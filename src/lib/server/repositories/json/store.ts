import type { OpenActionTarget, StoredAction } from "../../../shared/contracts/catalog.ts";
import { GuideV1 } from "../../../shared/contracts/guide.ts";
import {
  CodeReviewOutcome,
  type StoredOutcome,
} from "../../../shared/contracts/outcomes.ts";
import type { ListReviewsOutput, ReviewRecord } from "../../../shared/contracts/persistence.ts";
import { pullRequestSyncKey } from "../../../shared/contracts/provenance.ts";
import { tools } from "../../../shared/contracts/tools.ts";
import { applyCatalogReplacement } from "../../../shared/domain/catalog.ts";
import {
  agentIsConnected,
  findLocalReviewToAdopt,
  reviewSummary,
} from "../../../shared/domain/reviews.ts";
import type { AppRepositories } from "../ports.ts";
import { locked, mutateStore, readStore, resetJsonStoreCache, writeStore } from "./file.ts";

export { resetJsonStoreCache };

function httpError(message: string, status: number): Error {
  return Object.assign(new Error(message), { status });
}

function unwrapGuide(body: unknown): GuideV1 {
  return GuideV1.parse(
    body && typeof body === "object" && "guide" in body
      ? (body as { guide: unknown }).guide
      : body,
  );
}

function sameOpenTarget(a: OpenActionTarget, b: OpenActionTarget): boolean {
  return pullRequestSyncKey(a) === pullRequestSyncKey(b);
}

function isInFlight(action: StoredAction): boolean {
  return action.status === "queued" || action.status === "claimed";
}

function sameQueuedAction(
  existing: StoredAction,
  parsed: { kind: StoredAction["kind"]; target?: OpenActionTarget; reviewId?: string },
): boolean {
  if (!isInFlight(existing) || existing.kind !== parsed.kind) return false;
  if (parsed.kind === "refresh") return true;
  if (parsed.kind === "generate-guide") {
    return existing.kind === "generate-guide" && existing.reviewId === parsed.reviewId;
  }
  return Boolean(
    (existing.kind === "open" || existing.kind === "update-diff") &&
      parsed.target &&
      sameOpenTarget(existing.target, parsed.target),
  );
}

function appendActive(store: { reviews: ReviewRecord[]; activeId: string | null }, guide: GuideV1): {
  id: string;
} {
  const id = crypto.randomUUID();
  store.reviews.push({
    id,
    addedAt: new Date().toISOString(),
    guide,
    outcomes: [],
  });
  store.activeId = id;
  return { id };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function listReviews(): Promise<ListReviewsOutput> {
  const store = await readStore();
  return {
    activeId: store.activeId,
    reviews: store.reviews.map(reviewSummary),
    repositories: store.repositories,
    catalog: store.catalog,
    actions: store.actions,
    agentConnected: agentIsConnected(store.agentLastSeen),
  };
}

export async function queueAction(input: unknown): Promise<{ id: string }> {
  const parsed = tools.queue_action.input.parse(input);
  return mutateStore((store) => {
    if (parsed.kind === "generate-guide") {
      const found = store.reviews.find((review) => review.id === parsed.reviewId);
      if (!found) {
        throw httpError(`unknown review ${parsed.reviewId}`, 404);
      }
      if (!found.guide.unchaptered) {
        throw httpError("Generate guide is only for an unchaptered review", 400);
      }
    }
    const existing = store.actions.find((action) => sameQueuedAction(action, parsed));
    if (existing) return { id: existing.id };
    const id = crypto.randomUUID();
    const queuedAt = new Date().toISOString();
    if (parsed.kind === "generate-guide") {
      store.actions.push({
        id,
        kind: "generate-guide",
        status: "queued",
        queuedAt,
        reviewId: parsed.reviewId,
      });
    } else if (parsed.kind === "refresh") {
      store.actions.push({
        id,
        kind: "refresh",
        status: "queued",
        queuedAt,
      });
    } else {
      store.actions.push({
        id,
        kind: parsed.kind,
        status: "queued",
        queuedAt,
        target: parsed.target,
      });
    }
    return { id };
  });
}

export async function waitForAction(input: unknown = {}): Promise<StoredAction | null> {
  const parsed = tools.wait_for_action.input.parse(input ?? {});
  const timeoutMs = parsed.timeoutMs ?? 25_000;
  const deadline = Date.now() + timeoutMs;
  // ponytail: 50ms poll, fine for one waiting agent; evented wait if that changes
  for (;;) {
    const claimed = await mutateStore((store) => {
      store.agentLastSeen = new Date().toISOString();
      const inFlight = store.actions.find((action) => action.status === "claimed");
      if (inFlight) return inFlight;
      const queued = store.actions.find((action) => action.status === "queued");
      if (queued) {
        queued.status = "claimed";
        queued.claimedAt = store.agentLastSeen;
        return queued;
      }
      return null;
    });
    if (claimed) return claimed;
    if (Date.now() >= deadline) return null;
    await sleep(50);
  }
}

export async function completeAction(input: unknown): Promise<{ ok: true }> {
  const parsed = tools.complete_action.input.parse(input);
  return mutateStore((store) => {
    const action = store.actions.find((row) => row.id === parsed.id);
    if (!action) {
      throw httpError(`unknown action ${parsed.id}`, 404);
    }
    if (!isInFlight(action)) {
      throw httpError(`action ${parsed.id} is not in flight`, 409);
    }
    if (parsed.status === "succeeded" && action.kind !== "refresh" && !parsed.reviewId) {
      throw httpError(
        "reviewId required when Open, Update Diff, or Generate guide succeeds",
        400,
      );
    }
    action.status = parsed.status;
    action.completedAt = new Date().toISOString();
    if (parsed.status === "succeeded" && parsed.reviewId) action.reviewId = parsed.reviewId;
    if (parsed.status === "failed") action.error = parsed.error;
    return { ok: true as const };
  });
}

export async function replaceCatalog(input: unknown): Promise<{ ok: true }> {
  const parsed = tools.replace_catalog.input.parse(input);
  return mutateStore((store) => {
    const next = applyCatalogReplacement(
      store.repositories,
      store.catalog,
      store.reviews,
      parsed,
    );
    store.repositories = next.repositories;
    store.catalog = next.catalog;
    store.reviews = next.reviews;
    return { ok: true as const };
  });
}

export async function addReview(input: unknown): Promise<{ id: string }> {
  const guide = GuideV1.parse(input);
  return mutateStore((store) => appendActive(store, guide));
}

export async function addReviewFromTool(body: unknown): Promise<{ id: string }> {
  return addReview(unwrapGuide(body));
}

export async function upsertReview(input: unknown): Promise<{ id: string }> {
  const guide = GuideV1.parse(input);
  const source = guide.source;
  if (!source) {
    throw httpError("upsert_review requires pull-request source", 400);
  }
  const key = pullRequestSyncKey(source);
  return mutateStore((store) => {
    const found =
      store.reviews.find(
        (review) =>
          review.guide.source && pullRequestSyncKey(review.guide.source) === key,
      ) ?? findLocalReviewToAdopt(store.reviews, source);
    if (found) {
      found.guide = guide;
      store.activeId = found.id;
      return { id: found.id };
    }
    return appendActive(store, guide);
  });
}

export async function upsertReviewFromTool(body: unknown): Promise<{ id: string }> {
  return upsertReview(unwrapGuide(body));
}

export async function removeReview(id: string): Promise<{ ok: true }> {
  return mutateStore((store) => {
    const next = store.reviews.filter((review) => review.id !== id);
    if (next.length === store.reviews.length) {
      throw httpError(`unknown review ${id}`, 404);
    }
    store.reviews = next;
    if (store.activeId === id) {
      store.activeId = next[0]?.id ?? null;
    }
    return { ok: true as const };
  });
}

export async function getReview(
  id: string,
): Promise<{ guide: GuideV1; outcomes: StoredOutcome[] }> {
  const store = await readStore();
  const found = store.reviews.find((review) => review.id === id);
  if (!found) {
    throw httpError(`unknown review ${id}`, 404);
  }
  return { guide: found.guide, outcomes: found.outcomes };
}

export async function publishReviewOutcome(
  reviewId: string,
  outcome: unknown,
): Promise<{ id: string }> {
  const parsed = CodeReviewOutcome.parse(outcome);
  return mutateStore((store) => {
    const found = store.reviews.find((review) => review.id === reviewId);
    if (!found) {
      throw httpError(`unknown review ${reviewId}`, 404);
    }
    const id = crypto.randomUUID();
    found.outcomes.push({
      id,
      addedAt: new Date().toISOString(),
      outcome: parsed,
    });
    return { id };
  });
}

export async function setActive(id: string): Promise<{ activeId: string }> {
  return mutateStore((store) => {
    if (!store.reviews.some((review) => review.id === id)) {
      throw httpError(`unknown review ${id}`, 404);
    }
    store.activeId = id;
    return { activeId: id };
  });
}

export async function seedIfEmpty(guide: GuideV1): Promise<void> {
  await locked(async () => {
    const current = await readStore();
    if (current.reviews.length > 0) return;
    const store = structuredClone(current);
    appendActive(store, guide);
    await writeStore(store);
  });
}

export const jsonRepositories: AppRepositories = {
  listReviews,
  getReview,
  addReview,
  addReviewFromTool,
  upsertReview,
  upsertReviewFromTool,
  removeReview,
  setActive,
  seedIfEmpty,
  replaceCatalog,
  queueAction,
  waitForAction,
  completeAction,
  publishReviewOutcome,
};
