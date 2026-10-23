import assert from "node:assert/strict";
import { test } from "node:test";
import type { CommentThread, CreateCommentAnchor } from "../contracts/comments.ts";
import { ClientOperationId } from "../contracts/comments.ts";
import {
  isAmbiguousFailure,
  matchingRecentCreate,
  matchingRecentReply,
  mintClientOperationId,
  nextDelivery,
  type Delivery,
} from "./comment-delivery.ts";

const COP = "cop_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const COP_OTHER = "cop_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const WHEN = "2026-09-16T12:00:00.000Z";
const LINE: CreateCommentAnchor = {
  kind: "line",
  path: "src/a.ts",
  side: "current",
  line: 11,
};

function thread(
  id: string,
  body: string,
  anchor: CommentThread["anchor"] = LINE,
  createdAt = WHEN,
): CommentThread {
  return {
    id,
    provider: "github",
    status: "active",
    outdated: false,
    anchor,
    messages: [
      {
        id: `${id}-m0`,
        author: { login: "ada" },
        body,
        createdAt,
        updatedAt: createdAt,
        ownedByCurrentUser: true,
      },
    ],
  };
}

test("nextDelivery keeps content through send, success, failed, retry, and cancel", () => {
  assert.equal(ClientOperationId.safeParse(mintClientOperationId()).success, true);
  const draft: Delivery = { state: "draft", content: "please rename" };
  const typed = nextDelivery(draft, { type: "type", content: "please rename it" });
  assert.deepEqual(typed, { state: "draft", content: "please rename it" });

  const sending = nextDelivery(typed, { type: "send", clientOperationId: COP });
  assert.deepEqual(sending, {
    state: "sending",
    content: "please rename it",
    clientOperationId: COP,
  });
  assert.deepEqual(nextDelivery(sending, { type: "type", content: "ignored" }), sending);

  assert.deepEqual(nextDelivery(sending, { type: "success", threadId: "t1", commentId: "c1" }), {
    state: "succeeded",
    content: "please rename it",
    threadId: "t1",
    commentId: "c1",
  });

  const failed = nextDelivery(sending, {
    type: "failure",
    error: "git host is unavailable",
    errorCode: "unavailable",
  });
  assert.deepEqual(failed, {
    state: "failed",
    content: "please rename it",
    clientOperationId: COP,
    error: "git host is unavailable",
    errorCode: "unavailable",
  });

  const retried = nextDelivery(failed, { type: "retry" });
  assert.deepEqual(retried, {
    state: "sending",
    content: "please rename it",
    clientOperationId: COP,
  });
  const retriedWithNew = nextDelivery(failed, { type: "send", clientOperationId: COP_OTHER });
  assert.deepEqual(retriedWithNew, retried);

  assert.deepEqual(nextDelivery(sending, { type: "cancel" }), {
    state: "draft",
    content: "please rename it",
  });
  assert.deepEqual(nextDelivery(failed, { type: "cancel" }), {
    state: "draft",
    content: "please rename it",
  });
});

test("ambiguous create/reply matches clientOperationId then content, anchor, and time; never a wrong row", () => {
  assert.equal(isAmbiguousFailure("network"), true);
  assert.equal(isAmbiguousFailure("unavailable"), true);
  assert.equal(isAmbiguousFailure("auth"), false);
  assert.equal(isAmbiguousFailure("denied"), false);
  assert.equal(isAmbiguousFailure(null), false);

  const listed = [
    thread("gh_thr_other", "please rename", { kind: "line", path: "src/a.ts", side: "current", line: 12 }),
    thread("gh_thr_hit", "please rename", LINE),
  ];
  const now = Date.parse("2026-09-16T12:01:00.000Z");
  const pending = { content: "please rename", anchor: LINE, clientOperationId: COP };

  assert.equal(
    matchingRecentCreate(listed, pending, now, {
      byOperationId: (id) => (id === COP ? { threadId: "gh_thr_hit", commentId: "gh_thr_hit-m0" } : undefined),
    })?.id,
    "gh_thr_hit",
  );
  assert.equal(matchingRecentCreate(listed, pending, now)?.id, "gh_thr_hit");
  assert.equal(
    matchingRecentCreate(
      listed,
      { ...pending, content: "different" },
      now,
    ),
    undefined,
  );
  assert.equal(
    matchingRecentCreate(listed, pending, Date.parse("2026-09-16T13:00:00.000Z")),
    undefined,
  );

  const parent = thread("ado_thr_line", "root");
  parent.messages.push({
    id: "ado_cmt_reply",
    author: { login: "ada" },
    body: "also here",
    createdAt: WHEN,
    updatedAt: WHEN,
    ownedByCurrentUser: true,
  });
  assert.equal(
    matchingRecentReply([parent], { threadId: "ado_thr_line", content: "also here", clientOperationId: COP }, now, {
      byOperationId: (id) =>
        id === COP ? { threadId: "ado_thr_line", commentId: "ado_cmt_reply" } : undefined,
    })?.id,
    "ado_cmt_reply",
  );
  assert.equal(
    matchingRecentReply([parent], { threadId: "ado_thr_line", content: "also here", clientOperationId: COP }, now)?.id,
    "ado_cmt_reply",
  );
  assert.equal(
    matchingRecentReply(
      [parent],
      { threadId: "ado_thr_line", content: "root", clientOperationId: COP_OTHER },
      now,
    ),
    undefined,
  );
});
