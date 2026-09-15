import type { CodeReviewOutcome, StoredOutcome } from "./contracts.ts";

export type OutcomeHistoryEntry = {
  id: string;
  addedAt: string;
  shortHead: string;
};

export type OutcomeSelection =
  | { status: "exact"; record: StoredOutcome; history: OutcomeHistoryEntry[] }
  | { status: "outdated"; record: StoredOutcome; history: OutcomeHistoryEntry[] }
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

function newestRun(
  rows: readonly StoredOutcome[],
): StoredOutcome | undefined {
  return rows.reduce<StoredOutcome | undefined>(
    (best, row) => (!best || row.addedAt >= best.addedAt ? row : best),
    undefined,
  );
}

function historyEntries(
  history: readonly StoredOutcome[],
): OutcomeHistoryEntry[] {
  return [...history]
    .sort((a, b) => b.addedAt.localeCompare(a.addedAt))
    .map((row) => ({
      id: row.id,
      addedAt: row.addedAt,
      shortHead: row.outcome.head.slice(0, 7),
    }));
}

function isCurrentRun(
  row: StoredOutcome,
  currentBase: string,
  currentHead: string,
): boolean {
  return row.outcome.base === currentBase && row.outcome.head === currentHead;
}

export function selectReviewOutcome(
  currentBase: string,
  currentHead: string,
  history: readonly StoredOutcome[],
  selectedId?: string | null,
): OutcomeSelection {
  const record =
    (selectedId && history.find((row) => row.id === selectedId)) ||
    newestRun(
      history.filter((row) => isCurrentRun(row, currentBase, currentHead)),
    ) ||
    newestRun(history);
  if (!record) return { status: "empty" };
  return {
    status: isCurrentRun(record, currentBase, currentHead)
      ? "exact"
      : "outdated",
    record,
    history: historyEntries(history),
  };
}
