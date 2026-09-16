import {
  collapsedOnDiff,
  markViewed,
  parseViewed,
  serializeViewed,
  unmarkViewed,
} from "$lib/shared/domain/guide-view";
import { reviewLandingTab } from "$lib/shared/domain/overview";
import type { ReviewTab } from "$lib/shared/page-data";
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
