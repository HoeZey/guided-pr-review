import { afterEach, expect, test, vi } from "vitest";
import type { CommentThread } from "$lib/shared/contracts/comments";
import { resetThreadSession, threadSession } from "./threads.svelte";
import {
  cancelComposer,
  composerSession,
  openCreateComposer,
  openLineComposer,
  openReplyComposer,
  resetComposerSession,
  submitComposer,
  typeComposer,
} from "./composer.svelte";

const COP = "cop_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const COP_REPLY = "cop_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const WHEN = "2026-09-16T12:00:00.000Z";
const LINE = { kind: "line" as const, path: "src/a.ts", side: "current" as const, line: 11 };

function createdThread(id = "ado_thr_new_1"): CommentThread {
  return {
    id,
    provider: "azure-devops",
    status: "active",
    outdated: false,
    anchor: LINE,
    messages: [
      {
        id: `${id}-m0`,
        author: { login: "ada" },
        body: "please rename",
        createdAt: WHEN,
        updatedAt: WHEN,
        ownedByCurrentUser: true,
      },
    ],
  };
}

afterEach(() => {
  resetComposerSession();
  resetThreadSession();
});

test("create and reply replace pending with the provider result and keep one draft through send failure and retry", async () => {
  openCreateComposer("r1", LINE);
  typeComposer("please rename");
  const created = createdThread();
  const createThread = vi.fn(async () => created);
  await submitComposer({ createThread, mint: () => COP });
  expect(createThread).toHaveBeenCalledWith(
    "r1",
    { anchor: LINE, body: "please rename", clientOperationId: COP },
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
  expect(threadSession.threads.map((row) => row.id)).toEqual(["ado_thr_new_1"]);
  expect(composerSession.target).toBeNull();

  openCreateComposer("r1", LINE);
  typeComposer("please rename");
  await submitComposer({ createThread: async () => created, mint: () => COP });
  expect(threadSession.threads.map((row) => row.id)).toEqual(["ado_thr_new_1"]);

  threadSession.threads = [created];
  openReplyComposer("r1", created.id);
  typeComposer("also here");
  const reply = {
    id: "ado_cmt_reply",
    author: { login: "ada" },
    body: "also here",
    createdAt: WHEN,
    updatedAt: WHEN,
    ownedByCurrentUser: true,
  };
  const replyFn = vi.fn(async () => reply);
  await submitComposer({ reply: replyFn, mint: () => COP_REPLY });
  expect(replyFn).toHaveBeenCalledWith(
    "r1",
    created.id,
    { body: "also here", clientOperationId: COP_REPLY },
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
  expect(threadSession.threads[0]?.messages.map((row) => row.id)).toEqual(["ado_thr_new_1-m0", "ado_cmt_reply"]);

  openCreateComposer("r1", LINE);
  typeComposer("keep me");
  const err = Object.assign(new Error("git host identity is not connected"), { code: "auth" });
  await submitComposer({
    createThread: async () => {
      throw err;
    },
    mint: () => COP,
  });
  expect(composerSession.delivery).toMatchObject({
    state: "failed",
    content: "keep me",
    clientOperationId: COP,
    errorCode: "auth",
  });
  const retried = vi.fn(async () => createdThread("ado_thr_retry"));
  await submitComposer({ createThread: retried });
  expect(retried.mock.calls[0]?.[1]).toMatchObject({ clientOperationId: COP });
  expect(threadSession.threads.some((row) => row.id === "ado_thr_retry")).toBe(true);
});

test("cancel aborts only the current request so Retry can send again", async () => {
  openCreateComposer("r1", LINE);
  typeComposer("please rename");
  let signal: AbortSignal | undefined;
  const createThread = vi.fn((reviewId: string, input: unknown, init?: { signal?: AbortSignal }) => {
    signal = init?.signal;
    return new Promise<CommentThread>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => {
        reject(Object.assign(new Error("Aborted"), { name: "AbortError" }));
      });
    });
  });
  const first = submitComposer({ createThread, mint: () => COP });
  await vi.waitFor(() => {
    expect(composerSession.delivery.state).toBe("sending");
  });
  cancelComposer();
  await first.catch(() => undefined);
  expect(signal?.aborted).toBe(true);
  expect(composerSession.delivery.state).toBe("draft");
  expect(composerSession.delivery).toMatchObject({ content: "please rename" });

  const second = vi.fn(async (_id: string, _input: unknown, init?: { signal?: AbortSignal }) => {
    expect(init?.signal?.aborted).toBe(false);
    return createdThread();
  });
  await submitComposer({ createThread: second, mint: () => COP });
  expect(second).toHaveBeenCalledTimes(1);
  expect(threadSession.threads.map((row) => row.id)).toEqual(["ado_thr_new_1"]);
});

test("ambiguous retry lists and reconciles before resend for create and reply", async () => {
  openCreateComposer("r1", LINE);
  typeComposer("please rename");
  await submitComposer({
    createThread: async () => {
      throw Object.assign(new Error("git host is unavailable"), { code: "unavailable" });
    },
    mint: () => COP,
  });
  const existing = createdThread("gh_thr_hit");
  const createThread = vi.fn(async () => createdThread("should-not-create"));
  const list = vi.fn(async () => ({ threads: [existing] }));
  await submitComposer({
    createThread,
    list,
    now: Date.parse("2026-09-16T12:01:00.000Z"),
    byOperationId: (id) => (id === COP ? { threadId: "gh_thr_hit", commentId: "gh_thr_hit-m0" } : undefined),
  });
  expect(list).toHaveBeenCalledWith("r1");
  expect(createThread).not.toHaveBeenCalled();
  expect(threadSession.threads.map((row) => row.id)).toEqual(["gh_thr_hit"]);
  expect(composerSession.target).toBeNull();

  threadSession.threads = [existing];
  openReplyComposer("r1", existing.id);
  typeComposer("also here");
  await submitComposer({
    reply: async () => {
      throw Object.assign(new Error("network"), { code: "network" });
    },
    mint: () => COP_REPLY,
  });
  const withReply = {
    ...existing,
    messages: [
      ...existing.messages,
      {
        id: "gh_cmt_reply",
        author: { login: "ada" },
        body: "also here",
        createdAt: WHEN,
        updatedAt: WHEN,
        ownedByCurrentUser: true,
      },
    ],
  };
  const reply = vi.fn(async () => withReply.messages[1]!);
  await submitComposer({
    reply,
    list: async () => ({ threads: [withReply] }),
    now: Date.parse("2026-09-16T12:01:00.000Z"),
  });
  expect(reply).not.toHaveBeenCalled();
  expect(threadSession.threads[0]?.messages.map((row) => row.id)).toEqual(["gh_thr_hit-m0", "gh_cmt_reply"]);
});

test("reopening the same line, file, or reply after a failed send keeps the operation id and still lists before resend", async () => {
  const existing = createdThread("gh_thr_hit");
  const now = Date.parse("2026-09-16T12:01:00.000Z");

  openCreateComposer("r1", LINE);
  typeComposer("please rename");
  await submitComposer({
    createThread: async () => {
      throw Object.assign(new Error("git host is unavailable"), { code: "unavailable" });
    },
    mint: () => COP,
  });
  openLineComposer("r1", "src/a.ts", 11, false);
  expect(composerSession.delivery).toMatchObject({
    state: "failed",
    content: "please rename",
    clientOperationId: COP,
    errorCode: "unavailable",
  });
  const createAfterClick = vi.fn(async () => createdThread("should-not-create"));
  const listAfterClick = vi.fn(async () => ({ threads: [existing] }));
  await submitComposer({
    createThread: createAfterClick,
    list: listAfterClick,
    now,
    mint: () => COP_REPLY,
    byOperationId: (id) => (id === COP ? { threadId: "gh_thr_hit", commentId: "gh_thr_hit-m0" } : undefined),
  });
  expect(listAfterClick).toHaveBeenCalledWith("r1");
  expect(createAfterClick).not.toHaveBeenCalled();

  resetComposerSession();
  resetThreadSession();
  const fileAnchor = { kind: "file" as const, path: "src/a.ts" };
  const fileHit = createdThread("gh_thr_file");
  fileHit.anchor = fileAnchor;
  openCreateComposer("r1", fileAnchor);
  typeComposer("file note");
  await submitComposer({
    createThread: async () => {
      throw Object.assign(new Error("git host is unavailable"), { code: "unavailable" });
    },
    mint: () => COP,
  });
  openCreateComposer("r1", fileAnchor);
  expect(composerSession.delivery).toMatchObject({ state: "failed", clientOperationId: COP });
  const createAfterFile = vi.fn(async () => createdThread("should-not-create"));
  const listAfterFile = vi.fn(async () => ({ threads: [fileHit] }));
  await submitComposer({
    createThread: createAfterFile,
    list: listAfterFile,
    now,
    mint: () => COP_REPLY,
    byOperationId: (id) => (id === COP ? { threadId: "gh_thr_file", commentId: "gh_thr_file-m0" } : undefined),
  });
  expect(listAfterFile).toHaveBeenCalledWith("r1");
  expect(createAfterFile).not.toHaveBeenCalled();

  resetComposerSession();
  resetThreadSession();
  threadSession.threads = [existing];
  openReplyComposer("r1", existing.id);
  typeComposer("also here");
  await submitComposer({
    reply: async () => {
      throw Object.assign(new Error("network"), { code: "network" });
    },
    mint: () => COP_REPLY,
  });
  openReplyComposer("r1", existing.id);
  expect(composerSession.delivery).toMatchObject({ state: "failed", clientOperationId: COP_REPLY });
  const withReply = {
    ...existing,
    messages: [
      ...existing.messages,
      {
        id: "gh_cmt_reply",
        author: { login: "ada" },
        body: "also here",
        createdAt: WHEN,
        updatedAt: WHEN,
        ownedByCurrentUser: true,
      },
    ],
  };
  const replyAfterOpen = vi.fn(async () => withReply.messages[1]!);
  const listAfterReply = vi.fn(async () => ({ threads: [withReply] }));
  await submitComposer({
    reply: replyAfterOpen,
    list: listAfterReply,
    now,
    mint: () => COP,
  });
  expect(listAfterReply).toHaveBeenCalledWith("r1");
  expect(replyAfterOpen).not.toHaveBeenCalled();
});

test("line click builds current-side line or range anchors on one composer", () => {
  openLineComposer("r1", "src/a.ts", 11, false);
  expect(composerSession.target).toEqual({ kind: "create", anchor: LINE });
  openLineComposer("r1", "src/a.ts", 13, true);
  expect(composerSession.target).toEqual({
    kind: "create",
    anchor: { kind: "range", path: "src/a.ts", side: "current", startLine: 11, endLine: 13 },
  });
  typeComposer("range note");
  openLineComposer("r1", "src/a.ts", 12, false);
  expect(composerSession.target).toEqual({
    kind: "create",
    anchor: { kind: "line", path: "src/a.ts", side: "current", line: 12 },
  });
  expect(composerSession.delivery).toMatchObject({ state: "draft", content: "range note" });
});
