import { afterEach, expect, test, vi } from "vitest";
import { mount, tick, unmount } from "svelte";
import type { StoredOutcome } from "$lib/shared/contracts/outcomes";
import type { ReviewPageData } from "$lib/shared/page-data";
import { FAKE_REVIEW_OK, FAKE_UNCHAPTERED_REVIEW } from "$lib/shared/shell-fakes";
import { resetReviewSession, setTab } from "$lib/client/state/review.svelte";
import AppShell from "../AppShell.svelte";

let mounted: ReturnType<typeof mount> | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  if (mounted) unmount(mounted);
  mounted = null;
  host?.remove();
  host = null;
  resetReviewSession();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
});

const BASE = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const HEAD = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const OTHER = "cccccccccccccccccccccccccccccccccccccccc";

function renderShell(data: ReviewPageData) {
  resetReviewSession();
  host = document.createElement("div");
  document.body.appendChild(host);
  mounted = mount(AppShell, { target: host, props: { data } });
  return host;
}

async function openCodeReview(root: HTMLElement) {
  expect(root.querySelector('[role="tab"][data-tab="review"]')).toBeNull();
  await tick();
  setTab("review");
  await tick();
}

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

function reviewWith(overrides: Partial<ReviewPageData>): ReviewPageData {
  return { ...FAKE_REVIEW_OK, ...overrides };
}

test("Code Review renders empty, exact current, and newest-prior outdated runs", async () => {
  const empty = renderShell(FAKE_REVIEW_OK);
  await openCodeReview(empty);
  expect(empty.querySelector(".nav-empty")?.textContent).toBe("No runs");
  expect(empty.querySelector(".outcome-empty h2")?.textContent).toBe("No code-review outcome");
  expect(empty.textContent).toContain("Run /code-review on this base and head");
  expect(empty.querySelector(".outcome-stale")).toBeNull();
  unmount(mounted!);
  mounted = null;
  empty.remove();

  const exactRow = stored("exact-1", "2026-01-02T00:00:00.000Z", BASE, HEAD, {
    standards: {
      findings: [{ severity: "major", title: "Lock mutex", explanation: "Hold the lock." }],
    },
  });
  const prior = stored("old-1", "2026-01-01T00:00:00.000Z", BASE, OTHER, {
    spec: {
      findings: [
        {
          severity: "minor",
          classification: "partial",
          title: "Old spec",
          explanation: "Prior head.",
        },
      ],
    },
  });
  const exact = renderShell(reviewWith({ outcomes: [prior, exactRow] }));
  await openCodeReview(exact);
  expect(exact.querySelector(".outcome-stale")).toBeNull();
  expect(exact.querySelector("#outcome-standards")?.textContent).toContain("Lock mutex");
  expect(exact.querySelector('[data-jump="outcome-standards"] .axis-count')?.textContent).toBe("1");
  expect(exact.querySelector('[data-jump="outcome-spec"] .axis-count')?.textContent).toBe("0");
  expect((exact.querySelector("[data-outcome-run]") as HTMLSelectElement).value).toBe("exact-1");
  unmount(mounted!);
  mounted = null;
  exact.remove();

  const outdated = renderShell(reviewWith({ outcomes: [prior] }));
  await openCodeReview(outdated);
  expect(outdated.querySelector(".outcome-stale")?.textContent).toMatch(/Outdated/);
  expect(outdated.querySelector("#outcome-spec")?.textContent).toContain("Old spec");
  expect(outdated.querySelector('[data-jump="outcome-standards"] .axis-count')?.textContent).toBe("0");
  expect(outdated.querySelector('[data-jump="outcome-spec"] .axis-count')?.textContent).toBe("1");
});

test("Code Review history, repeated runs, and finding copy stay complete across tabs", async () => {
  const first = stored("run-a", "2026-01-01T08:00:00.000Z", BASE, HEAD, {
    standards: {
      findings: [
        {
          severity: "nit",
          title: "First run",
          explanation: "Oldest exact.",
          recommendation: "Leave it.",
          location: { path: "src/a.ts", startLine: 4, endLine: 6 },
          reference: { source: "engineering.mdc", quote: "one guard" },
        },
      ],
    },
  });
  const second = stored("run-b", "2026-01-02T15:30:00.000Z", BASE, HEAD, {
    spec: {
      findings: [
        {
          severity: "major",
          classification: "incorrect",
          title: "Second run",
          explanation: "Newest exact.",
          location: { path: "src/b.ts", startLine: 10 },
        },
      ],
    },
  });
  const root = renderShell(reviewWith({ outcomes: [first, second] }));
  await openCodeReview(root);
  const select = root.querySelector("[data-outcome-run]") as HTMLSelectElement;
  expect([...select.options].map((opt) => opt.value)).toEqual(["run-b", "run-a"]);
  expect(select.options[0].textContent).toBe("2026-01-02 15:30 · bbbbbbb");
  expect(select.options[1].textContent).toBe("2026-01-01 08:00 · bbbbbbb");
  expect(root.querySelector('[data-jump="outcome-standards"] .axis-count')?.textContent).toBe("0");
  expect(root.querySelector('[data-jump="outcome-spec"] .axis-count')?.textContent).toBe("1");
  expect(root.querySelector("#outcome-spec")?.textContent).toContain("Second run");
  expect(root.querySelector("#outcome-spec .severity-major")?.textContent).toBe("major");
  expect(root.querySelector("#outcome-spec .classification")?.textContent).toBe("incorrect");
  expect(root.querySelector("#outcome-spec .location")?.textContent).toBe("src/b.ts:10");

  select.value = "run-a";
  select.dispatchEvent(new Event("change", { bubbles: true }));
  await tick();
  expect(root.querySelector(".outcome-stale")).toBeNull();
  expect(root.querySelector("#outcome-standards")?.textContent).toContain("First run");
  expect(root.querySelector("#outcome-standards .severity-nit")?.textContent).toBe("nit");
  expect(root.querySelector("#outcome-standards .location")?.textContent).toBe("src/a.ts:4–6");
  expect(root.querySelector("#outcome-standards .recommendation")?.textContent).toContain("Leave it.");
  expect(root.querySelector("#outcome-standards .reference")?.textContent).toContain("engineering.mdc");
  expect(root.querySelector("#outcome-standards .reference")?.textContent).toContain("one guard");
  expect(root.querySelector('[data-jump="outcome-standards"] .axis-count')?.textContent).toBe("1");
  expect(root.querySelector('[data-jump="outcome-spec"] .axis-count')?.textContent).toBe("0");
  expect(root.querySelector("#outcome-spec .axis-empty")?.textContent).toBe("No Spec findings.");

  const guideTab = root.querySelector('[role="tab"][data-tab="guide"]') as HTMLButtonElement;
  guideTab.click();
  await tick();
  expect(root.querySelector("#outcome-standards")).toBeNull();
  await openCodeReview(root);
  expect((root.querySelector("[data-outcome-run]") as HTMLSelectElement).value).toBe("run-a");
  expect(root.querySelector("#outcome-standards")?.textContent).toContain("First run");
});

async function openGuide(root: HTMLElement) {
  const tab = root.querySelector('[role="tab"][data-tab="guide"]') as HTMLButtonElement;
  tab.click();
  await tick();
}

test("empty Guide shows coding-agent copy with no Generate guide button", async () => {
  const chaptered = renderShell(FAKE_REVIEW_OK);
  await openGuide(chaptered);
  expect(chaptered.querySelector(".outcome-empty")).toBeNull();
  expect(chaptered.querySelector("[data-queue-generate]")).toBeNull();
  expect(chaptered.textContent).not.toContain(
    "Ask your coding agent to generate a reading-order guide.",
  );
  unmount(mounted!);
  mounted = null;
  chaptered.remove();

  const empty = renderShell({ ...FAKE_UNCHAPTERED_REVIEW, agentConnected: true });
  await openGuide(empty);
  expect(empty.querySelector(".outcome-empty h2")?.textContent).toBe("No guide");
  expect(empty.textContent).toContain(
    "Ask your coding agent to generate a reading-order guide.",
  );
  expect(empty.querySelector(".outcome-empty button")).toBeNull();
  expect(empty.querySelector("[data-queue-generate]")).toBeNull();
  expect(empty.textContent).not.toContain("Generate guide");
  expect(empty.textContent).not.toContain("This review is a Diff");
});

