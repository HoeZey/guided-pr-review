import type { GuideV1 } from "./contracts/guide";

export type PageStatus = "ok" | "loading" | "error";

export type ReviewTab = "guide" | "diff" | "review";

export type HomeReviewLink = {
  id: string;
  title: string;
};

export type HomePageData = {
  kind: "home";
  status: PageStatus;
  error?: string;
  reviews: HomeReviewLink[];
};

export type ReviewPageData = {
  kind: "review";
  status: PageStatus;
  error?: string;
  reviewId: string;
  title: string;
  guide: GuideV1 | null;
};
