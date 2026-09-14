import type { ReviewSummary } from "./contracts.ts";

export type HomeCard = {
  id: string;
  title: string;
  range: string | undefined;
  repository: { owner: string; name: string } | undefined;
  webUrl: string | undefined;
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
  }));
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
