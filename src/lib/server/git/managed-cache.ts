import { mkdir, rm, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { CredentialSource } from "../auth/ports.ts";
import { parseUnifiedDiff } from "./parse-unified.ts";
import { GIT_MAX_OUTPUT_BYTES, GIT_TIMEOUT_MS } from "./process.ts";
import type {
  GitCacheFs,
  GitCacheIdentity,
  GitDiff,
  GitProcessResult,
  GitProcessRunner,
  ManagedGitCache,
} from "./ports.ts";
import { GitOperationError } from "./ports.ts";

const COMMIT_SHA = /^[0-9a-f]{40}$/i;
const FORBIDDEN = /^(checkout|switch|restore|worktree|submodule|lfs|clone)$/;
const ASKPASS = fileURLToPath(new URL("./askpass.mjs", import.meta.url));

export function gitCachePath(dataDir: string, identity: GitCacheIdentity): string {
  return join(
    dataDir,
    "git-caches",
    identity.provider,
    encodeSegment(identity.host),
    `${encodeSegment(identity.repositoryId)}.git`,
  );
}

export function createNodeGitCacheFs(): GitCacheFs {
  return {
    mkdirp: async (path) => {
      await mkdir(path, { recursive: true });
    },
    rmrf: async (path) => {
      await rm(path, { recursive: true, force: true });
    },
    exists: async (path) => {
      try {
        await stat(path);
        return true;
      } catch (err) {
        if ((err as NodeJS.ErrnoException).code === "ENOENT") return false;
        throw err;
      }
    },
  };
}

export function createManagedGitCache(options: {
  dataDir: string;
  runner: GitProcessRunner;
  credentials: CredentialSource;
  fs?: GitCacheFs;
}): ManagedGitCache & GitDiff {
  const fs = options.fs ?? createNodeGitCacheFs();
  // ponytail: one in-process lock per cache path. Fine for a single Node. File lock if writers multiply.
  const locks = new Map<string, Promise<void>>();
  const cacheRoot = resolve(join(options.dataDir, "git-caches"));

  const git = (
    identity: GitCacheIdentity,
    args: readonly string[],
    cwd: string,
    env?: Readonly<Record<string, string>>,
  ) => {
    const sub = args.find((arg) => !arg.startsWith("-"));
    if (sub && FORBIDDEN.test(sub)) {
      return Promise.reject(new GitOperationError("fetch-failure", identity, "forbidden git command"));
    }
    return options.runner.run({
      argv: [
        "git",
        "-c",
        "core.hooksPath=/dev/null",
        "-c",
        "fetch.recurseSubmodules=false",
        "-c",
        "lfs.fetchexclude=*",
        ...args,
      ],
      cwd,
      env,
      timeoutMs: GIT_TIMEOUT_MS,
      maxOutputBytes: GIT_MAX_OUTPUT_BYTES,
    });
  };

  const withLock = async <T>(identity: GitCacheIdentity, fn: () => Promise<T>): Promise<T> => {
    const key = gitCachePath(options.dataDir, identity);
    const prev = locks.get(key) ?? Promise.resolve();
    const run = prev.then(fn, fn);
    locks.set(
      key,
      run.then(
        () => undefined,
        () => undefined,
      ),
    );
    return run;
  };

  function managedPath(identity: GitCacheIdentity): string {
    const cache = resolve(gitCachePath(options.dataDir, identity));
    if (cache !== cacheRoot && !cache.startsWith(`${cacheRoot}/`)) {
      throw new GitOperationError("corrupt", identity, "managed git cache path escaped app data");
    }
    return cache;
  }

  const ensureBare = (identity: GitCacheIdentity) =>
    withLock(identity, () => ensureBareUnlocked(identity));

  async function recreateUnlocked(identity: GitCacheIdentity): Promise<void> {
    const cache = managedPath(identity);
    if (await fs.exists(cache)) await fs.rmrf(cache);
    await fs.mkdirp(dirname(cache));
    const result = await git(identity, ["init", "--bare", cache], options.dataDir);
    if (result.commandMissing || result.timedOut || result.code !== 0) {
      throw new GitOperationError("corrupt", identity, "failed to initialize managed git cache");
    }
  }

  async function ensureBareUnlocked(identity: GitCacheIdentity): Promise<void> {
    const cache = managedPath(identity);
    if (await isBare(identity, cache)) return;
    await recreateUnlocked(identity);
  }

  async function isBare(identity: GitCacheIdentity, cache: string): Promise<boolean> {
    const result = await git(identity, ["rev-parse", "--is-bare-repository"], cache);
    return result.code === 0 && result.stdout.trim() === "true";
  }

  async function hasCommit(identity: GitCacheIdentity, cache: string, sha: string): Promise<boolean> {
    const result = await git(identity, ["cat-file", "-e", `${sha}^{commit}`], cache);
    return result.code === 0;
  }

  async function fetchMissing(
    identity: GitCacheIdentity,
    cache: string,
    cloneUrl: string,
    missing: string[],
    env: Readonly<Record<string, string>> | undefined,
  ): Promise<GitProcessResult> {
    return git(
      identity,
      [
        "fetch",
        "--no-tags",
        "--no-recurse-submodules",
        "--",
        stripUserinfo(cloneUrl),
        ...missing.map((sha) => `${sha}:refs/guided-pr-review/${sha}`),
      ],
      cache,
      env,
    );
  }

  async function authEnv(
    identity: GitCacheIdentity,
    cloneUrl: string,
  ): Promise<Readonly<Record<string, string>> | undefined> {
    if (!/^https?:\/\//i.test(cloneUrl)) return undefined;
    const cred = await options.credentials.getAccessToken({
      provider: identity.provider,
      host: identity.host,
    });
    if (cred.status !== "connected") {
      throw new GitOperationError("fetch-failure", identity, "git credentials unavailable");
    }
    return {
      GIT_ASKPASS: ASKPASS,
      GIT_TERMINAL_PROMPT: "0",
      GUIDED_PR_REVIEW_GIT_ASKPASS_TOKEN: cred.token,
      GUIDED_PR_REVIEW_GIT_USERNAME:
        identity.provider === "github" ? "x-access-token" : "unused",
    };
  }

  const fetchCommits = (
    identity: GitCacheIdentity,
    commits: readonly string[],
    fetchOptions?: { cloneUrl: string },
  ) =>
    withLock(identity, async () => {
      await ensureBareUnlocked(identity);
      const shas = commits.map(requireSha);
      const cache = managedPath(identity);
      const missing: string[] = [];
      for (const sha of shas) {
        if (!(await hasCommit(identity, cache, sha))) missing.push(sha);
      }
      if (missing.length === 0) return;
      const cloneUrl = fetchOptions?.cloneUrl;
      if (!cloneUrl) {
        throw new GitOperationError("fetch-failure", identity, "clone URL required to fetch commits");
      }
      const env = await authEnv(identity, cloneUrl);
      let result = await fetchMissing(identity, cache, cloneUrl, missing, env);
      if (isCorruptResult(result)) {
        await recreateUnlocked(identity);
        result = await fetchMissing(identity, managedPath(identity), cloneUrl, missing, env);
      }
      if (result.commandMissing || result.timedOut || result.code !== 0) {
        throw failFetch(identity, result);
      }
      for (const sha of missing) {
        if (!(await hasCommit(identity, cache, sha))) {
          throw new GitOperationError("missing-commit", identity, "commit is not in the managed cache");
        }
      }
    });

  const unifiedThreeDot: GitDiff["unifiedThreeDot"] = (input) =>
    withLock(input.identity, async () => {
      const source = requireSha(input.sourceCommit);
      const target = requireSha(input.targetCommit);
      const cache = managedPath(input.identity);
      if (!(await isBare(input.identity, cache))) {
        throw new GitOperationError("corrupt", input.identity, "managed git cache is not a bare repository");
      }
      for (const sha of [source, target]) {
        if (!(await hasCommit(input.identity, cache, sha))) {
          throw new GitOperationError("missing-commit", input.identity, "commit is not in the managed cache");
        }
      }
      const result = await git(
        input.identity,
        ["diff", "--no-color", "--no-ext-diff", "-U3", "-M", `${target}...${source}`],
        cache,
      );
      if (result.commandMissing || result.timedOut || result.code !== 0) {
        throw new GitOperationError("missing-commit", input.identity, "failed to compute three-dot diff");
      }
      if (!result.stdout.trim()) {
        throw new GitOperationError("empty-diff", input.identity, "three-dot diff is empty");
      }
      return parseUnifiedDiff(result.stdout);
    });

  return { ensureBare, fetchCommits, unifiedThreeDot };
}

function encodeSegment(value: string): string {
  return encodeURIComponent(value.toLowerCase()).replace(/\./g, "%2e");
}

function requireSha(value: string): string {
  if (!COMMIT_SHA.test(value)) throw new Error("exact commit SHA required");
  return value.toLowerCase();
}

function stripUserinfo(cloneUrl: string): string {
  try {
    const url = new URL(cloneUrl);
    if (url.protocol === "http:" || url.protocol === "https:") {
      url.username = "";
      url.password = "";
      return url.toString();
    }
  } catch {
    // Path remotes are not URLs.
  }
  return cloneUrl;
}

function isCorruptResult(result: GitProcessResult): boolean {
  const text = `${result.stderr}\n${result.stdout}`.toLowerCase();
  return text.includes("corrupt") || text.includes("not a git repository") || text.includes("bad config");
}

function failFetch(identity: GitCacheIdentity, result: GitProcessResult): GitOperationError {
  const text = `${result.stderr}\n${result.stdout}`.toLowerCase();
  if (isCorruptResult(result)) {
    return new GitOperationError("corrupt", identity, "managed git cache is corrupt");
  }
  if (text.includes("not found") || text.includes("couldn't find") || text.includes("unknown revision")) {
    return new GitOperationError("missing-commit", identity, "remote does not have the requested commit");
  }
  return new GitOperationError("fetch-failure", identity, "git fetch failed");
}
