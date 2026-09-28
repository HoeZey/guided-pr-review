import type { StoredAction } from "../../shared/contracts/catalog.ts";
import type { GuideV1 } from "../../shared/contracts/guide.ts";
import type { StoredOutcome } from "../../shared/contracts/outcomes.ts";
import type { ListReviewsOutput, ReviewDiff } from "../../shared/contracts/persistence.ts";
import type { GitProviderKind } from "../providers/ports.ts";

export type ReviewRepository = {
  listReviews: () => Promise<ListReviewsOutput>;
  getReview: (
    id: string,
  ) => Promise<{ guide: GuideV1; outcomes: StoredOutcome[]; diff?: ReviewDiff }>;
  addReview: (input: unknown) => Promise<{ id: string }>;
  addReviewFromTool: (body: unknown) => Promise<{ id: string }>;
  upsertReview: (input: unknown) => Promise<{ id: string }>;
  upsertReviewFromTool: (body: unknown) => Promise<{ id: string }>;
  removeReview: (id: string) => Promise<{ ok: true }>;
  setActive: (id: string) => Promise<{ activeId: string }>;
  seedIfEmpty: (guide: GuideV1) => Promise<void>;
};

export type CatalogRepository = {
  replaceCatalog: (input: unknown) => Promise<{ ok: true }>;
};

export type ActionRepository = {
  queueAction: (input: unknown) => Promise<{ id: string }>;
  waitForAction: (input?: unknown) => Promise<StoredAction | null>;
  completeAction: (input: unknown) => Promise<{ ok: true }>;
};

export type OutcomeRepository = {
  publishReviewOutcome: (
    reviewId: string,
    outcome: unknown,
  ) => Promise<{ id: string }>;
};

export type ConfiguredRepositoryRecord = {
  provider: GitProviderKind;
  host: string;
  id: string;
  owner: string;
  name: string;
  webUrl: string;
  cloneUrl?: string;
  origin: boolean;
};

/** Configured-repository persistence for PRD 07. */
export type ConfiguredRepositoryPort = {
  list: () => Promise<ConfiguredRepositoryRecord[]>;
  add: (input: ConfiguredRepositoryRecord) => Promise<{ ok: true }>;
  remove: (id: string) => Promise<{ ok: true }>;
};

export type AppRepositories = ReviewRepository &
  CatalogRepository &
  ActionRepository &
  OutcomeRepository;
