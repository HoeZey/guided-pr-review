import {
  type CatalogPullRequest,
  type CatalogSnapshot,
  type OpenActionTarget,
  type StoredAction,
} from "../contracts/catalog.ts";
import type { ReviewSummary } from "../contracts/persistence.ts";
import { pullRequestSyncKey } from "../contracts/provenance.ts";

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
  openTarget?: OpenActionTarget;
};

export type HomeCardAction = "open-saved" | "queue-open" | "queue-update-diff" | "disabled-host";

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

export const GENERATE_GUIDE_DISCONNECTED_HINT =
  "The guided-review skill must be running to generate a reading-order guide.";

export const OUTDATED_WARNING =
  "This saved review is outdated. The pull request has new commits.";

export function generateGuideHint(agentConnected: boolean): string | undefined {
  return agentConnected ? undefined : GENERATE_GUIDE_DISCONNECTED_HINT;
}

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

export function inFlightGenerateGuideCopy(
  status: StoredAction["status"],
): "Waiting" | "Generating guide" | undefined {
  if (status === "queued") return "Waiting";
  if (status === "claimed") return "Generating guide";
  return undefined;
}

export function latestGenerateGuideAction(
  reviewId: string,
  actions: readonly StoredAction[],
): StoredAction | undefined {
  return [...actions]
    .reverse()
    .find(
      (action) => action.kind === "generate-guide" && action.reviewId === reviewId,
    );
}

export function homeCardAction(
  card: HomeCard,
  _agentConnected: boolean,
): HomeCardAction {
  if (card.outdated && card.reviewId && card.openTarget && !card.archived) {
    return "queue-update-diff";
  }
  if (card.reviewId) return "open-saved";
  if (card.openTarget) return "queue-open";
  return "disabled-host";
}

export function offersGenerateGuide(
  card: Pick<HomeCard, "reviewId" | "hasGuide" | "repository">,
): boolean {
  return Boolean(card.reviewId) && !card.hasGuide && Boolean(card.repository);
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
  return reviews.map((review) => ({
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
    hasGuide: !review.unchaptered,
    outdated: false,
    archived: false,
  }));
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
  const outdated = !archived && sourceCommitMoved(review?.sourceCommit, item.sourceCommit);
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
    hasGuide: Boolean(review?.id) && !review?.unchaptered,
    outdated,
    archived,
    openTarget: {
      provider: item.provider,
      host: item.host,
      repository: item.repository,
      number: item.number,
    },
  };
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
