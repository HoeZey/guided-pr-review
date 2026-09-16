import {
  collapsedOnDiff,
  markViewed,
  parseViewed,
  serializeViewed,
  unmarkViewed,
} from "$lib/shared/domain/guide-view";
import {
  inFlightGenerateGuideCopy,
  latestGenerateGuideAction,
  reviewLandingTab,
} from "$lib/shared/domain/overview";
import type { GuideV1 } from "$lib/shared/contracts/guide";
import type { ListReviewsOutput } from "$lib/shared/contracts/persistence";
import type { StoredOutcome } from "$lib/shared/contracts/outcomes";
import type { ReviewPageData, ReviewTab } from "$lib/shared/page-data";
import { fetchJson } from "../browser/fetch";
import {
  TAB_KEY,
  type StorageLike,
  browserLocalStorage,
  viewedKey,
  writePref,
} from "../browser/preferences";

export type UiOp = {
  id: string;
  kind: string;
  reviewId?: string;
  status: "pending" | "failed";
  error?: string;
};

type ReviewSession = {
  reviewId: string | null;
  tab: ReviewTab;
  viewed: Set<string>;
  collapsed: Set<string>;
  collapsedDirs: Set<string>;
  selectedChapterId: string | null;
  selectedGuidePath: string | null;
  selectedDiffPath: string | null;
  selectedOutcomeSection: string | null;
  selectedOutcomeId: string | null;
  ops: UiOp[];
  page: ReviewPageData | null;
};

function emptySession(): ReviewSession {
  return {
    reviewId: null,
    tab: "guide",
    viewed: new Set(),
    collapsed: new Set(),
    collapsedDirs: new Set(),
    selectedChapterId: null,
    selectedGuidePath: null,
    selectedDiffPath: null,
    selectedOutcomeSection: null,
    selectedOutcomeId: null,
    ops: [],
    page: null,
  };
}

export const session = $state<ReviewSession>(emptySession());

export function resetReviewSession(): void {
  const next = emptySession();
  session.reviewId = next.reviewId;
  session.tab = next.tab;
  session.viewed = next.viewed;
  session.collapsed = next.collapsed;
  session.collapsedDirs = next.collapsedDirs;
  session.selectedChapterId = next.selectedChapterId;
  session.selectedGuidePath = next.selectedGuidePath;
  session.selectedDiffPath = next.selectedDiffPath;
  session.selectedOutcomeSection = next.selectedOutcomeSection;
  session.selectedOutcomeId = next.selectedOutcomeId;
  session.ops = next.ops;
  session.page = next.page;
}

export function bindReview(
  reviewId: string,
  guide: { unchaptered?: boolean },
  storage: StorageLike | null = browserLocalStorage(),
): void {
  if (session.reviewId === reviewId) return;
  const viewed = parseViewed(storage?.getItem(viewedKey(reviewId)) ?? null);
  const tab = reviewLandingTab(guide);
  session.reviewId = reviewId;
  session.tab = tab;
  session.viewed = viewed;
  session.collapsed = tab === "diff" ? collapsedOnDiff(viewed, viewed) : new Set(viewed);
  session.collapsedDirs = new Set();
  session.selectedChapterId = null;
  session.selectedGuidePath = null;
  session.selectedDiffPath = null;
  session.selectedOutcomeSection = null;
  session.selectedOutcomeId = null;
  session.ops = session.ops.filter((op) => !op.reviewId || op.reviewId === reviewId);
}

export function adoptReviewPage(data: ReviewPageData): void {
  if (session.page?.reviewId === data.reviewId) return;
  session.page = data;
}

export function currentReviewPage(ssr: ReviewPageData): ReviewPageData {
  return session.page?.reviewId === ssr.reviewId ? session.page : ssr;
}

export function generateGuidePending(page: ReviewPageData): boolean {
  const latest = latestGenerateGuideAction(page.reviewId, page.actions);
  if (latest && inFlightGenerateGuideCopy(latest.status)) return true;
  return session.ops.some(
    (op) =>
      op.kind === "generate-guide" &&
      op.reviewId === page.reviewId &&
      op.status === "pending",
  );
}

export async function refreshCurrentReview(force = false): Promise<void> {
  const page = session.page;
  if (!page || page.kind !== "review") return;
  if (session.reviewId !== page.reviewId) return;
  if (!force && !generateGuidePending(page)) return;
  try {
    const listed = await fetchJson<ListReviewsOutput>("/api/reviews");
    const payload = await fetchJson<{ guide: GuideV1; outcomes?: StoredOutcome[] }>(
      `/api/reviews/${page.reviewId}`,
    );
    session.page = {
      ...page,
      title: payload.guide.title,
      guide: payload.guide,
      outcomes: payload.outcomes ?? [],
      actions: listed.actions,
      catalog: listed.catalog,
      agentConnected: listed.agentConnected,
    };
    const latest = latestGenerateGuideAction(page.reviewId, listed.actions);
    if (latest?.status === "succeeded" || latest?.status === "failed") {
      session.ops = session.ops.filter((op) => op.id !== latest.id);
    }
  } catch {
    /* Keep the hydrated review readable if the agent refresh fails. */
  }
}

export async function queueGenerateGuide(reviewId: string): Promise<void> {
  const created = await fetchJson<{ id: string }>("/api/actions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "generate-guide", reviewId }),
  });
  session.ops = [
    ...session.ops.filter(
      (op) => !(op.kind === "generate-guide" && op.reviewId === reviewId),
    ),
    { id: created.id, kind: "generate-guide", reviewId, status: "pending" },
  ];
  await refreshCurrentReview(true);
}

export function setTab(
  next: ReviewTab,
  storage: StorageLike | null = browserLocalStorage(),
): void {
  session.tab = next;
  writePref(storage, TAB_KEY, next);
  if (next === "diff") {
    session.collapsed = collapsedOnDiff(session.viewed, session.collapsed);
  }
}

export function persistViewed(storage: StorageLike | null = browserLocalStorage()): void {
  if (!session.reviewId) return;
  writePref(storage, viewedKey(session.reviewId), serializeViewed(session.viewed));
}

export function selectDiffPath(path: string | null): void {
  session.selectedDiffPath = path;
}

export function toggleCollapsed(path: string): void {
  const next = new Set(session.collapsed);
  if (next.has(path)) next.delete(path);
  else next.add(path);
  session.collapsed = next;
}

export function toggleCollapsedDir(path: string): void {
  const next = new Set(session.collapsedDirs);
  if (next.has(path)) next.delete(path);
  else next.add(path);
  session.collapsedDirs = next;
}

export function setPathViewed(
  path: string,
  on: boolean,
  storage: StorageLike | null = browserLocalStorage(),
): void {
  if (on) {
    const next = markViewed(session.viewed, session.collapsed, path);
    session.viewed = next.viewed;
    session.collapsed = new Set([...next.collapsed, path]);
  } else {
    const next = unmarkViewed(session.viewed, session.collapsed, path);
    session.viewed = next.viewed;
    session.collapsed = next.collapsed;
  }
  persistViewed(storage);
}
