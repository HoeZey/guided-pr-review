import type { CommentMessage, CommentThread } from "$lib/shared/contracts/comments";
import { commentsApi } from "../browser/comments";

export const THREAD_LIST_STALE_MS = 60_000;

export type ThreadLoadReason = "open" | "focus" | "retry";

type ThreadListFn = (reviewId: string) => Promise<{ threads: CommentThread[] }>;

type CommentMutateFns = {
  update?: (
    reviewId: string,
    threadId: string,
    commentId: string,
    input: { body: string },
  ) => Promise<CommentMessage>;
  delete?: (reviewId: string, threadId: string, commentId: string) => Promise<{ ok: true }>;
};

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

export function upsertThread(thread: CommentThread): void {
  const index = threadSession.threads.findIndex((row) => row.id === thread.id);
  if (index < 0) {
    threadSession.threads = [...threadSession.threads, thread];
    return;
  }
  const next = threadSession.threads.slice();
  next[index] = thread;
  threadSession.threads = next;
}

export function appendReply(threadId: string, message: CommentThread["messages"][number]): void {
  threadSession.threads = threadSession.threads.map((thread) => {
    if (thread.id !== threadId) return thread;
    if (thread.messages.some((row) => row.id === message.id)) return thread;
    return { ...thread, messages: [...thread.messages, message] };
  });
}

function ownedMessage(threadId: string, commentId: string): CommentMessage | undefined {
  const thread = threadSession.threads.find((row) => row.id === threadId);
  const message = thread?.messages.find((row) => row.id === commentId);
  if (!message || !message.ownedByCurrentUser || message.deleted) return undefined;
  return message;
}

function cloneThreads(): CommentThread[] {
  return threadSession.threads.map((thread) => ({
    ...thread,
    messages: thread.messages.map((row) => ({ ...row })),
  }));
}

function replaceThreads(next: CommentThread[]): void {
  threadSession.threads = next;
}

function mapMessage(
  threadId: string,
  commentId: string,
  fn: (message: CommentMessage) => CommentMessage | null,
): void {
  threadSession.threads = threadSession.threads.flatMap((thread) => {
    if (thread.id !== threadId) return [thread];
    const messages = thread.messages.flatMap((row) => {
      if (row.id !== commentId) return [row];
      const next = fn(row);
      return next ? [next] : [];
    });
    if (messages.length === 0) return [];
    return [{ ...thread, messages }];
  });
}

export async function updateOwnedComment(
  threadId: string,
  commentId: string,
  body: string,
  opts: CommentMutateFns = {},
): Promise<void> {
  const reviewId = threadSession.reviewId;
  if (!reviewId || !ownedMessage(threadId, commentId)) return;
  const snapshot = cloneThreads();
  mapMessage(threadId, commentId, (message) => ({ ...message, body }));
  try {
    const update = opts.update ?? commentsApi.update;
    const message = await update(reviewId, threadId, commentId, { body });
    mapMessage(threadId, commentId, () => message);
  } catch (err) {
    replaceThreads(snapshot);
    throw err;
  }
}

export async function deleteOwnedComment(
  threadId: string,
  commentId: string,
  opts: CommentMutateFns = {},
): Promise<void> {
  const reviewId = threadSession.reviewId;
  const thread = threadSession.threads.find((row) => row.id === threadId);
  if (!reviewId || !thread || !ownedMessage(threadId, commentId)) return;
  const snapshot = cloneThreads();
  if (thread.provider === "github") {
    mapMessage(threadId, commentId, () => null);
  } else {
    mapMessage(threadId, commentId, (message) => ({ ...message, deleted: true }));
  }
  try {
    const remove = opts.delete ?? commentsApi.delete;
    await remove(reviewId, threadId, commentId);
  } catch (err) {
    replaceThreads(snapshot);
    throw err;
  }
}
