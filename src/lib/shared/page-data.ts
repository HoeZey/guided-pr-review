import type { StoredAction, CatalogSnapshot, ConfiguredRepository } from "./contracts/catalog";
import type { GuideV1 } from "./contracts/guide";
import type { StoredOutcome } from "./contracts/outcomes";

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
  catalog: CatalogSnapshot[];
  actions: StoredAction[];
  activeId: string | null;
  agentConnected: boolean;
  repositories: ConfiguredRepository[];
};

export type ReviewPageData = {
  kind: "review";
  status: PageStatus;
  error?: string;
  reviewId: string;
  title: string;
  guide: GuideV1 | null;
  outcomes: StoredOutcome[];
  catalog: CatalogSnapshot[];
  actions: StoredAction[];
  agentConnected: boolean;
};
