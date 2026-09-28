import { expect, test } from "vitest";
import { render } from "svelte/server";
import { FAKE_GUIDE } from "$lib/shared/shell-fakes";
import type { StoredOutcome } from "$lib/shared/contracts/outcomes";
import GenerateGuideEmpty from "./GenerateGuideEmpty.svelte";
import OutcomeBody from "./OutcomeBody.svelte";
import OutcomeRail from "./OutcomeRail.svelte";

const BASE = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HEAD = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const OTHER = "cccccccccccccccccccccccccccccccccccccccc";

function stored(
  id: string,
  addedAt: string,
  base: string,
  head: string,
  extra?: Partial<StoredOutcome["outcome"]>,
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
      ...extra,
    },
  };
}

test("Code Review SSR covers empty, exact, and outdated markup", () => {
  const empty = render(OutcomeRail, {
    props: { base: BASE, head: HEAD, outcomes: [] },
  }).body;
  expect(empty).toContain("No runs");
  expect(
    render(OutcomeBody, { props: { base: BASE, head: HEAD, outcomes: [] } }).body,
  ).toContain("No code-review outcome");

  const exact = stored("exact-1", "2026-01-02T00:00:00.000Z", BASE, HEAD, {
    standards: {
      findings: [{ severity: "major", title: "Lock mutex", explanation: "Hold the lock." }],
    },
  });
  const exactBody = render(OutcomeBody, {
    props: { base: FAKE_GUIDE.base, head: FAKE_GUIDE.head, outcomes: [exact] },
  }).body;
  expect(exactBody).toContain("Lock mutex");
  expect(exactBody).not.toContain("Outdated");

  const prior = stored("old-1", "2026-01-01T00:00:00.000Z", BASE, OTHER);
  const outdated = render(OutcomeBody, {
    props: { base: BASE, head: HEAD, outcomes: [prior] },
  }).body;
  expect(outdated).toContain("Outdated");
});

test("empty Guide SSR shows coding-agent copy with no Generate guide button", () => {
  const body = render(GenerateGuideEmpty).body;
  expect(body).toContain("<h2>No guide</h2>");
  expect(body).toContain("Ask your coding agent to generate a reading-order guide.");
  expect(body).not.toContain("Generate guide");
  expect(body).not.toContain("data-queue-generate");
  expect(body).not.toContain("<button");
});
