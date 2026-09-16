import type { CatalogSnapshot, OpenActionTarget, StoredAction } from "$lib/shared/contracts/catalog";
import type { ListReviewsOutput, ReviewSummary } from "$lib/shared/contracts/persistence";
import { reviewPath } from "$lib/shared/domain/overview";
import type { HomePageData } from "$lib/shared/page-data";
import { fetchJson } from "../browser/fetch";

export type HomeListed = {
  reviews: ReviewSummary[];
  catalog: CatalogSnapshot[];
  actions: StoredAction[];
  agentConnected: boolean;
  activeId: string | null;
};

type Navigate = (path: string) => Promise<void>;

async function defaultNavigate(path: string): Promise<void> {
  const { goto } = await import("$app/navigation");
  await goto(path);
}

let navigate: Navigate = defaultNavigate;
let watchTimer: ReturnType<typeof setInterval> | null = null;

export const homeUi = $state({
  pasteOpen: false,
  pasteError: null as string | null,
  pendingActionId: null as string | null,
  listed: null as HomeListed | null,
  mutating: false,
});

export function setHomeNavigate(fn: Navigate): void {
  navigate = fn;
}

export function resetHomeUi(): void {
  homeUi.pasteOpen = false;
  homeUi.pasteError = null;
  homeUi.pendingActionId = null;
  homeUi.listed = null;
  homeUi.mutating = false;
  navigate = defaultNavigate;
  stopHomeWatch();
}

export function homeListed(data: HomePageData): HomeListed {
  return (
    homeUi.listed ?? {
      reviews: data.reviews,
      catalog: data.catalog,
      actions: data.actions,
      agentConnected: data.agentConnected,
      activeId: data.activeId,
    }
  );
}

function applyList(listed: ListReviewsOutput): void {
  homeUi.listed = {
    reviews: listed.reviews,
    catalog: listed.catalog,
    actions: listed.actions,
    agentConnected: listed.agentConnected,
    activeId: listed.activeId,
  };
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

export async function queueHomeAction(
  payload:
    | { kind: "open" | "update-diff"; target: OpenActionTarget }
    | { kind: "refresh" }
    | { kind: "generate-guide"; reviewId: string },
): Promise<void> {
  homeUi.mutating = true;
  try {
    const created = await fetchJson<{ id: string }>("/api/actions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (payload.kind === "open" || payload.kind === "update-diff") {
      homeUi.pendingActionId = created.id;
    }
    await refreshHomeList();
  } finally {
    homeUi.mutating = false;
  }
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
  homeUi.mutating = true;
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
  } finally {
    homeUi.mutating = false;
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
