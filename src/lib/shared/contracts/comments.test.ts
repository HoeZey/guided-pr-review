import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ClientOperationId,
  CommentAnchor,
  CommentMessage,
  CommentThread,
  CreateThreadRequest,
  ReplyRequest,
} from "./comments.ts";

const AUTHOR = { login: "octocat" };
const WHEN = "2026-09-16T10:00:00.000Z";

function message(overrides: Record<string, unknown> = {}) {
  return {
    id: "cmt_1",
    author: AUTHOR,
    body: "looks off",
    createdAt: WHEN,
    updatedAt: WHEN,
    ownedByCurrentUser: true,
    ...overrides,
  };
}

test("parses line, range, file, PR-wide, and stale anchors and rejects provider fields", () => {
  const line = CommentAnchor.parse({
    kind: "line",
    path: "src/a.ts",
    side: "current",
    line: 12,
  });
  const range = CommentAnchor.parse({
    kind: "range",
    path: "src/a.ts",
    side: "current",
    startLine: 12,
    endLine: 14,
  });
  const file = CommentAnchor.parse({ kind: "file", path: "src/a.ts" });
  const pr = CommentAnchor.parse({ kind: "pr" });
  const stale = CommentAnchor.parse({
    kind: "stale",
    reason: "unmappable",
    path: "src/gone.ts",
  });

  assert.equal(line.kind, "line");
  assert.equal(range.kind, "range");
  assert.equal(file.kind, "file");
  assert.equal(pr.kind, "pr");
  assert.equal(stale.kind, "stale");
  if (stale.kind === "stale") assert.equal("line" in stale, false);

  assert.throws(() =>
    CommentAnchor.parse({
      kind: "line",
      path: "src/a.ts",
      side: "current",
      line: 12,
      changeTrackingId: 9,
    }),
  );
  assert.throws(() =>
    CommentAnchor.parse({
      kind: "range",
      path: "src/a.ts",
      side: "current",
      startLine: 14,
      endLine: 12,
    }),
  );
  assert.throws(() => CommentAnchor.parse({ kind: "line", path: "src/a.ts", side: "left", line: 1 }));
  assert.throws(() =>
    CommentAnchor.parse({ kind: "stale", reason: "unmappable", path: "src/a.ts", line: 4 }),
  );
  assert.throws(() => CommentAnchor.parse({ kind: "pr", webUrl: "https://github.com/octocat/Hello-World/pull/1" }));
});

test("thread and message contracts stay provider-payload free", () => {
  const thread = CommentThread.parse({
    id: "thr_1",
    provider: "azure-devops",
    status: "active",
    outdated: false,
    anchor: { kind: "file", path: "src/a.ts" },
    messages: [
      message(),
      message({
        id: "cmt_2",
        ownedByCurrentUser: false,
        deleted: true,
        author: { login: "other" },
      }),
    ],
  });
  assert.equal(thread.provider, "azure-devops");
  assert.equal(thread.messages[1]?.deleted, true);

  CommentThread.parse({
    ...thread,
    id: "thr_gh",
    provider: "github",
    anchor: { kind: "pr" },
  });

  assert.throws(() =>
    CommentThread.parse({
      ...thread,
      pullRequestThreadId: 88,
    }),
  );
  assert.throws(() =>
    CommentMessage.parse({
      ...message(),
      node_id: "PRRC_kwDO",
    }),
  );
});

test("client operation id is cop_ plus 32 hex and cannot name a provider resource", () => {
  const id = ClientOperationId.parse("cop_0123456789abcdef0123456789abcdef");
  assert.equal(id, "cop_0123456789abcdef0123456789abcdef");

  for (const value of [
    "thr_1",
    "cmt_1",
    "1",
    "cop_short",
    "cop_0123456789ABCDEF0123456789abcdef",
    "https://dev.azure.com/_apis/git/repositories/r/pullRequests/1/threads/2",
    "/repos/octocat/Hello-World/pulls/1/comments/9",
  ]) {
    assert.throws(() => ClientOperationId.parse(value), Error, value);
  }
});

test("create and reply requests accept only anchor, body, and client operation id", () => {
  CreateThreadRequest.parse({
    anchor: { kind: "line", path: "src/a.ts", side: "current", line: 2 },
    body: "please rename",
    clientOperationId: "cop_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  });
  ReplyRequest.parse({
    body: "agreed",
    clientOperationId: "cop_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  });

  assert.throws(() =>
    CreateThreadRequest.parse({
      anchor: { kind: "file", path: "src/a.ts" },
      body: "x",
      clientOperationId: "cop_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      provider: "github",
      host: "github.com",
      repository: { id: "1296269" },
      number: 42,
      webUrl: "https://github.com/octocat/Hello-World/pull/42",
    }),
  );
});
