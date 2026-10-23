import { z } from "zod";

export const CommentProviderKind = z.enum(["azure-devops", "github"]);
export const CommentThreadStatus = z.enum(["active", "closed", "unknown"]);
export const CommentSide = z.literal("current");
export const StaleAnchorReason = z.enum(["unmappable", "deleted-line", "outdated"]);

export const ClientOperationId = z
  .string()
  .regex(/^cop_[0-9a-f]{32}$/, "invalid client operation id");

export const LineAnchor = z
  .object({
    kind: z.literal("line"),
    path: z.string().min(1),
    side: CommentSide,
    line: z.number().int().positive(),
  })
  .strict();

export const RangeAnchor = z
  .object({
    kind: z.literal("range"),
    path: z.string().min(1),
    side: CommentSide,
    startLine: z.number().int().positive(),
    endLine: z.number().int().positive(),
  })
  .strict();

export const FileAnchor = z
  .object({
    kind: z.literal("file"),
    path: z.string().min(1),
  })
  .strict();

export const PullRequestAnchor = z
  .object({
    kind: z.literal("pr"),
  })
  .strict();

export const StaleAnchor = z
  .object({
    kind: z.literal("stale"),
    reason: StaleAnchorReason,
    path: z.string().min(1).optional(),
  })
  .strict();

function refineRange(value: { kind: string; startLine?: number; endLine?: number }, ctx: z.RefinementCtx): void {
  if (value.kind !== "range") return;
  if (
    typeof value.startLine === "number" &&
    typeof value.endLine === "number" &&
    value.endLine < value.startLine
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "range end must be at or after start",
      path: ["endLine"],
    });
  }
}

export const CommentAnchor = z
  .discriminatedUnion("kind", [LineAnchor, RangeAnchor, FileAnchor, PullRequestAnchor, StaleAnchor])
  .superRefine(refineRange);

export const CreateCommentAnchor = z
  .discriminatedUnion("kind", [LineAnchor, RangeAnchor, FileAnchor, PullRequestAnchor])
  .superRefine(refineRange);

export const CommentAuthor = z
  .object({
    login: z.string().min(1),
  })
  .strict();

export const CommentMessage = z
  .object({
    id: z.string().min(1),
    author: CommentAuthor,
    body: z.string(),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
    ownedByCurrentUser: z.boolean(),
    deleted: z.boolean().optional(),
  })
  .strict();

export const CommentThread = z
  .object({
    id: z.string().min(1),
    provider: CommentProviderKind,
    status: CommentThreadStatus,
    outdated: z.boolean(),
    anchor: CommentAnchor,
    messages: z.array(CommentMessage).min(1),
  })
  .strict();

export const CreateThreadRequest = z
  .object({
    anchor: CreateCommentAnchor,
    body: z.string().min(1),
    clientOperationId: ClientOperationId,
  })
  .strict();

export const ReplyRequest = z
  .object({
    body: z.string().min(1),
    clientOperationId: ClientOperationId,
  })
  .strict();

export const UpdateCommentRequest = z
  .object({
    body: z.string().min(1),
  })
  .strict();

export const CommentThreadList = z
  .object({
    threads: z.array(CommentThread),
  })
  .strict();

export type CommentProviderKind = z.infer<typeof CommentProviderKind>;
export type CommentThreadStatus = z.infer<typeof CommentThreadStatus>;
export type CommentSide = z.infer<typeof CommentSide>;
export type StaleAnchorReason = z.infer<typeof StaleAnchorReason>;
export type ClientOperationId = z.infer<typeof ClientOperationId>;
export type LineAnchor = z.infer<typeof LineAnchor>;
export type RangeAnchor = z.infer<typeof RangeAnchor>;
export type FileAnchor = z.infer<typeof FileAnchor>;
export type PullRequestAnchor = z.infer<typeof PullRequestAnchor>;
export type StaleAnchor = z.infer<typeof StaleAnchor>;
export type CommentAnchor = z.infer<typeof CommentAnchor>;
export type CreateCommentAnchor = z.infer<typeof CreateCommentAnchor>;
export type CommentAuthor = z.infer<typeof CommentAuthor>;
export type CommentMessage = z.infer<typeof CommentMessage>;
export type CommentThread = z.infer<typeof CommentThread>;
export type CreateThreadRequest = z.infer<typeof CreateThreadRequest>;
export type ReplyRequest = z.infer<typeof ReplyRequest>;
export type UpdateCommentRequest = z.infer<typeof UpdateCommentRequest>;
export type CommentThreadList = z.infer<typeof CommentThreadList>;
