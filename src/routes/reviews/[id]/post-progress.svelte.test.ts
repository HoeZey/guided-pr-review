import { afterEach, expect, test, vi } from "vitest";
import { mount, tick, unmount } from "svelte";
import type { CommentThread } from "$lib/shared/contracts/comments";
import type { ReviewPageData } from "$lib/shared/page-data";
import { resetReviewSession } from "$lib/client/state/review.svelte";
import { resetPreferences } from "$lib/client/state/preferences.svelte";
import { resetSyntax, setHighlighterLoader } from "$lib/client/browser/syntax";
import { GUIDE_CHAPTERED } from "$lib/client/components/guide/fixture";
import ReviewPage from "./+page.svelte";

const WHEN = "2026-11-10T22:00:00.000Z";
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
  resetSyntax();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function echoHighlighter() {
  setHighlighterLoader(async () => ({
    codeToTokens(code: string) {
      return { tokens: [[{ content: code, color: "#111" }]] };
    },
  }));
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

function hostedPage(): ReviewPageData {
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
  };
}

function renderPage() {
  echoHighlighter();
  host = document.createElement("div");
  document.body.appendChild(host);
  mounted = mount(ReviewPage, { target: host, props: { data: hostedPage() } });
  return host;
}

function guideFile(root: ParentNode, path: string): HTMLElement | null {
  return root.querySelector(`section.file.stage[data-path="${path}"]`);
}

function diffFile(root: ParentNode, path: string): HTMLElement | null {
  return root.querySelector(`section.file:not(.stage)[data-path="${path}"]`);
}

function commentCalls(spy: ReturnType<typeof vi.fn>): string[] {
  return spy.mock.calls
    .map(([url, init]) => {
      const method = ((init as RequestInit | undefined)?.method ?? "GET").toUpperCase();
      return `${method} ${String(url)}`;
    })
    .filter((row) => row.includes("/comments"));
}

function stubList(threads: CommentThread[] = []) {
  const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url === "/api/reviews/hosted-1/comments" && method === "GET") {
      return { ok: true, statusText: "OK", json: async () => ({ threads }) };
    }
    return { ok: true, statusText: "OK", json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchSpy);
  return fetchSpy;
}

test("a line click on Guide and Diff opens a composer and sends no request", async () => {
  const fetchSpy = stubList();
  const root = renderPage();
  const guide = () => guideFile(root, "src/maps.py");
  const diff = () => diffFile(root, "src/maps.py");
  await vi.waitFor(() => {
    expect(guide()?.querySelector("[data-comment-new='3']")).toBeTruthy();
    expect(diff()?.querySelector(".split-pane.right [data-comment-new='3']")).toBeTruthy();
  });
  const before = commentCalls(fetchSpy);

  (guide()?.querySelector("[data-comment-new='3']") as HTMLElement).click();
  await tick();

  expect(commentCalls(fetchSpy)).toEqual(before);
  expect(guide()?.querySelector("[data-comment-composer]")).toBeTruthy();
  expect(diff()?.querySelector("[data-comment-composer]")).toBeTruthy();
  expect(guide()?.querySelectorAll("[data-comment-composer]")).toHaveLength(1);
  expect(diff()?.querySelectorAll("[data-comment-composer]")).toHaveLength(1);
});

function shiftClick(node: Element): void {
  node.dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }));
}

function selectedLines(file: ParentNode | null): string[] {
  return [...(file?.querySelectorAll(".line.comment-selected") ?? [])].map(
    (line) => line.getAttribute("data-comment-new") ?? "",
  );
}

test("shift-click selects a contiguous current-side range in one file", async () => {
  stubList();
  const root = renderPage();
  const guide = () => guideFile(root, "src/maps.py");
  const other = () => guideFile(root, "tests/maps_test.py");
  const diff = () => diffFile(root, "src/maps.py");
  await vi.waitFor(() => {
    expect(guide()?.querySelector("[data-comment-new='1']")).toBeTruthy();
    expect(other()?.querySelector("[data-comment-new='2']")).toBeTruthy();
    expect(diff()?.querySelector(".split-pane.right [data-comment-new='1']")).toBeTruthy();
  });

  (guide()?.querySelector("[data-comment-new='1']") as HTMLElement).click();
  await tick();
  shiftClick(guide()?.querySelector("[data-comment-new='4']") as HTMLElement);
  await tick();

  expect(selectedLines(guide())).toEqual(["1", "2", "3", "4"]);
  expect(selectedLines(diff()?.querySelector(".split-pane.right"))).toEqual(["1", "2", "3", "4"]);
  expect(guide()?.querySelectorAll("[data-comment-composer]")).toHaveLength(1);
  expect(diff()?.querySelectorAll("[data-comment-composer]")).toHaveLength(1);

  shiftClick(other()?.querySelector("[data-comment-new='2']") as HTMLElement);
  await tick();
  expect(selectedLines(other())).toEqual(["2"]);
  expect(selectedLines(guide())).toEqual([]);
  expect(guide()?.querySelector("[data-comment-composer]")).toBeNull();
  expect(other()?.querySelectorAll("[data-comment-composer]")).toHaveLength(1);
});

function headerComposer(file: ParentNode | null): Element | null {
  return file?.querySelector(":scope > .file-head + .comment-stack [data-comment-composer]") ?? null;
}

test("a deleted-only line and the file Comment button open one file composer and send no request", async () => {
  const fetchSpy = stubList();
  const root = renderPage();
  const guide = () => guideFile(root, "src/maps.py");
  const diff = () => diffFile(root, "src/maps.py");
  await vi.waitFor(() => {
    expect(guide()?.querySelector("[data-comment-deleted]")).toBeTruthy();
    expect(diff()?.querySelector(".split-pane.left [data-comment-deleted]")).toBeTruthy();
  });
  const before = commentCalls(fetchSpy);

  (guide()?.querySelector("[data-comment-deleted]") as HTMLElement).click();
  await tick();
  expect(commentCalls(fetchSpy)).toEqual(before);
  expect(headerComposer(guide())).toBeTruthy();
  expect(guide()?.querySelector(".file-body [data-comment-composer]")).toBeNull();
  expect(headerComposer(diff())).toBeTruthy();
  expect(guide()?.querySelectorAll("[data-comment-composer]")).toHaveLength(1);
  expect(diff()?.querySelectorAll("[data-comment-composer]")).toHaveLength(1);

  (guide()?.querySelector("[data-comment-new='3']") as HTMLElement).click();
  await tick();
  expect(headerComposer(guide())).toBeNull();
  expect(guide()?.querySelector(".file-body [data-comment-composer]")).toBeTruthy();

  (guide()?.querySelector("[data-comment-file='src/maps.py']") as HTMLButtonElement).click();
  await tick();
  expect(commentCalls(fetchSpy)).toEqual(before);
  expect(headerComposer(guide())).toBeTruthy();
  expect(guide()?.querySelector(".file-body [data-comment-composer]")).toBeNull();
  expect(headerComposer(diff())).toBeTruthy();
  expect(guide()?.querySelectorAll("[data-comment-composer]")).toHaveLength(1);
  expect(diff()?.querySelectorAll("[data-comment-composer]")).toHaveLength(1);
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function typeDraft(root: ParentNode, value: string): void {
  const draft = root.querySelector("[data-comment-draft]") as HTMLTextAreaElement;
  draft.value = value;
  draft.dispatchEvent(new Event("input", { bubbles: true }));
}

function lineThread(id: string, body: string, line = 3): CommentThread {
  return {
    id,
    provider: "github",
    status: "active",
    outdated: false,
    anchor: { kind: "line", path: "src/maps.py", side: "current", line },
    messages: [
      {
        id: `${id}-m`,
        author: { login: "ada" },
        body,
        createdAt: WHEN,
        updatedAt: WHEN,
        ownedByCurrentUser: true,
      },
    ],
  };
}

test("Send and Reply show the spinner, keep the draft, and disable Send until the fake resolves", async () => {
  const created = lineThread("review:90", "please rename");
  const createPending = deferred<CommentThread>();
  const replyPending = deferred<{
    id: string;
    author: { login: string };
    body: string;
    createdAt: string;
    updatedAt: string;
    ownedByCurrentUser: boolean;
  }>();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url === "/api/reviews/hosted-1/comments" && method === "GET") {
        return { ok: true, statusText: "OK", json: async () => ({ threads: [] }) };
      }
      if (url === "/api/reviews/hosted-1/comments" && method === "POST") {
        const thread = await createPending.promise;
        return { ok: true, statusText: "Created", json: async () => thread };
      }
      if (url === "/api/reviews/hosted-1/comments/review%3A90/replies" && method === "POST") {
        const message = await replyPending.promise;
        return { ok: true, statusText: "Created", json: async () => message };
      }
      return { ok: true, statusText: "OK", json: async () => ({}) };
    }),
  );
  const root = renderPage();
  const guide = () => guideFile(root, "src/maps.py");
  await vi.waitFor(() => {
    expect(guide()?.querySelector("[data-comment-new='3']")).toBeTruthy();
  });
  (guide()?.querySelector("[data-comment-new='3']") as HTMLElement).click();
  await tick();
  typeDraft(root, "please rename");
  await tick();
  (guide()?.querySelector("[data-comment-send]") as HTMLButtonElement).click();
  await vi.waitFor(() => {
    expect(guide()?.querySelector("[data-comment-composer] .composer-spinner")).toBeTruthy();
  });
  const sending = guide()?.querySelector("[data-comment-composer]") as HTMLElement;
  expect((sending.querySelector("[data-comment-draft]") as HTMLTextAreaElement).value).toBe("please rename");
  expect((sending.querySelector("[data-comment-draft]") as HTMLTextAreaElement).readOnly).toBe(true);
  expect((sending.querySelector("[data-comment-send]") as HTMLButtonElement).disabled).toBe(true);
  expect(sending.querySelector("[data-comment-send]")?.textContent).toContain("Sending");
  expect(root.querySelector("[data-thread='review:90']")).toBeNull();

  createPending.resolve(created);
  await vi.waitFor(() => {
    expect(guide()?.querySelector("[data-thread='review:90']")).toBeTruthy();
  });
  expect(guide()?.querySelector("[data-comment-composer]")).toBeNull();
  const diff = () => diffFile(root, "src/maps.py");
  expect(diff()?.querySelector("[data-thread='review:90']")).toBeTruthy();
  expect(diff()?.querySelector("[data-comment-composer]")).toBeNull();
  expect(root.querySelector("[data-toast]")).toBeNull();
  (root.querySelector('[role="tab"][data-tab="discussion"]') as HTMLButtonElement).click();
  await tick();
  const discussion = root.querySelector('[data-tab-panel="discussion"]');
  expect(discussion?.querySelector("[data-thread='review:90']")?.textContent).toContain("please rename");
  expect(discussion?.querySelector("[data-comment-composer]")).toBeNull();

  (guide()?.querySelector("[data-comment-reply='review:90']") as HTMLButtonElement).click();
  await tick();
  typeDraft(root, "also here");
  await tick();
  (guide()?.querySelector("[data-comment-send]") as HTMLButtonElement).click();
  await vi.waitFor(() => {
    expect(guide()?.querySelector("[data-comment-composer] .composer-spinner")).toBeTruthy();
  });
  const replying = guide()?.querySelector("[data-comment-composer]") as HTMLElement;
  expect((replying.querySelector("[data-comment-draft]") as HTMLTextAreaElement).value).toBe("also here");
  expect((replying.querySelector("[data-comment-send]") as HTMLButtonElement).disabled).toBe(true);
  expect(guide()?.textContent).not.toContain("also here");

  replyPending.resolve({
    id: "review:91",
    author: { login: "ada" },
    body: "also here",
    createdAt: WHEN,
    updatedAt: WHEN,
    ownedByCurrentUser: true,
  });
  await vi.waitFor(() => {
    expect(guide()?.textContent).toContain("also here");
  });
  expect(guide()?.querySelector("[data-comment-composer]")).toBeNull();
  expect(guide()?.querySelector("[data-thread='review:90'].thread-landed")).toBeTruthy();
  expect(diff()?.querySelector("[data-thread='review:90'].thread-landed")).toBeTruthy();
});

function stubMotion(reduced: boolean): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduced && query.includes("prefers-reduced-motion"),
    media: query,
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent() {
      return false;
    },
  }));
}

function immediateCreate(thread: CommentThread) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url === "/api/reviews/hosted-1/comments" && method === "GET") {
        return { ok: true, statusText: "OK", json: async () => ({ threads: [] }) };
      }
      if (url === "/api/reviews/hosted-1/comments" && method === "POST") {
        return { ok: true, statusText: "Created", json: async () => thread };
      }
      return { ok: true, statusText: "OK", json: async () => ({}) };
    }),
  );
}

async function flush(): Promise<void> {
  for (let i = 0; i < 30; i += 1) {
    await tick();
    await Promise.resolve();
  }
}

async function postLine(root: HTMLElement, body: string): Promise<void> {
  await flush();
  const guide = guideFile(root, "src/maps.py");
  (guide?.querySelector("[data-comment-new='3']") as HTMLElement).click();
  await tick();
  typeDraft(root, body);
  await tick();
  (guide?.querySelector("[data-comment-send]") as HTMLButtonElement).click();
  await flush();
}

test("the highlight runs once on Guide, Diff, and Discussion and is absent under reduced motion", async () => {
  vi.useFakeTimers();
  stubMotion(false);
  const created = lineThread("review:90", "please rename");
  immediateCreate(created);
  const root = renderPage();
  await postLine(root, "please rename");
  expect(guideFile(root, "src/maps.py")?.querySelector("[data-thread='review:90'].thread-landed")).toBeTruthy();
  expect(diffFile(root, "src/maps.py")?.querySelector("[data-thread='review:90'].thread-landed")).toBeTruthy();
  (root.querySelector('[role="tab"][data-tab="discussion"]') as HTMLButtonElement).click();
  await tick();
  expect(
    root.querySelector("[data-tab-panel='discussion'] [data-thread='review:90'].thread-landed"),
  ).toBeTruthy();
  expect(root.querySelectorAll(".thread-landed")).toHaveLength(3);
  expect(root.querySelector("[data-toast]")).toBeNull();

  await vi.advanceTimersByTimeAsync(1499);
  expect(root.querySelectorAll(".thread-landed")).toHaveLength(3);
  await vi.advanceTimersByTimeAsync(1);
  expect(root.querySelector(".thread-landed")).toBeNull();
  (root.querySelector('[role="tab"][data-tab="guide"]') as HTMLButtonElement).click();
  await tick();
  (root.querySelector('[role="tab"][data-tab="discussion"]') as HTMLButtonElement).click();
  await tick();
  expect(root.querySelector(".thread-landed")).toBeNull();

  if (mounted) unmount(mounted);
  mounted = null;
  host?.remove();
  host = null;
  resetReviewSession();
  vi.stubGlobal("fetch", vi.fn());
  stubMotion(true);
  immediateCreate(created);
  const quiet = renderPage();
  await postLine(quiet, "please rename");
  expect(guideFile(quiet, "src/maps.py")?.querySelector("[data-thread='review:90']")).toBeTruthy();
  (quiet.querySelector('[role="tab"][data-tab="discussion"]') as HTMLButtonElement).click();
  await tick();
  expect(quiet.querySelector(".thread-landed")).toBeNull();
  await vi.advanceTimersByTimeAsync(1500);
  expect(quiet.querySelector(".thread-landed")).toBeNull();
});

test("a rejected send keeps the draft, shows the error, and Retry sends again", async () => {
  const created = lineThread("review:91", "please rename");
  let posts = 0;
  const fetchSpy = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = (init?.method ?? "GET").toUpperCase();
    if (url === "/api/reviews/hosted-1/comments" && method === "GET") {
      return { ok: true, statusText: "OK", json: async () => ({ threads: [] }) };
    }
    if (url === "/api/reviews/hosted-1/comments" && method === "POST") {
      posts += 1;
      if (posts === 1) {
        return {
          ok: false,
          statusText: "Unauthorized",
          json: async () => ({ error: "git host identity is not connected", code: "auth" }),
        };
      }
      return { ok: true, statusText: "Created", json: async () => created };
    }
    return { ok: true, statusText: "OK", json: async () => ({}) };
  });
  vi.stubGlobal("fetch", fetchSpy);
  const root = renderPage();
  const guide = () => guideFile(root, "src/maps.py");
  await vi.waitFor(() => {
    expect(guide()?.querySelector("[data-comment-new='3']")).toBeTruthy();
  });
  (guide()?.querySelector("[data-comment-new='3']") as HTMLElement).click();
  await tick();
  typeDraft(root, "please rename");
  await tick();
  const beforeRetry = commentCalls(fetchSpy).length;
  (guide()?.querySelector("[data-comment-send]") as HTMLButtonElement).click();
  await vi.waitFor(() => {
    expect(guide()?.querySelector(".composer-error")?.textContent).toContain(
      "git host identity is not connected",
    );
  });
  const composer = guide()?.querySelector("[data-comment-composer]") as HTMLElement;
  expect((composer.querySelector("[data-comment-draft]") as HTMLTextAreaElement).value).toBe("please rename");
  expect(composer.querySelector("[data-comment-send]")?.textContent).toContain("Retry");
  expect(guide()?.querySelector("[data-thread='review:91']")).toBeNull();
  expect(commentCalls(fetchSpy).filter((row) => row.startsWith("GET"))).toHaveLength(1);

  (composer.querySelector("[data-comment-send]") as HTMLButtonElement).click();
  await vi.waitFor(() => {
    expect(guide()?.querySelector("[data-thread='review:91']")).toBeTruthy();
  });
  expect(guide()?.querySelector("[data-comment-composer]")).toBeNull();
  expect(posts).toBe(2);
  expect(commentCalls(fetchSpy).filter((row) => row.startsWith("GET"))).toHaveLength(1);
  expect(commentCalls(fetchSpy).length).toBeGreaterThan(beforeRetry);
});

test("an ambiguous failure lists before Retry and does not post twice", async () => {
  const matched = lineThread("review:90", "please rename");
  matched.messages[0] = {
    ...matched.messages[0]!,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const listed = deferred<CommentThread[]>();
  let posts = 0;
  let lists = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url === "/api/reviews/hosted-1/comments" && method === "GET") {
        lists += 1;
        const threads = lists === 1 ? [] : await listed.promise;
        return { ok: true, statusText: "OK", json: async () => ({ threads }) };
      }
      if (url === "/api/reviews/hosted-1/comments" && method === "POST") {
        posts += 1;
        return {
          ok: false,
          statusText: "Service Unavailable",
          json: async () => ({ error: "git host is unavailable", code: "unavailable" }),
        };
      }
      return { ok: true, statusText: "OK", json: async () => ({}) };
    }),
  );
  const root = renderPage();
  const guide = () => guideFile(root, "src/maps.py");
  await vi.waitFor(() => {
    expect(guide()?.querySelector("[data-comment-new='3']")).toBeTruthy();
  });
  (guide()?.querySelector("[data-comment-new='3']") as HTMLElement).click();
  await tick();
  typeDraft(root, "please rename");
  await tick();
  (guide()?.querySelector("[data-comment-send]") as HTMLButtonElement).click();
  await vi.waitFor(() => {
    expect(guide()?.querySelector(".composer-error")?.textContent).toContain("git host is unavailable");
  });
  expect((guide()?.querySelector("[data-comment-draft]") as HTMLTextAreaElement).value).toBe("please rename");

  (guide()?.querySelector("[data-comment-send]") as HTMLButtonElement).click();
  await vi.waitFor(() => {
    expect(guide()?.querySelector("[data-comment-composer] .composer-spinner")).toBeTruthy();
  });
  expect(posts).toBe(1);
  expect(lists).toBe(2);
  const checking = guide()?.querySelector("[data-comment-composer]") as HTMLElement;
  expect((checking.querySelector("[data-comment-draft]") as HTMLTextAreaElement).value).toBe("please rename");
  expect((checking.querySelector("[data-comment-send]") as HTMLButtonElement).disabled).toBe(true);
  expect(guide()?.querySelector("[data-thread='review:90']")).toBeNull();

  listed.resolve([matched]);
  await vi.waitFor(() => {
    expect(guide()?.querySelector("[data-thread='review:90']")).toBeTruthy();
  });
  expect(posts).toBe(1);
  expect(guide()?.querySelector("[data-comment-composer]")).toBeNull();
  expect(diffFile(root, "src/maps.py")?.querySelector("[data-thread='review:90']")).toBeTruthy();
});
