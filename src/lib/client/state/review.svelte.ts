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
import { reviewLandingTab } from "$lib/shared/domain/overview";
import type { OpenActionTarget } from "$lib/shared/contracts/catalog";
import type { FileChange, GuideV1 } from "$lib/shared/contracts/guide";
import type { ReviewDiff } from "$lib/shared/contracts/persistence";
import { parseStoredTab, type ReviewPageData, type ReviewTab } from "$lib/shared/page-data";
import { chaptersForNav, fileId, sectionId } from "../components/guide/project";
import {
  TAB_KEY,
  type StorageLike,
  browserLocalStorage,
  viewedKey,
  writePref,
  writeTabCookie,
} from "../browser/preferences";
import { fetchJson } from "../browser/fetch";
import { composerSession, resetComposerSession } from "./composer.svelte";
import { loadReviewThreads, resetThreadSession, threadSession } from "./threads.svelte";

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

export const HEAD_CHECK_STALE_MS = 60_000;

type ReviewSync = {
  updating: boolean;
  stale: boolean;
  error: string | null;
  checkedAt: number | null;
};

function emptySync(): ReviewSync {
  return { updating: false, stale: false, error: null, checkedAt: null };
}

export const reviewSync = $state<ReviewSync>(emptySync());

let headInflight: Promise<void> | null = null;

function resetReviewSync(): void {
  const next = emptySync();
  reviewSync.updating = next.updating;
  reviewSync.stale = next.stale;
  reviewSync.error = next.error;
  reviewSync.checkedAt = next.checkedAt;
  headInflight = null;
}

export function resetReviewSession(): void {
  resetComposerSession();
  resetThreadSession();
  resetReviewSync();
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
    const rows = session.page?.diff?.files ?? filesForDiff(guide);
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

type LoadedReview = {
  guide: GuideV1;
  outcomes: ReviewPageData["outcomes"];
  diff?: ReviewDiff;
};

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function openTarget(page: ReviewPageData): OpenActionTarget | null {
  const source = page.guide?.source;
  if (!source || source.kind !== "pull-request") return null;
  return {
    provider: source.provider,
    host: source.host,
    repository: {
      id: source.repository.id,
      owner: source.repository.owner,
      name: source.repository.name,
      webUrl: source.repository.webUrl,
    },
    number: source.number,
  };
}

function diffHasLine(files: readonly FileChange[], path: string, line: number): boolean {
  return files.some(
    (file) =>
      file.path === path &&
      file.hunks?.some((hunk) => hunk.lines?.some((row) => row.newLine === line)),
  );
}

function clearMissingLine(files: readonly FileChange[]): void {
  const target = composerSession.target;
  if (target?.kind !== "create") return;
  const anchor = target.anchor;
  if (anchor.kind !== "line" && anchor.kind !== "range") return;
  const start = anchor.kind === "line" ? anchor.line : anchor.startLine;
  const end = anchor.kind === "line" ? anchor.line : anchor.endLine;
  for (let line = start; line <= end; line += 1) {
    if (!diffHasLine(files, anchor.path, line)) {
      composerSession.target = null;
      return;
    }
  }
}

export function applyLoadedReview(reviewId: string, loaded: LoadedReview): void {
  if (!session.page || session.page.reviewId !== reviewId) return;
  session.page = {
    ...session.page,
    title: loaded.guide.title,
    guide: loaded.guide,
    outcomes: loaded.outcomes,
    diff: loaded.diff,
  };
  clearMissingLine(loaded.diff?.files ?? []);
}

async function headMoved(reviewId: string, now = Date.now()): Promise<boolean> {
  reviewSync.checkedAt = now;
  const body = await fetchJson<{ moved?: boolean }>(`/api/reviews/${reviewId}/head`);
  return body.moved === true;
}

async function pullUpdatedDiff(page: ReviewPageData): Promise<void> {
  const target = openTarget(page);
  if (!target) return;
  await fetchJson("/api/reviews/update-diff", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ target }),
  });
  if (session.page?.reviewId !== page.reviewId) return;
  const loaded = await fetchJson<LoadedReview>(`/api/reviews/${page.reviewId}`);
  if (session.page?.reviewId !== page.reviewId) return;
  applyLoadedReview(page.reviewId, loaded);
}

export async function syncReviewOnOpen(): Promise<void> {
  const page = session.page;
  if (!page) return;
  const hosted = Boolean(page.guide?.source);
  if (!hosted) {
    await loadReviewThreads({ reviewId: page.reviewId, hosted: false, reason: "open" });
    return;
  }
  threadSession.reviewId = page.reviewId;
  threadSession.hosted = true;
  reviewSync.error = null;
  try {
    if (await headMoved(page.reviewId)) {
      reviewSync.updating = true;
      await pullUpdatedDiff(page);
      reviewSync.stale = false;
    }
  } catch (err) {
    reviewSync.error = messageOf(err);
  } finally {
    reviewSync.updating = false;
  }
  if (session.page?.reviewId !== page.reviewId) return;
  await loadReviewThreads({ reviewId: page.reviewId, hosted: true, reason: "open" });
}

export async function syncReviewOnFocus(now = Date.now()): Promise<void> {
  const page = session.page;
  if (!page) return;
  const hosted = Boolean(page.guide?.source);
  if (!hosted) {
    await loadReviewThreads({ reviewId: page.reviewId, hosted: false, reason: "focus", now });
    return;
  }
  const fresh = reviewSync.checkedAt != null && now - reviewSync.checkedAt < HEAD_CHECK_STALE_MS;
  if (!fresh) {
    if (!headInflight) {
      const run = headMoved(page.reviewId, now)
        .then((moved) => {
          if (session.page?.reviewId === page.reviewId) reviewSync.stale = moved;
        })
        .catch(() => undefined);
      headInflight = run.finally(() => {
        headInflight = null;
      });
    }
    await headInflight;
  }
  if (session.page?.reviewId !== page.reviewId) return;
  await loadReviewThreads({ reviewId: page.reviewId, hosted: true, reason: "focus", now });
}

export async function refreshReviewDiff(): Promise<void> {
  const page = session.page;
  if (!page?.guide?.source) return;
  reviewSync.error = null;
  reviewSync.updating = true;
  try {
    await pullUpdatedDiff(page);
    if (session.page?.reviewId === page.reviewId) reviewSync.stale = false;
  } catch (err) {
    if (session.page?.reviewId === page.reviewId) reviewSync.error = messageOf(err);
  } finally {
    reviewSync.updating = false;
  }
  if (session.page?.reviewId !== page.reviewId) return;
  await loadReviewThreads({ reviewId: page.reviewId, hosted: true, reason: "retry" });
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
