import { afterEach, expect, test, vi } from "vitest";
import { mount, tick, unmount } from "svelte";
import type { StoredAction } from "$lib/shared/contracts/catalog";
import type { StoredOutcome } from "$lib/shared/contracts/outcomes";
import type { ReviewPageData } from "$lib/shared/page-data";
import { FAKE_GUIDE, FAKE_REVIEW_OK, FAKE_UNCHAPTERED_REVIEW } from "$lib/shared/shell-fakes";
import { GENERATE_GUIDE_DISCONNECTED_HINT } from "$lib/shared/domain/overview";
import { resetReviewSession, session } from "$lib/client/state/review.svelte";
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
  const tab = root.querySelector('[role="tab"][data-tab="review"]') as HTMLButtonElement;
  tab.click();
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

function generateAction(
  status: StoredAction["status"],
  extras: Partial<Extract<StoredAction, { kind: "generate-guide" }>> = {},
): StoredAction {
  return {
    id: extras.id ?? `gen-${status}`,
    kind: "generate-guide",
    status,
    queuedAt: "2026-01-02T00:00:00.000Z",
    reviewId: extras.reviewId ?? FAKE_UNCHAPTERED_REVIEW.reviewId,
    ...extras,
  };
}

async function openGuide(root: HTMLElement) {
  const tab = root.querySelector('[role="tab"][data-tab="guide"]') as HTMLButtonElement;
  tab.click();
  await tick();
}

test("Generate Guide appears only for the current unchaptered review and covers agent states", async () => {
  const chaptered = renderShell(FAKE_REVIEW_OK);
  await openGuide(chaptered);
  expect(chaptered.querySelector("[data-queue-generate]")).toBeNull();
  expect(chaptered.textContent).not.toContain("This review is a Diff");
  unmount(mounted!);
  mounted = null;
  chaptered.remove();

  const idle = renderShell({ ...FAKE_UNCHAPTERED_REVIEW, agentConnected: true });
  await openGuide(idle);
  expect(idle.querySelector(".outcome-empty h2")?.textContent).toBe("Generate guide");
  expect(idle.textContent).toContain("This review is a Diff");
  const cta = idle.querySelector("[data-queue-generate]") as HTMLButtonElement;
  expect(cta.disabled).toBe(false);
  expect(cta.textContent).toBe("Generate guide");
  expect(cta.getAttribute("data-queue-generate")).toBe(FAKE_UNCHAPTERED_REVIEW.reviewId);
  unmount(mounted!);
  mounted = null;
  idle.remove();

  const waiting = renderShell({
    ...FAKE_UNCHAPTERED_REVIEW,
    agentConnected: true,
    actions: [generateAction("queued")],
  });
  await openGuide(waiting);
  const waitingBtn = waiting.querySelector("button.ghost") as HTMLButtonElement;
  expect(waitingBtn.disabled).toBe(true);
  expect(waitingBtn.textContent).toBe("Waiting");
  expect(waiting.querySelector("[data-queue-generate]")).toBeNull();
  unmount(mounted!);
  mounted = null;
  waiting.remove();

  const generating = renderShell({
    ...FAKE_UNCHAPTERED_REVIEW,
    agentConnected: true,
    actions: [generateAction("claimed")],
  });
  await openGuide(generating);
  expect(generating.querySelector("button.ghost")?.textContent).toBe("Generating guide");
  expect((generating.querySelector("button.ghost") as HTMLButtonElement).disabled).toBe(true);
  unmount(mounted!);
  mounted = null;
  generating.remove();

  const failed = renderShell({
    ...FAKE_UNCHAPTERED_REVIEW,
    agentConnected: true,
    actions: [
      generateAction("failed", {
        error: { code: "generate-guide-failed", message: "chaptering timed out" },
      }),
    ],
  });
  await openGuide(failed);
  expect(failed.textContent).toContain("chaptering timed out");
  const retry = failed.querySelector("[data-queue-generate]") as HTMLButtonElement;
  expect(retry.disabled).toBe(false);
  expect(retry.textContent).toBe("Generate guide");
  unmount(mounted!);
  mounted = null;
  failed.remove();

  const disconnected = renderShell({
    ...FAKE_UNCHAPTERED_REVIEW,
    agentConnected: false,
    outcomes: [
      stored("saved-1", "2026-01-02T00:00:00.000Z", BASE, HEAD, {
        standards: {
          findings: [{ severity: "minor", title: "Saved finding", explanation: "Still here." }],
        },
      }),
    ],
  });
  await openGuide(disconnected);
  expect(disconnected.textContent).toContain(GENERATE_GUIDE_DISCONNECTED_HINT);
  expect((disconnected.querySelector("button.ghost") as HTMLButtonElement).disabled).toBe(true);
  await openCodeReview(disconnected);
  expect(disconnected.querySelector("#outcome-standards")?.textContent).toContain("Saved finding");
  const diffTab = disconnected.querySelector('[role="tab"][data-tab="diff"]') as HTMLButtonElement;
  diffTab.click();
  await tick();
  expect(disconnected.querySelector("[data-tab-panel]")).toBeNull();
  expect((disconnected.querySelector('nav[aria-label="Files"]') as HTMLElement).hidden).toBe(false);
});

function listedPayload(page: ReviewPageData, actions = page.actions) {
  return {
    reviews: [
      {
        id: page.reviewId,
        title: page.title,
        addedAt: "2026-01-02T00:00:00.000Z",
        base: page.guide?.base ?? BASE,
        head: page.guide?.head ?? HEAD,
      },
    ],
    activeId: page.reviewId,
    repositories: [],
    catalog: page.catalog,
    actions,
    agentConnected: page.agentConnected,
  };
}

function jsonResponse(body: unknown) {
  return {
    ok: true,
    statusText: "OK",
    json: async () => body,
  };
}

test("Generate Guide queues one action, refreshes while pending, and fills the same review without reload", async () => {
  const reviewId = FAKE_UNCHAPTERED_REVIEW.reviewId;
  const queued = generateAction("queued", { id: "gen-1", reviewId });
  const started: ReviewPageData = {
    ...FAKE_UNCHAPTERED_REVIEW,
    agentConnected: true,
    actions: [queued],
  };
  const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/reviews") return jsonResponse(listedPayload(started));
    if (url === `/api/reviews/${reviewId}`) {
      return jsonResponse({ guide: started.guide, outcomes: started.outcomes });
    }
    throw new Error(`unexpected ${url}`);
  });
  vi.stubGlobal("fetch", fetchSpy);

  const pending = renderShell(started);
  await vi.waitFor(() => {
    const pendingUrls = fetchSpy.mock.calls.map(([url]) => String(url));
    expect(pendingUrls).toContain("/api/reviews");
    expect(pendingUrls).toContain(`/api/reviews/${reviewId}`);
  });
  fetchSpy.mockClear();

  await openCodeReview(pending);
  await openGuide(pending);
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(pending.querySelector("button.ghost")?.textContent).toBe("Waiting");
  unmount(mounted!);
  mounted = null;
  pending.remove();
  fetchSpy.mockReset();
  resetReviewSession();

  const idle: ReviewPageData = { ...FAKE_UNCHAPTERED_REVIEW, agentConnected: true, actions: [] };
  fetchSpy.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url === "/api/actions" && init?.method === "POST") {
      expect(JSON.parse(String(init.body))).toEqual({ kind: "generate-guide", reviewId });
      return jsonResponse({ id: "gen-1" });
    }
    if (url === "/api/reviews") {
      return jsonResponse(
        listedPayload(idle, [generateAction("succeeded", { id: "gen-1", reviewId })]),
      );
    }
    if (url === `/api/reviews/${reviewId}`) {
      return jsonResponse({ guide: FAKE_GUIDE, outcomes: idle.outcomes });
    }
    throw new Error(`unexpected ${url}`);
  });

  const root = renderShell(idle);
  await openGuide(root);
  expect(fetchSpy).not.toHaveBeenCalled();
  (root.querySelector("[data-queue-generate]") as HTMLButtonElement).click();
  await vi.waitFor(() => {
    expect(root.querySelector(".outcome-empty")).toBeNull();
    expect(root.querySelector(".guide-section")).toBeTruthy();
    expect(root.querySelector("[data-tab-panel]")).toBeNull();
  });
  const posts = fetchSpy.mock.calls.filter(
    ([url, init]) => String(url) === "/api/actions" && (init as RequestInit | undefined)?.method === "POST",
  );
  expect(posts).toHaveLength(1);
  expect(session.reviewId).toBe(reviewId);
});

