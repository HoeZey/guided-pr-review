import { afterEach, expect, test, vi } from "vitest";
import type { CommentThread } from "$lib/shared/contracts/comments";
import {
  THREAD_LIST_STALE_MS,
  loadReviewThreads,
  resetThreadSession,
  retryReviewThreads,
  threadSession,
} from "./threads.svelte";

const WHEN = "2026-09-16T10:00:00.000Z";

function thread(id: string): CommentThread {
  return {
    id,
    provider: "github",
    status: "active",
    outdated: false,
    anchor: { kind: "file", path: "src/a.ts" },
    messages: [
      {
        id: `${id}-m`,
        author: { login: "ada" },
        body: "note",
        createdAt: WHEN,
        updatedAt: WHEN,
        ownedByCurrentUser: true,
      },
    ],
  };
}

afterEach(() => {
  resetThreadSession();
});

test("hosted open and stale focus fetch once; fresh focus and unhosted do not; retry always lists", async () => {
  const list = vi.fn(async () => ({ threads: [thread("t1")] }));
  const t0 = Date.parse("2026-09-16T12:00:00.000Z");

  await loadReviewThreads({ reviewId: "r1", hosted: false, reason: "open", now: t0, list });
  expect(list).not.toHaveBeenCalled();
  expect(threadSession.threads).toEqual([]);

  await loadReviewThreads({ reviewId: "r1", hosted: true, reason: "open", now: t0, list });
  expect(list).toHaveBeenCalledTimes(1);
  expect(list).toHaveBeenCalledWith("r1");
  expect(threadSession.threads.map((row) => row.id)).toEqual(["t1"]);
  expect(threadSession.error).toBeNull();

  await loadReviewThreads({ reviewId: "r1", hosted: true, reason: "focus", now: t0 + 1_000, list });
  expect(list).toHaveBeenCalledTimes(1);

  await loadReviewThreads({
    reviewId: "r1",
    hosted: true,
    reason: "focus",
    now: t0 + THREAD_LIST_STALE_MS,
    list,
  });
  expect(list).toHaveBeenCalledTimes(2);

  await loadReviewThreads({
    reviewId: "r1",
    hosted: true,
    reason: "retry",
    now: t0 + THREAD_LIST_STALE_MS + 1,
    list,
  });
  expect(list).toHaveBeenCalledTimes(3);
});

test("failed list keeps the review readable and Retry refetches", async () => {
  const list = vi
    .fn()
    .mockRejectedValueOnce(new Error("git host is unavailable"))
    .mockResolvedValueOnce({ threads: [thread("t2")] });
  const t0 = Date.parse("2026-09-16T12:00:00.000Z");

  await loadReviewThreads({ reviewId: "r1", hosted: true, reason: "open", now: t0, list });
  expect(threadSession.threads).toEqual([]);
  expect(threadSession.error).toBe("git host is unavailable");
  expect(threadSession.loading).toBe(false);

  await loadReviewThreads({ reviewId: "r1", hosted: true, reason: "focus", now: t0 + 1_000, list });
  expect(list).toHaveBeenCalledTimes(1);

  await retryReviewThreads({ now: t0 + 1_000, list });
  expect(list).toHaveBeenCalledTimes(2);
  expect(threadSession.threads.map((row) => row.id)).toEqual(["t2"]);
  expect(threadSession.error).toBeNull();
});
