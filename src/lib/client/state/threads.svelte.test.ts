import { afterEach, expect, test, vi } from "vitest";
import type { CommentThread } from "$lib/shared/contracts/comments";
import {
  THREAD_LIST_STALE_MS,
  deleteOwnedComment,
  loadReviewThreads,
  resetThreadSession,
  retryReviewThreads,
  threadSession,
  updateOwnedComment,
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

test("owned edit and delete share one thread collection; failure restores the original; foreign ids never mutate", async () => {
  const later = "2026-09-16T12:00:00.000Z";
  const ado = thread("ado_thr");
  ado.provider = "azure-devops";
  const github: CommentThread = {
    ...thread("gh_thr"),
    messages: [
      thread("gh_thr").messages[0]!,
      {
        id: "gh_thr-other",
        author: { login: "other-reviewer" },
        body: "reply",
        createdAt: WHEN,
        updatedAt: WHEN,
        ownedByCurrentUser: false,
      },
    ],
  };
  threadSession.reviewId = "r1";
  threadSession.hosted = true;
  threadSession.threads = [ado, github];

  const update = vi.fn();
  const remove = vi.fn();
  await updateOwnedComment("missing", "ado_thr-m", "forged", { update });
  await updateOwnedComment("gh_thr", "gh_thr-other", "forged", { update });
  await deleteOwnedComment("gh_thr", "gh_thr-other", { delete: remove });
  expect(update).not.toHaveBeenCalled();
  expect(remove).not.toHaveBeenCalled();
  expect(threadSession.threads[0]?.messages[0]?.body).toBe("note");
  expect(threadSession.threads[1]?.messages.map((row) => row.id)).toEqual(["gh_thr-m", "gh_thr-other"]);

  const renamed = {
    ...ado.messages[0]!,
    body: "renamed",
    updatedAt: later,
  };
  const updateOwned = vi.fn(async () => {
    expect(threadSession.threads[0]?.messages[0]?.body).toBe("renamed");
    return renamed;
  });
  await updateOwnedComment("ado_thr", "ado_thr-m", "renamed", { update: updateOwned });
  expect(updateOwned).toHaveBeenCalledWith("r1", "ado_thr", "ado_thr-m", { body: "renamed" });
  expect(threadSession.threads[0]?.messages[0]).toEqual(renamed);
  expect(threadSession.threads[1]?.messages[0]?.body).toBe("note");

  const denied = Object.assign(new Error("GitHub permission was denied"), { code: "denied" });
  const failUpdate = vi.fn(async () => {
    expect(threadSession.threads[1]?.messages[0]?.body).toBe("edited");
    throw denied;
  });
  await expect(updateOwnedComment("gh_thr", "gh_thr-m", "edited", { update: failUpdate })).rejects.toMatchObject({
    code: "denied",
  });
  expect(threadSession.threads[1]?.messages[0]?.body).toBe("note");
  expect(threadSession.threads[0]?.messages[0]?.body).toBe("renamed");

  const deleteGithub = vi.fn(async () => {
    expect(threadSession.threads[1]?.messages.map((row) => row.id)).toEqual(["gh_thr-m", "gh_thr-other"]);
    return { ok: true as const };
  });
  await deleteOwnedComment("gh_thr", "gh_thr-m", { delete: deleteGithub });
  expect(deleteGithub).toHaveBeenCalledWith("r1", "gh_thr", "gh_thr-m");
  expect(threadSession.threads[1]?.messages.map((row) => row.id)).toEqual(["gh_thr-other"]);

  const failDelete = vi.fn(async () => {
    expect(threadSession.threads[0]?.messages[0]?.deleted).toBeUndefined();
    throw denied;
  });
  await expect(deleteOwnedComment("ado_thr", "ado_thr-m", { delete: failDelete })).rejects.toMatchObject({
    code: "denied",
  });
  expect(threadSession.threads[0]?.messages[0]?.deleted).toBeUndefined();
  expect(threadSession.threads[0]?.messages[0]?.body).toBe("renamed");

  const deleteAdo = vi.fn(async () => ({ ok: true as const }));
  await deleteOwnedComment("ado_thr", "ado_thr-m", { delete: deleteAdo });
  expect(threadSession.threads[0]?.messages[0]?.deleted).toBe(true);
  expect(threadSession.threads[0]?.messages[0]?.body).toBe("renamed");

  threadSession.threads = [thread("solo")];
  await deleteOwnedComment("solo", "solo-m", { delete: async () => ({ ok: true as const }) });
  expect(threadSession.threads).toEqual([]);
});
