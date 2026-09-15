import { z } from "zod";

export const LineType = z.enum(["context", "added", "removed"]);
export const ChapterKind = z.enum([
  "core",
  "consequences",
  "glue",
  "tests",
  "noise",
]);

export const Line = z
  .object({
    type: LineType,
    content: z.string(),
    oldLine: z.number().int().optional(),
    newLine: z.number().int().optional(),
  })
  .strict();

export const Hunk = z
  .object({
    header: z.string().optional(),
    oldStart: z.number().int().optional(),
    newStart: z.number().int().optional(),
    lines: z.array(Line),
  })
  .strict();

export const FileChange = z
  .object({
    path: z.string().min(1),
    language: z.string().optional(),
    stub: z.boolean().optional(),
    reason: z.string().optional(),
    additions: z.number().int().min(0).optional(),
    deletions: z.number().int().min(0).optional(),
    hunks: z.array(Hunk).optional(),
  })
  .strict()
  .superRefine((file, ctx) => {
    if (!file.stub && !(file.hunks && file.hunks.length > 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "non-stub file needs hunks",
      });
    }
  });

export const Chapter = z
  .object({
    id: z.string().min(1),
    kind: ChapterKind,
    title: z.string().min(1),
    why: z.string().min(1),
    open: z.boolean().optional(),
    additions: z.number().int().min(0).optional(),
    deletions: z.number().int().min(0).optional(),
    files: z.array(FileChange),
  })
  .strict();

export const Omitted = z
  .object({
    path: z.string().min(1),
    reason: z.string().min(1),
    note: z.string().optional(),
  })
  .strict();

const Sha = z.string().regex(/^[0-9a-f]{40}$/i);

export function isAzureDevOpsHost(host: string): boolean {
  const normalized = host.toLowerCase();
  return (
    normalized === "dev.azure.com" || normalized.endsWith(".visualstudio.com")
  );
}

export const AzureDevOpsProviderContext = z
  .object({
    kind: z.literal("azure-devops"),
    project: z.string().min(1),
    firstComparingIteration: z.number().int(),
    secondComparingIteration: z.number().int(),
    changes: z.record(
      z.string(),
      z.object({ changeTrackingId: z.number().int() }).strict(),
    ),
  })
  .strict();

export const ProviderContext = z.discriminatedUnion("kind", [
  AzureDevOpsProviderContext,
]);

export const PullRequestSource = z
  .object({
    kind: z.literal("pull-request"),
    provider: z.literal("azure-devops"),
    host: z
      .string()
      .min(1)
      .refine(isAzureDevOpsHost, { message: "unsupported git host" }),
    repository: z
      .object({
        id: z.string().min(1),
        owner: z.string().min(1),
        name: z.string().min(1),
        webUrl: z.string().url(),
      })
      .strict(),
    number: z.number().int().positive(),
    webUrl: z.string().url(),
    sourceRef: z.string().min(1),
    targetRef: z.string().min(1),
    sourceCommit: Sha,
    targetCommit: Sha,
    providerContext: ProviderContext,
  })
  .strict();

export const GuideV1 = z
  .object({
    version: z.literal(1),
    title: z.string().min(1),
    summary: z.string().optional(),
    base: z.string().min(1),
    head: z.string().min(1),
    range: z.string().optional(),
    repo: z.string().optional(),
    additions: z.number().int().min(0).optional(),
    deletions: z.number().int().min(0).optional(),
    chapters: z.array(Chapter).min(1),
    omitted: z.array(Omitted).optional(),
    unchaptered: z.boolean().optional(),
    source: PullRequestSource.optional(),
  })
  .strict();

export type GuideV1 = z.infer<typeof GuideV1>;
export type Chapter = z.infer<typeof Chapter>;
export type FileChange = z.infer<typeof FileChange>;
export type Hunk = z.infer<typeof Hunk>;
export type PullRequestSource = z.infer<typeof PullRequestSource>;
export type AzureDevOpsProviderContext = z.infer<typeof AzureDevOpsProviderContext>;

export function pullRequestSyncKey(source: {
  provider: string;
  host: string;
  repository: { id: string };
  number: number;
}): string {
  return `${source.provider}:${source.host}:${source.repository.id}:${source.number}`;
}

export const FindingSeverity = z.enum(["major", "minor", "nit"]);
export const SpecClassification = z.enum([
  "missing",
  "partial",
  "scope-creep",
  "incorrect",
]);

export const FindingLocation = z
  .object({
    path: z.string().min(1),
    startLine: z.number().int(),
    endLine: z.number().int().optional(),
  })
  .strict();

export const FindingReference = z
  .object({
    source: z.string().min(1),
    quote: z.string().optional(),
  })
  .strict();

const findingFields = {
  severity: FindingSeverity,
  title: z.string().min(1),
  explanation: z.string().min(1),
  recommendation: z.string().optional(),
  location: FindingLocation.optional(),
  reference: FindingReference.optional(),
};

export const StandardsFinding = z.object(findingFields).strict();

export const SpecFinding = z
  .object({
    ...findingFields,
    classification: SpecClassification,
  })
  .strict();

export const CodeReviewOutcome = z
  .object({
    version: z.literal(1),
    base: Sha,
    head: Sha,
    branch: z.string().min(1).optional(),
    standards: z.object({ findings: z.array(StandardsFinding) }).strict(),
    spec: z.object({ findings: z.array(SpecFinding) }).strict(),
  })
  .strict();

export type CodeReviewOutcome = z.infer<typeof CodeReviewOutcome>;
export type StandardsFinding = z.infer<typeof StandardsFinding>;
export type SpecFinding = z.infer<typeof SpecFinding>;

export const StoredOutcome = z
  .object({
    id: z.string().min(1),
    addedAt: z.string().min(1),
    outcome: CodeReviewOutcome,
  })
  .strict();

export type StoredOutcome = z.infer<typeof StoredOutcome>;

export const ReviewRecord = z
  .object({
    id: z.string().min(1),
    addedAt: z.string().min(1),
    guide: GuideV1,
    outcomes: z.array(StoredOutcome).default([]),
  })
  .strict();

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
    provider: z.literal("azure-devops"),
    host: z
      .string()
      .min(1)
      .refine(isAzureDevOpsHost, { message: "unsupported git host" }),
    id: z.string().min(1),
    owner: z.string().min(1),
    name: z.string().min(1),
    webUrl: z.string().url(),
    origin: z.boolean(),
  })
  .strict();

export const CatalogPullRequest = z
  .object({
    provider: z.literal("azure-devops"),
    host: z
      .string()
      .min(1)
      .refine(isAzureDevOpsHost, { message: "unsupported git host" }),
    repository: CatalogRepositoryIdentity,
    number: z.number().int().positive(),
    title: z.string().min(1),
    webUrl: z.string().url(),
    sourceRef: z.string().min(1),
    targetRef: z.string().min(1),
    sourceCommit: Sha,
    targetCommit: Sha,
    isDraft: z.boolean(),
    status: z.enum(["active", "completed", "abandoned"]),
    author: z.string().min(1),
    isReviewer: z.boolean(),
    isAuthor: z.boolean(),
    updatedAt: z.string().min(1),
  })
  .strict();

export const CatalogSnapshot = z
  .object({
    provider: z.literal("azure-devops"),
    host: z
      .string()
      .min(1)
      .refine(isAzureDevOpsHost, { message: "unsupported git host" }),
    repository: CatalogRepositoryIdentity,
    syncedAt: z.string().min(1).optional(),
    error: z.string().min(1).optional(),
    pullRequests: z.array(CatalogPullRequest),
  })
  .strict();

export const OpenActionTarget = z
  .object({
    provider: z.literal("azure-devops"),
    host: z
      .string()
      .min(1)
      .refine(isAzureDevOpsHost, { message: "unsupported git host" }),
    repository: CatalogRepositoryIdentity,
    number: z.number().int().positive(),
  })
  .strict();

export const ActionError = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
  })
  .strict();

export const ActionKind = z.enum(["open", "refresh", "update-diff"]);

export const StoredAction = z
  .object({
    id: z.string().min(1),
    kind: ActionKind,
    status: z.enum(["queued", "claimed", "succeeded", "failed"]),
    queuedAt: z.string().min(1),
    claimedAt: z.string().min(1).optional(),
    completedAt: z.string().min(1).optional(),
    target: OpenActionTarget.optional(),
    reviewId: z.string().min(1).optional(),
    error: ActionError.optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.kind !== "refresh" && !value.target) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "target required unless the action is Refresh",
        path: ["target"],
      });
    }
  });

export const StoreV1 = z
  .object({
    version: z.literal(1),
    activeId: z.string().nullable(),
    reviews: z.array(ReviewRecord),
    repositories: z.array(ConfiguredRepository).default([]),
    catalog: z.array(CatalogSnapshot).default([]),
    actions: z.array(StoredAction).default([]),
    agentLastSeen: z.string().min(1).optional(),
  })
  .strict();

export type StoreV1 = z.infer<typeof StoreV1>;
export type ReviewRecord = z.infer<typeof ReviewRecord>;
export type StoredAction = z.infer<typeof StoredAction>;
export type ActionKind = z.infer<typeof ActionKind>;
export type OpenActionTarget = z.infer<typeof OpenActionTarget>;
export type ActionError = z.infer<typeof ActionError>;

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
        provider: z.literal("azure-devops"),
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

export const tools = {
  list_reviews: {
    input: z.object({}).strict(),
    output: z
      .object({
        reviews: z.array(ReviewSummary),
        activeId: z.string().nullable(),
        repositories: z.array(ConfiguredRepository),
        catalog: z.array(CatalogSnapshot),
        actions: z.array(StoredAction),
        agentConnected: z.boolean(),
      })
      .strict(),
  },
  queue_action: {
    input: z.discriminatedUnion("kind", [
      z
        .object({
          kind: z.literal("open"),
          target: OpenActionTarget,
        })
        .strict(),
      z
        .object({
          kind: z.literal("update-diff"),
          target: OpenActionTarget,
        })
        .strict(),
      z.object({ kind: z.literal("refresh") }).strict(),
    ]),
    output: z.object({ id: z.string() }).strict(),
  },
  wait_for_action: {
    input: z
      .object({
        timeoutMs: z.number().int().min(0).max(30_000).optional(),
      })
      .strict(),
    output: z.object({ action: StoredAction.nullable() }).strict(),
  },
  complete_action: {
    input: z
      .object({
        id: z.string().min(1),
        status: z.enum(["succeeded", "failed"]),
        reviewId: z.string().min(1).optional(),
        error: ActionError.optional(),
      })
      .strict()
      .superRefine((value, ctx) => {
        if (value.status === "failed" && !value.error) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "error required when an action fails",
            path: ["error"],
          });
        }
      }),
    output: z.object({ ok: z.literal(true) }).strict(),
  },
  replace_catalog: {
    input: z
      .object({
        origin: z.boolean(),
        repository: z
          .object({
            provider: z.literal("azure-devops"),
            host: z
              .string()
              .min(1)
              .refine(isAzureDevOpsHost, { message: "unsupported git host" }),
            id: z.string().min(1),
            owner: z.string().min(1),
            name: z.string().min(1),
            webUrl: z.string().url(),
          })
          .strict(),
        syncedAt: z.string().min(1).optional(),
        error: z.string().min(1).optional(),
        pullRequests: z.array(CatalogPullRequest).default([]),
      })
      .strict()
      .superRefine((value, ctx) => {
        if (!value.error && !value.syncedAt) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "syncedAt required when catalog replacement succeeds",
            path: ["syncedAt"],
          });
        }
      }),
    output: z.object({ ok: z.literal(true) }).strict(),
  },
  add_review: {
    input: z.object({ guide: GuideV1 }).strict(),
    output: z.object({ id: z.string() }).strict(),
  },
  upsert_review: {
    input: z.object({ guide: GuideV1 }).strict(),
    output: z.object({ id: z.string() }).strict(),
  },
  publish_review_outcome: {
    input: z
      .object({
        reviewId: z.string().min(1),
        outcome: CodeReviewOutcome,
      })
      .strict(),
    output: z.object({ id: z.string() }).strict(),
  },
  remove_review: {
    input: z.object({ id: z.string().min(1) }).strict(),
    output: z.object({ ok: z.literal(true) }).strict(),
  },
  get_review: {
    input: z.object({ id: z.string().min(1) }).strict(),
    output: z
      .object({
        guide: GuideV1,
        outcomes: z.array(StoredOutcome),
      })
      .strict(),
  },
  set_active: {
    input: z.object({ id: z.string().min(1) }).strict(),
    output: z.object({ activeId: z.string() }).strict(),
  },
} as const;

export type ListReviewsOutput = z.infer<typeof tools.list_reviews.output>;
export type ConfiguredRepository = z.infer<typeof ConfiguredRepository>;
export type CatalogPullRequest = z.infer<typeof CatalogPullRequest>;
export type CatalogSnapshot = z.infer<typeof CatalogSnapshot>;
export const emptyStore = (): StoreV1 => ({
  version: 1,
  activeId: null,
  reviews: [],
  repositories: [],
  catalog: [],
  actions: [],
});
