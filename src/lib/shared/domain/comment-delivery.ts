import {
  ClientOperationId as ClientOperationIdSchema,
  type ClientOperationId,
  type CommentAnchor,
  type CommentMessage,
  type CommentThread,
  type CreateCommentAnchor,
} from "../contracts/comments.ts";

export function mintClientOperationId(): ClientOperationId {
  return ClientOperationIdSchema.parse(`cop_${crypto.randomUUID().replaceAll("-", "").toLowerCase()}`);
}

export type Delivery =
  | { state: "draft"; content: string }
  | { state: "sending"; content: string; clientOperationId: ClientOperationId }
  | { state: "failed"; content: string; clientOperationId: ClientOperationId; error: string; errorCode: string | null }
  | { state: "succeeded"; content: string; threadId: string; commentId: string };

export type DeliveryEvent =
  | { type: "type"; content: string }
  | { type: "send"; clientOperationId: ClientOperationId }
  | { type: "success"; threadId: string; commentId: string }
  | { type: "failure"; error: string; errorCode: string | null }
  | { type: "retry" }
  | { type: "cancel" };

const MATCH_WINDOW_MS = 5 * 60 * 1000;

export function nextDelivery(current: Delivery, event: DeliveryEvent): Delivery {
  if (event.type === "type") {
    if (current.state === "draft") return { state: "draft", content: event.content };
    if (current.state === "failed") return { ...current, content: event.content };
    return current;
  }
  if (event.type === "send") {
    const clientOperationId =
      current.state === "sending" || current.state === "failed"
        ? current.clientOperationId
        : event.clientOperationId;
    return { state: "sending", content: current.content, clientOperationId };
  }
  if (event.type === "success") {
    return {
      state: "succeeded",
      content: current.content,
      threadId: event.threadId,
      commentId: event.commentId,
    };
  }
  if (event.type === "failure") {
    if (current.state !== "sending" && current.state !== "failed") return current;
    return {
      state: "failed",
      content: current.content,
      clientOperationId: current.clientOperationId,
      error: event.error,
      errorCode: event.errorCode,
    };
  }
  if (event.type === "retry") {
    if (current.state === "failed" || current.state === "sending") {
      return { state: "sending", content: current.content, clientOperationId: current.clientOperationId };
    }
    return current;
  }
  if (current.state === "sending" || current.state === "failed") {
    return { state: "draft", content: current.content };
  }
  return current;
}

export function isAmbiguousFailure(code: string | null): boolean {
  return code === "network" || code === "unavailable";
}

export type OperationLookup = (
  id: ClientOperationId,
) => { threadId: string; commentId: string } | undefined;

function sameAnchor(left: CommentAnchor | CreateCommentAnchor, right: CreateCommentAnchor): boolean {
  if (left.kind !== right.kind) return false;
  if (left.kind === "pr" && right.kind === "pr") return true;
  if (left.kind === "file" && right.kind === "file") return left.path === right.path;
  if (left.kind === "line" && right.kind === "line") {
    return left.path === right.path && left.line === right.line;
  }
  if (left.kind === "range" && right.kind === "range") {
    return left.path === right.path && left.startLine === right.startLine && left.endLine === right.endLine;
  }
  return false;
}

function recent(iso: string, nowMs: number, windowMs: number): boolean {
  const published = Date.parse(iso);
  if (!Number.isFinite(published)) return false;
  return Math.abs(nowMs - published) <= windowMs;
}

export function matchingRecentCreate(
  threads: CommentThread[],
  pending: { content: string; anchor: CreateCommentAnchor; clientOperationId: ClientOperationId },
  nowMs: number,
  opts: { byOperationId?: OperationLookup; windowMs?: number } = {},
): CommentThread | undefined {
  const windowMs = opts.windowMs ?? MATCH_WINDOW_MS;
  const marked = opts.byOperationId?.(pending.clientOperationId);
  if (marked) return threads.find((row) => row.id === marked.threadId);
  return threads.find((row) => {
    if (!sameAnchor(row.anchor, pending.anchor)) return false;
    const root = row.messages[0];
    if (!root || root.body !== pending.content) return false;
    return recent(root.createdAt, nowMs, windowMs);
  });
}

export function matchingRecentReply(
  threads: CommentThread[],
  pending: { threadId: string; content: string; clientOperationId: ClientOperationId },
  nowMs: number,
  opts: { byOperationId?: OperationLookup; windowMs?: number } = {},
): CommentMessage | undefined {
  const windowMs = opts.windowMs ?? MATCH_WINDOW_MS;
  const marked = opts.byOperationId?.(pending.clientOperationId);
  const thread = threads.find((row) => row.id === (marked?.threadId ?? pending.threadId));
  if (!thread) return undefined;
  if (marked) return thread.messages.find((row) => row.id === marked.commentId);
  return thread.messages.slice(1).find((row) => row.body === pending.content && recent(row.createdAt, nowMs, windowMs));
}
