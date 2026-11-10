import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { StoredAction } from "../../shared/contracts/catalog.ts";
import type { GuideV1 } from "../../shared/contracts/guide.ts";
import type { ReviewDiff } from "../../shared/contracts/persistence.ts";
import {
  addReview,
  getReview,
  jsonRepositories,
  resetJsonStoreCache,
  upsertReview,
} from "../repositories/json/store.ts";
import { createAppServices } from "../services/app.ts";
import type { AppServices } from "../services/app.ts";
import { createMcpHandler } from "./handler.ts";

function unused(name: string) {
  return async () => {
    throw new Error(`unexpected ${name}`);
  };
}

const listed = {
  reviews: [],
  activeId: null,
  repositories: [],
  catalog: [],
  actions: [] as StoredAction[],
  agentConnected: false,
};

const SHA_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SHA_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const sampleGuide: GuideV1 = {
  version: 1,
  title: "Fix thing",
  base: SHA_A,
  head: SHA_B,
  unchaptered: true,
  chapters: [
    {
      id: "core",
      kind: "core",
      title: "Core",
      why: "Why.",
      files: [{ path: "a.py", stub: true, reason: "placeholder" }],
    },
  ],
};

const sampleDiff: ReviewDiff = {
  sourceCommit: SHA_B,
  targetCommit: SHA_A,
  files: [
    {
      path: "src/a.ts",
      hunks: [
        {
          header: "@@ -10,2 +10,3 @@",
          lines: [
            { type: "context", content: "def foo():" },
            { type: "removed", content: "    x = 1" },
            { type: "added", content: "    x = 2" },
          ],
        },
        {
          header: "@@ -40,1 +41,2 @@",
          lines: [
            { type: "context", content: "def bar():" },
            { type: "added", content: "    y = 3" },
          ],
        },
      ],
    },
  ],
};

function fakeServices(overrides: {
  list?: AppServices["reviews"]["list"];
  get?: AppServices["reviews"]["get"];
  openPullRequest?: AppServices["reviews"]["openPullRequest"];
  addLocalReview?: AppServices["reviews"]["addLocalReview"];
  publish?: AppServices["outcomes"]["publish"];
}): AppServices {
  return {
    reviews: {
      list: overrides.list ?? unused("list"),
      get: overrides.get ?? unused("get"),
      add: unused("add"),
      addFromTool: unused("addFromTool"),
      upsert: unused("upsert"),
      upsertFromTool: unused("upsertFromTool"),
      remove: unused("remove"),
      setActive: unused("setActive"),
      chapterReview: unused("chapterReview"),
      seedIfEmpty: unused("seedIfEmpty"),
      openDiff: unused("openDiff"),
      updateDiff: unused("updateDiff"),
      openPullRequest: overrides.openPullRequest ?? unused("openPullRequest"),
      addLocalReview: overrides.addLocalReview ?? unused("addLocalReview"),
      readHead: unused("readHead"),
    },
    catalog: { replace: unused("replace") },
    catalogRefresh: { refresh: unused("catalogRefresh") },
    actions: {
      queue: unused("queue"),
      wait: unused("wait"),
      complete: unused("complete"),
    },
    outcomes: { publish: overrides.publish ?? unused("publish") },
    connections: {
      list: unused("connections.list"),
      retry: unused("connections.retry"),
    },
    repositories: {
      list: unused("repositories.list"),
      add: unused("repositories.add"),
      remove: unused("repositories.remove"),
      search: unused("repositories.search"),
    },
    comments: {
      list: unused("comments.list"),
      createThread: unused("comments.createThread"),
      reply: unused("comments.reply"),
      update: unused("comments.update"),
      delete: unused("comments.delete"),
    },
  };
}

test("MCP tools/list offers open_pull_request and add_local_review, not full-guide writes", async () => {
  const { handleMcpJson } = createMcpHandler(fakeServices({ list: async () => listed }));
  const listedRpc = await handleMcpJson({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
  });
  const tools = (
    listedRpc as { result: { tools: { name: string }[] } }
  ).result.tools.map((tool) => tool.name);
  assert.ok(tools.includes("list_reviews"));
  assert.ok(tools.includes("get_review"));
  assert.ok(tools.includes("read_diff"));
  assert.ok(tools.includes("chapter_review"));
  assert.ok(tools.includes("open_pull_request"));
  assert.ok(tools.includes("add_local_review"));
  assert.equal(tools.includes("add_review"), false);
  assert.equal(tools.includes("upsert_review"), false);
  assert.equal(tools.includes("queue_action"), false);
  assert.equal(tools.includes("wait_for_action"), false);
  assert.equal(tools.includes("complete_action"), false);
});

test("MCP tools/call list_reviews uses the injected review service", async () => {
  const { handleMcpJson } = createMcpHandler(
    fakeServices({
      list: async () => listed,
    }),
  );
  const listedRpc = await handleMcpJson({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "list_reviews", arguments: {} },
  });
  assert.deepEqual(
    (listedRpc as { result: { structuredContent: unknown } }).result.structuredContent,
    listed,
  );
});

test("MCP tools/call rejects retired action queue tools", async () => {
  const { handleMcpJson } = createMcpHandler(fakeServices({ list: async () => listed }));
  for (const name of ["queue_action", "wait_for_action", "complete_action"] as const) {
    const rpc = await handleMcpJson({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name, arguments: {} },
    });
    assert.equal((rpc as { error?: { code: number } }).error?.code, -32601);
  }
});

test("MCP tools/call read_diff returns numbered plain text through the handler", async () => {
  const { handleMcpJson } = createMcpHandler(
    fakeServices({
      get: async (id) => {
        assert.equal(id, "rev-1");
        return { guide: sampleGuide, outcomes: [], diff: sampleDiff };
      },
    }),
  );
  const rpc = await handleMcpJson({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "read_diff", arguments: { id: "rev-1" } },
  });
  const text = (rpc as { result: { content: { type: string; text: string }[] } }).result
    .content[0].text;
  assert.equal(
    text,
    [
      "id: rev-1",
      `sourceCommit: ${SHA_B}`,
      "title: Fix thing",
      "",
      "== src/a.ts (modified)",
      "@@ -10,2 +10,3 @@",
      "  def foo():",
      "1 -    x = 1",
      "2 +    x = 2",
      "@@ -40,1 +41,2 @@",
      "  def bar():",
      "3 +    y = 3",
    ].join("\n"),
  );
  assert.equal(
    (rpc as { result: { structuredContent?: unknown } }).result.structuredContent,
    undefined,
  );
});

test("MCP tools/call read_diff prints intent when present and errors when missing", async () => {
  const withIntent: ReviewDiff = {
    ...sampleDiff,
    intent: {
      description: "PR body",
      commits: [{ sha: "c1", subject: "Do it", body: "details" }],
    },
  };
  const { handleMcpJson } = createMcpHandler(
    fakeServices({
      get: async (id) => {
        if (id === "missing") {
          throw Object.assign(new Error("unknown review missing"), { status: 404 });
        }
        if (id === "no-diff") {
          return { guide: sampleGuide, outcomes: [] };
        }
        return { guide: sampleGuide, outcomes: [], diff: withIntent };
      },
    }),
  );

  const printed = await handleMcpJson({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: { name: "read_diff", arguments: { id: "rev-1" } },
  });
  const text = (printed as { result: { content: { text: string }[] } }).result.content[0]
    .text;
  assert.ok(text.includes("PR body"));
  assert.ok(text.includes("Do it"));
  assert.ok(text.includes("  details"));

  const unknown = await handleMcpJson({
    jsonrpc: "2.0",
    id: 5,
    method: "tools/call",
    params: { name: "read_diff", arguments: { id: "missing" } },
  });
  assert.equal((unknown as { error?: { code: number; message: string } }).error?.code, 404);
  assert.match(
    (unknown as { error: { message: string } }).error.message,
    /unknown review missing/,
  );

  const noDiff = await handleMcpJson({
    jsonrpc: "2.0",
    id: 6,
    method: "tools/call",
    params: { name: "read_diff", arguments: { id: "no-diff" } },
  });
  assert.equal((noDiff as { error?: { code: number; message: string } }).error?.code, 409);
  assert.match(
    (noDiff as { error: { message: string } }).error.message,
    /refresh first/,
  );
});

async function withStore(fn: () => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "gpr-10-04-"));
  const prev = process.env.GUIDED_PR_REVIEW_DATA;
  process.env.GUIDED_PR_REVIEW_DATA = dir;
  resetJsonStoreCache();
  try {
    await fn();
  } finally {
    resetJsonStoreCache();
    if (prev === undefined) delete process.env.GUIDED_PR_REVIEW_DATA;
    else process.env.GUIDED_PR_REVIEW_DATA = prev;
    await rm(dir, { recursive: true, force: true });
  }
}

test("MCP chapter_review through the real store splits a hunk, rejects gaps and stale commits, and keeps the review id", async () => {
  await withStore(async () => {
    const { handleMcpJson } = createMcpHandler(createAppServices(jsonRepositories));
    const seeded = await upsertReview({
      guide: {
        ...sampleGuide,
        source: {
          kind: "pull-request",
          provider: "github",
          host: "github.com",
          repository: {
            id: "1",
            owner: "o",
            name: "r",
            webUrl: "https://github.com/o/r",
          },
          number: 1,
          webUrl: "https://github.com/o/r/pull/1",
          sourceRef: "refs/heads/feature",
          targetRef: "refs/heads/main",
          sourceCommit: SHA_B,
          targetCommit: SHA_A,
          providerContext: { kind: "github" },
        },
      },
      diff: {
        sourceCommit: SHA_B,
        targetCommit: SHA_A,
        files: [
          {
            path: "src/a.ts",
            hunks: [
              {
                header: "@@ -10,7 +10,7 @@ def foo",
                oldStart: 10,
                newStart: 10,
                lines: [
                  { type: "context", content: "c0", oldLine: 10, newLine: 10 },
                  { type: "context", content: "c1", oldLine: 11, newLine: 11 },
                  { type: "context", content: "c2", oldLine: 12, newLine: 12 },
                  { type: "context", content: "c3", oldLine: 13, newLine: 13 },
                  { type: "context", content: "c4", oldLine: 14, newLine: 14 },
                  { type: "removed", content: "old", oldLine: 15 },
                  { type: "added", content: "new", newLine: 15 },
                  { type: "context", content: "d0", oldLine: 16, newLine: 16 },
                  { type: "context", content: "d1", oldLine: 17, newLine: 17 },
                  { type: "context", content: "d2", oldLine: 18, newLine: 18 },
                  { type: "context", content: "d3", oldLine: 19, newLine: 19 },
                  { type: "context", content: "d4", oldLine: 20, newLine: 20 },
                ],
              },
            ],
          },
        ],
      },
    });

    const gap = await handleMcpJson({
      jsonrpc: "2.0",
      id: 10,
      method: "tools/call",
      params: {
        name: "chapter_review",
        arguments: {
          id: seeded.id,
          sourceCommit: SHA_B,
          chapters: [
            { title: "Only one", why: "Gap.", refs: [{ path: "src/a.ts", from: 1, to: 1 }] },
          ],
        },
      },
    });
    assert.equal((gap as { error?: { code: number } }).error?.code, 400);
    assert.deepEqual(JSON.parse((gap as { error: { message: string } }).error.message), {
      missing: { "src/a.ts": [[2, 2]] },
      duplicated: {},
      unknownPaths: [],
      partialStubs: [],
    });
    const afterGap = await getReview(seeded.id);
    assert.equal(afterGap.guide.unchaptered, true);

    const stale = await handleMcpJson({
      jsonrpc: "2.0",
      id: 11,
      method: "tools/call",
      params: {
        name: "chapter_review",
        arguments: {
          id: seeded.id,
          sourceCommit: SHA_A,
          chapters: [
            { title: "All", why: "Stale.", refs: [{ path: "src/a.ts" }] },
          ],
        },
      },
    });
    assert.equal((stale as { error?: { code: number } }).error?.code, 409);
    assert.match(
      (stale as { error: { message: string } }).error.message,
      new RegExp(SHA_B),
    );

    const ok = await handleMcpJson({
      jsonrpc: "2.0",
      id: 12,
      method: "tools/call",
      params: {
        name: "chapter_review",
        arguments: {
          id: seeded.id,
          sourceCommit: SHA_B.toUpperCase(),
          chapters: [
            { title: "First", why: "Why one.", refs: [{ path: "src/a.ts", from: 1, to: 1 }] },
            { title: "Second", why: "Why two.", refs: [{ path: "src/a.ts", from: 2, to: 2 }] },
          ],
        },
      },
    });
    assert.deepEqual(
      (ok as { result: { structuredContent: unknown } }).result.structuredContent,
      { id: seeded.id },
    );
    const saved = await getReview(seeded.id);
    assert.equal(saved.guide.unchaptered, undefined);
    assert.equal(saved.guide.chapters[0].open, true);
    assert.equal(saved.guide.chapters[0].kind, undefined);
    assert.equal(saved.guide.chapters.length, 2);
    assert.equal(saved.guide.source?.sourceCommit, SHA_B);
    assert.equal(saved.diff?.sourceCommit, SHA_B);
    assert.equal(saved.guide.chapters[0].files[0].hunks![0].header, "@@ -12,4 +12,3 @@ def foo");
    assert.equal(saved.guide.chapters[1].files[0].hunks![0].header, "@@ -16,3 +15,4 @@ def foo");

    const noDiffId = await addReview(sampleGuide);
    const missingDiff = await handleMcpJson({
      jsonrpc: "2.0",
      id: 13,
      method: "tools/call",
      params: {
        name: "chapter_review",
        arguments: {
          id: noDiffId.id,
          sourceCommit: SHA_B,
          chapters: [{ title: "X", why: "Y", refs: [{ path: "src/a.ts" }] }],
        },
      },
    });
    assert.equal((missingDiff as { error?: { code: number } }).error?.code, 409);
  });
});

test("MCP tools/call open_pull_request and add_local_review use the review service", async () => {
  const { handleMcpJson } = createMcpHandler(
    fakeServices({
      openPullRequest: async (url) => {
        assert.equal(url, "https://github.com/octocat/Hello-World/pull/42");
        return { id: "pr-1", chaptered: false, behind: false };
      },
      addLocalReview: async (input) => {
        assert.deepEqual(input, {
          repoPath: "/tmp/repo",
          base: "main",
          head: "feature",
          title: "Local",
        });
        return { id: "local-1" };
      },
    }),
  );

  const opened = await handleMcpJson({
    jsonrpc: "2.0",
    id: 7,
    method: "tools/call",
    params: {
      name: "open_pull_request",
      arguments: { url: "https://github.com/octocat/Hello-World/pull/42" },
    },
  });
  assert.deepEqual(
    (opened as { result: { structuredContent: unknown } }).result.structuredContent,
    { id: "pr-1", chaptered: false, behind: false },
  );

  const local = await handleMcpJson({
    jsonrpc: "2.0",
    id: 8,
    method: "tools/call",
    params: {
      name: "add_local_review",
      arguments: {
        repoPath: "/tmp/repo",
        base: "main",
        head: "feature",
        title: "Local",
      },
    },
  });
  assert.deepEqual(
    (local as { result: { structuredContent: unknown } }).result.structuredContent,
    { id: "local-1" },
  );

  for (const name of ["add_review", "upsert_review"] as const) {
    const rpc = await handleMcpJson({
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: { name, arguments: { guide: sampleGuide } },
    });
    assert.equal((rpc as { error?: { code: number } }).error?.code, -32601);
  }
});
