import type { CodeReviewOutcome, StoredOutcome } from "./contracts.ts";

export type OutcomeSelection =
  | { status: "exact"; record: StoredOutcome }
  | { status: "empty" };

export function findingCounts(outcome: CodeReviewOutcome): {
  standards: number;
  spec: number;
} {
  return {
    standards: outcome.standards.findings.length,
    spec: outcome.spec.findings.length,
  };
}

export function selectReviewOutcome(
  currentBase: string,
  currentHead: string,
  history: readonly StoredOutcome[],
): OutcomeSelection {
  const matches = history.filter(
    (row) => row.outcome.base === currentBase && row.outcome.head === currentHead,
  );
  if (matches.length === 0) return { status: "empty" };
  const newest = matches.reduce((best, row) =>
    row.addedAt >= best.addedAt ? row : best,
  );
  return { status: "exact", record: newest };
}
