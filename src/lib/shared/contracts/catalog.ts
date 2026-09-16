import { z } from "zod";
import { Sha, refineProviderHost } from "./provenance.ts";

const GitProvider = z.enum(["azure-devops", "github"]);

const CatalogRepositoryIdentity = z
  .object({
    id: z.string().min(1),
    owner: z.string().min(1),
    name: z.string().min(1),
    webUrl: z.string().url(),
  })
  .strict();

export const ConfiguredRepository = z
  .object({
    provider: GitProvider,
    host: z.string().min(1),
    id: z.string().min(1),
    owner: z.string().min(1),
    name: z.string().min(1),
    webUrl: z.string().url(),
    cloneUrl: z.string().min(1).optional(),
    origin: z.boolean(),
  })
  .strict()
  .superRefine(refineProviderHost);

export const CatalogPullRequest = z
  .object({
    provider: GitProvider,
    host: z.string().min(1),
    repository: CatalogRepositoryIdentity,
    number: z.number().int().positive(),
    title: z.string().min(1),
    webUrl: z.string().url(),
    sourceRef: z.string().min(1),
    targetRef: z.string().min(1),
    sourceCommit: Sha,
    targetCommit: Sha,
    isDraft: z.boolean(),
    status: z.enum(["active", "completed", "abandoned", "closed"]),
    author: z.string().min(1),
    isReviewer: z.boolean(),
    isAuthor: z.boolean(),
    updatedAt: z.string().min(1),
  })
  .strict()
  .superRefine(refineProviderHost);

export const CatalogSnapshot = z
  .object({
    provider: GitProvider,
    host: z.string().min(1),
    repository: CatalogRepositoryIdentity,
    syncedAt: z.string().min(1).optional(),
    attemptedAt: z.string().min(1).optional(),
    error: z.string().min(1).optional(),
    pullRequests: z.array(CatalogPullRequest),
  })
  .strict()
  .superRefine(refineProviderHost);

export const OpenActionTarget = z
  .object({
    provider: GitProvider,
    host: z.string().min(1),
    repository: CatalogRepositoryIdentity,
    number: z.number().int().positive(),
  })
  .strict()
  .superRefine(refineProviderHost);

export const ActionError = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
  })
  .strict();

const ActionStatus = z.enum(["queued", "claimed", "succeeded", "failed"]);

const storedActionBase = {
  id: z.string().min(1),
  status: ActionStatus,
  queuedAt: z.string().min(1),
  claimedAt: z.string().min(1).optional(),
  completedAt: z.string().min(1).optional(),
  error: ActionError.optional(),
};

export const StoredOpenAction = z
  .object({
    ...storedActionBase,
    kind: z.literal("open"),
    target: OpenActionTarget,
    reviewId: z.string().min(1).optional(),
  })
  .strict();

export const StoredUpdateDiffAction = z
  .object({
    ...storedActionBase,
    kind: z.literal("update-diff"),
    target: OpenActionTarget,
    reviewId: z.string().min(1).optional(),
  })
  .strict();

export const StoredRefreshAction = z
  .object({
    ...storedActionBase,
    kind: z.literal("refresh"),
    reviewId: z.string().min(1).optional(),
  })
  .strict();

export const StoredGenerateGuideAction = z
  .object({
    ...storedActionBase,
    kind: z.literal("generate-guide"),
    reviewId: z.string().min(1),
  })
  .strict();

export const StoredAction = z.discriminatedUnion("kind", [
  StoredOpenAction,
  StoredUpdateDiffAction,
  StoredRefreshAction,
  StoredGenerateGuideAction,
]);

export const QueueOpenInput = z
  .object({
    kind: z.literal("open"),
    target: OpenActionTarget,
  })
  .strict();

export const QueueUpdateDiffInput = z
  .object({
    kind: z.literal("update-diff"),
    target: OpenActionTarget,
  })
  .strict();

export const QueueRefreshInput = z.object({ kind: z.literal("refresh") }).strict();

export const QueueGenerateGuideInput = z
  .object({
    kind: z.literal("generate-guide"),
    reviewId: z.string().min(1),
  })
  .strict();

export type StoredAction = z.infer<typeof StoredAction>;
export type StoredOpenAction = z.infer<typeof StoredOpenAction>;
export type StoredGenerateGuideAction = z.infer<typeof StoredGenerateGuideAction>;
export type ActionKind = StoredAction["kind"];
export type OpenActionTarget = z.infer<typeof OpenActionTarget>;
export type ActionError = z.infer<typeof ActionError>;
export type ConfiguredRepository = z.infer<typeof ConfiguredRepository>;
export type CatalogPullRequest = z.infer<typeof CatalogPullRequest>;
export type CatalogSnapshot = z.infer<typeof CatalogSnapshot>;
