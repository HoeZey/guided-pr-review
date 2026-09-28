import {
  type CatalogPullRequest,
  type CatalogSnapshot,
  type OpenActionTarget,
} from "../contracts/catalog.ts";
import type { ReviewSummary } from "../contracts/persistence.ts";
import { pullRequestSyncKey } from "../contracts/provenance.ts";

export type GuideBookStatus = "grey" | "yellow" | "green";

export type ArchivedCardLabel = "Merged" | "Closed";

export type HomeCard = {
  id: string;
  title: string;
  range: string | undefined;
  repository: { owner: string; name: string } | undefined;
  webUrl: string | undefined;
  reviewId: string | undefined;
  hasGuide: boolean;
  outdated: boolean;
  archived: boolean;
  bookStatus: GuideBookStatus;
  archivedLabel?: ArchivedCardLabel;
  openTarget?: OpenActionTarget;
};

export type HomeCardAction = "open-saved" | "queue-open" | "disabled-host";

export type HomeGroupId =
  | "review-requests"
  | "authored-by-me"
  | "other-saved-prs"
  | "local-ranges"
  | "archived";

export type HomeGroup = {
  id: HomeGroupId;
  title: string;
  cards: HomeCard[];
  collapsed?: boolean;
};

export type HomeOverview = {
  lastSynced: string | undefined;
  catalogErrors: { owner: string; name: string; message: string }[];
  groups: HomeGroup[];
};

export type OverviewView = { kind: "home" } | { kind: "review"; reviewId: string };

export const HOME_PATH = "/";

export function reviewPath(reviewId: string): string {
  return `/reviews/${encodeURIComponent(reviewId)}`;
}

export function reviewLandingTab(guide: { unchaptered?: boolean }): "guide" | "diff" {
  return guide.unchaptered ? "diff" : "guide";
}

export function guidePresentsWalkthrough(guide: { unchaptered?: boolean }): boolean {
  return !guide.unchaptered;
}

export const OUTDATED_WARNING =
  "This saved review is outdated. The pull request has new commits.";

export function reviewOutdatedWarning(
  review: Pick<ReviewSummary, "syncKey" | "sourceCommit">,
  catalog: readonly CatalogSnapshot[],
): string | undefined {
  if (!review.syncKey || !review.sourceCommit) return undefined;
  const item = catalogItemByKey(catalog, review.syncKey);
  if (!item || item.status !== "active") return undefined;
  return sourceCommitMoved(review.sourceCommit, item.sourceCommit)
    ? OUTDATED_WARNING
    : undefined;
}

export function homeCardAction(
  card: HomeCard,
  _agentConnected: boolean,
): HomeCardAction {
  if (card.reviewId) return "open-saved";
  if (card.openTarget) return "queue-open";
  return "disabled-host";
}

export function guideBookHover(status: GuideBookStatus): string {
  if (status === "grey") return "Guide missing. Ask your coding agent to generate the guide";
  if (status === "yellow") return "Guide stale. Ask your coding agent to update the guide";
  return "The guide is up to date";
}

export function resolveOverviewView(
  pathname: string,
  reviewIds: readonly string[],
): OverviewView {
  const path = pathname.replace(/\/+$/, "") || "/";
  const match = /^\/reviews\/([^/]+)$/.exec(path);
  if (match) {
    const reviewId = decodeURIComponent(match[1]);
    if (reviewIds.includes(reviewId)) return { kind: "review", reviewId };
  }
  return { kind: "home" };
}

export function projectHomeCards(reviews: readonly ReviewSummary[]): HomeCard[] {
  return reviews.map((review) => {
    const hasGuide = !review.unchaptered;
    return {
      id: review.id,
      title: review.title,
      range: homeRange(review),
      repository: review.pullRequest
        ? {
            owner: review.pullRequest.repository.owner,
            name: review.pullRequest.repository.name,
          }
        : undefined,
      webUrl: review.pullRequest?.webUrl,
      reviewId: review.id,
      hasGuide,
      outdated: false,
      archived: false,
      bookStatus: guideBookStatus({ hasGuide, archived: false }),
    };
  });
}

const GROUP_TITLE: Record<HomeGroupId, string> = {
  "review-requests": "Review requests",
  "authored-by-me": "Authored by me",
  "other-saved-prs": "Other saved PRs",
  "local-ranges": "Local ranges",
  archived: "Archived",
};

function catalogCard(
  item: CatalogPullRequest,
  reviews: readonly ReviewSummary[],
  extra?: { archived?: boolean },
): HomeCard {
  const syncKey = pullRequestSyncKey(item);
  const review = reviews.find((row) => row.syncKey === syncKey);
  const archived = Boolean(extra?.archived);
  const hasGuide = Boolean(review?.id) && !review?.unchaptered;
  const outdated =
    !archived &&
    Boolean(review?.diffCommit) &&
    sourceCommitMoved(review?.sourceCommit, review!.diffCommit!);
  return {
    id: review?.id ?? syncKey,
    title: item.title,
    range: `${stripHeads(item.targetRef)} ← ${stripHeads(item.sourceRef)}`,
    repository: {
      owner: item.repository.owner,
      name: item.repository.name,
    },
    webUrl: item.webUrl,
    reviewId: review?.id,
    hasGuide,
    outdated,
    archived,
    bookStatus: guideBookStatus({
      hasGuide,
      archived,
      reviewCommit: review?.sourceCommit,
      diffCommit: review?.diffCommit,
    }),
    ...(archived ? { archivedLabel: archivedCardLabel(item.status) } : {}),
    openTarget: {
      provider: item.provider,
      host: item.host,
      repository: item.repository,
      number: item.number,
    },
  };
}

function guideBookStatus(opts: {
  hasGuide: boolean;
  archived: boolean;
  reviewCommit?: string;
  diffCommit?: string;
}): GuideBookStatus {
  if (!opts.hasGuide) return "grey";
  if (opts.archived) return "green";
  if (opts.diffCommit && sourceCommitMoved(opts.reviewCommit, opts.diffCommit)) {
    return "yellow";
  }
  return "green";
}

function archivedCardLabel(
  status: CatalogPullRequest["status"],
): ArchivedCardLabel {
  return status === "completed" ? "Merged" : "Closed";
}

function isReviewRequest(item: CatalogPullRequest): boolean {
  return item.status === "active" && item.isReviewer && !item.isDraft;
}

function isAuthoredByMe(item: CatalogPullRequest): boolean {
  return item.status === "active" && item.isAuthor;
}

function isClosed(item: CatalogPullRequest): boolean {
  return item.status === "completed" || item.status === "abandoned" || item.status === "closed";
}

function catalogItemByKey(
  catalog: readonly CatalogSnapshot[],
  key: string,
): CatalogPullRequest | undefined {
  for (const snapshot of catalog) {
    const item = snapshot.pullRequests.find((row) => pullRequestSyncKey(row) === key);
    if (item) return item;
  }
  return undefined;
}

function sourceCommitMoved(
  reviewCommit: string | undefined,
  catalogCommit: string,
): boolean {
  return Boolean(reviewCommit && reviewCommit.toLowerCase() !== catalogCommit.toLowerCase());
}

/** True when an active reviewer or authored catalog PR has no saved review, no saved diff, or a newer source commit than the saved diff. */
export function catalogHasNewChanges(
  reviews: readonly ReviewSummary[],
  catalog: readonly CatalogSnapshot[],
): boolean {
  for (const snapshot of catalog) {
    for (const item of snapshot.pullRequests) {
      if (!(isReviewRequest(item) || isAuthoredByMe(item))) continue;
      const key = pullRequestSyncKey(item);
      const review = reviews.find((row) => row.syncKey === key);
      if (!review) return true;
      if (!review.diffCommit) return true;
      if (sourceCommitMoved(review.diffCommit, item.sourceCommit)) return true;
    }
  }
  for (const review of reviews) {
    if (!review.pullRequest || review.diffCommit) continue;
    const item = review.syncKey ? catalogItemByKey(catalog, review.syncKey) : undefined;
    if (item && isClosed(item)) continue;
    if (item && (isReviewRequest(item) || isAuthoredByMe(item))) continue;
    return true;
  }
  return false;
}

/** Open targets the refresh click should syncDiff for. */
export function homeDiffSyncTargets(
  reviews: readonly ReviewSummary[],
  catalog: readonly CatalogSnapshot[],
): OpenActionTarget[] {
  const seen = new Set<string>();
  const targets: OpenActionTarget[] = [];
  const push = (target: OpenActionTarget) => {
    const key = pullRequestSyncKey(target);
    if (seen.has(key)) return;
    seen.add(key);
    targets.push(target);
  };
  for (const snapshot of catalog) {
    for (const item of snapshot.pullRequests) {
      if (!(isReviewRequest(item) || isAuthoredByMe(item))) continue;
      push({
        provider: item.provider,
        host: item.host,
        repository: item.repository,
        number: item.number,
      });
    }
  }
  for (const review of reviews) {
    if (!review.pullRequest || review.diffCommit) continue;
    const item = review.syncKey ? catalogItemByKey(catalog, review.syncKey) : undefined;
    if (item && isClosed(item)) continue;
    const pr = review.pullRequest;
    push({
      provider: pr.provider,
      host: pr.host,
      repository: {
        id: pr.repository.id,
        owner: pr.repository.owner,
        name: pr.repository.name,
        webUrl: pr.webUrl,
      },
      number: pr.number,
    });
  }
  return targets;
}

export function projectHomeOverview(
  reviews: readonly ReviewSummary[],
  catalog: readonly CatalogSnapshot[],
): HomeOverview {
  const reviewRequests: HomeCard[] = [];
  const authored: HomeCard[] = [];
  const archived: HomeCard[] = [];
  const placed = new Set<string>();
  for (const snapshot of catalog) {
    for (const item of snapshot.pullRequests) {
      const key = pullRequestSyncKey(item);
      if (isClosed(item)) {
        const review = reviews.find((row) => row.syncKey === key);
        if (review) {
          archived.push(catalogCard(item, reviews, { archived: true }));
          placed.add(key);
        }
        continue;
      }
      const review = reviews.find((row) => row.syncKey === key);
      if (!review) continue;
      if (isReviewRequest(item)) {
        reviewRequests.push(catalogCard(item, reviews));
        placed.add(key);
      } else if (isAuthoredByMe(item)) {
        authored.push(catalogCard(item, reviews));
        placed.add(key);
      }
    }
  }
  const otherSaved: HomeCard[] = [];
  const localRanges: HomeCard[] = [];
  for (const review of reviews) {
    if (review.syncKey && placed.has(review.syncKey)) continue;
    const item = review.syncKey ? catalogItemByKey(catalog, review.syncKey) : undefined;
    if (item) {
      otherSaved.push(catalogCard(item, reviews));
      continue;
    }
    const [card] = projectHomeCards([review]);
    if (review.pullRequest) otherSaved.push(card);
    else localRanges.push(card);
  }
  const groups: HomeGroup[] = [];
  const push = (id: HomeGroupId, cards: HomeCard[], collapsed = false) => {
    if (!cards.length) return;
    groups.push({
      id,
      title: GROUP_TITLE[id],
      cards,
      ...(collapsed ? { collapsed: true } : {}),
    });
  };
  push("review-requests", reviewRequests);
  push("authored-by-me", authored);
  push("other-saved-prs", otherSaved);
  push("local-ranges", localRanges);
  push("archived", archived, true);
  const lastSynced = catalog
    .map((snapshot) => snapshot.syncedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  const catalogErrors = catalog.flatMap((snapshot) =>
    snapshot.error
      ? [
          {
            owner: snapshot.repository.owner,
            name: snapshot.repository.name,
            message: snapshot.error,
          },
        ]
      : [],
  );
  return { lastSynced, catalogErrors, groups };
}

function homeRange(review: ReviewSummary): string | undefined {
  const pr = review.pullRequest;
  if (pr) return `${stripHeads(pr.targetRef)} ← ${stripHeads(pr.sourceRef)}`;
  return parseThreeDot(review.range);
}

function parseThreeDot(range: string | undefined): string | undefined {
  if (!range) return undefined;
  const idx = range.indexOf("...");
  if (idx === -1) return undefined;
  const target = range.slice(0, idx).trim();
  const source = range.slice(idx + 3).trim();
  if (!target || !source) return undefined;
  return `${target} ← ${source}`;
}

function stripHeads(ref: string): string {
  return ref.replace(/^refs\/heads\//i, "");
}
