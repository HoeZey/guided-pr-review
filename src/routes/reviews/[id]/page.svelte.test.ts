import { afterEach, expect, test, vi } from "vitest";
import { mount, tick, unmount } from "svelte";
import { FAKE_REVIEW_OK } from "$lib/shared/shell-fakes";
import { HOME_PATH } from "$lib/shared/domain/overview";
import { TAB_KEY } from "$lib/client/browser/preferences";
import { resetReviewSession } from "$lib/client/state/review.svelte";
import { THREAD_LIST_STALE_MS } from "$lib/client/state/threads.svelte";
import type { CommentThread } from "$lib/shared/contracts/comments";
import type { ReviewPageData } from "$lib/shared/page-data";
import ReviewPage from "./+page.svelte";

let mounted: ReturnType<typeof mount> | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  if (mounted) unmount(mounted);
  mounted = null;
  host?.remove();
  host = null;
  resetReviewSession();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const WHEN = "2026-09-16T10:00:00.000Z";

function prThread(id: string, body: string): CommentThread {
  return {
    id,
    provider: "github",
    status: "active",
    outdated: false,
    anchor: { kind: "pr" },
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function renderPage(data: ReviewPageData) {
  host = document.createElement("div");
  document.body.appendChild(host);
  mounted = mount(ReviewPage, { target: host, props: { data } });
  return host;
}

function hostedReview(tab?: ReviewPageData["tab"]): ReviewPageData {
  return {
    ...FAKE_REVIEW_OK,
    ...(tab ? { tab } : {}),
    guide: {
      ...FAKE_REVIEW_OK.guide!,
      source: {
        kind: "pull-request",
        provider: "github",
        host: "github.com",
        repository: {
          id: "1",
          owner: "octo",
          name: "hello",
          webUrl: "https://github.com/octo/hello",
        },
        number: 1,
        webUrl: "https://github.com/octo/hello/pull/1",
        sourceRef: "refs/heads/feature",
        targetRef: "refs/heads/develop",
        sourceCommit: "b".repeat(40),
        targetCommit: "a".repeat(40),
        providerContext: { kind: "github" },
      },
    },
  };
}

test("review page renders the shell from fake page data", () => {
  const root = renderPage(FAKE_REVIEW_OK);
  expect(root.querySelector("#app")?.getAttribute("data-view")).toBe("review");
  expect(root.querySelector(".back-link")?.getAttribute("href")).toBe(HOME_PATH);
  expect(root.querySelector("[role='tablist']")).toBeTruthy();
});

test("a local review with no host pull request requests no threads", async () => {
  const fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
  const root = renderPage(FAKE_REVIEW_OK);
  await tick();
  expect(root.querySelector('[role="tab"][data-tab="discussion"]')).toBeTruthy();
  expect(root.querySelector(".guide-section")).toBeTruthy();
  expect(fetchSpy.mock.calls.map(([url]) => String(url)).some((url) => url.includes("/comments"))).toBe(
    false,
  );
});

test("a hosted review has a Discussion tab and requests threads on open", async () => {
  const fetchSpy = vi.fn(async () => ({
    ok: true,
    statusText: "OK",
    json: async () => ({ threads: [] }),
  }));
  vi.stubGlobal("fetch", fetchSpy);
  const root = renderPage(hostedReview());
  expect(root.querySelector('[role="tab"][data-tab="discussion"]')).toBeTruthy();
  await vi.waitFor(() => {
    expect(fetchSpy.mock.calls.map(([url]) => String(url))).toContain("/api/reviews/fake-review/comments");
  });
});

test("a stored discussion tab reopens Discussion", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      statusText: "OK",
      json: async () => ({ threads: [] }),
    })),
  );

  localStorage.setItem(TAB_KEY, "discussion");
  const fromStorage = renderPage(hostedReview());
  await tick();
  expect(fromStorage.querySelector("#app")?.getAttribute("data-tab")).toBe("discussion");
  expect(fromStorage.querySelector('[data-tab-panel="discussion"]')).toBeTruthy();
  unmount(mounted!);
  mounted = null;
  fromStorage.remove();
  host = null;
  resetReviewSession();
  localStorage.clear();

  const fromPage = renderPage(hostedReview("discussion"));
  await tick();
  expect(fromPage.querySelector("#app")?.getAttribute("data-tab")).toBe("discussion");
  expect(fromPage.querySelector('[data-tab-panel="discussion"]')).toBeTruthy();
});

test("Loading comments shows on the tab row until the list succeeds", async () => {
  const pending = deferred<{ threads: never[] }>();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      const body = await pending.promise;
      return { ok: true, statusText: "OK", json: async () => body };
    }),
  );
  const root = renderPage(hostedReview());
  await vi.waitFor(() => {
    expect(root.querySelector(".view-tabs .tab-loading")?.textContent).toContain("Loading comments");
  });
  expect(root.querySelector(".view-tabs .tab-loading .composer-spinner")).toBeTruthy();
  expect(root.querySelector(".guide-section")).toBeTruthy();
  pending.resolve({ threads: [] });
  await vi.waitFor(() => {
    expect(root.querySelector(".view-tabs .tab-loading")).toBeNull();
  });
});

test("a failed list shows Retry and Retry lists again", async () => {
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
      json: async () => ({ threads: [] }),
    });
  vi.stubGlobal("fetch", fetchSpy);
  const root = renderPage(hostedReview());
  await vi.waitFor(() => {
    expect(root.querySelector("[data-retry-comments]")).toBeTruthy();
  });
  expect(root.querySelector(".view-tabs .tab-loading")).toBeNull();
  expect(root.querySelector(".review-banner")?.textContent).toContain("git host is unavailable");
  expect(root.querySelector(".guide-section")).toBeTruthy();

  (root.querySelector('[role="tab"][data-tab="diff"]') as HTMLButtonElement).click();
  await tick();
  expect(root.querySelector("#app")?.getAttribute("data-tab")).toBe("diff");
  expect(root.querySelector('nav[aria-label="Files"]')).toBeTruthy();

  (root.querySelector('[role="tab"][data-tab="guide"]') as HTMLButtonElement).click();
  await tick();
  expect(root.querySelector("#app")?.getAttribute("data-tab")).toBe("guide");
  expect(root.querySelector(".guide-section")).toBeTruthy();

  (root.querySelector("[data-retry-comments]") as HTMLButtonElement).click();
  await vi.waitFor(() => {
    expect(root.querySelector("[data-retry-comments]")).toBeNull();
  });
  expect(fetchSpy.mock.calls.filter(([url]) => String(url).includes("/comments"))).toHaveLength(2);
});

test("threads already on screen stay during a reload", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-16T12:00:00.000Z"));
  const pending = deferred<CommentThread[]>();
  let calls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      calls += 1;
      const threads = calls === 1 ? [prThread("pr-old", "kept")] : await pending.promise;
      return { ok: true, statusText: "OK", json: async () => ({ threads }) };
    }),
  );
  const root = renderPage(hostedReview("discussion"));
  await vi.waitFor(() => {
    expect(root.querySelector('[data-thread="pr-old"]')?.textContent).toContain("kept");
  });
  vi.setSystemTime(Date.now() + THREAD_LIST_STALE_MS);
  document.dispatchEvent(new Event("visibilitychange"));
  await tick();
  expect(root.querySelector('[data-thread="pr-old"]')?.textContent).toContain("kept");
  expect(root.querySelector(".view-tabs .tab-loading")?.textContent).toContain("Loading comments");
  pending.resolve([prThread("pr-new", "replaced")]);
  await vi.waitFor(() => {
    expect(root.querySelector('[data-thread="pr-new"]')?.textContent).toContain("replaced");
  });
  expect(root.querySelector('[data-thread="pr-old"]')).toBeNull();
  expect(root.querySelector(".view-tabs .tab-loading")).toBeNull();
});

test("focus and visibility on return start one list", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-16T12:00:00.000Z"));
  const pending = deferred<void>();
  let calls = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      calls += 1;
      if (calls > 1) await pending.promise;
      return {
        ok: true,
        statusText: "OK",
        json: async () => ({ threads: [prThread("pr-1", "note")] }),
      };
    }),
  );
  renderPage(hostedReview());
  await vi.waitFor(() => {
    expect(calls).toBe(1);
  });
  vi.setSystemTime(Date.now() + THREAD_LIST_STALE_MS);
  window.dispatchEvent(new Event("focus"));
  document.dispatchEvent(new Event("visibilitychange"));
  await tick();
  expect(calls).toBe(2);
  pending.resolve();
});
