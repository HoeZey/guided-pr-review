import { afterEach, expect, test, vi } from "vitest";
import { mount, tick, unmount } from "svelte";
import type { HomePageData, ReviewPageData } from "$lib/shared/page-data";
import {
  FAKE_HOME_ERROR,
  FAKE_HOME_LOADING,
  FAKE_HOME_OK,
  FAKE_REVIEW_ERROR,
  FAKE_REVIEW_LOADING,
  FAKE_REVIEW_OK,
  FAKE_UNCHAPTERED_REVIEW,
} from "$lib/shared/shell-fakes";
import { HOME_PATH, reviewPath } from "$lib/shared/domain/overview";
import { resetHomeUi } from "$lib/client/state/home.svelte";
import { resetReviewSession, session } from "$lib/client/state/review.svelte";
import AppShell from "./AppShell.svelte";

let mounted: ReturnType<typeof mount> | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  if (mounted) unmount(mounted);
  mounted = null;
  host?.remove();
  host = null;
  resetReviewSession();
  resetHomeUi();
  localStorage.clear();
  vi.unstubAllGlobals();
});

function renderShell(data: HomePageData | ReviewPageData) {
  host = document.createElement("div");
  document.body.appendChild(host);
  mounted = mount(AppShell, { target: host, props: { data } });
  return host;
}

test("fake Home data renders chrome, review links, loading, and errors", () => {
  const ok = renderShell(FAKE_HOME_OK);
  const app = ok.querySelector("#app");
  expect(app?.getAttribute("data-view")).toBe("home");
  expect(ok.querySelector("h1")?.textContent).toBe("Home");
  expect(ok.querySelector(".brand-link")?.getAttribute("href")).toBe(HOME_PATH);
  expect(ok.querySelector(`[data-open-review="${FAKE_HOME_OK.reviews[0].id}"]`)?.getAttribute("href")).toBe(
    reviewPath(FAKE_HOME_OK.reviews[0].id),
  );
  expect(ok.querySelector("[role='tablist']")).toBeNull();
  unmount(mounted!);
  mounted = null;
  ok.remove();

  const loading = renderShell(FAKE_HOME_LOADING);
  expect(loading.querySelector(".boot")?.textContent).toBe("Loading…");
  unmount(mounted!);
  mounted = null;
  loading.remove();

  const errored = renderShell(FAKE_HOME_ERROR);
  expect(errored.querySelector(".err")?.textContent).toBe("Failed to load Home");
});

test("fake review data renders tabs internally without fetch or route changes", async () => {
  const fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
  const path = window.location.pathname;
  const root = renderShell(FAKE_REVIEW_OK);
  const app = root.querySelector("#app");
  expect(app?.getAttribute("data-view")).toBe("review");
  expect(app?.getAttribute("data-tab")).toBe("guide");
  expect(root.querySelector("h1")?.textContent).toBe("Fake review");
  expect(root.querySelector(".back-link")?.getAttribute("href")).toBe(HOME_PATH);
  expect(root.querySelector(".guide-section")).toBeTruthy();
  expect(root.querySelector(".guide-aside h2")?.textContent).toBe("Core");

  const diffTab = root.querySelector('[role="tab"][data-tab="diff"]') as HTMLButtonElement;
  const discussionTab = root.querySelector('[role="tab"][data-tab="discussion"]') as HTMLButtonElement;
  expect(root.querySelector('[role="tablist"]')?.querySelectorAll('[role="tab"]').length).toBe(4);
  expect(root.querySelector('[role="tab"][data-tab="guide"]')?.textContent).toContain("Guide");
  expect(diffTab?.textContent).toContain("Diff");
  expect(root.querySelector('[role="tab"][data-tab="review"]')?.textContent).toContain("Code Review");
  expect(discussionTab).toBeTruthy();
  expect(discussionTab.getAttribute("aria-selected")).toBe("false");
  expect(discussionTab.textContent).toContain("Discussion");
  discussionTab.click();
  await tick();
  expect(app?.getAttribute("data-tab")).toBe("discussion");
  expect(discussionTab.getAttribute("aria-selected")).toBe("true");
  expect(root.querySelector('[role="tab"][data-tab="guide"]')?.getAttribute("aria-selected")).toBe("false");
  expect(root.querySelector('[data-tab-panel="discussion"]')).toBeTruthy();
  expect(root.querySelector(".comment-stack.is-pr")).toBeNull();
  diffTab.click();
  await tick();
  expect(app?.getAttribute("data-tab")).toBe("diff");
  expect(diffTab.getAttribute("aria-selected")).toBe("true");
  expect(root.querySelector('[role="tab"][data-tab="guide"]')?.getAttribute("aria-selected")).toBe(
    "false",
  );
  expect(root.querySelector('nav[aria-label="Files"]')).toBeTruthy();
  expect(root.querySelector("[data-tab-panel]")).toBeNull();
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(window.location.pathname).toBe(path);
  expect(session.reviewId).toBe("fake-review");
});

test("unchaptered fake review lands on Diff without a route change", () => {
  const root = renderShell(FAKE_UNCHAPTERED_REVIEW);
  expect(root.querySelector("#app")?.getAttribute("data-tab")).toBe("diff");
  expect(root.querySelector('[role="tab"][data-tab="diff"]')?.getAttribute("aria-selected")).toBe(
    "true",
  );
});

test("hydration consumes Home and review page data without a catalog or review fetch", () => {
  const fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
  const home = renderShell(FAKE_HOME_OK);
  expect(home.querySelector("#app")?.getAttribute("data-view")).toBe("home");
  expect(home.querySelector(`[data-open-review="${FAKE_HOME_OK.reviews[0].id}"]`)).toBeTruthy();
  unmount(mounted!);
  mounted = null;
  home.remove();

  const review = renderShell(FAKE_REVIEW_OK);
  expect(review.querySelector("#app")?.getAttribute("data-view")).toBe("review");
  expect(review.querySelector("h1")?.textContent).toBe("Fake review");
  expect(fetchSpy).not.toHaveBeenCalled();
});

test("review loading and error surfaces keep the shell chrome", () => {
  const loading = renderShell(FAKE_REVIEW_LOADING);
  expect(loading.querySelector("#app")?.getAttribute("data-view")).toBe("review");
  expect(loading.querySelector(".boot")?.textContent).toBe("Loading…");
  unmount(mounted!);
  mounted = null;
  loading.remove();

  const errored = renderShell(FAKE_REVIEW_ERROR);
  expect(errored.querySelector(".err")?.textContent).toBe("Failed to load review");
  expect(errored.querySelector("[role='tablist']")).toBeTruthy();
});
