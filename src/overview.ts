import {
  pullRequestSyncKey,
  type CatalogPullRequest,
  type CatalogSnapshot,
  type ReviewSummary,
} from "./contracts.ts";

export type HomeCard = {
  id: string;
  title: string;
  range: string | undefined;
  repository: { owner: string; name: string } | undefined;
  webUrl: string | undefined;
  reviewId: string | undefined;
};

export type HomeGroupId =
  | "review-requests"
  | "authored-by-me"
  | "other-saved-prs"
  | "local-ranges";

export type HomeGroup = {
  id: HomeGroupId;
  title: string;
  cards: HomeCard[];
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
  }));
}

const GROUP_TITLE: Record<HomeGroupId, string> = {
  "review-requests": "Review requests",
  "authored-by-me": "Authored by me",
  "other-saved-prs": "Other saved PRs",
  "local-ranges": "Local ranges",
};

function catalogCard(
  item: CatalogPullRequest,
  reviews: readonly ReviewSummary[],
): HomeCard {
  const syncKey = pullRequestSyncKey(item);
  const review = reviews.find((row) => row.syncKey === syncKey);
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
  };
}

function isReviewRequest(item: CatalogPullRequest): boolean {
  return item.status === "active" && item.isReviewer && !item.isDraft;
}

function isAuthoredByMe(item: CatalogPullRequest): boolean {
  return item.status === "active" && item.isAuthor;
}

export function projectHomeOverview(
  reviews: readonly ReviewSummary[],
  catalog: readonly CatalogSnapshot[],
): HomeOverview {
  const reviewRequests: HomeCard[] = [];
  const authored: HomeCard[] = [];
  const placed = new Set<string>();
  for (const snapshot of catalog) {
    for (const item of snapshot.pullRequests) {
      const key = pullRequestSyncKey(item);
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
    const [card] = projectHomeCards([review]);
    if (review.pullRequest) otherSaved.push(card);
    else localRanges.push(card);
  }
  const groups: HomeGroup[] = [];
  const push = (id: HomeGroupId, cards: HomeCard[]) => {
    if (!cards.length) return;
    groups.push({ id, title: GROUP_TITLE[id], cards });
  };
  push("review-requests", reviewRequests);
  push("authored-by-me", authored);
  push("other-saved-prs", otherSaved);
  push("local-ranges", localRanges);
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
