import type { CommentThread } from "$lib/shared/contracts/comments";
import { commentsApi } from "../browser/comments";

export const THREAD_LIST_STALE_MS = 60_000;

export type ThreadLoadReason = "open" | "focus" | "retry";

type ThreadListFn = (reviewId: string) => Promise<{ threads: CommentThread[] }>;

type ThreadSession = {
  reviewId: string | null;
  hosted: boolean;
  threads: CommentThread[];
  loading: boolean;
  error: string | null;
  fetchedAt: number | null;
};

function emptySession(): ThreadSession {
  return {
    reviewId: null,
    hosted: false,
    threads: [],
    loading: false,
    error: null,
    fetchedAt: null,
  };
}

export const threadSession = $state<ThreadSession>(emptySession());

export function resetThreadSession(): void {
  const next = emptySession();
  threadSession.reviewId = next.reviewId;
  threadSession.hosted = next.hosted;
  threadSession.threads = next.threads;
  threadSession.loading = next.loading;
  threadSession.error = next.error;
  threadSession.fetchedAt = next.fetchedAt;
}

export async function loadReviewThreads(opts: {
  reviewId: string;
  hosted: boolean;
  reason: ThreadLoadReason;
  now?: number;
  list?: ThreadListFn;
}): Promise<void> {
  const now = opts.now ?? Date.now();
  const list = opts.list ?? ((reviewId) => commentsApi.list(reviewId));
  if (!opts.hosted) {
    threadSession.reviewId = opts.reviewId;
    threadSession.hosted = false;
    threadSession.threads = [];
    threadSession.loading = false;
    threadSession.error = null;
    threadSession.fetchedAt = null;
    return;
  }
  if (
    opts.reason === "focus" &&
    threadSession.reviewId === opts.reviewId &&
    threadSession.fetchedAt != null &&
    now - threadSession.fetchedAt < THREAD_LIST_STALE_MS
  ) {
    return;
  }
  threadSession.reviewId = opts.reviewId;
  threadSession.hosted = true;
  threadSession.loading = true;
  if (opts.reason === "retry") threadSession.error = null;
  try {
    const listed = await list(opts.reviewId);
    if (threadSession.reviewId !== opts.reviewId) return;
    threadSession.threads = listed.threads;
    threadSession.error = null;
    threadSession.fetchedAt = now;
  } catch (err) {
    if (threadSession.reviewId !== opts.reviewId) return;
    threadSession.error = err instanceof Error ? err.message : String(err);
    threadSession.fetchedAt = now;
  } finally {
    if (threadSession.reviewId === opts.reviewId) threadSession.loading = false;
  }
}

export async function retryReviewThreads(opts: {
  now?: number;
  list?: ThreadListFn;
} = {}): Promise<void> {
  if (!threadSession.reviewId || !threadSession.hosted) return;
  await loadReviewThreads({
    reviewId: threadSession.reviewId,
    hosted: true,
    reason: "retry",
    now: opts.now,
    list: opts.list,
  });
}
