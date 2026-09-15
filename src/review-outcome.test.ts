import assert from "node:assert/strict";
import { test } from "node:test";
import { CodeReviewOutcome, type StoredOutcome } from "./contracts.ts";
import { findingCounts, selectReviewOutcome } from "./review-outcome.ts";

const BASE = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HEAD = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const OTHER = "cccccccccccccccccccccccccccccccccccccccc";

function stored(
  id: string,
  addedAt: string,
  base: string,
  head: string,
): StoredOutcome {
  return {
    id,
    addedAt,
    outcome: {
      version: 1,
      base,
      head,
      standards: { findings: [] },
      spec: { findings: [] },
    },
  };
}

test("selectReviewOutcome chooses newest exact base and head", () => {
  const older = stored("a", "2026-01-01T00:00:00.000Z", BASE, HEAD);
  const newer = stored("b", "2026-01-02T00:00:00.000Z", BASE, HEAD);
  const otherHead = stored("c", "2026-01-03T00:00:00.000Z", BASE, OTHER);
  const sel = selectReviewOutcome(BASE, HEAD, [older, otherHead, newer]);
  assert.equal(sel.status, "exact");
  assert.equal(sel.status === "exact" ? sel.record.id : "", "b");
});

test("selectReviewOutcome is empty when history is empty", () => {
  assert.equal(selectReviewOutcome(BASE, HEAD, []).status, "empty");
});

test("selectReviewOutcome falls back to newest prior run as outdated", () => {
  const older = stored("old", "2026-01-01T00:00:00.000Z", BASE, OTHER);
  const newer = stored("new", "2026-01-04T00:00:00.000Z", BASE, OTHER);
  const sel = selectReviewOutcome(BASE, HEAD, [older, newer]);
  assert.equal(sel.status, "outdated");
  assert.equal(sel.status === "outdated" ? sel.record.id : "", "new");
});

test("selectReviewOutcome lists every run by date and short head SHA", () => {
  const older = stored("a", "2026-01-01T00:00:00.000Z", BASE, HEAD);
  const newer = stored("b", "2026-01-02T12:00:00.000Z", BASE, OTHER);
  const sel = selectReviewOutcome(BASE, HEAD, [older, newer]);
  assert.equal(sel.status, "exact");
  assert.deepEqual(sel.status === "exact" ? sel.history : [], [
    {
      id: "b",
      addedAt: "2026-01-02T12:00:00.000Z",
      shortHead: "ccccccc",
    },
    {
      id: "a",
      addedAt: "2026-01-01T00:00:00.000Z",
      shortHead: "bbbbbbb",
    },
  ]);
});

test("selectReviewOutcome keeps repeated runs at one head as separate entries", () => {
  const first = stored("a", "2026-01-01T00:00:00.000Z", BASE, HEAD);
  const second = stored("b", "2026-01-02T00:00:00.000Z", BASE, HEAD);
  const sel = selectReviewOutcome(BASE, HEAD, [first, second]);
  assert.equal(sel.status, "exact");
  assert.deepEqual(
    sel.status === "exact" ? sel.history.map((row) => row.id) : [],
    ["b", "a"],
  );
  assert.equal(sel.status === "exact" ? sel.history[0].shortHead : "", "bbbbbbb");
  assert.equal(sel.status === "exact" ? sel.history[1].shortHead : "", "bbbbbbb");
});

test("selectReviewOutcome opens a chosen prior run", () => {
  const older = stored("a", "2026-01-01T00:00:00.000Z", BASE, OTHER);
  const newer = stored("b", "2026-01-02T00:00:00.000Z", BASE, HEAD);
  const sel = selectReviewOutcome(BASE, HEAD, [older, newer], "a");
  assert.equal(sel.status, "outdated");
  assert.equal(sel.status === "outdated" ? sel.record.id : "", "a");
});

test("Standards and Spec counts stay independent including zero", () => {
  const outcome = CodeReviewOutcome.parse({
    version: 1,
    base: BASE,
    head: HEAD,
    standards: {
      findings: [
        { severity: "major", title: "A", explanation: "a" },
        { severity: "nit", title: "B", explanation: "b" },
      ],
    },
    spec: { findings: [] },
  });
  assert.deepEqual(findingCounts(outcome), { standards: 2, spec: 0 });
  const reverse = CodeReviewOutcome.parse({
    ...outcome,
    standards: { findings: [] },
    spec: {
      findings: [
        {
          severity: "minor",
          classification: "partial",
          title: "C",
          explanation: "c",
        },
      ],
    },
  });
  assert.deepEqual(findingCounts(reverse), { standards: 0, spec: 1 });
});
