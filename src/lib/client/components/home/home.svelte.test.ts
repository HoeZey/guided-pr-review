import { afterEach, expect, test, vi } from "vitest";
import { mount, tick, unmount } from "svelte";
import {
  HOME_FIXTURE,
  HOME_FIXTURE_DISCONNECTED,
  HOME_FIXTURE_WAITING,
  SHA_C,
} from "$lib/shared/home-fakes";
import { reviewPath } from "$lib/shared/domain/overview";
import { CATALOG_REFRESH_STALE_MS } from "$lib/shared/domain/catalog";
import { resetHomeUi, homeUi, addRepository } from "$lib/client/state/home.svelte";
import { HOME_GROUPS_KEY } from "$lib/client/browser/preferences";
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
    if (String(url).startsWith("/api/repositories/search") || String(url).startsWith("/api/repositories/search?")) {
      return Promise.resolve({
        ok: true,
        statusText: "OK",
        json: async () => ({ repositories: [] }),
      });
    }
    if (url === "/api/catalog") {
      return Promise.resolve({
        ok: true,
        statusText: "OK",
        json: async () => ({ skipped: false }),
      });
    }
    if (url === "/api/reviews") {
      return Promise.resolve({
        ok: true,
        statusText: "OK",
        json: async () => ({
          reviews: HOME_FIXTURE.reviews,
          catalog: HOME_FIXTURE.catalog,
          actions: HOME_FIXTURE.actions,
          agentConnected: HOME_FIXTURE.agentConnected,
          activeId: HOME_FIXTURE.activeId,
          repositories: HOME_FIXTURE.repositories,
        }),
      });
    }
    return Promise.resolve({
      ok: true,
      statusText: "OK",
      json: async () => ({}),
    });
  });
}

function homeFetchUrls(fetchSpy: ReturnType<typeof vi.fn>): string[] {
  return fetchSpy.mock.calls.map(([url]) => String(url));
}

function homeSection(root: ParentNode, title: string): HTMLDetailsElement {
  const section = [...root.querySelectorAll("details.home-group")].find(
    (el) => el.querySelector("h2")?.textContent === title,
  );
  if (!(section instanceof HTMLDetailsElement)) throw new Error(`missing ${title}`);
  return section;
}

test("Home restores a collapsed section and keeps the next choice", async () => {
  localStorage.setItem(
    HOME_GROUPS_KEY,
    JSON.stringify({ archived: true, "my-published-prs": false }),
  );
  vi.stubGlobal("fetch", homeFetch());
  const root = renderHome();
  await tick();
  expect(homeSection(root, "Archived").open).toBe(true);
  expect(homeSection(root, "My published PRs").open).toBe(false);

  const published = homeSection(root, "My published PRs");
  published.open = true;
  published.dispatchEvent(new Event("toggle"));
  await tick();
  expect(homeSection(root, "My published PRs").open).toBe(true);
  expect(JSON.parse(localStorage.getItem(HOME_GROUPS_KEY) ?? "{}")).toMatchObject({
    archived: true,
    "my-published-prs": true,
  });

  unmount(mounted!);
  mounted = null;
  root.remove();
  const again = renderHome();
  await tick();
  expect(homeSection(again, "My published PRs").open).toBe(true);
  expect(homeSection(again, "Archived").open).toBe(true);
});

test("hydration renders projected Home from page data without refetching list or catalog", async () => {
  const fetchSpy = homeFetch();
  vi.stubGlobal("fetch", fetchSpy);
  const root = renderHome();
  await tick();
  expect(root.querySelector(".home-group h2")?.textContent).toBe("Review requests");
  expect(root.querySelector(`[data-open-review="saved-current"]`)?.getAttribute("href")).toBe(
    reviewPath("saved-current"),
  );
  expect(root.querySelector(`[data-open-review="saved-outdated"]`)?.getAttribute("href")).toBe(
    reviewPath("saved-outdated"),
  );
  expect(root.querySelector(`[data-open-review="saved-local"]`)?.getAttribute("href")).toBe(
    reviewPath("saved-local"),
  );
  expect(root.querySelector("[data-queue-open]")).toBeNull();
  expect(root.textContent).not.toContain("Open from host");
  expect(root.querySelector("[data-queue-update-diff]")).toBeNull();
  expect(root.querySelector("[data-queue-generate]")).toBeNull();
  expect(root.querySelector(".home-card-status.is-outdated")).toBeNull();
  expect(
    [...root.querySelectorAll(".home-card-status")].map((el) => el.textContent),
  ).not.toContain("No guide");
  expect(root.textContent).not.toContain("Update Diff");
  expect(root.textContent).not.toContain("Generate guide");
  expect(root.textContent).not.toContain("Open saved");
  expect(root.querySelector('[data-guide-book="green"]')?.getAttribute("aria-label")).toBe(
    "The guide is up to date",
  );
  expect(root.querySelector('[data-guide-book="yellow"]')?.getAttribute("aria-label")).toBe(
    "Guide stale. Ask your coding agent to update the guide",
  );
  expect(root.querySelector('[data-guide-book="grey"]')?.getAttribute("aria-label")).toBe(
    "Guide missing. Ask your coding agent to generate the guide",
  );
  expect(root.querySelector('[data-guide-book="grey"] svg path')?.getAttribute("d")).toContain(
    "M4 19.5",
  );
  expect(root.querySelector('[data-guide-book="green"] svg path')?.getAttribute("d")).toContain(
    "M12 5v16",
  );
  expect(root.querySelector('[data-guide-book="yellow"] svg path')?.getAttribute("d")).toContain(
    "M12 5v16",
  );
  expect(
    [...root.querySelectorAll("[data-archive-status]")].map((el) => el.textContent),
  ).toEqual(["Merged", "Closed", "Closed"]);
  expect(
    [...root.querySelectorAll(".home-group.is-archived [data-guide-book]")].map((el) =>
      el.getAttribute("data-guide-book"),
    ),
  ).toEqual(["green", "green", "green"]);
  const refresh = root.querySelector("[data-queue-refresh]");
  expect(refresh?.querySelector("svg.refresh-icon path")?.getAttribute("d")).toContain("M3 12a9");
  expect(refresh?.textContent?.trim()).not.toBe("Refresh");
  expect(root.querySelector("[data-open-paste]")).toBeNull();
  expect(root.querySelector("#paste-modal")).toBeNull();
  expect(root.querySelector("[data-home-controls] [data-repository-search]")).toBeNull();
  expect(root.querySelector('[data-open-repo-menu="github"]')).toBeTruthy();
  expect(root.querySelector('[data-open-repo-menu="azure-devops"]')).toBeTruthy();
  expect((root.querySelector("[data-ado-organization]") as HTMLInputElement).value).toBe(
    "braidteam",
  );
  expect((root.querySelector("[data-ado-project]") as HTMLInputElement).value).toBe("BRAID");
  expect(root.querySelector("[data-add-repository-input]")).toBeNull();
  expect(root.textContent).not.toContain("Repository URL");
  expect(root.querySelector("[data-home-cards] .home-group")).toBeTruthy();
  expect(root.querySelector(".home-group.is-archived summary h2")?.textContent).toBe("Archived");
  expect(
    homeFetchUrls(fetchSpy).every(
      (url) =>
        url === "/api/connections" ||
        url === "/api/repositories" ||
        String(url).startsWith("/api/repositories/search") ||
        url === "/api/catalog" ||
        url === "/api/reviews",
    ),
  ).toBe(true);
  unmount(mounted!);
  mounted = null;
  root.remove();
  host = document.createElement("div");
  document.body.appendChild(host);
  mounted = mount(AppShell, { target: host, props: { data: HOME_FIXTURE_WAITING } });
  await tick();
  expect(host.querySelector("[data-queue-generate]")).toBeNull();
  expect(host.textContent).not.toContain("Waiting");
  expect(homeFetchUrls(fetchSpy).some((url) => url.includes("actions"))).toBe(false);
});

test("background catalog check dots the refresh icon without adding a card", async () => {
  let catalogBody: { reviews: typeof HOME_FIXTURE.reviews; catalog: typeof HOME_FIXTURE.catalog } | null =
    null;
  const fetchSpy = homeFetch((url) => {
    if (url === "/api/catalog") {
      return {
        ok: true,
        statusText: "OK",
        json: async () => ({ skipped: false }),
      };
    }
    if (url === "/api/reviews") {
      const nextCatalog = structuredClone(HOME_FIXTURE.catalog);
      nextCatalog[0].pullRequests.push({
        ...HOME_FIXTURE.catalog[0].pullRequests[0],
        number: 9999,
        title: "Brand new review request",
        webUrl:
          "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/9999",
        sourceCommit: SHA_C,
        isReviewer: true,
        isAuthor: false,
        status: "active",
      });
      catalogBody = {
        reviews: HOME_FIXTURE.reviews,
        catalog: nextCatalog,
      };
      return {
        ok: true,
        statusText: "OK",
        json: async () => ({
          reviews: catalogBody!.reviews,
          catalog: catalogBody!.catalog,
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
  const root = renderHome();
  await vi.waitFor(() => {
    expect(homeFetchUrls(fetchSpy).filter((url) => url === "/api/catalog")).toHaveLength(1);
  });
  await vi.waitFor(() => {
    expect(root.querySelector("[data-refresh-dot]")).toBeTruthy();
  });
  expect(root.querySelector("[data-queue-refresh]")?.getAttribute("title")).toBe("New changes to pull");
  expect(root.textContent).not.toContain("Brand new review request");
  expect(root.querySelector(".home-card-title")?.textContent).toBe("Current work");
  expect(homeUi.refreshing).toBe(false);
  expect(homeUi.hasNewChanges).toBe(true);
  expect(JSON.parse(String((fetchSpy.mock.calls.find(([url]) => url === "/api/catalog")?.[1] as RequestInit).body))).toEqual(
    { reason: "focus" },
  );
});

test("host actions keep stale Home visible while the API request is in flight", async () => {
  let catalogCalls = 0;
  let resolvePost: ((value: unknown) => void) | undefined;
  const fetchSpy = homeFetch((url) => {
    if (url === "/api/catalog") {
      catalogCalls += 1;
      if (catalogCalls === 1) {
        return {
          ok: true,
          statusText: "OK",
          json: async () => ({ skipped: false }),
        };
      }
      return new Promise((resolve) => {
        resolvePost = resolve;
      });
    }
    if (url === "/api/reviews") {
      return {
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
      };
    }
    return undefined;
  });
  vi.stubGlobal("fetch", fetchSpy);
  const root = renderHome();
  await vi.waitFor(() => {
    expect(catalogCalls).toBe(1);
    expect(homeUi.refreshing).toBe(false);
  });
  homeUi.lastCatalogRefreshAt = null;
  (root.querySelector("[data-queue-refresh]") as HTMLButtonElement).click();
  await tick();
  expect(root.querySelector(".home-group h2")?.textContent).toBe("Review requests");
  expect(root.querySelector(".home-card-title")?.textContent).toBe("Current work");
  expect(root.querySelector("[data-queue-refresh]")?.classList.contains("is-spinning")).toBe(true);
  expect(root.querySelector("[data-queue-refresh]")?.getAttribute("aria-busy")).toBe("true");
  expect(homeFetchUrls(fetchSpy).filter((url) => url === "/api/catalog").length).toBeGreaterThan(1);
  expect(homeFetchUrls(fetchSpy).some((url) => url === "/api/actions")).toBe(false);
  resolvePost?.({
    ok: true,
    statusText: "OK",
    json: async () => ({ skipped: false }),
  });
  await vi.waitFor(() => {
    expect(homeFetchUrls(fetchSpy).some((url) => url === "/api/reviews/update-diff")).toBe(true);
  });
  expect(homeUi.refreshing).toBe(false);
});

test("Home shows provider recovery and Retry without leaking tokens", async () => {
  const payload = {
    connections: [
      {
        provider: "azure-devops",
        host: "dev.azure.com",
        status: "login-required",
        recovery: "az login",
      },
      {
        provider: "github",
        host: "github.com",
        status: "connected",
        login: "octocat",
      },
    ],
  };
  const fetchSpy = vi.fn().mockResolvedValue({
    ok: true,
    statusText: "OK",
    json: async () => payload,
  });
  vi.stubGlobal("fetch", fetchSpy);
  const root = renderHome();
  await vi.waitFor(() => {
    expect(root.querySelector('[data-connection="azure-devops"]')?.textContent).toContain("az login");
  });
  expect(root.querySelector('[data-retry-connection="azure-devops"]')?.textContent).toBe("Retry");
  expect(root.querySelector('[data-connection="github"]')?.textContent).toContain("octocat");
  expect(root.textContent).not.toContain("gho_");
  expect(root.textContent).not.toContain("accessToken");
  (root.querySelector("[data-retry-connection='azure-devops']") as HTMLButtonElement).click();
  await tick();
  expect(fetchSpy.mock.calls.some((call) => (call[1] as RequestInit | undefined)?.method === "POST")).toBe(
    true,
  );
});

test("Home add and remove repository call the thin handler and never queue agent actions", async () => {
  const origin = {
    provider: "azure-devops" as const,
    host: "dev.azure.com",
    id: "ado-1",
    owner: "braidteam/BRAID",
    name: "braid-connection-designer",
    webUrl: "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer",
    origin: true,
  };
  const github = {
    provider: "github" as const,
    host: "github.com",
    id: "1296269",
    owner: "octocat",
    name: "Hello-World",
    webUrl: "https://github.com/octocat/Hello-World",
    origin: false,
  };
  const candidate = {
    provider: "github" as const,
    host: "github.com",
    owner: "octocat",
    name: "Hello-World",
    webUrl: "https://github.com/octocat/Hello-World",
  };
  let rows = [origin];
  const fetchSpy = homeFetch((url, init) => {
    if (url === "/api/repositories" && (!init?.method || init.method === "GET")) {
      return {
        ok: true,
        statusText: "OK",
        json: async () => ({ repositories: rows }),
      };
    }
    if (String(url).startsWith("/api/repositories/search")) {
      return {
        ok: true,
        statusText: "OK",
        json: async () => ({ repositories: [candidate] }),
      };
    }
    if (url === "/api/repositories" && init?.method === "POST") {
      expect(JSON.parse(String(init.body))).toEqual({
        provider: "github",
        host: "github.com",
        owner: "octocat",
        name: "Hello-World",
      });
      rows = [origin, github];
      return {
        ok: true,
        statusText: "Created",
        json: async () => ({ repository: github }),
      };
    }
    if (String(url).startsWith("/api/repositories/") && init?.method === "DELETE") {
      rows = [origin];
      return {
        ok: true,
        statusText: "OK",
        json: async () => ({ ok: true }),
      };
    }
    return undefined;
  });
  vi.stubGlobal("fetch", fetchSpy);
  const root = renderHome();
  await vi.waitFor(() => {
    expect(root.querySelector('[data-configured-repository="ado-1"]')?.textContent).toContain(
      "braid-connection-designer",
    );
    expect(root.querySelector('[data-configured-repository="ado-1"]')?.textContent).not.toContain(
      "braidteam/BRAID /",
    );
  });
  expect(root.querySelector('[data-configured-repository="ado-1"]')?.textContent).toContain("origin");
  (root.querySelector('[data-open-repo-menu="github"]') as HTMLButtonElement).click();
  await vi.waitFor(() => {
    expect(root.querySelector('[data-add-repository="octocat/Hello-World"]')).toBeTruthy();
  });
  (root.querySelector('[data-add-repository="octocat/Hello-World"]') as HTMLButtonElement).click();
  await vi.waitFor(() => {
    expect(root.querySelector('[data-configured-repository="1296269"]')?.textContent).toContain(
      "octocat / Hello-World",
    );
  });
  expect(homeFetchUrls(fetchSpy).some((url) => url === "/api/actions")).toBe(false);
  (root.querySelector('[data-remove-repository="1296269"]') as HTMLButtonElement).click();
  await vi.waitFor(() => {
    expect(root.querySelector('[data-confirm-remove="1296269"]')).toBeTruthy();
  });
  (root.querySelector('[data-confirm-remove="1296269"]') as HTMLButtonElement).click();
  await vi.waitFor(() => {
    expect(root.querySelector('[data-configured-repository="1296269"]')).toBeNull();
  });
  expect(root.querySelector('[data-configured-repository="ado-1"]')).not.toBeNull();
});

test("Home shows duplicate repository errors from the handler", async () => {
  const candidate = {
    provider: "github" as const,
    host: "github.com",
    owner: "octocat",
    name: "Hello-World",
  };
  const fetchSpy = homeFetch((url, init) => {
    if (String(url).startsWith("/api/repositories/search")) {
      return {
        ok: true,
        statusText: "OK",
        json: async () => ({ repositories: [candidate] }),
      };
    }
    if (url === "/api/repositories" && init?.method === "POST") {
      return {
        ok: false,
        statusText: "Conflict",
        json: async () => ({ error: "This repository is already configured" }),
      };
    }
    return undefined;
  });
  vi.stubGlobal("fetch", fetchSpy);
  const root = renderHome();
  (root.querySelector('[data-open-repo-menu="github"]') as HTMLButtonElement).click();
  await vi.waitFor(() => {
    expect(root.querySelector("[data-repository-search]")).toBeTruthy();
    expect(root.querySelector('[data-add-repository="octocat/Hello-World"]')).toBeTruthy();
  });
  await addRepository(candidate);
  await vi.waitFor(() => {
    expect(root.querySelector("[data-repository-error]")?.textContent).toBe(
      "This repository is already configured",
    );
  });
  expect(homeFetchUrls(fetchSpy).some((url) => url === "/api/actions")).toBe(false);
});

test("failed searchable list keeps the home column controls", async () => {
  const fetchSpy = homeFetch((url) => {
    if (String(url).startsWith("/api/repositories/search")) {
      return {
        ok: true,
        statusText: "OK",
        json: async () => ({
          repositories: [],
          error: { code: "unavailable", message: "gh list failed" },
        }),
      };
    }
    return undefined;
  });
  vi.stubGlobal("fetch", fetchSpy);
  const root = renderHome();
  await vi.waitFor(() => {
    expect(root.querySelector("[data-repository-error]")?.textContent).toBe("gh list failed");
  });
  expect(root.querySelector("[data-home-controls]")).toBeTruthy();
  expect(root.querySelector('[data-open-repo-menu="github"]')).toBeTruthy();
  expect(root.querySelector("[data-repository-search]")).toBeNull();
  expect(root.querySelector("[data-home-cards]")).toBeTruthy();
});

test("parallel repository loads keep busy and search errors until both finish", async () => {
  let resolveList: ((value: unknown) => void) | undefined;
  let resolveSearch: ((value: unknown) => void) | undefined;
  const fetchSpy = homeFetch((url) => {
    if (url === "/api/repositories") {
      return new Promise((resolve) => {
        resolveList = resolve;
      });
    }
    if (String(url).startsWith("/api/repositories/search")) {
      return new Promise((resolve) => {
        resolveSearch = resolve;
      });
    }
    return undefined;
  });
  vi.stubGlobal("fetch", fetchSpy);
  const root = renderHome();
  await vi.waitFor(() => {
    expect(resolveList).toBeTypeOf("function");
    expect(resolveSearch).toBeTypeOf("function");
  });
  expect(homeUi.repositoryBusy).toBe(true);

  resolveSearch?.({
    ok: true,
    statusText: "OK",
    json: async () => ({
      repositories: [],
      error: { code: "unavailable", message: "gh list failed" },
    }),
  });
  await vi.waitFor(() => {
    expect(root.querySelector("[data-repository-error]")?.textContent).toBe("gh list failed");
  });
  expect(homeUi.repositoryBusy).toBe(true);

  resolveList?.({
    ok: true,
    statusText: "OK",
    json: async () => ({ repositories: [] }),
  });
  await vi.waitFor(() => {
    expect(homeUi.repositoryBusy).toBe(false);
  });
  expect(root.querySelector("[data-repository-error]")?.textContent).toBe("gh list failed");
  expect(root.querySelector("[data-home-controls]")).toBeTruthy();
});

test("Refresh stays enabled without an agent and does not queue actions", async () => {
  const fetchSpy = homeFetch((url) => {
    if (url === "/api/catalog") {
      return {
        ok: true,
        statusText: "OK",
        json: async () => ({ skipped: false }),
      };
    }
    if (url === "/api/reviews") {
      return {
        ok: true,
        statusText: "OK",
        json: async () => ({
          reviews: HOME_FIXTURE_DISCONNECTED.reviews,
          catalog: HOME_FIXTURE_DISCONNECTED.catalog,
          actions: HOME_FIXTURE_DISCONNECTED.actions,
          agentConnected: false,
          activeId: HOME_FIXTURE_DISCONNECTED.activeId,
          repositories: HOME_FIXTURE_DISCONNECTED.repositories,
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
  const button = host.querySelector("[data-queue-refresh]") as HTMLButtonElement;
  expect(button.disabled).toBe(false);
  button.click();
  await vi.waitFor(() => {
    expect(homeFetchUrls(fetchSpy).some((url) => url === "/api/catalog")).toBe(true);
  });
  await vi.waitFor(() => {
    expect(homeFetchUrls(fetchSpy).some((url) => url === "/api/reviews/update-diff")).toBe(true);
  });
  expect(homeFetchUrls(fetchSpy).some((url) => url === "/api/actions")).toBe(false);
  expect(host.querySelector(".home-card-title")?.textContent).toBe("Current work");
});

test("failed catalog refresh keeps prior Home cards and shows the existing error line", async () => {
  const fetchSpy = homeFetch((url) => {
    if (url === "/api/catalog") {
      return {
        ok: false,
        statusText: "Internal Server Error",
        json: async () => ({ error: "listRepositories failed" }),
      };
    }
    return undefined;
  });
  vi.stubGlobal("fetch", fetchSpy);
  const root = renderHome();
  await tick();
  (root.querySelector("[data-queue-refresh]") as HTMLButtonElement).click();
  await vi.waitFor(() => {
    expect(root.querySelector("[data-refresh-error]")?.textContent).toBe("listRepositories failed");
  });
  expect(root.querySelector(".home-card-title")?.textContent).toBe("Current work");
  expect(homeUi.refreshing).toBe(false);
  expect(homeFetchUrls(fetchSpy).some((url) => url === "/api/actions")).toBe(false);
});

test("stale Home focus refreshes after 60 seconds and skips inside the window", async () => {
  let now = Date.parse("2026-09-16T12:00:00.000Z");
  vi.spyOn(Date, "now").mockImplementation(() => now);
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => "visible",
  });
  const fetchSpy = homeFetch((url) => {
    if (url === "/api/catalog") {
      return {
        ok: true,
        statusText: "OK",
        json: async () => ({ skipped: false }),
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
          agentConnected: true,
          activeId: HOME_FIXTURE.activeId,
          repositories: [],
        }),
      };
    }
    return undefined;
  });
  vi.stubGlobal("fetch", fetchSpy);
  const root = renderHome();
  await tick();
  await vi.waitFor(() => {
    expect(fetchSpy.mock.calls.filter(([url]) => url === "/api/catalog").length).toBeGreaterThan(0);
    expect(fetchSpy.mock.calls.filter(([url]) => url === "/api/reviews").length).toBeGreaterThan(0);
  });
  await vi.waitFor(() => {
    expect(homeUi.lastCatalogRefreshAt).not.toBeNull();
  });
  homeUi.lastCatalogRefreshAt = now;
  const before = fetchSpy.mock.calls.filter(([url]) => url === "/api/catalog").length;
  document.dispatchEvent(new Event("visibilitychange"));
  await tick();
  expect(fetchSpy.mock.calls.filter(([url]) => url === "/api/catalog")).toHaveLength(before);
  now += CATALOG_REFRESH_STALE_MS;
  document.dispatchEvent(new Event("visibilitychange"));
  await vi.waitFor(() => {
    expect(fetchSpy.mock.calls.filter(([url]) => url === "/api/catalog")).toHaveLength(before + 1);
  });
  const focusBodies = fetchSpy.mock.calls
    .filter(([url]) => url === "/api/catalog")
    .map(([, init]) => JSON.parse(String((init as RequestInit).body)));
  expect(focusBodies.every((body) => body.reason === "focus")).toBe(true);
  expect(root.querySelector(".home-card-title")?.textContent).toBe("Current work");
});

test("manual refresh coalesced with focus still persists diffs", async () => {
  let resolveFocus: ((value: unknown) => void) | undefined;
  const fetchSpy = homeFetch((url) => {
    if (url === "/api/catalog") {
      return new Promise((resolve) => {
        resolveFocus = resolve;
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
    if (url === "/api/reviews/update-diff") {
      return {
        ok: true,
        statusText: "OK",
        json: async () => ({ reviewId: "saved-current" }),
      };
    }
    return undefined;
  });
  vi.stubGlobal("fetch", fetchSpy);
  const root = renderHome();
  await vi.waitFor(() => {
    expect(resolveFocus).toBeTypeOf("function");
  });
  (root.querySelector("[data-queue-refresh]") as HTMLButtonElement).click();
  await tick();
  expect(homeFetchUrls(fetchSpy).filter((url) => url === "/api/reviews/update-diff")).toHaveLength(0);
  resolveFocus?.({
    ok: true,
    statusText: "OK",
    json: async () => ({ skipped: false }),
  });
  await vi.waitFor(() => {
    expect(homeFetchUrls(fetchSpy).some((url) => url === "/api/reviews/update-diff")).toBe(true);
  });
  expect(homeFetchUrls(fetchSpy).filter((url) => url === "/api/catalog")).toHaveLength(1);
  expect(
    fetchSpy.mock.calls
      .filter(([url]) => url === "/api/catalog")
      .map(([, init]) => JSON.parse(String((init as RequestInit).body))),
  ).toEqual([{ reason: "focus" }]);
});

