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
  })
  .strict();

export type GuideV1 = z.infer<typeof GuideV1>;
export type Chapter = z.infer<typeof Chapter>;
export type FileChange = z.infer<typeof FileChange>;

export const ReviewRecord = z
  .object({
    id: z.string().min(1),
    addedAt: z.string().min(1),
    guide: GuideV1,
  })
  .strict();

export const StoreV1 = z
  .object({
    version: z.literal(1),
    activeId: z.string().nullable(),
    reviews: z.array(ReviewRecord),
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
  })
  .strict();

export const tools = {
  list_reviews: {
    input: z.object({}).strict(),
    output: z
      .object({
        reviews: z.array(ReviewSummary),
        activeId: z.string().nullable(),
      })
      .strict(),
  },
  add_review: {
    input: z.object({ guide: GuideV1 }).strict(),
    output: z.object({ id: z.string() }).strict(),
  },
  remove_review: {
    input: z.object({ id: z.string().min(1) }).strict(),
    output: z.object({ ok: z.literal(true) }).strict(),
  },
  get_review: {
    input: z.object({ id: z.string().min(1) }).strict(),
    output: z.object({ guide: GuideV1 }).strict(),
  },
  set_active: {
    input: z.object({ id: z.string().min(1) }).strict(),
    output: z.object({ activeId: z.string() }).strict(),
  },
} as const;

export type ListReviewsOutput = z.infer<typeof tools.list_reviews.output>;
export const emptyStore = (): StoreV1 => ({
  version: 1,
  activeId: null,
  reviews: [],
});
