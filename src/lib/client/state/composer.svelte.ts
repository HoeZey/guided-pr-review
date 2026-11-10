import type {
  ClientOperationId,
  CommentMessage,
  CommentThread,
  CreateCommentAnchor,
} from "$lib/shared/contracts/comments";
import {
  isAmbiguousFailure,
  matchingRecentCreate,
  matchingRecentReply,
  mintClientOperationId,
  nextDelivery,
  type Delivery,
  type OperationLookup,
} from "$lib/shared/domain/comment-delivery";
import { commentsApi } from "../browser/comments";
import { appendReply, noteDiscussionArrival, upsertThread } from "./threads.svelte";

export type ComposerTarget =
  | { kind: "create"; anchor: CreateCommentAnchor }
  | { kind: "reply"; threadId: string };

type ComposerSession = {
  reviewId: string | null;
  target: ComposerTarget | null;
  delivery: Delivery;
};

export type SubmitComposerFns = {
  createThread?: (
    reviewId: string,
    input: { anchor: CreateCommentAnchor; body: string; clientOperationId: ClientOperationId },
    init?: RequestInit,
  ) => Promise<CommentThread>;
  reply?: (
    reviewId: string,
    threadId: string,
    input: { body: string; clientOperationId: ClientOperationId },
    init?: RequestInit,
  ) => Promise<CommentMessage>;
  list?: (reviewId: string) => Promise<{ threads: CommentThread[] }>;
  mint?: () => ClientOperationId;
  now?: number;
  byOperationId?: OperationLookup;
};

function empty(): ComposerSession {
  return { reviewId: null, target: null, delivery: { state: "draft", content: "" } };
}

export const composerSession = $state<ComposerSession>(empty());

const HIGHLIGHT_MS = 1500;

export const threadHighlight = $state<{ id: string | null }>({ id: null });

let sendGeneration = 0;
let sendAbort: AbortController | null = null;
let highlightTimer: ReturnType<typeof setTimeout> | null = null;

function prefersReducedMotion(): boolean {
  return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function clearThreadHighlight(): void {
  if (highlightTimer != null) clearTimeout(highlightTimer);
  highlightTimer = null;
  threadHighlight.id = null;
}

function showThreadHighlight(id: string): void {
  clearThreadHighlight();
  if (prefersReducedMotion()) return;
  threadHighlight.id = id;
  highlightTimer = setTimeout(() => {
    highlightTimer = null;
    if (threadHighlight.id === id) threadHighlight.id = null;
  }, HIGHLIGHT_MS);
}

function abandonSend(): void {
  sendGeneration += 1;
  sendAbort?.abort();
  sendAbort = null;
}

function startRequest(): { gen: number; signal: AbortSignal } {
  sendAbort?.abort();
  sendGeneration += 1;
  sendAbort = new AbortController();
  return { gen: sendGeneration, signal: sendAbort.signal };
}

export function resetComposerSession(): void {
  abandonSend();
  clearThreadHighlight();
  const next = empty();
  composerSession.reviewId = next.reviewId;
  composerSession.target = next.target;
  composerSession.delivery = next.delivery;
}

function keepContent(reviewId: string): string {
  return composerSession.reviewId === reviewId ? composerSession.delivery.content : "";
}

function keepFailedDelivery(reviewId: string, target: ComposerTarget): boolean {
  return (
    composerSession.reviewId === reviewId &&
    composerSession.delivery.state === "failed" &&
    JSON.stringify(composerSession.target) === JSON.stringify(target)
  );
}

export function openCreateComposer(reviewId: string, anchor: CreateCommentAnchor): void {
  const target: ComposerTarget = { kind: "create", anchor };
  if (keepFailedDelivery(reviewId, target)) return;
  abandonSend();
  const content = keepContent(reviewId);
  composerSession.reviewId = reviewId;
  composerSession.target = target;
  composerSession.delivery = { state: "draft", content };
}

export function openReplyComposer(reviewId: string, threadId: string): void {
  const target: ComposerTarget = { kind: "reply", threadId };
  if (keepFailedDelivery(reviewId, target)) return;
  abandonSend();
  const content = keepContent(reviewId);
  composerSession.reviewId = reviewId;
  composerSession.target = target;
  composerSession.delivery = { state: "draft", content };
}

export function openLineComposer(reviewId: string, path: string, line: number, extend: boolean): void {
  const current = composerSession.target;
  if (
    extend &&
    composerSession.reviewId === reviewId &&
    current?.kind === "create" &&
    (current.anchor.kind === "line" || current.anchor.kind === "range") &&
    current.anchor.path === path
  ) {
    const start =
      current.anchor.kind === "line" ? current.anchor.line : Math.min(current.anchor.startLine, line);
    const end = current.anchor.kind === "line" ? line : Math.max(current.anchor.endLine, line);
    const lo = Math.min(start, end);
    const hi = Math.max(start, end);
    const anchor: CreateCommentAnchor =
      lo === hi
        ? { kind: "line", path, side: "current", line: lo }
        : { kind: "range", path, side: "current", startLine: lo, endLine: hi };
    openCreateComposer(reviewId, anchor);
    return;
  }
  openCreateComposer(reviewId, { kind: "line", path, side: "current", line });
}

export function typeComposer(content: string): void {
  composerSession.delivery = nextDelivery(composerSession.delivery, { type: "type", content });
}

export function cancelComposer(): void {
  abandonSend();
  composerSession.delivery = nextDelivery(composerSession.delivery, { type: "cancel" });
}

function closeComposer(): void {
  composerSession.target = null;
  composerSession.delivery = { state: "draft", content: "" };
}

function finishLanded(threadId: string): void {
  showThreadHighlight(threadId);
  closeComposer();
}

function errorCodeOf(err: unknown): string | null {
  if (err && typeof err === "object" && "name" in err && (err as { name: string }).name === "AbortError") {
    return "aborted";
  }
  if (err && typeof err === "object" && "code" in err && typeof (err as { code: unknown }).code === "string") {
    return (err as { code: string }).code;
  }
  return "network";
}

function isAbort(err: unknown): boolean {
  return Boolean(err && typeof err === "object" && "name" in err && (err as { name: string }).name === "AbortError");
}

export async function submitComposer(opts: SubmitComposerFns = {}): Promise<void> {
  const reviewId = composerSession.reviewId;
  const target = composerSession.target;
  if (!reviewId || !target) return;
  const content = composerSession.delivery.content;
  if (!content.trim()) return;

  const retrying = composerSession.delivery.state === "failed";
  const priorCode = composerSession.delivery.state === "failed" ? composerSession.delivery.errorCode : null;
  const mint = opts.mint ?? mintClientOperationId;
  if (retrying) {
    composerSession.delivery = nextDelivery(composerSession.delivery, { type: "retry" });
  } else {
    composerSession.delivery = nextDelivery(composerSession.delivery, {
      type: "send",
      clientOperationId: mint(),
    });
  }

  const { gen, signal } = startRequest();
  const clientOperationId =
    composerSession.delivery.state === "sending" ? composerSession.delivery.clientOperationId : mint();

  const createThread = opts.createThread ?? commentsApi.createThread;
  const reply = opts.reply ?? commentsApi.reply;
  const list = opts.list ?? ((id: string) => commentsApi.list(id));
  const now = opts.now ?? Date.now();

  try {
    if (retrying && isAmbiguousFailure(priorCode)) {
      const listed = await list(reviewId);
      if (gen !== sendGeneration) return;
      if (target.kind === "create") {
        const hit = matchingRecentCreate(
          listed.threads,
          { content, anchor: target.anchor, clientOperationId },
          now,
          { byOperationId: opts.byOperationId },
        );
        if (hit) {
          upsertThread(hit);
          noteDiscussionArrival(hit.id);
          finishLanded(hit.id);
          return;
        }
      } else {
        const hit = matchingRecentReply(
          listed.threads,
          { threadId: target.threadId, content, clientOperationId },
          now,
          { byOperationId: opts.byOperationId },
        );
        if (hit) {
          const parent = listed.threads.find((row) => row.id === target.threadId);
          if (parent) upsertThread(parent);
          else appendReply(target.threadId, hit);
          finishLanded(target.threadId);
          return;
        }
      }
    }

    if (target.kind === "create") {
      const thread = await createThread(
        reviewId,
        { anchor: target.anchor, body: content, clientOperationId },
        { signal },
      );
      if (gen !== sendGeneration) return;
      upsertThread(thread);
      noteDiscussionArrival(thread.id);
      finishLanded(thread.id);
      return;
    }

    const message = await reply(
      reviewId,
      target.threadId,
      { body: content, clientOperationId },
      { signal },
    );
    if (gen !== sendGeneration) return;
    appendReply(target.threadId, message);
    finishLanded(target.threadId);
  } catch (err) {
    if (gen !== sendGeneration) return;
    if (isAbort(err)) return;
    composerSession.delivery = nextDelivery(composerSession.delivery, {
      type: "failure",
      error: err instanceof Error ? err.message : String(err),
      errorCode: errorCodeOf(err),
    });
  } finally {
    if (gen === sendGeneration) sendAbort = null;
  }
}
