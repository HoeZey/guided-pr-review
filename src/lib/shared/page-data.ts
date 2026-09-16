import type { StoredAction, CatalogSnapshot, ConfiguredRepository } from "./contracts/catalog";
import type { GuideV1 } from "./contracts/guide";
import type { StoredOutcome } from "./contracts/outcomes";
import type { ReviewSummary } from "./contracts/persistence";

export type PageStatus = "ok" | "loading" | "error";

export type ReviewTab = "guide" | "diff" | "review";

export type HomePageData = {
  kind: "home";
  status: PageStatus;
  error?: string;
  reviews: ReviewSummary[];
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
