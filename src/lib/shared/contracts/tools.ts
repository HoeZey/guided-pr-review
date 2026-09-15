import { z } from "zod";
import {
  ActionError,
  CatalogPullRequest,
  QueueGenerateGuideInput,
  QueueOpenInput,
  QueueRefreshInput,
  QueueUpdateDiffInput,
  StoredAction,
} from "./catalog.ts";
import { GuideV1 } from "./guide.ts";
import { CodeReviewOutcome, StoredOutcome } from "./outcomes.ts";
import { ListReviewsOutput } from "./persistence.ts";
import { isAzureDevOpsHost } from "./provenance.ts";

// Transport-only MCP tool input and output declarations.
// Runtime schemas live in sibling contract modules.

export const tools = {
  list_reviews: {
    input: z.object({}).strict(),
    output: ListReviewsOutput,
  },
  queue_action: {
    input: z.discriminatedUnion("kind", [
      QueueOpenInput,
      QueueUpdateDiffInput,
      QueueRefreshInput,
      QueueGenerateGuideInput,
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
