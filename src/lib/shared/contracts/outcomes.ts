import { z } from "zod";
import { Sha } from "./provenance.ts";

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
