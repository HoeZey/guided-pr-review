import { afterEach, expect, test, vi } from "vitest";
import { mount, tick, unmount } from "svelte";
import { HOME_FIXTURE, HOME_FIXTURE_WAITING } from "$lib/shared/home-fakes";
import { reviewPath } from "$lib/shared/domain/overview";
import { FAKE_GUIDE } from "$lib/shared/shell-fakes";
import { resetHomeUi, setHomeNavigate } from "$lib/client/state/home.svelte";
import { resetReviewSession } from "$lib/client/state/review.svelte";
import AppShell from "../AppShell.svelte";

let mounted: ReturnType<typeof mount> | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  if (mounted) unmount(mounted);
  mounted = null;
  host?.remove();
  host = null;
  resetReviewSession();
  resetHomeUi();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  localStorage.clear();
});

function renderHome() {
  host = document.createElement("div");
  document.body.appendChild(host);
  mounted = mount(AppShell, { target: host, props: { data: HOME_FIXTURE } });
  return host;
}

test("hydration renders projected Home from page data without refetching list or catalog", () => {
  const fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
  const root = renderHome();
  expect(root.querySelector(".home-group h2")?.textContent).toBe("Review requests");
  expect(root.querySelector(`[data-open-review="saved-current"]`)?.getAttribute("href")).toBe(
    reviewPath("saved-current"),
  );
  expect(root.querySelector(`[data-open-review="saved-local"]`)?.getAttribute("href")).toBe(
    reviewPath("saved-local"),
  );
  expect(root.querySelector("[data-queue-open]")?.textContent).toContain("Open from host");
  expect(root.querySelector("[data-queue-update-diff]")?.textContent).toBe("Update Diff");
  expect(root.querySelector("[data-queue-generate]")?.textContent).toBe("Generate guide");
  expect(root.querySelector("[data-queue-refresh]")?.textContent).toBe("Refresh");
  expect(root.querySelector("[data-open-paste]")?.textContent).toBe("Add");
  expect(root.querySelector(".home-group.is-archived summary h2")?.textContent).toBe("Archived");
  expect(fetchSpy).not.toHaveBeenCalled();
  unmount(mounted!);
  mounted = null;
  root.remove();
  host = document.createElement("div");
  document.body.appendChild(host);
  mounted = mount(AppShell, { target: host, props: { data: HOME_FIXTURE_WAITING } });
  expect([...host.querySelectorAll(".home-card-status")].map((el) => el.textContent)).toContain(
    "Waiting",
  );
  expect(fetchSpy).not.toHaveBeenCalled();
});

test("Paste Guide posts the existing reviews API then navigates to the new review", async () => {
  const goto = vi.fn().mockResolvedValue(undefined);
  setHomeNavigate(goto);
  const fetchSpy = vi.fn().mockResolvedValue({
    ok: true,
    statusText: "Created",
    json: async () => ({ id: "pasted-1" }),
  });
  vi.stubGlobal("fetch", fetchSpy);
  const root = renderHome();
  (root.querySelector("[data-open-paste]") as HTMLButtonElement).click();
  await tick();
  const textarea = root.querySelector("#paste-json") as HTMLTextAreaElement;
  textarea.value = JSON.stringify(FAKE_GUIDE);
  (root.querySelector("[data-paste-save]") as HTMLButtonElement).click();
  await tick();
  await Promise.resolve();
  expect(fetchSpy).toHaveBeenCalledTimes(1);
  const init = fetchSpy.mock.calls[0][1] as RequestInit;
  expect(fetchSpy.mock.calls[0][0]).toBe("/api/reviews");
  expect(init.method).toBe("POST");
  expect(JSON.parse(String(init.body))).toEqual({ guide: FAKE_GUIDE });
  expect(goto).toHaveBeenCalledWith(reviewPath("pasted-1"));
});

test("host actions keep stale Home visible while the API request is in flight", async () => {
  let resolvePost: ((value: unknown) => void) | undefined;
  const fetchSpy = vi.fn((url: string) => {
    if (url === "/api/actions") {
      return new Promise((resolve) => {
        resolvePost = resolve;
      });
    }
    return Promise.resolve({
      ok: true,
      statusText: "OK",
      json: async () => ({
        reviews: HOME_FIXTURE.reviews,
        catalog: HOME_FIXTURE.catalog,
        actions: HOME_FIXTURE.actions,
        agentConnected: true,
        activeId: HOME_FIXTURE.activeId,
        repositories: [],
      }),
    });
  });
  vi.stubGlobal("fetch", fetchSpy);
  const root = renderHome();
  (root.querySelector("[data-queue-refresh]") as HTMLButtonElement).click();
  await tick();
  expect(root.querySelector(".home-group h2")?.textContent).toBe("Review requests");
  expect(root.querySelector(".home-card-title")?.textContent).toBe("Current work");
  expect(fetchSpy.mock.calls[0][0]).toBe("/api/actions");
  resolvePost?.({
    ok: true,
    statusText: "Created",
    json: async () => ({ id: "refresh-1" }),
  });
  await tick();
});
