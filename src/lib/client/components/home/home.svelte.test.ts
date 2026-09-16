import { afterEach, expect, test, vi } from "vitest";
import { mount, tick, unmount } from "svelte";
import { HOME_FIXTURE, HOME_FIXTURE_WAITING } from "$lib/shared/home-fakes";
import { reviewPath } from "$lib/shared/domain/overview";
import { FAKE_GUIDE } from "$lib/shared/shell-fakes";
import { resetHomeUi, setHomeNavigate, homeUi, addRepository } from "$lib/client/state/home.svelte";
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

test("hydration renders projected Home from page data without refetching list or catalog", async () => {
  const fetchSpy = homeFetch();
  vi.stubGlobal("fetch", fetchSpy);
  const root = renderHome();
  await tick();
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
  expect(root.querySelector("[data-add-repository]")?.textContent).toBe("Add repository");
  expect(root.querySelector(".home-group.is-archived summary h2")?.textContent).toBe("Archived");
  expect(homeFetchUrls(fetchSpy).every((url) => url === "/api/connections" || url === "/api/repositories")).toBe(
    true,
  );
  unmount(mounted!);
  mounted = null;
  root.remove();
  host = document.createElement("div");
  document.body.appendChild(host);
  mounted = mount(AppShell, { target: host, props: { data: HOME_FIXTURE_WAITING } });
  await tick();
  expect([...host.querySelectorAll(".home-card-status")].map((el) => el.textContent)).toContain(
    "Waiting",
  );
  expect(homeFetchUrls(fetchSpy).every((url) => url === "/api/connections" || url === "/api/repositories")).toBe(
    true,
  );
  expect(homeFetchUrls(fetchSpy).some((url) => url.includes("reviews") || url.includes("catalog"))).toBe(
    false,
  );
});

test("Paste Guide posts the existing reviews API then navigates to the new review", async () => {
  const goto = vi.fn().mockResolvedValue(undefined);
  setHomeNavigate(goto);
  const fetchSpy = homeFetch((url) => {
    if (url === "/api/reviews") {
      return {
        ok: true,
        statusText: "Created",
        json: async () => ({ id: "pasted-1" }),
      };
    }
    return undefined;
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
  const reviewCalls = fetchSpy.mock.calls.filter(([url]) => url === "/api/reviews");
  expect(reviewCalls).toHaveLength(1);
  const init = reviewCalls[0][1] as RequestInit;
  expect(init.method).toBe("POST");
  expect(JSON.parse(String(init.body))).toEqual({ guide: FAKE_GUIDE });
  expect(goto).toHaveBeenCalledWith(reviewPath("pasted-1"));
});

test("host actions keep stale Home visible while the API request is in flight", async () => {
  let resolvePost: ((value: unknown) => void) | undefined;
  const fetchSpy = homeFetch((url) => {
    if (url === "/api/actions") {
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
  await tick();
  (root.querySelector("[data-queue-refresh]") as HTMLButtonElement).click();
  await tick();
  expect(root.querySelector(".home-group h2")?.textContent).toBe("Review requests");
  expect(root.querySelector(".home-card-title")?.textContent).toBe("Current work");
  expect(homeFetchUrls(fetchSpy).some((url) => url === "/api/actions")).toBe(true);
  resolvePost?.({
    ok: true,
    statusText: "Created",
    json: async () => ({ id: "refresh-1" }),
  });
  await tick();
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
  let rows = [origin];
  const fetchSpy = homeFetch((url, init) => {
    if (url === "/api/repositories" && (!init?.method || init.method === "GET")) {
      return {
        ok: true,
        statusText: "OK",
        json: async () => ({ repositories: rows }),
      };
    }
    if (url === "/api/repositories" && init?.method === "POST") {
      expect(JSON.parse(String(init.body))).toEqual({
        url: "https://github.com/octocat/Hello-World.git",
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
      "braidteam/BRAID / braid-connection-designer",
    );
  });
  expect(root.querySelector('[data-configured-repository="ado-1"]')?.textContent).toContain("origin");
  const input = root.querySelector("[data-add-repository-input]") as HTMLInputElement;
  homeUi.repositoryInput = "https://github.com/octocat/Hello-World.git";
  input.value = homeUi.repositoryInput;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  (root.querySelector("[data-add-repository]") as HTMLButtonElement).click();
  await vi.waitFor(() => {
    expect(root.querySelector('[data-configured-repository="1296269"]')?.textContent).toContain(
      "octocat / Hello-World",
    );
  });
  expect(homeFetchUrls(fetchSpy).some((url) => url === "/api/actions")).toBe(false);
  (root.querySelector('[data-remove-repository="1296269"]') as HTMLButtonElement).click();
  await vi.waitFor(() => {
    expect(root.querySelector('[data-configured-repository="1296269"]')).toBeNull();
  });
  expect(root.querySelector('[data-configured-repository="ado-1"]')).not.toBeNull();
});

test("Home shows duplicate and unsupported repository errors from the handler", async () => {
  const fetchSpy = homeFetch((url, init) => {
    if (url === "/api/repositories" && init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as { url?: string };
      if (String(body.url).includes("github.com")) {
        return {
          ok: false,
          statusText: "Conflict",
          json: async () => ({ error: "This repository is already configured" }),
        };
      }
      return {
        ok: false,
        statusText: "Bad Request",
        json: async () => ({ error: "unsupported git host" }),
      };
    }
    return undefined;
  });
  vi.stubGlobal("fetch", fetchSpy);
  const root = renderHome();
  await vi.waitFor(() => {
    expect(root.querySelector("[data-add-repository-input]")).toBeTruthy();
    expect((root.querySelector("[data-add-repository]") as HTMLButtonElement).disabled).toBe(false);
  });
  await addRepository("https://github.com/octocat/Hello-World.git");
  await vi.waitFor(() => {
    expect(root.querySelector("[data-repository-error]")?.textContent).toBe(
      "This repository is already configured",
    );
  });
  await addRepository("https://bitbucket.org/octocat/Hello-World.git");
  await vi.waitFor(() => {
    expect(root.querySelector("[data-repository-error]")?.textContent).toBe("unsupported git host");
  });
  expect(homeFetchUrls(fetchSpy).some((url) => url === "/api/actions")).toBe(false);
});

