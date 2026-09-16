import { z } from "zod";
import {
  CatalogSnapshot,
  ConfiguredRepository,
  StoredActions,
} from "./catalog.ts";
import { GuideV1 } from "./guide.ts";
import { StoredOutcome } from "./outcomes.ts";

export const ReviewRecord = z
  .object({
    id: z.string().min(1),
    addedAt: z.string().min(1),
    guide: GuideV1,
    outcomes: z.array(StoredOutcome).default([]),
  })
  .strict();

export const StoreV1 = z
  .object({
    version: z.literal(1),
    activeId: z.string().nullable(),
    reviews: z.array(ReviewRecord),
    repositories: z.array(ConfiguredRepository).default([]),
    catalog: z.array(CatalogSnapshot).default([]),
    actions: StoredActions,
    agentLastSeen: z.string().min(1).optional(),
  })
  .strict();

export type StoreV1 = z.infer<typeof StoreV1>;
export type ReviewRecord = z.infer<typeof ReviewRecord>;

export const ReviewSummary = z
  .object({
    id: z.string(),
    title: z.string(),
    range: z.string().optional(),
    addedAt: z.string(),
    base: z.string(),
    head: z.string(),
    syncKey: z.string().optional(),
    sourceCommit: z.string().optional(),
    unchaptered: z.boolean().optional(),
    pullRequest: z
      .object({
        provider: z.enum(["azure-devops", "github"]),
        host: z.string(),
        repository: z
          .object({
            id: z.string(),
            owner: z.string(),
            name: z.string(),
          })
          .strict(),
        number: z.number().int(),
        webUrl: z.string(),
        targetRef: z.string().min(1),
        sourceRef: z.string().min(1),
      })
      .strict()
      .optional(),
  })
  .strict();

export type ReviewSummary = z.infer<typeof ReviewSummary>;

export const ListReviewsOutput = z
  .object({
    reviews: z.array(ReviewSummary),
    activeId: z.string().nullable(),
    repositories: z.array(ConfiguredRepository),
    catalog: z.array(CatalogSnapshot),
    actions: StoredActions,
    agentConnected: z.boolean(),
  })
  .strict();

export type ListReviewsOutput = z.infer<typeof ListReviewsOutput>;

export const emptyStore = (): StoreV1 => ({
  version: 1,
  activeId: null,
  reviews: [],
  repositories: [],
  catalog: [],
  actions: [],
});
