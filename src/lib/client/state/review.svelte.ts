import {
  collapsedOnDiff,
  filesForDiff,
  guideStops,
  markViewed,
  parseViewed,
  serializeViewed,
  stepGuide,
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
import { parseStoredTab, type ReviewPageData, type ReviewTab } from "$lib/shared/page-data";
import { chaptersForNav, fileId, sectionId } from "../components/guide/project";
import { fetchJson } from "../browser/fetch";
import {
  TAB_KEY,
  type StorageLike,
  browserLocalStorage,
  viewedKey,
  writePref,
  writeTabCookie,
} from "../browser/preferences";
import { resetComposerSession } from "./composer.svelte";
import { resetThreadSession } from "./threads.svelte";

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
  tocOpen: boolean;
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
    tocOpen: false,
    ops: [],
    page: null,
  };
}

export const session = $state<ReviewSession>(emptySession());

export function resetReviewSession(): void {
  resetComposerSession();
  resetThreadSession();
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
  session.tocOpen = next.tocOpen;
  session.ops = next.ops;
  session.page = next.page;
}

export function bindReview(
  reviewId: string,
  guide: { unchaptered?: boolean },
  storage: StorageLike | null = browserLocalStorage(),
  initialTab?: ReviewTab,
): void {
  if (session.reviewId === reviewId) return;
  resetComposerSession();
  resetThreadSession();
  const viewed = parseViewed(storage?.getItem(viewedKey(reviewId)) ?? null);
  const tab = initialTab ?? reviewLandingTab(guide);
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
  session.tocOpen = false;
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
  const reviewId = page.reviewId;
  try {
    const listed = await fetchJson<ListReviewsOutput>("/api/reviews");
    const payload = await fetchJson<{ guide: GuideV1; outcomes?: StoredOutcome[] }>(
      `/api/reviews/${reviewId}`,
    );
    if (session.reviewId !== reviewId) return;
    session.page = {
      ...page,
      reviewId,
      title: payload.guide.title,
      guide: payload.guide,
      outcomes: payload.outcomes ?? [],
      actions: listed.actions,
      catalog: listed.catalog,
      agentConnected: listed.agentConnected,
    };
    const latest = latestGenerateGuideAction(reviewId, listed.actions);
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
  writeTabCookie(next);
  if (next !== "guide") session.tocOpen = false;
  if (next === "diff") {
    session.collapsed = collapsedOnDiff(session.viewed, session.collapsed);
  }
}

export function adoptLegacyTab(storage: StorageLike | null = browserLocalStorage()): void {
  const stored = parseStoredTab(storage?.getItem(TAB_KEY) ?? null);
  if (!stored) return;
  setTab(stored, storage);
}

export type ReadingTarget = { id: string; path?: string; chapterId?: string };

export function nextReadingTarget(delta: number): ReadingTarget | null {
  const guide = session.page?.guide;
  if (!guide) return null;
  if (session.tab === "review") {
    const ids = ["outcome-standards", "outcome-spec"];
    const i = ids.indexOf(session.selectedOutcomeSection || "outcome-standards");
    const next = ids[i + delta];
    return next ? { id: next } : null;
  }
  if (session.tab === "diff") {
    const rows = filesForDiff(guide);
    const i = rows.findIndex((row) => row.path === session.selectedDiffPath);
    const next = rows[i + delta];
    return next ? { id: `diff-file-${i + delta}`, path: next.path } : null;
  }
  const chapters = chaptersForNav(guide);
  const stops = guideStops(chapters.filter((chapter) => !chapter._omitted));
  const path = session.selectedGuidePath || stops[0]?.path;
  const chapterId = session.selectedChapterId || stops[0]?.chapterId;
  if (!path || !chapterId) return null;
  const next = stepGuide(stops, chapterId, path, delta);
  if (!next) return null;
  const chapter = chapters.find((item) => item.id === next.chapterId);
  const index = (chapter?.files || []).findIndex((file) => file.path === next.path);
  return {
    id: index >= 0 && chapter ? fileId(chapter.id, index) : sectionId(next.chapterId),
    path: next.path,
    chapterId: next.chapterId,
  };
}

export function applyReadingTarget(target: ReadingTarget): void {
  if (target.chapterId) session.selectedChapterId = target.chapterId;
  if (target.path) {
    session.selectedGuidePath = target.path;
    session.selectedDiffPath = target.path;
  }
  if (target.id === "outcome-standards" || target.id === "outcome-spec") {
    session.selectedOutcomeSection = target.id;
  }
  document.getElementById(target.id)?.scrollIntoView?.({ behavior: "auto", block: "start" });
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
