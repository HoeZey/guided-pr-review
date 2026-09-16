import type {
  CommentThread,
  CommentThreadList,
  CreateThreadRequest,
  ReplyRequest,
  UpdateCommentRequest,
} from "$lib/shared/contracts/comments";
import { fetchJson } from "./fetch";

export type CommentClient = {
  list: (reviewId: string) => Promise<CommentThreadList>;
  createThread: (reviewId: string, input: CreateThreadRequest) => Promise<CommentThread>;
  reply: (
    reviewId: string,
    threadId: string,
    input: ReplyRequest,
  ) => Promise<CommentThread["messages"][number]>;
  update: (
    reviewId: string,
    threadId: string,
    commentId: string,
    input: UpdateCommentRequest,
  ) => Promise<CommentThread["messages"][number]>;
  delete: (reviewId: string, threadId: string, commentId: string) => Promise<{ ok: true }>;
};

function commentsPath(reviewId: string, suffix = ""): string {
  return `/api/reviews/${encodeURIComponent(reviewId)}/comments${suffix}`;
}

function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

export const commentsApi: CommentClient = {
  list: (reviewId) => fetchJson(commentsPath(reviewId)),
  createThread: (reviewId, input) => fetchJson(commentsPath(reviewId), jsonInit("POST", input)),
  reply: (reviewId, threadId, input) =>
    fetchJson(
      commentsPath(reviewId, `/${encodeURIComponent(threadId)}/replies`),
      jsonInit("POST", input),
    ),
  update: (reviewId, threadId, commentId, input) =>
    fetchJson(
      commentsPath(
        reviewId,
        `/${encodeURIComponent(threadId)}/${encodeURIComponent(commentId)}`,
      ),
      jsonInit("PATCH", input),
    ),
  delete: (reviewId, threadId, commentId) =>
    fetchJson(
      commentsPath(
        reviewId,
        `/${encodeURIComponent(threadId)}/${encodeURIComponent(commentId)}`,
      ),
      { method: "DELETE" },
    ),
};
