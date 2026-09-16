import { afterEach, expect, test, vi } from "vitest";
import { mount, tick, unmount } from "svelte";
import type { CommentThread } from "$lib/shared/contracts/comments";
import type { ReviewPageData } from "$lib/shared/page-data";
import { headerThreads, projectInlineThreads, threadsAfter } from "$lib/shared/domain/comment-slots";
import { filesForDiff } from "$lib/shared/domain/guide-view";
import { THREAD_LIST_STALE_MS } from "$lib/client/state/threads.svelte";
import { resetReviewSession } from "$lib/client/state/review.svelte";
import { resetPreferences } from "$lib/client/state/preferences.svelte";
import { resetSyntax, setHighlighterLoader } from "$lib/client/browser/syntax";
import AppShell from "../AppShell.svelte";
import CodeFile from "./CodeFile.svelte";
import { CODE_VIEW_FIXTURE } from "./fixture";
import { GUIDE_CHAPTERED } from "../guide/fixture";
import { DIFF_GUIDE } from "../diff/fixture";

const WHEN = "2026-09-16T10:00:00.000Z";
const SHA_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SHA_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

let mounted: ReturnType<typeof mount> | null = null;
let host: HTMLDivElement | null = null;

const OFFSET_HEIGHT = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "offsetHeight");

afterEach(() => {
  if (mounted) unmount(mounted);
  mounted = null;
  host?.remove();
  host = null;
  resetReviewSession();
  resetPreferences();
  resetSyntax();
  localStorage.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  if (OFFSET_HEIGHT) Object.defineProperty(HTMLElement.prototype, "offsetHeight", OFFSET_HEIGHT);
  else delete (HTMLElement.prototype as { offsetHeight?: number }).offsetHeight;
});

function echoHighlighter() {
  setHighlighterLoader(async () => ({
    codeToTokens(code: string) {
      return { tokens: [[{ content: code, color: "#111" }]] };
    },
  }));
}

function thread(id: string, anchor: CommentThread["anchor"], extra: Partial<CommentThread> = {}): CommentThread {
  return {
    id,
    provider: "github",
    status: extra.status ?? "active",
    outdated: extra.outdated ?? false,
    anchor,
    messages: extra.messages ?? [
      {
        id: `${id}-m0`,
        author: { login: "ada" },
        body: `${id} body`,
        createdAt: WHEN,
        updatedAt: extra.messages?.[0]?.updatedAt ?? WHEN,
        ownedByCurrentUser: true,
        ...(extra.messages?.[0]?.deleted ? { deleted: true } : {}),
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

function hostedPage(guide = { ...GUIDE_CHAPTERED, source: SOURCE }, tab: ReviewPageData["tab"] = "guide"): ReviewPageData {
  return {
    kind: "review",
    status: "ok",
    reviewId: "hosted-1",
    title: guide.title,
    guide,
    outcomes: [],
    catalog: [],
    actions: [],
    agentConnected: false,
    tab,
  };
}

test("CodeFile renders file threads under the header and line threads after unified and split rows", async () => {
  echoHighlighter();
  const fileThread = thread("file-a", { kind: "file", path: CODE_VIEW_FIXTURE.path });
  const lineThread = thread("line-3", {
    kind: "line",
    path: CODE_VIEW_FIXTURE.path,
    side: "current",
    line: 3,
  });
  const files = [CODE_VIEW_FIXTURE];
  const unifiedSlots = projectInlineThreads([fileThread, lineThread], files, {
    layout: "unified",
    hideUnchanged: false,
    surface: "diff",
  });
  host = document.createElement("div");
  document.body.appendChild(host);
  mounted = mount(CodeFile, {
    target: host,
    props: {
      file: CODE_VIEW_FIXTURE,
      id: "f-0",
      layout: "unified",
      theme: "dark",
      headerThreads: headerThreads(unifiedSlots, 0),
      afterThreads: (hunkIndex, itemIndex, side) =>
        threadsAfter(unifiedSlots, 0, hunkIndex, itemIndex, side),
    },
  });
  await tick();
  const fileHead = host.querySelector(".file-head");
  const fileCard = host.querySelector('[data-thread="file-a"]');
  const lineCard = host.querySelector('[data-thread="line-3"]');
  expect(fileCard).toBeTruthy();
  expect(lineCard).toBeTruthy();
  expect(fileHead?.nextElementSibling).toBe(fileCard?.closest(".comment-stack"));
  expect(lineCard?.closest(".comment-stack")?.previousElementSibling?.textContent).toContain("snapshot");
  expect(host.querySelector(".line.added")?.textContent).toContain("snapshot");
  unmount(mounted);
  mounted = null;
  host.remove();

  const splitSlots = projectInlineThreads([lineThread], files, {
    layout: "split",
    hideUnchanged: false,
    surface: "diff",
  });
  host = document.createElement("div");
  document.body.appendChild(host);
  mounted = mount(CodeFile, {
    target: host,
    props: {
      file: CODE_VIEW_FIXTURE,
      id: "f-0",
      layout: "split",
      theme: "dark",
      afterThreads: (hunkIndex, itemIndex, side) =>
        threadsAfter(splitSlots, 0, hunkIndex, itemIndex, side),
    },
  });
  await tick();
  expect(host.querySelector(".split-pane.right [data-thread='line-3']")).toBeTruthy();
  expect(host.querySelector(".split-pane.left [data-thread='line-3']")).toBeNull();
  expect(host.querySelector(".split-pane.left .comment-stack-spacer")).toBeTruthy();
});

test("Guide and Diff share one fetch; tab switch does not refetch; stale focus and Retry do", async () => {
  echoHighlighter();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-16T12:00:00.000Z"));
  const line = thread("line-3", {
    kind: "line",
    path: "src/maps.py",
    side: "current",
    line: 3,
  });
  const file = thread("file-maps", { kind: "file", path: "src/maps.py" });
  const pr = thread("pr-wide", { kind: "pr" });
  const stale = thread("stale", { kind: "stale", reason: "unmappable", path: "src/maps.py" }, { outdated: true });
  const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/reviews/hosted-1/comments") {
      return {
        ok: true,
        statusText: "OK",
        json: async () => ({ threads: [line, file, pr, stale] }),
      };
    }
    return { ok: true, statusText: "OK", json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchSpy);
  host = document.createElement("div");
  document.body.appendChild(host);
  mounted = mount(AppShell, { target: host, props: { data: hostedPage() } });
  await vi.waitFor(() => {
    expect(host?.querySelector('[data-thread="line-3"]')).toBeTruthy();
  });
  expect(fetchSpy.mock.calls.filter(([url]) => String(url).includes("/comments"))).toHaveLength(1);
  expect(host.querySelector('[data-thread="file-maps"]')).toBeTruthy();
  expect(host.querySelector('[data-thread="pr-wide"]')).toBeNull();
  expect(host.querySelector('[data-thread="stale"]')).toBeNull();
  expect(host.querySelector(".file.stage")?.textContent).toContain("snapshot");

  (host.querySelector('[role="tab"][data-tab="diff"]') as HTMLButtonElement).click();
  await tick();
  expect(host.querySelector("#app")?.getAttribute("data-tab")).toBe("diff");
  expect(host.querySelector('[data-thread="line-3"]')).toBeTruthy();
  (host.querySelector('[role="tab"][data-tab="guide"]') as HTMLButtonElement).click();
  await tick();
  expect(fetchSpy.mock.calls.filter(([url]) => String(url).includes("/comments"))).toHaveLength(1);

  document.dispatchEvent(new Event("visibilitychange"));
  await tick();
  expect(fetchSpy.mock.calls.filter(([url]) => String(url).includes("/comments"))).toHaveLength(1);

  vi.setSystemTime(Date.now() + THREAD_LIST_STALE_MS);
  document.dispatchEvent(new Event("visibilitychange"));
  await tick();
  expect(fetchSpy.mock.calls.filter(([url]) => String(url).includes("/comments"))).toHaveLength(2);
});

test("comment list failure leaves Guide and Diff readable and Retry lists again", async () => {
  echoHighlighter();
  const fetchSpy = vi
    .fn()
    .mockResolvedValueOnce({
      ok: false,
      statusText: "Bad Gateway",
      json: async () => ({ error: "git host is unavailable" }),
    })
    .mockResolvedValueOnce({
      ok: true,
      statusText: "OK",
      json: async () => ({
        threads: [
          thread("line-3", { kind: "line", path: "src/maps.py", side: "current", line: 3 }),
        ],
      }),
    });
  vi.stubGlobal("fetch", fetchSpy);
  host = document.createElement("div");
  document.body.appendChild(host);
  mounted = mount(AppShell, {
    target: host,
    props: { data: hostedPage({ ...DIFF_GUIDE, source: SOURCE, unchaptered: true }, "diff") },
  });
  await vi.waitFor(() => {
    expect(host?.querySelector("[data-retry-comments]")).toBeTruthy();
  });
  expect(filesForDiff(DIFF_GUIDE).length).toBeGreaterThan(0);
  expect(host.querySelector("section.file")).toBeTruthy();
  expect(host.querySelector(".line") || host.querySelector(".stub")).toBeTruthy();
  (host.querySelector("[data-retry-comments]") as HTMLButtonElement).click();
  await vi.waitFor(() => {
    expect(host?.querySelector("[data-retry-comments]")).toBeNull();
  });
  expect(fetchSpy.mock.calls.filter(([url]) => String(url).includes("/comments"))).toHaveLength(2);
});

test("split spacer height tracks a stack that appears after the first mount", async () => {
  echoHighlighter();
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get() {
      return (this as HTMLElement).classList.contains("comment-stack") ? 48 : 0;
    },
  });
  let releaseList: (body: { threads: CommentThread[] }) => void = () => undefined;
  const listPending = new Promise<{ threads: CommentThread[] }>((resolve) => {
    releaseList = resolve;
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/reviews/hosted-1/comments") {
        const body = await listPending;
        return { ok: true, statusText: "OK", json: async () => body };
      }
      return { ok: true, statusText: "OK", json: async () => ({}) };
    }),
  );
  host = document.createElement("div");
  document.body.appendChild(host);
  mounted = mount(AppShell, {
    target: host,
    props: { data: hostedPage({ ...DIFF_GUIDE, source: SOURCE, unchaptered: true }, "diff") },
  });
  await vi.waitFor(() => {
    expect(host?.querySelector("section.file[data-path='pkg/src/a.ts'] .diff.split")).toBeTruthy();
  });
  expect(host.querySelector(".comment-stack")).toBeNull();
  expect(host.querySelector(".comment-stack-spacer")).toBeNull();

  releaseList({
    threads: [thread("line-3", { kind: "line", path: "pkg/src/a.ts", side: "current", line: 3 })],
  });
  const file = () => host?.querySelector("section.file[data-path='pkg/src/a.ts']");
  await vi.waitFor(() => {
    expect(file()?.querySelector(".split-pane.right [data-thread='line-3']")).toBeTruthy();
  });
  const spacer = file()?.querySelector(".split-pane.left .comment-stack-spacer");
  expect(spacer).toBeTruthy();
  expect((spacer as HTMLElement).style.height).toBe("48px");
});

test("Guide and Diff create a line comment and reply through one composer without targeting a host URL", async () => {
  echoHighlighter();
  const created: CommentThread = thread(
    "review:90",
    { kind: "line", path: "src/maps.py", side: "current", line: 3 },
    {
      messages: [
        {
          id: "review:90",
          author: { login: "ada" },
          body: "please rename",
          createdAt: WHEN,
          updatedAt: WHEN,
          ownedByCurrentUser: true,
        },
      ],
    },
  );
  const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url === "/api/reviews/hosted-1/comments" && method === "GET") {
      return { ok: true, statusText: "OK", json: async () => ({ threads: [] }) };
    }
    if (url === "/api/reviews/hosted-1/comments" && method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      expect(body).toMatchObject({
        anchor: { kind: "line", path: "src/maps.py", side: "current", line: 3 },
        body: "please rename",
      });
      expect(body).not.toHaveProperty("provider");
      expect(body).not.toHaveProperty("webUrl");
      expect(body).not.toHaveProperty("host");
      expect(String(body.clientOperationId)).toMatch(/^cop_[0-9a-f]{32}$/);
      return { ok: true, statusText: "Created", json: async () => created };
    }
    if (url === "/api/reviews/hosted-1/comments/review%3A90/replies" && method === "POST") {
      const body = JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>;
      expect(body.body).toBe("also here");
      expect(body).not.toHaveProperty("provider");
      return {
        ok: true,
        statusText: "Created",
        json: async () => ({
          id: "review:91",
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
  host = document.createElement("div");
  document.body.appendChild(host);
  mounted = mount(AppShell, { target: host, props: { data: hostedPage() } });
  await vi.waitFor(() => {
    expect(host?.querySelector("[data-comment-new='3']")).toBeTruthy();
  });
  (host.querySelector("[data-comment-new='3']") as HTMLElement).click();
  await tick();
  const draft = host.querySelector("[data-comment-draft]") as HTMLTextAreaElement;
  expect(draft).toBeTruthy();
  draft.value = "please rename";
  draft.dispatchEvent(new Event("input", { bubbles: true }));
  await tick();
  (host.querySelector('[role="tab"][data-tab="diff"]') as HTMLButtonElement).click();
  await tick();
  expect((host.querySelector("[data-comment-draft]") as HTMLTextAreaElement).value).toBe("please rename");
  (host.querySelector('[role="tab"][data-tab="guide"]') as HTMLButtonElement).click();
  await tick();
  (host.querySelector("[data-comment-send]") as HTMLButtonElement).click();
  await vi.waitFor(() => {
    expect(host?.querySelector('[data-thread="review:90"]')).toBeTruthy();
  });
  expect(host.querySelector("[data-comment-composer]")).toBeNull();
  expect(host.querySelector('[data-thread="review:90"]')?.textContent).toContain("please rename");
  (host.querySelector('[data-comment-reply="review:90"]') as HTMLButtonElement).click();
  await tick();
  const replyDraft = host.querySelector("[data-comment-draft]") as HTMLTextAreaElement;
  replyDraft.value = "also here";
  replyDraft.dispatchEvent(new Event("input", { bubbles: true }));
  await tick();
  (host.querySelector("[data-comment-send]") as HTMLButtonElement).click();
  await vi.waitFor(() => {
    expect(host?.textContent).toContain("also here");
  });
  const commentUrls = fetchSpy.mock.calls.map(([url]) => String(url)).filter((url) => url.includes("/comments"));
  expect(commentUrls.join(" ")).not.toMatch(/github\.com|dev\.azure\.com/);
});
