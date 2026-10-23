import type { CatalogSnapshot, ConfiguredRepository, OpenActionTarget, StoredAction } from "$lib/shared/contracts/catalog";
import type { ListReviewsOutput, ReviewSummary } from "$lib/shared/contracts/persistence";
import { pullRequestSyncKey } from "$lib/shared/contracts/provenance";
import { CATALOG_REFRESH_STALE_MS } from "$lib/shared/domain/catalog";
import { catalogHasNewChanges, homeDiffSyncTargets, reviewPath } from "$lib/shared/domain/overview";
import type { HomePageData } from "$lib/shared/page-data";
import { fetchJson } from "../browser/fetch";
import { resetConnectionUi } from "./connection.svelte";

export type HomeListed = {
  reviews: ReviewSummary[];
  catalog: CatalogSnapshot[];
  actions: StoredAction[];
  agentConnected: boolean;
  activeId: string | null;
  repositories: ConfiguredRepository[];
};

export type DiffOp = { kind: "open" | "update-diff"; error?: string };

export type SearchableRepositoryCandidate = {
  provider: "azure-devops" | "github";
  host: string;
  owner: string;
  name: string;
  webUrl?: string;
};

type Navigate = (path: string) => Promise<void>;

async function defaultNavigate(path: string): Promise<void> {
  const { goto } = await import("$app/navigation");
  await goto(path);
}

let navigate: Navigate = defaultNavigate;
let watchTimer: ReturnType<typeof setInterval> | null = null;
let catalogRefreshInflight: Promise<void> | null = null;
let catalogRefreshAppliedList = false;
const diffInflight = new Map<string, Promise<void>>();
let repositoryLoadsInflight = 0;
let configuredRepositoryError: string | null = null;
let searchableRepositoryError: string | null = null;

function beginRepositoryLoad(): void {
  repositoryLoadsInflight += 1;
  homeUi.repositoryBusy = true;
}

function endRepositoryLoad(): void {
  repositoryLoadsInflight = Math.max(0, repositoryLoadsInflight - 1);
  homeUi.repositoryBusy = repositoryLoadsInflight > 0;
}

function publishRepositoryError(): void {
  homeUi.repositoryError = searchableRepositoryError ?? configuredRepositoryError;
}

export const homeUi = $state({
  pasteOpen: false,
  pasteError: null as string | null,
  pendingActionId: null as string | null,
  listed: null as HomeListed | null,
  configured: null as ConfiguredRepository[] | null,
  searchable: null as SearchableRepositoryCandidate[] | null,
  repositoryError: null as string | null,
  repositoryInput: "",
  adoOrganization: "braidteam",
  adoProject: "BRAID",
  repositoryBusy: false,
  refreshing: false,
  lastCatalogRefreshAt: null as number | null,
  refreshError: null as string | null,
  hasNewChanges: false,
  diffOps: {} as Record<string, DiffOp>,
});

export function setHomeNavigate(fn: Navigate): void {
  navigate = fn;
}

export function resetHomeUi(): void {
  homeUi.pasteOpen = false;
  homeUi.pasteError = null;
  homeUi.pendingActionId = null;
  homeUi.listed = null;
  homeUi.configured = null;
  homeUi.searchable = null;
  homeUi.repositoryError = null;
  homeUi.repositoryInput = "";
  homeUi.adoOrganization = "braidteam";
  homeUi.adoProject = "BRAID";
  homeUi.repositoryBusy = false;
  homeUi.refreshing = false;
  homeUi.lastCatalogRefreshAt = null;
  homeUi.refreshError = null;
  homeUi.hasNewChanges = false;
  homeUi.diffOps = {};
  navigate = defaultNavigate;
  catalogRefreshInflight = null;
  catalogRefreshAppliedList = false;
  repositoryLoadsInflight = 0;
  configuredRepositoryError = null;
  searchableRepositoryError = null;
  diffInflight.clear();
  stopHomeWatch();
  resetConnectionUi();
}

export function leaveHome(): void {
  homeUi.pasteOpen = false;
  homeUi.pasteError = null;
  homeUi.pendingActionId = null;
  homeUi.listed = null;
  homeUi.configured = null;
  homeUi.searchable = null;
  homeUi.repositoryError = null;
  homeUi.repositoryInput = "";
  homeUi.adoOrganization = "braidteam";
  homeUi.adoProject = "BRAID";
  homeUi.repositoryBusy = false;
  homeUi.refreshing = false;
  homeUi.refreshError = null;
  homeUi.hasNewChanges = false;
  homeUi.diffOps = {};
  repositoryLoadsInflight = 0;
  configuredRepositoryError = null;
  searchableRepositoryError = null;
  diffInflight.clear();
  stopHomeWatch();
  resetConnectionUi();
}

export function homeListed(data: HomePageData): HomeListed {
  return (
    homeUi.listed ?? {
      reviews: data.reviews,
      catalog: data.catalog,
      actions: data.actions,
      agentConnected: data.agentConnected,
      activeId: data.activeId,
      repositories: homeUi.configured ?? data.repositories,
    }
  );
}

export function homeRepositories(data: HomePageData): ConfiguredRepository[] {
  return homeUi.configured ?? homeUi.listed?.repositories ?? data.repositories;
}

function applyList(listed: ListReviewsOutput): void {
  homeUi.listed = {
    reviews: listed.reviews,
    catalog: listed.catalog,
    actions: listed.actions,
    agentConnected: listed.agentConnected,
    activeId: listed.activeId,
    repositories: homeUi.configured ?? listed.repositories,
  };
}

export async function loadRepositories(): Promise<void> {
  beginRepositoryLoad();
  try {
    const listed = await fetchJson<{
      repositories: ConfiguredRepository[];
      error?: { code: string; message: string };
    }>("/api/repositories");
    homeUi.configured = listed.repositories;
    configuredRepositoryError = listed.error?.message ?? null;
    publishRepositoryError();
    if (homeUi.listed) {
      homeUi.listed = { ...homeUi.listed, repositories: listed.repositories };
    }
  } catch (err) {
    configuredRepositoryError = err instanceof Error ? err.message : String(err);
    publishRepositoryError();
  } finally {
    endRepositoryLoad();
  }
}

function searchUrl(): string {
  const params = new URLSearchParams();
  const organization = homeUi.adoOrganization.trim();
  const project = homeUi.adoProject.trim();
  if (organization) params.set("organization", organization);
  if (project) params.set("project", project);
  const query = params.toString();
  return query ? `/api/repositories/search?${query}` : "/api/repositories/search";
}

export async function loadSearchableRepositories(): Promise<void> {
  beginRepositoryLoad();
  try {
    const listed = await fetchJson<{
      repositories: SearchableRepositoryCandidate[];
      error?: { code: string; message: string };
    }>(searchUrl());
    homeUi.searchable = listed.repositories;
    searchableRepositoryError = listed.error?.message ?? null;
    publishRepositoryError();
  } catch (err) {
    homeUi.searchable = [];
    searchableRepositoryError = err instanceof Error ? err.message : String(err);
    publishRepositoryError();
  } finally {
    endRepositoryLoad();
  }
}

export function filteredSearchableRepositories(): SearchableRepositoryCandidate[] {
  const rows = homeUi.searchable ?? [];
  const needle = homeUi.repositoryInput.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((row) =>
    `${row.owner}/${row.name} ${row.webUrl ?? ""}`.toLowerCase().includes(needle),
  );
}

export async function addRepository(candidate: SearchableRepositoryCandidate): Promise<void> {
  homeUi.repositoryBusy = true;
  try {
    await fetchJson("/api/repositories", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        provider: candidate.provider,
        host: candidate.host,
        owner: candidate.owner,
        name: candidate.name,
      }),
    });
    homeUi.repositoryInput = "";
    await loadRepositories();
    await loadSearchableRepositories();
  } catch (err) {
    homeUi.repositoryError = err instanceof Error ? err.message : String(err);
    homeUi.repositoryBusy = false;
  }
}

export async function removeRepository(id: string): Promise<void> {
  homeUi.repositoryBusy = true;
  try {
    await fetchJson(`/api/repositories/${encodeURIComponent(id)}`, { method: "DELETE" });
    await loadRepositories();
  } catch (err) {
    homeUi.repositoryError = err instanceof Error ? err.message : String(err);
    homeUi.repositoryBusy = false;
  }
}

export async function refreshHomeList(): Promise<void> {
  const listed = await fetchJson<ListReviewsOutput>("/api/reviews");
  applyList(listed);
  if (!homeUi.pendingActionId) return;
  const pending = listed.actions.find((action) => action.id === homeUi.pendingActionId);
  if (pending?.status === "succeeded" && pending.reviewId) {
    homeUi.pendingActionId = null;
    await navigate(reviewPath(pending.reviewId));
    return;
  }
  if (pending?.status === "failed" || pending?.status === "succeeded") {
    homeUi.pendingActionId = null;
  }
}

export async function refreshCatalog(reason: "focus" | "manual" = "manual"): Promise<void> {
  if (
    reason === "focus" &&
    homeUi.lastCatalogRefreshAt != null &&
    Date.now() - homeUi.lastCatalogRefreshAt < CATALOG_REFRESH_STALE_MS
  ) {
    return;
  }
  if (catalogRefreshInflight) {
    await catalogRefreshInflight;
    if (reason === "manual" && !catalogRefreshAppliedList) {
      await refreshHomeList();
      catalogRefreshAppliedList = true;
      if (!homeUi.refreshError) await syncHomeDiffs();
      const listed = homeUi.listed;
      if (listed) homeUi.hasNewChanges = catalogHasNewChanges(listed.reviews, listed.catalog);
    }
    return;
  }
  const animate = reason === "manual";
  if (animate) homeUi.refreshing = true;
  catalogRefreshAppliedList = false;
  catalogRefreshInflight = (async () => {
    try {
      await fetchJson("/api/catalog", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      homeUi.refreshError = null;
      homeUi.lastCatalogRefreshAt = Date.now();
      if (reason === "manual") {
        await refreshHomeList();
        catalogRefreshAppliedList = true;
        await syncHomeDiffs();
        const listed = homeUi.listed;
        if (listed) homeUi.hasNewChanges = catalogHasNewChanges(listed.reviews, listed.catalog);
      } else {
        const listed = await fetchJson<ListReviewsOutput>("/api/reviews");
        homeUi.hasNewChanges = catalogHasNewChanges(listed.reviews, listed.catalog);
      }
    } catch (err) {
      homeUi.refreshError = err instanceof Error ? err.message : String(err);
    } finally {
      if (animate) homeUi.refreshing = false;
      catalogRefreshInflight = null;
    }
  })();
  await catalogRefreshInflight;
}

async function syncHomeDiffs(): Promise<void> {
  const listed = homeUi.listed;
  if (!listed) return;
  const targets = homeDiffSyncTargets(listed.reviews, listed.catalog);
  await Promise.all(
    targets.map(async (target) => {
      try {
        await fetchJson<{ reviewId: string }>("/api/reviews/update-diff", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ target }),
        });
      } catch {
        /* Keep successes; the next list refresh leaves the dot when any target failed. */
      }
    }),
  );
  await refreshHomeList();
}

async function runHostDiff(kind: "open" | "update-diff", target: OpenActionTarget): Promise<void> {
  const key = pullRequestSyncKey(target);
  const existing = diffInflight.get(key);
  if (existing) {
    await existing;
    return;
  }
  homeUi.diffOps = { ...homeUi.diffOps, [key]: { kind } };
  const run = (async () => {
    try {
      const result = await fetchJson<{ reviewId: string }>(
        kind === "open" ? "/api/reviews/open" : "/api/reviews/update-diff",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ target }),
        },
      );
      const next = { ...homeUi.diffOps };
      delete next[key];
      homeUi.diffOps = next;
      await refreshHomeList();
      await navigate(reviewPath(result.reviewId));
    } catch (err) {
      homeUi.diffOps = {
        ...homeUi.diffOps,
        [key]: { kind, error: err instanceof Error ? err.message : String(err) },
      };
    }
  })();
  diffInflight.set(key, run);
  try {
    await run;
  } finally {
    diffInflight.delete(key);
  }
}

export async function queueHomeAction(
  payload:
    | { kind: "open" | "update-diff"; target: OpenActionTarget }
    | { kind: "refresh" }
    | { kind: "generate-guide"; reviewId: string },
): Promise<void> {
  if (payload.kind === "refresh") {
    await refreshCatalog("manual");
    return;
  }
  if (payload.kind === "open") {
    await runHostDiff("open", payload.target);
    return;
  }
  if (payload.kind === "update-diff") {
    await runHostDiff("update-diff", payload.target);
    return;
  }
  const created = await fetchJson<{ id: string }>("/api/actions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  homeUi.pendingActionId = created.id;
  await refreshHomeList();
}

export async function pasteGuide(text: string): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    alert(`invalid JSON: ${err}`);
    return;
  }
  const body =
    parsed && typeof parsed === "object" && "guide" in parsed ? parsed : { guide: parsed };
  homeUi.pasteError = null;
  try {
    const created = await fetchJson<{ id: string }>("/api/reviews", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    homeUi.pasteOpen = false;
    await navigate(reviewPath(created.id));
  } catch (err) {
    homeUi.pasteError = err instanceof Error ? err.message : String(err);
  }
}

function hasInflight(actions: readonly StoredAction[] | undefined, pendingId: string | null): boolean {
  if (pendingId) return true;
  return Boolean(
    actions?.some((action) => action.status === "queued" || action.status === "claimed"),
  );
}

export function stopHomeWatch(): void {
  if (!watchTimer) return;
  clearInterval(watchTimer);
  watchTimer = null;
}

export function syncHomeWatch(actions: readonly StoredAction[]): void {
  if (typeof window === "undefined") return;
  if (!hasInflight(actions, homeUi.pendingActionId)) {
    stopHomeWatch();
    return;
  }
  if (watchTimer) return;
  watchTimer = setInterval(() => {
    void refreshHomeList();
  }, 2000);
}

export function formatLastSynced(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}
