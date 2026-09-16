import { expect, test } from "vitest";
import { render } from "svelte/server";
import { GENERATE_GUIDE_DISCONNECTED_HINT } from "$lib/shared/domain/overview";
import { FAKE_GUIDE, FAKE_UNCHAPTERED_REVIEW } from "$lib/shared/shell-fakes";
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

test("Generate Guide SSR covers idle, waiting, failed, and disconnected copy", () => {
  const idle = render(GenerateGuideEmpty, {
    props: {
      reviewId: FAKE_UNCHAPTERED_REVIEW.reviewId,
      actions: [],
      agentConnected: true,
    },
  }).body;
  expect(idle).toContain("Generate guide");
  expect(idle).toContain("This review is a Diff");
  expect(idle).toContain("data-queue-generate");

  const waiting = render(GenerateGuideEmpty, {
    props: {
      reviewId: FAKE_UNCHAPTERED_REVIEW.reviewId,
      agentConnected: true,
      actions: [
        {
          id: "gen-1",
          kind: "generate-guide",
          status: "queued",
          queuedAt: "2026-01-02T00:00:00.000Z",
          reviewId: FAKE_UNCHAPTERED_REVIEW.reviewId,
        },
      ],
    },
  }).body;
  expect(waiting).toContain("Waiting");
  expect(waiting).not.toContain("data-queue-generate");

  const failed = render(GenerateGuideEmpty, {
    props: {
      reviewId: FAKE_UNCHAPTERED_REVIEW.reviewId,
      agentConnected: true,
      actions: [
        {
          id: "gen-1",
          kind: "generate-guide",
          status: "failed",
          queuedAt: "2026-01-02T00:00:00.000Z",
          reviewId: FAKE_UNCHAPTERED_REVIEW.reviewId,
          error: { code: "generate-guide-failed", message: "chaptering timed out" },
        },
      ],
    },
  }).body;
  expect(failed).toContain("chaptering timed out");
  expect(failed).toContain("data-queue-generate");

  const disconnected = render(GenerateGuideEmpty, {
    props: {
      reviewId: FAKE_UNCHAPTERED_REVIEW.reviewId,
      actions: [],
      agentConnected: false,
    },
  }).body;
  expect(disconnected).toContain(GENERATE_GUIDE_DISCONNECTED_HINT);
});
