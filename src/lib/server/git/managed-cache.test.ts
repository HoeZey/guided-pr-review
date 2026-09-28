import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { FileChange } from "../../shared/contracts/guide.ts";
import type { CredentialSource } from "../auth/ports.ts";
import { createManagedGitCache, gitCachePath } from "./managed-cache.ts";
import { parseUnifiedDiff } from "./parse-unified.ts";
import { createGitProcessRunner } from "./process.ts";
import type { GitCacheFs, GitCacheIdentity, GitProcessResult, GitProcessRunner } from "./ports.ts";
import { GitOperationError } from "./ports.ts";

const github: GitCacheIdentity = {
  provider: "github",
  host: "GitHub.com",
  repositoryId: "42",
};

test("derives one cache path from provider, host, and repository id", () => {
  const a = gitCachePath("/data", github);
  const b = gitCachePath("/data", { ...github, host: "github.com" });
  const ado = gitCachePath("/data", {
    provider: "azure-devops",
    host: "dev.azure.com",
    repositoryId: "42",
  });
  const other = gitCachePath("/data", { ...github, repositoryId: "../escape" });
  assert.equal(a, b);
  assert.notEqual(a, ado);
  assert.notEqual(a, other);
  assert.match(a, /\/data\/git-caches\/github\//);
  assert.equal(a.includes(".."), false);
  assert.equal(other.includes(".."), false);
});

test("parses a three-dot unified diff into FileChange hunks and binary stubs", () => {
  const files = parseUnifiedDiff(`diff --git a/src/maps.py b/src/maps.py
index 1111111..2222222 100644
--- a/src/maps.py
+++ b/src/maps.py
@@ -1,4 +1,5 @@
 keep
 also keep
-maps = list_maps(model.workflow_id)
+maps = list_maps(snapshot.workflow_id)
+extra = "<script>x</script>"
diff --git a/logo.png b/logo.png
index 3333333..4444444 100644
Binary files a/logo.png and b/logo.png differ
`);
  const parsed = files.map((file) => FileChange.parse(file));
  assert.deepEqual(parsed, [
    {
      path: "src/maps.py",
      language: "python",
      additions: 2,
      deletions: 1,
      hunks: [
        {
          header: "@@ -1,4 +1,5 @@",
          oldStart: 1,
          newStart: 1,
          lines: [
            { type: "context", content: "keep", oldLine: 1, newLine: 1 },
            { type: "context", content: "also keep", oldLine: 2, newLine: 2 },
            {
              type: "removed",
              content: "maps = list_maps(model.workflow_id)",
              oldLine: 3,
            },
            {
              type: "added",
              content: "maps = list_maps(snapshot.workflow_id)",
              newLine: 3,
            },
            { type: "added", content: 'extra = "<script>x</script>"', newLine: 4 },
          ],
        },
      ],
    },
    { path: "logo.png", stub: true, reason: "binary" },
  ]);
});

const unusedCredentials: CredentialSource = {
  getAccessToken: async () => {
    throw new Error("local fixture remotes must not request credentials");
  },
};

test("a repository with no local clone yields a complete parsed Diff from exact commits", async () => {
  const root = await mkdtemp(join(tmpdir(), "gpr-07-05-"));
  const fixture = await makeFixtureRemote(join(root, "remote"));
  const dataDir = join(root, "data");
  const identity: GitCacheIdentity = {
    provider: "github",
    host: "github.com",
    repositoryId: "maps",
  };
  const recorded = recordingRunner(createGitProcessRunner());
  const git = createManagedGitCache({
    dataDir,
    runner: recorded,
    credentials: unusedCredentials,
  });

  await git.ensureBare(identity);
  await git.fetchCommits(identity, [fixture.source, fixture.target], {
    cloneUrl: fixture.remote,
  });
  const files = await git.unifiedThreeDot({
    identity,
    sourceCommit: fixture.source,
    targetCommit: fixture.target,
  });
  const parsed = files.map((file) => FileChange.parse(file));
  const maps = parsed.find((file) => file.path === "src/maps.py");
  assert.ok(maps);
  assert.equal(maps.language, "python");
  assert.equal(maps.stub, undefined);
  const lines = (maps.hunks || []).flatMap((hunk) => hunk.lines);
  assert.ok(lines.some((line) => line.type === "removed" && line.content.includes("model.workflow_id")));
  assert.ok(lines.some((line) => line.type === "added" && line.content.includes("snapshot.workflow_id")));
  assert.ok(lines.some((line) => line.type === "added" && line.content.includes("extra =")));

  const cache = gitCachePath(dataDir, identity);
  const bare = await runGit(["rev-parse", "--is-bare-repository"], cache);
  assert.equal(bare.stdout.trim(), "true");
  assert.notEqual(cache, fixture.remote);
  assert.equal(
    recorded.argvLog.some((argv) =>
      argv.some((arg) => /^(checkout|switch|restore|worktree|submodule|lfs|clone)$/.test(arg)),
    ),
    false,
  );
});

const TOKEN = "gho_FIXTURE_TOKEN_abcdef1234567890";
const SHA_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SHA_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const noopFs: GitCacheFs = {
  mkdirp: async () => undefined,
  rmrf: async () => undefined,
  exists: async () => false,
};

test("concurrent fetches for one cache serialize while different caches stay independent", async () => {
  const inflight = { one: 0, two: 0 };
  let peakOne = 0;
  let peakAll = 0;
  const runner = delayGit(40, inflight, (next) => {
    peakOne = Math.max(peakOne, next.one);
    peakAll = Math.max(peakAll, next.one + next.two);
  });
  const git = createManagedGitCache({
    dataDir: "/data",
    runner,
    credentials: unusedCredentials,
    fs: noopFs,
  });
  const a: GitCacheIdentity = { provider: "github", host: "github.com", repositoryId: "one" };
  const b: GitCacheIdentity = { provider: "github", host: "github.com", repositoryId: "two" };
  await Promise.all([
    git.fetchCommits(a, [SHA_A], { cloneUrl: "/remotes/one.git" }),
    git.fetchCommits(a, [SHA_B], { cloneUrl: "/remotes/one.git" }),
    git.fetchCommits(b, [SHA_A], { cloneUrl: "/remotes/two.git" }),
  ]);
  assert.equal(peakOne, 1);
  assert.ok(peakAll >= 2);
});

test("token is absent from process arguments, logs, git config, and disk", async () => {
  const root = await mkdtemp(join(tmpdir(), "gpr-07-05-token-"));
  const dataDir = join(root, "data");
  const identity: GitCacheIdentity = {
    provider: "github",
    host: "github.com",
    repositoryId: "secret",
  };
  const fake = statefulGit();
  const wrapped = recordingRunner(fake);
  const credentials: CredentialSource = {
    async getAccessToken() {
      return {
        status: "connected",
        identity: { provider: "github", host: "github.com", login: "octocat" },
        token: TOKEN,
      };
    },
  };
  const git = createManagedGitCache({ dataDir, runner: wrapped, credentials });
  await git.fetchCommits(identity, [SHA_A, SHA_B], {
    cloneUrl: "https://github.com/octocat/maps.git",
  });
  const dumped = JSON.stringify({ argv: wrapped.argvLog, env: wrapped.envLog.map(publicEnv) });
  assert.equal(dumped.includes(TOKEN), false);
  assert.equal(
    wrapped.argvLog.some((argv) => argv.some((arg) => arg.includes(TOKEN))),
    false,
  );
  assert.ok(wrapped.envLog.some((env) => env?.GIT_ASKPASS));
  assert.ok(wrapped.envLog.some((env) => env?.GUIDED_PR_REVIEW_GIT_ASKPASS_TOKEN === TOKEN));
  assert.equal(
    wrapped.argvLog.some((argv) => argv.some((arg) => /extraheader|credential\.helper/i.test(arg))),
    false,
  );
  assert.ok(wrapped.argvLog.some((argv) => argv.includes("fetch")));
  const onDisk = await readTree(dataDir);
  assert.equal(onDisk.includes(TOKEN), false);
});

test("corrupt managed cache recovers without changing other caches", async () => {
  const root = await mkdtemp(join(tmpdir(), "gpr-07-05-corrupt-"));
  const fixture = await makeFixtureRemote(join(root, "remote"));
  const dataDir = join(root, "data");
  const good: GitCacheIdentity = { provider: "github", host: "github.com", repositoryId: "good" };
  const bad: GitCacheIdentity = { provider: "github", host: "github.com", repositoryId: "bad" };
  const git = createManagedGitCache({
    dataDir,
    runner: createGitProcessRunner(),
    credentials: unusedCredentials,
  });
  await git.fetchCommits(good, [fixture.source, fixture.target], { cloneUrl: fixture.remote });
  await git.fetchCommits(bad, [fixture.source, fixture.target], { cloneUrl: fixture.remote });
  const goodCache = gitCachePath(dataDir, good);
  const badCache = gitCachePath(dataDir, bad);
  const goodHead = await readFile(join(goodCache, "HEAD"), "utf8");
  await writeFile(join(badCache, "HEAD"), "not a git repository\n");
  await writeFile(join(badCache, "config"), "broken\n");
  await writeFile(join(badCache, "objects/pack/corrupt.pack"), "garbage");
  await git.fetchCommits(bad, [fixture.source, fixture.target], { cloneUrl: fixture.remote });
  const recovered = await runGit(["rev-parse", "--is-bare-repository"], badCache);
  assert.equal(recovered.stdout.trim(), "true");
  assert.equal(await readFile(join(goodCache, "HEAD"), "utf8"), goodHead);
  const files = await git.unifiedThreeDot({
    identity: bad,
    sourceCommit: fixture.source,
    targetCommit: fixture.target,
  });
  assert.ok(files.some((file) => file.path === "src/maps.py"));
});

test("logCommits returns oldest-first sha subject and body for target..source", async () => {
  const root = await mkdtemp(join(tmpdir(), "gpr-10-02-log-"));
  const fixture = await makeIntentFixtureRemote(join(root, "remote"));
  const dataDir = join(root, "data");
  const identity: GitCacheIdentity = {
    provider: "github",
    host: "github.com",
    repositoryId: "intent",
  };
  const recorded = recordingRunner(createGitProcessRunner());
  const git = createManagedGitCache({
    dataDir,
    runner: recorded,
    credentials: unusedCredentials,
  });
  await git.fetchCommits(identity, [fixture.source, fixture.target], {
    cloneUrl: fixture.remote,
  });
  const commits = await git.logCommits({
    identity,
    sourceCommit: fixture.source,
    targetCommit: fixture.target,
  });
  assert.deepEqual(
    commits.map((row) => ({ sha: row.sha, subject: row.subject, body: row.body })),
    [
      { sha: fixture.mid, subject: "mid change", body: "middle body" },
      { sha: fixture.source, subject: "feature tip", body: "tip body\nmore detail" },
    ],
  );
  assert.ok(
    recorded.argvLog.some(
      (argv) =>
        argv.includes("log") &&
        argv.includes("--reverse") &&
        argv.some((arg) => arg.includes(`${fixture.target}..${fixture.source}`)),
    ),
  );
});

async function makeIntentFixtureRemote(dir: string): Promise<{
  remote: string;
  source: string;
  target: string;
  mid: string;
}> {
  const work = join(dir, "work");
  const remote = join(dir, "remote.git");
  await mkdir(join(work, "src"), { recursive: true });
  await writeFile(join(work, "src/maps.py"), "one\n");
  await runGit(["init"], work);
  await runGit(["add", "src/maps.py"], work);
  await runGit(["commit", "-m", "base"], work);
  const target = (await runGit(["rev-parse", "HEAD"], work)).stdout.trim();
  await writeFile(join(work, "src/maps.py"), "two\n");
  await runGit(["add", "src/maps.py"], work);
  await runGit(["commit", "-m", "mid change", "-m", "middle body"], work);
  const mid = (await runGit(["rev-parse", "HEAD"], work)).stdout.trim();
  await writeFile(join(work, "src/maps.py"), "three\n");
  await runGit(["add", "src/maps.py"], work);
  await runGit(["commit", "-m", "feature tip", "-m", "tip body\nmore detail"], work);
  const source = (await runGit(["rev-parse", "HEAD"], work)).stdout.trim();
  await runGit(["clone", "--bare", work, remote], dir);
  return { remote, source, target, mid };
}

test("unchanged available commits skip fetch", async () => {
  const fake = statefulGit({ present: [SHA_A, SHA_B] });
  const recorded = recordingRunner(fake);
  const git = createManagedGitCache({
    dataDir: "/data",
    runner: recorded,
    credentials: unusedCredentials,
    fs: noopFs,
  });
  await git.fetchCommits(
    { provider: "github", host: "github.com", repositoryId: "maps" },
    [SHA_A, SHA_B],
    { cloneUrl: "/remotes/maps.git" },
  );
  assert.equal(
    recorded.argvLog.some((argv) => argv.includes("fetch")),
    false,
  );
});

test("empty diff, missing commit, and fetch failure are distinct errors", async () => {
  const root = await mkdtemp(join(tmpdir(), "gpr-07-05-err-"));
  const fixture = await makeFixtureRemote(join(root, "remote"));
  const dataDir = join(root, "data");
  const identity: GitCacheIdentity = {
    provider: "github",
    host: "github.com",
    repositoryId: "err",
  };
  const git = createManagedGitCache({
    dataDir,
    runner: createGitProcessRunner(),
    credentials: unusedCredentials,
  });
  await git.fetchCommits(identity, [fixture.source, fixture.target], { cloneUrl: fixture.remote });
  await assert.rejects(
    () => git.unifiedThreeDot({ identity, sourceCommit: fixture.source, targetCommit: fixture.source }),
    (err: unknown) => err instanceof GitOperationError && err.kind === "empty-diff",
  );
  const missing = "cccccccccccccccccccccccccccccccccccccccc";
  await assert.rejects(
    () => git.fetchCommits(identity, [missing], { cloneUrl: fixture.remote }),
    (err: unknown) => err instanceof GitOperationError && (err.kind === "missing-commit" || err.kind === "fetch-failure"),
  );
  await assert.rejects(
    () => git.fetchCommits(identity, [SHA_A], { cloneUrl: join(root, "no-such-remote.git") }),
    (err: unknown) => err instanceof GitOperationError && err.kind === "fetch-failure",
  );
});

async function makeFixtureRemote(dir: string): Promise<{
  remote: string;
  source: string;
  target: string;
}> {
  const work = join(dir, "work");
  const remote = join(dir, "remote.git");
  await mkdir(join(work, "src"), { recursive: true });
  await writeFile(
    join(work, "src/maps.py"),
    "keep\nalso keep\nmaps = list_maps(model.workflow_id)\ndone\n",
  );
  await runGit(["init"], work);
  await runGit(["add", "src/maps.py"], work);
  await runGit(["commit", "-m", "base"], work);
  const target = (await runGit(["rev-parse", "HEAD"], work)).stdout.trim();
  await writeFile(
    join(work, "src/maps.py"),
    'keep\nalso keep\nmaps = list_maps(snapshot.workflow_id)\nextra = "<script>x</script>"\ndone\n',
  );
  await runGit(["add", "src/maps.py"], work);
  await runGit(["commit", "-m", "feature"], work);
  const source = (await runGit(["rev-parse", "HEAD"], work)).stdout.trim();
  await runGit(["clone", "--bare", work, remote], dir);
  return { remote, source, target };
}

function recordingRunner(inner: GitProcessRunner): GitProcessRunner & {
  argvLog: string[][];
  envLog: Array<Readonly<Record<string, string>> | undefined>;
} {
  const argvLog: string[][] = [];
  const envLog: Array<Readonly<Record<string, string>> | undefined> = [];
  return {
    argvLog,
    envLog,
    async run(request) {
      argvLog.push([...request.argv]);
      envLog.push(request.env);
      return inner.run(request);
    },
  };
}

function ok(stdout = ""): GitProcessResult {
  return { code: 0, stdout, stderr: "", timedOut: false, commandMissing: false };
}

function gitVerb(argv: readonly string[]): string {
  const args = argv[0] === "git" ? argv.slice(1) : argv;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-c") {
      i += 1;
      continue;
    }
    if (!args[i].startsWith("-")) return args[i];
  }
  return "";
}

function statefulGit(options: { present?: string[] } = {}): GitProcessRunner {
  const present = new Set((options.present ?? []).map((sha) => sha.toLowerCase()));
  const bares = new Set<string>();
  return {
    async run(request) {
      const cwd = request.cwd ?? "";
      const verb = gitVerb(request.argv);
      if (verb === "rev-parse") {
        return bares.has(cwd) ? ok("true\n") : { ...ok(""), code: 128, stderr: "not a git repository" };
      }
      if (verb === "init") {
        const path = request.argv[request.argv.length - 1];
        if (path && path !== "init") bares.add(path);
        return ok();
      }
      if (verb === "cat-file") {
        const spec = request.argv.find((arg) => /^[0-9a-f]{40}/i.test(arg)) ?? "";
        const sha = spec.slice(0, 40).toLowerCase();
        return present.has(sha) ? ok() : { ...ok(""), code: 1 };
      }
      if (verb === "fetch") {
        for (const arg of request.argv) {
          const sha = arg.split(":")[0];
          if (/^[0-9a-f]{40}$/i.test(sha)) present.add(sha.toLowerCase());
        }
        return ok();
      }
      return ok();
    },
  };
}

function delayGit(
  ms: number,
  inflight: { one: number; two: number },
  observe: (next: { one: number; two: number }) => void,
): GitProcessRunner {
  const inner = statefulGit();
  return {
    async run(request) {
      const cwd = request.cwd ?? "";
      const name: "one" | "two" | undefined = cwd.endsWith("two.git")
        ? "two"
        : cwd.endsWith("one.git")
          ? "one"
          : undefined;
      if (name) {
        inflight[name] += 1;
        observe({ ...inflight });
      }
      await new Promise((resolve) => setTimeout(resolve, ms));
      try {
        return await inner.run(request);
      } finally {
        if (name) inflight[name] -= 1;
      }
    },
  };
}

function publicEnv(env: Readonly<Record<string, string>> | undefined): Record<string, string> | undefined {
  if (!env) return env;
  const { GUIDED_PR_REVIEW_GIT_ASKPASS_TOKEN: _token, ...rest } = env;
  return rest;
}

async function readTree(root: string): Promise<string> {
  const chunks: string[] = [];
  async function walk(dir: string): Promise<void> {
    let entries: string[];
    try {
      entries = await readdir(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const path = join(dir, name);
      chunks.push(name);
      try {
        chunks.push(await readFile(path, "utf8"));
      } catch {
        await walk(path);
      }
    }
  }
  await walk(root);
  return chunks.join("\n");
}

function runGit(argv: string[], cwd: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", argv, {
      cwd,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "fixture",
        GIT_AUTHOR_EMAIL: "fixture@example.com",
        GIT_COMMITTER_NAME: "fixture",
        GIT_COMMITTER_EMAIL: "fixture@example.com",
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_TERMINAL_PROMPT: "0",
      },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout, stderr, code }));
  });
}
