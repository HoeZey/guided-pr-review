import { afterEach, expect, test, vi } from "vitest";
import { mount, tick, unmount } from "svelte";
import { FAKE_REVIEW_OK } from "$lib/shared/shell-fakes";
import { HOME_PATH } from "$lib/shared/domain/overview";
import { TAB_KEY } from "$lib/client/browser/preferences";
import { composerSession } from "$lib/client/state/composer.svelte";
import { HEAD_CHECK_STALE_MS, resetReviewSession } from "$lib/client/state/review.svelte";
import { THREAD_LIST_STALE_MS } from "$lib/client/state/threads.svelte";
import type { CommentThread } from "$lib/shared/contracts/comments";
import type { FileChange } from "$lib/shared/contracts/guide";
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

const STORED_LINE = "stored commit line";
const LATEST_LINE = "latest commit line";

function lineFile(content: string, line = 3): FileChange {
  return {
    path: "src/open.ts",
    language: "typescript",
    hunks: [{ lines: [{ type: "added", content, newLine: line }] }],
  };
}

function hostedReview(tab?: ReviewPageData["tab"], line = STORED_LINE): ReviewPageData {
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
    diff: {
      sourceCommit: "b".repeat(40),
      targetCommit: "a".repeat(40),
      files: [lineFile(line)],
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
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/head")) {
        return { ok: true, statusText: "OK", json: async () => ({ moved: false }) };
      }
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
  let lists = 0;
  const fetchSpy = vi.fn(async (input: RequestInfo | URL) => {
    if (String(input).endsWith("/head")) {
      return { ok: true, statusText: "OK", json: async () => ({ moved: false }) };
    }
    lists += 1;
    if (lists === 1) {
      return {
        ok: false,
        statusText: "Bad Gateway",
        json: async () => ({ error: "git host is unavailable" }),
      };
    }
    return { ok: true, statusText: "OK", json: async () => ({ threads: [] }) };
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
  let lists = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/head")) {
        return { ok: true, statusText: "OK", json: async () => ({ moved: false }) };
      }
      lists += 1;
      const threads = lists === 1 ? [prThread("pr-old", "kept")] : await pending.promise;
      return { ok: true, statusText: "OK", json: async () => ({ threads }) };
    }),
  );
  const root = renderPage(hostedReview("discussion"));
  await vi.waitFor(() => {
    expect(root.querySelector('[data-thread="pr-old"]')?.textContent).toContain("kept");
  });
  vi.setSystemTime(Date.now() + THREAD_LIST_STALE_MS);
  document.dispatchEvent(new Event("visibilitychange"));
  await vi.waitFor(() => {
    expect(root.querySelector(".view-tabs .tab-loading")?.textContent).toContain("Loading comments");
  });
  expect(root.querySelector('[data-thread="pr-old"]')?.textContent).toContain("kept");
  pending.resolve([prThread("pr-new", "replaced")]);
  await vi.waitFor(() => {
    expect(root.querySelector('[data-thread="pr-new"]')?.textContent).toContain("replaced");
  });
  expect(root.querySelector('[data-thread="pr-old"]')).toBeNull();
  expect(root.querySelector(".view-tabs .tab-loading")).toBeNull();
});

test("Save shows a spinner until the fake resolves", async () => {
  const pending = deferred<CommentThread["messages"][number]>();
  const saved = {
    id: "pr-1-m",
    author: { login: "ada" },
    body: "renamed",
    createdAt: WHEN,
    updatedAt: "2026-09-16T12:00:00.000Z",
    ownedByCurrentUser: true,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url === "/api/reviews/fake-review/comments" && method === "GET") {
        return { ok: true, statusText: "OK", json: async () => ({ threads: [prThread("pr-1", "note")] }) };
      }
      if (url === "/api/reviews/fake-review/comments/pr-1/pr-1-m" && method === "PATCH") {
        expect(JSON.parse(String(init?.body ?? "{}"))).toEqual({ body: "renamed" });
        const message = await pending.promise;
        return { ok: true, statusText: "OK", json: async () => message };
      }
      return { ok: true, statusText: "OK", json: async () => ({}) };
    }),
  );
  const root = renderPage(hostedReview("discussion"));
  await vi.waitFor(() => {
    expect(root.querySelector('[data-comment-edit="pr-1-m"]')).toBeTruthy();
  });
  expect(root.querySelector(".composer-spinner")).toBeNull();
  (root.querySelector('[data-comment-edit="pr-1-m"]') as HTMLButtonElement).click();
  await tick();
  const draft = root.querySelector("[data-comment-edit-draft]") as HTMLTextAreaElement;
  draft.value = "renamed";
  draft.dispatchEvent(new Event("input", { bubbles: true }));
  await tick();
  (root.querySelector("[data-comment-save]") as HTMLButtonElement).click();
  await vi.waitFor(() => {
    expect(root.querySelector('[data-thread="pr-1"] .composer-spinner')).toBeTruthy();
  });
  expect((root.querySelector("[data-comment-edit-draft]") as HTMLTextAreaElement).value).toBe("renamed");
  expect((root.querySelector("[data-comment-save]") as HTMLButtonElement).disabled).toBe(true);
  pending.resolve(saved);
  await vi.waitFor(() => {
    expect(root.querySelector(".composer-spinner")).toBeNull();
  });
  expect(root.querySelector("[data-comment-edit-draft]")).toBeNull();
  expect(root.querySelector('[data-thread="pr-1"]')?.textContent).toContain("renamed");
});

test("a failed save keeps the editor open with the typed text", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url === "/api/reviews/fake-review/comments" && method === "GET") {
        return { ok: true, statusText: "OK", json: async () => ({ threads: [prThread("pr-1", "note")] }) };
      }
      if (url === "/api/reviews/fake-review/comments/pr-1/pr-1-m" && method === "PATCH") {
        return {
          ok: false,
          statusText: "Forbidden",
          json: async () => ({ error: "could not save", code: "denied" }),
        };
      }
      return { ok: true, statusText: "OK", json: async () => ({}) };
    }),
  );
  const root = renderPage(hostedReview("discussion"));
  await vi.waitFor(() => {
    expect(root.querySelector('[data-comment-edit="pr-1-m"]')).toBeTruthy();
  });
  (root.querySelector('[data-comment-edit="pr-1-m"]') as HTMLButtonElement).click();
  await tick();
  const draft = root.querySelector("[data-comment-edit-draft]") as HTMLTextAreaElement;
  draft.value = "kept draft";
  draft.dispatchEvent(new Event("input", { bubbles: true }));
  await tick();
  (root.querySelector("[data-comment-save]") as HTMLButtonElement).click();
  await vi.waitFor(() => {
    expect(root.querySelector('[data-thread="pr-1"] .composer-error')?.textContent).toContain("could not save");
  });
  const kept = root.querySelector("[data-comment-edit-draft]") as HTMLTextAreaElement;
  expect(kept).toBeTruthy();
  expect(kept.value).toBe("kept draft");
  expect(root.querySelector(".composer-spinner")).toBeNull();
});

test("Delete shows a spinner until the fake resolves", async () => {
  const pending = deferred<{ ok: true }>();
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url === "/api/reviews/fake-review/comments" && method === "GET") {
        return { ok: true, statusText: "OK", json: async () => ({ threads: [prThread("pr-1", "note")] }) };
      }
      if (url === "/api/reviews/fake-review/comments/pr-1/pr-1-m" && method === "DELETE") {
        await pending.promise;
        return { ok: true, statusText: "OK", json: async () => ({ ok: true }) };
      }
      return { ok: true, statusText: "OK", json: async () => ({}) };
    }),
  );
  const root = renderPage(hostedReview("discussion"));
  await vi.waitFor(() => {
    expect(root.querySelector('[data-comment-delete="pr-1-m"]')).toBeTruthy();
  });
  expect(root.querySelector(".composer-spinner")).toBeNull();
  (root.querySelector('[data-comment-delete="pr-1-m"]') as HTMLButtonElement).click();
  await tick();
  (root.querySelector("[data-comment-delete-confirm]") as HTMLButtonElement).click();
  await vi.waitFor(() => {
    expect(root.querySelector('[data-thread="pr-1"] .composer-spinner')).toBeTruthy();
  });
  expect(root.querySelector('[data-thread="pr-1"]')?.textContent).toContain("note");
  expect((root.querySelector("[data-comment-delete-confirm]") as HTMLButtonElement).disabled).toBe(true);
  pending.resolve({ ok: true });
  await vi.waitFor(() => {
    expect(root.querySelector('[data-thread="pr-1"]')).toBeNull();
  });
  expect(root.querySelector(".composer-spinner")).toBeNull();
});

test("a failed delete leaves the message on screen with the error", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url === "/api/reviews/fake-review/comments" && method === "GET") {
        return { ok: true, statusText: "OK", json: async () => ({ threads: [prThread("pr-1", "note")] }) };
      }
      if (url === "/api/reviews/fake-review/comments/pr-1/pr-1-m" && method === "DELETE") {
        return {
          ok: false,
          statusText: "Forbidden",
          json: async () => ({ error: "could not delete", code: "denied" }),
        };
      }
      return { ok: true, statusText: "OK", json: async () => ({}) };
    }),
  );
  const root = renderPage(hostedReview("discussion"));
  await vi.waitFor(() => {
    expect(root.querySelector('[data-comment-delete="pr-1-m"]')).toBeTruthy();
  });
  (root.querySelector('[data-comment-delete="pr-1-m"]') as HTMLButtonElement).click();
  await tick();
  (root.querySelector("[data-comment-delete-confirm]") as HTMLButtonElement).click();
  await vi.waitFor(() => {
    expect(root.querySelector('[data-thread="pr-1"] .composer-error')?.textContent).toContain("could not delete");
  });
  expect(root.querySelector('[data-thread="pr-1"] .thread-copy')?.textContent).toBe("note");
  expect(root.querySelector(".composer-spinner")).toBeNull();
});

test("another author's message has no Edit or Delete", async () => {
  const thread = prThread("pr-1", "mine");
  thread.messages.push({
    id: "pr-1-other",
    author: { login: "other-reviewer" },
    body: "theirs",
    createdAt: WHEN,
    updatedAt: WHEN,
    ownedByCurrentUser: false,
  });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      statusText: "OK",
      json: async () => ({ threads: [thread] }),
    })),
  );
  const root = renderPage(hostedReview("discussion"));
  await vi.waitFor(() => {
    expect(root.querySelector('[data-thread="pr-1"]')?.textContent).toContain("theirs");
  });
  expect(root.querySelector('[data-comment-edit="pr-1-m"]')).toBeTruthy();
  expect(root.querySelector('[data-comment-delete="pr-1-m"]')).toBeTruthy();
  expect(root.querySelector('[data-comment-edit="pr-1-other"]')).toBeNull();
  expect(root.querySelector('[data-comment-delete="pr-1-other"]')).toBeNull();
});

test("focus and visibility on return start one list", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-16T12:00:00.000Z"));
  const pending = deferred<void>();
  let lists = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("/head")) {
        return { ok: true, statusText: "OK", json: async () => ({ moved: false }) };
      }
      lists += 1;
      if (lists > 1) await pending.promise;
      return {
        ok: true,
        statusText: "OK",
        json: async () => ({ threads: [prThread("pr-1", "note")] }),
      };
    }),
  );
  renderPage(hostedReview());
  await vi.waitFor(() => {
    expect(lists).toBe(1);
  });
  vi.setSystemTime(Date.now() + THREAD_LIST_STALE_MS);
  window.dispatchEvent(new Event("focus"));
  document.dispatchEvent(new Event("visibilitychange"));
  await tick();
  expect(lists).toBe(2);
  pending.resolve();
});

test("opening a review whose head moved runs Update Diff before listing threads", async () => {
  const order: string[] = [];
  const pendingUpdate = deferred<void>();
  const page = hostedReview("diff");
  const latest = {
    guide: page.guide,
    outcomes: [],
    diff: {
      sourceCommit: "c".repeat(40),
      targetCommit: "a".repeat(40),
      files: [lineFile(LATEST_LINE)],
    },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url === "/api/reviews/fake-review/head") {
        order.push("head");
        return { ok: true, statusText: "OK", json: async () => ({ moved: true }) };
      }
      if (url === "/api/reviews/update-diff" && method === "POST") {
        order.push("update");
        await pendingUpdate.promise;
        return {
          ok: true,
          statusText: "OK",
          json: async () => ({ reviewId: "fake-review", skipped: false }),
        };
      }
      if (url === "/api/reviews/fake-review" && method === "GET") {
        order.push("review");
        return { ok: true, statusText: "OK", json: async () => latest };
      }
      if (url === "/api/reviews/fake-review/comments") {
        order.push("comments");
        return { ok: true, statusText: "OK", json: async () => ({ threads: [] }) };
      }
      throw new Error(`unexpected ${method} ${url}`);
    }),
  );
  const root = renderPage(page);
  await vi.waitFor(() => {
    expect(root.querySelector(".view-tabs .tab-loading")?.textContent).toContain("Updating diff");
  });
  expect(order).toEqual(["head", "update"]);
  expect(root.textContent).toContain(STORED_LINE);
  pendingUpdate.resolve();
  await vi.waitFor(() => {
    expect(order).toContain("comments");
  });
  expect(order.indexOf("update")).toBeLessThan(order.indexOf("comments"));
  expect(root.textContent).toContain(LATEST_LINE);
  expect(root.textContent).not.toContain(STORED_LINE);
  expect(root.querySelector(".view-tabs .tab-loading")).toBeNull();
});

test("a focus with a moved head shows Refresh and does not change the diff", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-16T12:00:00.000Z"));
  let heads = 0;
  let updates = 0;
  let reads = 0;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      reads += 1;
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.endsWith("/head")) {
        heads += 1;
        return { ok: true, statusText: "OK", json: async () => ({ moved: heads > 1 }) };
      }
      if (url === "/api/reviews/update-diff" && method === "POST") {
        updates += 1;
        return {
          ok: true,
          statusText: "OK",
          json: async () => ({ reviewId: "fake-review", skipped: false }),
        };
      }
      if (url.endsWith("/comments")) {
        return { ok: true, statusText: "OK", json: async () => ({ threads: [] }) };
      }
      throw new Error(`unexpected ${method} ${url}`);
    }),
  );
  const root = renderPage(hostedReview("diff"));
  await vi.waitFor(() => {
    expect(heads).toBe(1);
  });
  expect(root.querySelector("[data-refresh-diff]")).toBeNull();
  expect(root.textContent).toContain(STORED_LINE);
  vi.setSystemTime(Date.now() + HEAD_CHECK_STALE_MS);
  window.dispatchEvent(new Event("focus"));
  await vi.waitFor(() => {
    expect(root.querySelector("[data-refresh-diff]")?.textContent).toBe("Refresh");
  });
  expect(root.querySelector(".review-banner")?.textContent).toContain("new commits");
  expect(updates).toBe(0);
  expect(root.textContent).toContain(STORED_LINE);
  const readsAfterFocus = reads;
  window.dispatchEvent(new Event("focus"));
  await tick();
  expect(reads).toBe(readsAfterFocus);
});

test("Refresh updates the diff, then lists threads", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-16T12:00:00.000Z"));
  let heads = 0;
  const order: string[] = [];
  const pendingUpdate = deferred<void>();
  const page = hostedReview("diff");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.endsWith("/head")) {
        heads += 1;
        order.push("head");
        return { ok: true, statusText: "OK", json: async () => ({ moved: heads > 1 }) };
      }
      if (url === "/api/reviews/update-diff" && method === "POST") {
        order.push("update");
        await pendingUpdate.promise;
        return {
          ok: true,
          statusText: "OK",
          json: async () => ({ reviewId: "fake-review", skipped: false }),
        };
      }
      if (url === "/api/reviews/fake-review" && method === "GET") {
        order.push("review");
        return {
          ok: true,
          statusText: "OK",
          json: async () => ({
            guide: page.guide,
            outcomes: [],
            diff: {
              sourceCommit: "c".repeat(40),
              targetCommit: "a".repeat(40),
              files: [lineFile(LATEST_LINE)],
            },
          }),
        };
      }
      if (url.endsWith("/comments")) {
        order.push("comments");
        return { ok: true, statusText: "OK", json: async () => ({ threads: [] }) };
      }
      throw new Error(`unexpected ${method} ${url}`);
    }),
  );
  const root = renderPage(page);
  await vi.waitFor(() => {
    expect(heads).toBe(1);
  });
  vi.setSystemTime(Date.now() + HEAD_CHECK_STALE_MS);
  window.dispatchEvent(new Event("focus"));
  await vi.waitFor(() => {
    expect(root.querySelector("[data-refresh-diff]")).toBeTruthy();
  });
  const before = order.length;
  (root.querySelector("[data-refresh-diff]") as HTMLButtonElement).click();
  await vi.waitFor(() => {
    expect(root.querySelector(".view-tabs .tab-loading")?.textContent).toContain("Updating diff");
  });
  expect(order.slice(before)).toEqual(["update"]);
  expect(root.textContent).toContain(STORED_LINE);
  pendingUpdate.resolve();
  await vi.waitFor(() => {
    expect(root.textContent).toContain(LATEST_LINE);
  });
  expect(root.textContent).not.toContain(STORED_LINE);
  const followed = order.slice(before);
  expect(followed.indexOf("update")).toBeLessThan(followed.indexOf("comments"));
  expect(root.querySelector("[data-refresh-diff]")).toBeNull();
});

test("a draft keeps its text after Refresh and a removed line selection clears", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-09-16T12:00:00.000Z"));
  let heads = 0;
  const page = hostedReview("diff");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.endsWith("/head")) {
        heads += 1;
        return { ok: true, statusText: "OK", json: async () => ({ moved: heads > 1 }) };
      }
      if (url === "/api/reviews/update-diff" && method === "POST") {
        return {
          ok: true,
          statusText: "OK",
          json: async () => ({ reviewId: "fake-review", skipped: false }),
        };
      }
      if (url === "/api/reviews/fake-review" && method === "GET") {
        return {
          ok: true,
          statusText: "OK",
          json: async () => ({
            guide: page.guide,
            outcomes: [],
            diff: {
              sourceCommit: "c".repeat(40),
              targetCommit: "a".repeat(40),
              files: [lineFile("kept beside", 1)],
            },
          }),
        };
      }
      if (url.endsWith("/comments")) {
        return { ok: true, statusText: "OK", json: async () => ({ threads: [] }) };
      }
      throw new Error(`unexpected ${method} ${url}`);
    }),
  );
  const root = renderPage(page);
  await vi.waitFor(() => {
    expect(root.querySelector("[data-comment-new='3'][data-comment-type]")).toBeTruthy();
  });
  (root.querySelector("[data-comment-new='3']") as HTMLElement).click();
  await tick();
  const draft = root.querySelector("[data-comment-draft]") as HTMLTextAreaElement;
  draft.value = "keep this";
  draft.dispatchEvent(new Event("input", { bubbles: true }));
  await tick();
  expect(draft.value).toBe("keep this");
  vi.setSystemTime(Date.now() + HEAD_CHECK_STALE_MS);
  window.dispatchEvent(new Event("focus"));
  await vi.waitFor(() => {
    expect(root.querySelector("[data-refresh-diff]")).toBeTruthy();
  });
  (root.querySelector("[data-refresh-diff]") as HTMLButtonElement).click();
  await vi.waitFor(() => {
    expect(root.querySelector("[data-comment-new='1']")).toBeTruthy();
  });
  expect(root.querySelector(".comment-selected")).toBeNull();
  expect(composerSession.target).toBeNull();
  expect(composerSession.delivery.content).toBe("keep this");
  (root.querySelector("[data-comment-new='1']") as HTMLElement).click();
  await tick();
  expect((root.querySelector("[data-comment-draft]") as HTMLTextAreaElement).value).toBe("keep this");
});

test("a failed update keeps the old diff and offers Retry", async () => {
  let updates = 0;
  const page = hostedReview("diff");
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = (init?.method ?? "GET").toUpperCase();
      if (url.endsWith("/head")) {
        return { ok: true, statusText: "OK", json: async () => ({ moved: true }) };
      }
      if (url === "/api/reviews/update-diff" && method === "POST") {
        updates += 1;
        if (updates === 1) {
          return {
            ok: false,
            statusText: "Bad Gateway",
            json: async () => ({ error: "diff update failed" }),
          };
        }
        return {
          ok: true,
          statusText: "OK",
          json: async () => ({ reviewId: "fake-review", skipped: false }),
        };
      }
      if (url === "/api/reviews/fake-review" && method === "GET") {
        return {
          ok: true,
          statusText: "OK",
          json: async () => ({
            guide: page.guide,
            outcomes: [],
            diff: {
              sourceCommit: "c".repeat(40),
              targetCommit: "a".repeat(40),
              files: [lineFile(LATEST_LINE)],
            },
          }),
        };
      }
      if (url.endsWith("/comments")) {
        return { ok: true, statusText: "OK", json: async () => ({ threads: [] }) };
      }
      throw new Error(`unexpected ${method} ${url}`);
    }),
  );
  const root = renderPage(page);
  await vi.waitFor(() => {
    expect(root.querySelector("[data-retry-diff]")?.textContent).toBe("Retry");
  });
  expect(root.textContent).toContain("diff update failed");
  expect(root.textContent).toContain(STORED_LINE);
  expect(root.textContent).not.toContain(LATEST_LINE);
  (root.querySelector("[data-retry-diff]") as HTMLButtonElement).click();
  await vi.waitFor(() => {
    expect(root.textContent).toContain(LATEST_LINE);
  });
  expect(updates).toBe(2);
  expect(root.textContent).not.toContain(STORED_LINE);
  expect(root.querySelector("[data-retry-diff]")).toBeNull();
});
