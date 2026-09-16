import type { DiffLayout } from "$lib/shared/domain/guide-view";
import { TAB_COOKIE, parseStoredTab, type ReviewTab } from "$lib/shared/page-data";

export { TAB_COOKIE, parseStoredTab };

export const THEME_KEY = "guided-pr-review-theme";
export const TAB_KEY = "guided-pr-review-tab";
export const DIFF_KEY = "guided-pr-review-diff";
export const GUIDE_DIFF_KEY = "guided-pr-review-guide-diff";
export const SPLIT_KEY = "guided-pr-review-split";
export const HIDE_KEY = "guided-pr-review-hide-unchanged";
export const RAILS_KEY = "guided-pr-review-rails";
export const VIEWED_PREFIX = "guided-pr-review-viewed:";

export type Theme = "light" | "dark";

export const PREF_DEFAULTS = {
  theme: "dark" as Theme,
  tab: "guide" as ReviewTab,
  diffLayout: "split" as DiffLayout,
  guideLayout: "unified" as DiffLayout,
  splitPct: 0.5,
  hideUnchanged: false,
  sidebarPx: 280,
};

export type StorageLike = Pick<Storage, "getItem" | "setItem">;

export function viewedKey(reviewId: string): string {
  return VIEWED_PREFIX + reviewId;
}

export function browserLocalStorage(): StorageLike | null {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage;
  } catch {
    return null;
  }
}

export function parseTheme(raw: string | null): Theme {
  return raw === "light" || raw === "dark" ? raw : PREF_DEFAULTS.theme;
}

export function parseTab(raw: string | null): ReviewTab {
  return parseStoredTab(raw) ?? PREF_DEFAULTS.tab;
}

export function writeTabCookie(tab: ReviewTab): void {
  if (typeof document === "undefined") return;
  document.cookie = `${TAB_COOKIE}=${tab}; Path=/; SameSite=Lax`;
}

export function parseSplitPct(raw: string | null): number {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : PREF_DEFAULTS.splitPct;
}

export function parseHideUnchanged(raw: string | null): boolean {
  return raw === "1";
}

export function parseSidebarPx(raw: string | null): number {
  try {
    const rails = JSON.parse(raw || "null") as { sidebar?: number } | null;
    if (rails?.sidebar) return rails.sidebar;
  } catch {
    /* ignore */
  }
  return PREF_DEFAULTS.sidebarPx;
}

export function readTheme(storage: StorageLike | null): Theme {
  return parseTheme(storage?.getItem(THEME_KEY) ?? null);
}

export function writePref(storage: StorageLike | null, key: string, value: string): void {
  try {
    storage?.setItem(key, value);
  } catch {
    /* private mode */
  }
}
