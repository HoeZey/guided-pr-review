import assert from "node:assert/strict";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { test } from "node:test";
import { numberDiff, printNumberedDiff } from "../../shared/domain/numbered-diff.ts";
import type { ProviderPullRequestReader, ProviderRepositoryReader } from "../providers/ports.ts";
import { createGitProcessRunner } from "../git/process.ts";
import { createMcpHandler } from "../mcp/handler.ts";
import type { AppRepositories } from "../repositories/ports.ts";
import { createAppServices } from "./app.ts";
import { createReviewService } from "./reviews.ts";

function unused(name: string) {
  return async () => {
    throw new Error(`unexpected ${name}`);
  };
}

function run(cwd: string, args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn("git", args, { cwd, env: { ...process.env, GIT_CONFIG_NOSYSTEM: "1" } });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

async function tempRepo(): Promise<{
  path: string;
  base: string;
  head: string;
  cleanup: () => Promise<void>;
}> {
  const path = await mkdtemp(join(tmpdir(), "local-review-"));
  const git = (args: string[]) => run(path, args);
  assert.equal((await git(["init"])).code, 0);
  assert.equal((await git(["config", "user.email", "test@example.com"])).code, 0);
  assert.equal((await git(["config", "user.name", "Test"])).code, 0);
  await writeFile(join(path, "readme.txt"), "one\n");
  assert.equal((await git(["add", "readme.txt"])).code, 0);
  assert.equal((await git(["commit", "-m", "base commit"])).code, 0);
  const base = (await git(["rev-parse", "HEAD"])).stdout.trim();
  await writeFile(join(path, "readme.txt"), "one\ntwo\n");
  assert.equal((await git(["add", "readme.txt"])).code, 0);
  assert.equal((await git(["commit", "-m", "head subject\n\nbody line"])).code, 0);
  const head = (await git(["rev-parse", "HEAD"])).stdout.trim();
  return {
    path,
    base,
    head,
    cleanup: async () => {
      await rm(path, { recursive: true, force: true });
    },
  };
}

function memoryRepos(): AppRepositories & {
  byId: Map<string, { guide: unknown; diff?: unknown }>;
} {
  const byId = new Map<string, { guide: unknown; diff?: unknown }>();
  return {
    byId,
    listReviews: async () => ({
      reviews: [],
      activeId: null,
      repositories: [],
      catalog: [],
      actions: [],
      agentConnected: false,
    }),
    getReview: async (id) => {
      const row = byId.get(id);
      if (!row) throw Object.assign(new Error(`unknown review ${id}`), { status: 404 });
      return row as never;
    },
    addReview: async (input) => {
      const id = `local-${byId.size + 1}`;
      const body =
        input && typeof input === "object" && "guide" in input
          ? (input as { guide: unknown; diff?: unknown })
          : { guide: input };
      byId.set(id, { guide: body.guide, ...(body.diff !== undefined ? { diff: body.diff } : {}) });
      return { id };
    },
    addReviewFromTool: unused("addReviewFromTool"),
    upsertReview: unused("upsertReview"),
    upsertReviewFromTool: unused("upsertReviewFromTool"),
    removeReview: unused("removeReview"),
    setActive: unused("setActive"),
    seedIfEmpty: unused("seedIfEmpty"),
    replaceCatalog: unused("replaceCatalog"),
    queueAction: unused("queueAction"),
    waitForAction: unused("waitForAction"),
    completeAction: unused("completeAction"),
    publishReviewOutcome: unused("publishReviewOutcome"),
  };
}

const emptyReader: ProviderPullRequestReader & ProviderRepositoryReader = {
  listPullRequests: unused("listPullRequests") as never,
  getPullRequest: unused("getPullRequest") as never,
  getRepository: unused("getRepository") as never,
};

test("addLocalReview on a temporary repository saves a numbered diff with intent commits", async () => {
  const repo = await tempRepo();
  try {
    const store = memoryRepos();
    const reviews = createReviewService(store, {
      readers: { ado: emptyReader, github: emptyReader },
      repositoryReaders: { ado: emptyReader, github: emptyReader },
      listConfigured: async () => [],
      git: {
        ensureBare: unused("ensureBare"),
        fetchCommits: unused("fetchCommits"),
        unifiedThreeDot: unused("unifiedThreeDot"),
        logCommits: unused("logCommits"),
      },
      processRunner: createGitProcessRunner(),
    });
    const { id } = await reviews.addLocalReview({
      repoPath: repo.path,
      base: repo.base,
      head: repo.head,
    });
    const got = await reviews.get(id);
    assert.equal(got.guide.unchaptered, true);
    assert.equal(got.guide.title, "head subject");
    assert.equal(got.guide.source, undefined);
    assert.equal(got.diff?.sourceCommit, repo.head);
    assert.equal(got.diff?.targetCommit, repo.base);
    assert.equal(got.diff?.intent?.description, undefined);
    assert.equal(got.diff?.intent?.commits.length, 1);
    assert.equal(got.diff?.intent?.commits[0]?.subject, "head subject");
    assert.equal(got.diff?.intent?.commits[0]?.body, "body line");
    assert.ok(got.diff);
    const text = printNumberedDiff({
      id,
      sourceCommit: got.diff.sourceCommit,
      title: got.guide.title,
      intent: got.diff.intent,
      files: numberDiff(got.diff.files),
    });
    assert.match(text, /1 \+two/);
    assert.match(text, /head subject/);
  } finally {
    await repo.cleanup();
  }
});

test("addLocalReview rejects a non-repository path, unknown commit, and empty diff", async () => {
  const repo = await tempRepo();
  const emptyDir = await mkdtemp(join(tmpdir(), "not-git-"));
  try {
    const store = memoryRepos();
    const reviews = createReviewService(store, {
      readers: { ado: emptyReader, github: emptyReader },
      repositoryReaders: { ado: emptyReader, github: emptyReader },
      listConfigured: async () => [],
      git: {
        ensureBare: unused("ensureBare"),
        fetchCommits: unused("fetchCommits"),
        unifiedThreeDot: unused("unifiedThreeDot"),
        logCommits: unused("logCommits"),
      },
      processRunner: createGitProcessRunner(),
    });
    await assert.rejects(
      () =>
        reviews.addLocalReview({
          repoPath: emptyDir,
          base: "HEAD",
          head: "HEAD",
        }),
      (err: Error & { status?: number }) =>
        err.status === 400 && /not a git work tree/.test(err.message),
    );
    await assert.rejects(
      () =>
        reviews.addLocalReview({
          repoPath: repo.path,
          base: repo.base,
          head: "deadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
        }),
      (err: Error & { status?: number }) => err.status === 400 && /unknown commit/.test(err.message),
    );
    await assert.rejects(
      () =>
        reviews.addLocalReview({
          repoPath: repo.path,
          base: repo.head,
          head: repo.head,
        }),
      (err: Error & { status?: number }) => err.status === 400 && /empty diff/.test(err.message),
    );
  } finally {
    await repo.cleanup();
    await rm(emptyDir, { recursive: true, force: true });
  }
});

test("production path: MCP add_local_review through createAppServices and the real git runner", async () => {
  const repo = await tempRepo();
  try {
    const store = memoryRepos();
    const services = createAppServices(store, {
      readers: { ado: emptyReader, github: emptyReader },
      processRunner: createGitProcessRunner(),
      git: {
        ensureBare: unused("ensureBare"),
        fetchCommits: unused("fetchCommits"),
        unifiedThreeDot: unused("unifiedThreeDot"),
        logCommits: unused("logCommits"),
      },
    });
    const { handleMcpJson } = createMcpHandler(services);
    const rpc = await handleMcpJson({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "add_local_review",
        arguments: {
          repoPath: repo.path,
          base: repo.base,
          head: repo.head,
          title: "Custom title",
        },
      },
    });
    const result = (rpc as { result: { structuredContent: { id: string } } }).result
      .structuredContent;
    assert.ok(result.id);
    const got = await services.reviews.get(result.id);
    assert.equal(got.guide.title, "Custom title");
    assert.ok(got.diff?.files.length);
  } finally {
    await repo.cleanup();
  }
});
