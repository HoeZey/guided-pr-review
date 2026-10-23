import { afterEach, expect, test, vi } from "vitest";

vi.mock("$lib/shared/page-data", async (importOriginal) => {
  const actual = await importOriginal<typeof import("$lib/shared/page-data")>();
  return { ...actual, commentsEnabled: () => true };
});
import { mount, tick, unmount } from "svelte";
import type { CommentThread } from "$lib/shared/contracts/comments";
import type { ReviewPageData } from "$lib/shared/page-data";
import { resetReviewSession } from "$lib/client/state/review.svelte";
import { resetPreferences } from "$lib/client/state/preferences.svelte";
import AppShell from "../AppShell.svelte";
import { GUIDE_CHAPTERED } from "../guide/fixture";

const WHEN = "2026-09-16T10:00:00.000Z";
const SHA_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SHA_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

let mounted: ReturnType<typeof mount> | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  if (mounted) unmount(mounted);
  mounted = null;
  host?.remove();
  host = null;
  resetReviewSession();
  resetPreferences();
  localStorage.clear();
  vi.unstubAllGlobals();
});

function thread(
  id: string,
  anchor: CommentThread["anchor"],
  extra: Partial<CommentThread> = {},
): CommentThread {
  return {
    id,
    provider: extra.provider ?? "github",
    status: extra.status ?? "active",
    outdated: extra.outdated ?? false,
    anchor,
    messages: extra.messages ?? [
      {
        id: `${id}-m0`,
        author: { login: "ada" },
        body: `${id} body`,
        createdAt: WHEN,
        updatedAt: WHEN,
        ownedByCurrentUser: true,
      },
    ],
  };
}

const SOURCE = {
  kind: "pull-request" as const,
  provider: "github" as const,
  host: "github.com",
  repository: {
    id: "1",
    owner: "octocat",
    name: "Hello-World",
    webUrl: "https://github.com/octocat/Hello-World",
  },
  number: 1,
  webUrl: "https://github.com/octocat/Hello-World/pull/1",
  sourceRef: "refs/heads/feature",
  targetRef: "refs/heads/develop",
  sourceCommit: SHA_B,
  targetCommit: SHA_A,
  providerContext: { kind: "github" as const },
};

function hostedPage(tab: ReviewPageData["tab"] = "guide"): ReviewPageData {
  return {
    kind: "review",
    status: "ok",
    reviewId: "hosted-1",
    title: GUIDE_CHAPTERED.title,
    guide: { ...GUIDE_CHAPTERED, source: SOURCE },
    outcomes: [],
    catalog: [],
    actions: [],
    agentConnected: false,
    tab,
  };
}

const LISTED: CommentThread[] = [
  thread("review:10", { kind: "line", path: "src/maps.py", side: "current", line: 3 }),
  thread("review:20", { kind: "file", path: "src/maps.py" }),
  thread("issue:1", { kind: "pr" }, { provider: "github" }),
  thread("ado_thr_pr", { kind: "pr" }, { provider: "azure-devops", status: "closed" }),
  thread(
    "review:99",
    { kind: "stale", reason: "unmappable", path: "src/gone.ts" },
    { provider: "github", outdated: true },
  ),
];

function stubComments(list: CommentThread[], onCreate?: (body: Record<string, unknown>) => CommentThread) {
  const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url === "/api/reviews/hosted-1/comments" && method === "GET") {
      return { ok: true, statusText: "OK", json: async () => ({ threads: list }) };
    }
    if (url === "/api/reviews/hosted-1/comments" && method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      const created = onCreate?.(body);
      return { ok: true, statusText: "Created", json: async () => created };
    }
    return { ok: true, statusText: "OK", json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchSpy);
  return fetchSpy;
}

function renderShell(tab: ReviewPageData["tab"] = "guide") {
  host = document.createElement("div");
  document.body.appendChild(host);
  mounted = mount(AppShell, { target: host, props: { data: hostedPage(tab) } });
  return host;
}

test("Discussion lists PR-wide and stale threads with a shared count and never above Diff", async () => {
  stubComments(LISTED);
  const root = renderShell("diff");
  await vi.waitFor(() => {
    expect(root.querySelector('[data-thread="review:10"]')).toBeTruthy();
  });
  expect(root.querySelector('[data-thread="issue:1"]')).toBeNull();
  expect(root.querySelector('[data-thread="ado_thr_pr"]')).toBeNull();
  expect(root.querySelector('[data-thread="review:99"]')).toBeNull();
  expect(root.querySelector("main .comment-stack.is-pr")).toBeNull();
  expect(root.querySelector("main > .comment-stack")).toBeNull();

  const discussionTab = root.querySelector('[role="tab"][data-tab="discussion"]') as HTMLButtonElement;
  expect(discussionTab.getAttribute("role")).toBe("tab");
  expect(discussionTab.textContent).toContain("Discussion");
  expect(discussionTab.textContent).toContain("(3)");
  discussionTab.click();
  await tick();
  expect(root.querySelector("#app")?.getAttribute("data-tab")).toBe("discussion");
  expect(discussionTab.getAttribute("aria-selected")).toBe("true");
  expect(root.querySelector('[data-tab-panel="discussion"]')).toBeTruthy();
  const panel = root.querySelector('[data-tab-panel="discussion"]');
  expect(panel?.querySelector('[data-thread="issue:1"]')?.textContent).toContain("issue:1 body");
  expect(panel?.querySelector('[data-thread="issue:1"]')?.textContent).toContain("GitHub");
  expect(panel?.querySelector('[data-thread="issue:1"]')?.textContent).toContain("Pull request");
  expect(panel?.querySelector('[data-thread="ado_thr_pr"]')?.textContent).toContain("Azure DevOps");
  expect(panel?.querySelector('[data-thread="review:99"]')?.textContent).toContain("Unmappable");
  expect(panel?.querySelector('[data-thread="review:99"]')?.textContent).toContain("src/gone.ts");
  expect(panel?.textContent).not.toMatch(/\{"kind":/);
  expect(panel?.querySelector('[data-thread="review:10"]')).toBeNull();
  expect(panel?.querySelector('[data-thread="review:20"]')).toBeNull();
  expect(panel?.querySelector('[data-comment-reply="issue:1"]')).toBeNull();
  expect(panel?.querySelector('[data-comment-reply="ado_thr_pr"]')).toBeTruthy();
  expect(panel?.querySelector('[data-comment-reply="review:99"]')).toBeTruthy();
  expect(panel?.querySelector("[data-discussion-new]")).toBeTruthy();
  expect(panel?.querySelector('[data-comment-edit="issue:1-m0"]')).toBeTruthy();
  expect(panel?.querySelector('[data-comment-delete="ado_thr_pr-m0"]')).toBeTruthy();

  (root.querySelector('[role="tab"][data-tab="diff"]') as HTMLButtonElement).click();
  await tick();
  expect(root.querySelector('[data-thread="review:10"]')).toBeTruthy();
  expect(root.querySelector('[data-tab-panel="discussion"]')).toBeNull();
  expect(root.querySelector("main .comment-stack.is-pr")).toBeNull();
});

test("Discussion creates a PR-wide thread through the comment service without a host URL", async () => {
  const created = thread("issue:8", { kind: "pr" }, { provider: "github" });
  created.messages[0] = {
    id: "issue:8",
    author: { login: "ada" },
    body: "ship it",
    createdAt: WHEN,
    updatedAt: WHEN,
    ownedByCurrentUser: true,
  };
  const fetchSpy = stubComments([], (body) => {
    expect(body).toMatchObject({ anchor: { kind: "pr" }, body: "ship it" });
    expect(body).not.toHaveProperty("provider");
    expect(body).not.toHaveProperty("webUrl");
    expect(body).not.toHaveProperty("host");
    expect(String(body.clientOperationId)).toMatch(/^cop_[0-9a-f]{32}$/);
    return created;
  });
  const root = renderShell("discussion");
  await vi.waitFor(() => {
    expect(root.querySelector("[data-discussion-new]")).toBeTruthy();
  });
  (root.querySelector("[data-discussion-new]") as HTMLButtonElement).click();
  await tick();
  const draft = root.querySelector("[data-comment-draft]") as HTMLTextAreaElement;
  draft.value = "ship it";
  draft.dispatchEvent(new Event("input", { bubbles: true }));
  await tick();
  (root.querySelector("[data-comment-send]") as HTMLButtonElement).click();
  await vi.waitFor(() => {
    expect(root.querySelector('[data-thread="issue:8"]')).toBeTruthy();
  });
  expect(root.querySelector('[data-thread="issue:8"]')?.textContent).toContain("ship it");
  expect(root.querySelector('[role="tab"][data-tab="discussion"]')?.textContent).toContain("(1)");
  expect(root.querySelector("[data-comment-composer]")).toBeNull();
  const commentUrls = fetchSpy.mock.calls.map(([url]) => String(url)).filter((url) => url.includes("/comments"));
  expect(commentUrls.join(" ")).not.toMatch(/github\.com|dev\.azure\.com/);
});

test("Discussion replies on ADO PR-wide threads and hides nested GitHub issue replies", async () => {
  const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url === "/api/reviews/hosted-1/comments" && method === "GET") {
      return { ok: true, statusText: "OK", json: async () => ({ threads: LISTED }) };
    }
    if (url === "/api/reviews/hosted-1/comments/ado_thr_pr/replies" && method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      expect(body.body).toBe("also here");
      expect(body).not.toHaveProperty("provider");
      return {
        ok: true,
        statusText: "Created",
        json: async () => ({
          id: "ado_cmt_pr_reply",
          author: { login: "ada" },
          body: "also here",
          createdAt: WHEN,
          updatedAt: WHEN,
          ownedByCurrentUser: true,
        }),
      };
    }
    return { ok: true, statusText: "OK", json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchSpy);
  const root = renderShell("discussion");
  await vi.waitFor(() => {
    expect(root.querySelector('[data-comment-reply="ado_thr_pr"]')).toBeTruthy();
  });
  expect(root.querySelector('[data-comment-reply="issue:1"]')).toBeNull();
  (root.querySelector('[data-comment-reply="ado_thr_pr"]') as HTMLButtonElement).click();
  await tick();
  const draft = root.querySelector("[data-comment-draft]") as HTMLTextAreaElement;
  draft.value = "also here";
  draft.dispatchEvent(new Event("input", { bubbles: true }));
  await tick();
  (root.querySelector("[data-comment-send]") as HTMLButtonElement).click();
  await vi.waitFor(() => {
    expect(root.querySelector('[data-thread="ado_thr_pr"]')?.textContent).toContain("also here");
  });
  expect(fetchSpy.mock.calls.map(([url]) => String(url)).join(" ")).not.toMatch(/github\.com|dev\.azure\.com/);
});
