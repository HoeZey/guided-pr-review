import { z } from "zod";
import { PullRequestSource } from "./provenance.ts";

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
    unchaptered: z.boolean().optional(),
    source: PullRequestSource.optional(),
  })
  .strict();

export type GuideV1 = z.infer<typeof GuideV1>;
export type Chapter = z.infer<typeof Chapter>;
export type FileChange = z.infer<typeof FileChange>;
export type Hunk = z.infer<typeof Hunk>;
