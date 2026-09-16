import { afterEach, expect, test, vi } from "vitest";
import { mount, tick, unmount } from "svelte";
import { HOME_FIXTURE, HOME_FIXTURE_DISCONNECTED } from "$lib/shared/home-fakes";
import { reviewPath } from "$lib/shared/domain/overview";
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
});

function homeFetch(handler?: (url: string, init?: RequestInit) => Promise<unknown> | unknown) {
  return vi.fn((url: string, init?: RequestInit) => {
    const handled = handler?.(url, init);
    if (handled !== undefined) return Promise.resolve(handled);
    if (url === "/api/connections") {
      return Promise.resolve({
        ok: true,
        statusText: "OK",
        json: async () => ({ connections: [] }),
      });
    }
    if (url === "/api/repositories") {
      return Promise.resolve({
        ok: true,
        statusText: "OK",
        json: async () => ({ repositories: [] }),
      });
    }
    return Promise.resolve({
      ok: true,
      statusText: "OK",
      json: async () => ({}),
    });
  });
}

test("Open posts the review open handler, stays on stale Home, then navigates", async () => {
  const goto = vi.fn().mockResolvedValue(undefined);
  setHomeNavigate(goto);
  let resolveOpen: ((value: unknown) => void) | undefined;
  const fetchSpy = homeFetch((url) => {
    if (url === "/api/reviews/open") {
      return new Promise((resolve) => {
        resolveOpen = resolve;
      });
    }
    if (url === "/api/reviews") {
      return {
        ok: true,
        statusText: "OK",
        json: async () => ({
          reviews: HOME_FIXTURE.reviews,
          catalog: HOME_FIXTURE.catalog,
          actions: [],
          agentConnected: false,
          activeId: HOME_FIXTURE.activeId,
          repositories: [],
        }),
      };
    }
    return undefined;
  });
  vi.stubGlobal("fetch", fetchSpy);
  host = document.createElement("div");
  document.body.appendChild(host);
  mounted = mount(AppShell, { target: host, props: { data: HOME_FIXTURE_DISCONNECTED } });
  await tick();
  const button = host.querySelector("[data-queue-open]") as HTMLButtonElement;
  expect(button).toBeTruthy();
  button.click();
  await tick();
  expect(host.querySelector(".home-card-title")?.textContent).toBe("Current work");
  expect([...host.querySelectorAll(".home-card-status")].map((el) => el.textContent)).toContain(
    "Opening",
  );
  expect(fetchSpy.mock.calls.some(([url]) => url === "/api/reviews/open")).toBe(true);
  expect(fetchSpy.mock.calls.some(([url]) => url === "/api/actions")).toBe(false);
  const openCall = fetchSpy.mock.calls.find(([url]) => url === "/api/reviews/open");
  expect(JSON.parse(String((openCall?.[1] as RequestInit).body))).toEqual({
    target: {
      provider: "azure-devops",
      host: "dev.azure.com",
      repository: {
        id: "repo-1",
        owner: "braidteam/BRAID",
        name: "braid-connection-designer",
        webUrl: "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer",
      },
      number: 1106,
    },
  });
  resolveOpen?.({
    ok: true,
    statusText: "OK",
    json: async () => ({ reviewId: "opened-1", skipped: false }),
  });
  await vi.waitFor(() => {
    expect(goto).toHaveBeenCalledWith(reviewPath("opened-1"));
  });
});

test("Update Diff posts the review update handler without an agent", async () => {
  const goto = vi.fn().mockResolvedValue(undefined);
  setHomeNavigate(goto);
  const fetchSpy = homeFetch((url) => {
    if (url === "/api/reviews/update-diff") {
      return {
        ok: true,
        statusText: "OK",
        json: async () => ({ reviewId: "saved-outdated", skipped: false }),
      };
    }
    if (url === "/api/reviews") {
      return {
        ok: true,
        statusText: "OK",
        json: async () => ({
          reviews: HOME_FIXTURE.reviews,
          catalog: HOME_FIXTURE.catalog,
          actions: [],
          agentConnected: false,
          activeId: HOME_FIXTURE.activeId,
          repositories: [],
        }),
      };
    }
    return undefined;
  });
  vi.stubGlobal("fetch", fetchSpy);
  host = document.createElement("div");
  document.body.appendChild(host);
  mounted = mount(AppShell, { target: host, props: { data: HOME_FIXTURE_DISCONNECTED } });
  await tick();
  const button = host.querySelector("[data-queue-update-diff]") as HTMLButtonElement;
  expect(button).toBeTruthy();
  button.click();
  await vi.waitFor(() => {
    expect(fetchSpy.mock.calls.some(([url]) => url === "/api/reviews/update-diff")).toBe(true);
  });
  expect(fetchSpy.mock.calls.some(([url]) => url === "/api/actions")).toBe(false);
  await vi.waitFor(() => {
    expect(goto).toHaveBeenCalledWith(reviewPath("saved-outdated"));
  });
});

test("repeated Open for the same PR shares one in-flight request", async () => {
  let opens = 0;
  let resolveOpen: ((value: unknown) => void) | undefined;
  const fetchSpy = homeFetch((url) => {
    if (url === "/api/reviews/open") {
      opens += 1;
      return new Promise((resolve) => {
        resolveOpen = resolve;
      });
    }
    if (url === "/api/reviews") {
      return {
        ok: true,
        statusText: "OK",
        json: async () => ({
          reviews: HOME_FIXTURE.reviews,
          catalog: HOME_FIXTURE.catalog,
          actions: [],
          agentConnected: true,
          activeId: HOME_FIXTURE.activeId,
          repositories: [],
        }),
      };
    }
    return undefined;
  });
  vi.stubGlobal("fetch", fetchSpy);
  host = document.createElement("div");
  document.body.appendChild(host);
  mounted = mount(AppShell, { target: host, props: { data: HOME_FIXTURE } });
  await tick();
  const button = host.querySelector("[data-queue-open]") as HTMLButtonElement;
  button.click();
  button.click();
  await tick();
  expect(opens).toBe(1);
  resolveOpen?.({
    ok: true,
    statusText: "OK",
    json: async () => ({ reviewId: "opened-1", skipped: false }),
  });
  await tick();
});
