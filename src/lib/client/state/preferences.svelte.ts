import { parseDiffLayout, type DiffLayout } from "$lib/shared/domain/guide-view";
import {
  DIFF_KEY,
  GUIDE_DIFF_KEY,
  HIDE_KEY,
  PREF_DEFAULTS,
  RAILS_KEY,
  SPLIT_KEY,
  THEME_KEY,
  type StorageLike,
  type Theme,
  browserLocalStorage,
  parseHideUnchanged,
  parseSidebarPx,
  parseSplitPct,
  parseTheme,
  writePref,
} from "../browser/preferences";

type PreferenceState = {
  theme: Theme;
  guideLayout: typeof PREF_DEFAULTS.guideLayout;
  diffLayout: typeof PREF_DEFAULTS.diffLayout;
  splitPct: number;
  hideUnchanged: boolean;
  sidebarPx: number;
  hydrated: boolean;
};

export const prefs = $state<PreferenceState>({
  theme: PREF_DEFAULTS.theme,
  guideLayout: PREF_DEFAULTS.guideLayout,
  diffLayout: PREF_DEFAULTS.diffLayout,
  splitPct: PREF_DEFAULTS.splitPct,
  hideUnchanged: PREF_DEFAULTS.hideUnchanged,
  sidebarPx: PREF_DEFAULTS.sidebarPx,
  hydrated: false,
});

export function resetPreferences(): void {
  prefs.theme = PREF_DEFAULTS.theme;
  prefs.guideLayout = PREF_DEFAULTS.guideLayout;
  prefs.diffLayout = PREF_DEFAULTS.diffLayout;
  prefs.splitPct = PREF_DEFAULTS.splitPct;
  prefs.hideUnchanged = PREF_DEFAULTS.hideUnchanged;
  prefs.sidebarPx = PREF_DEFAULTS.sidebarPx;
  prefs.hydrated = false;
}

function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = theme;
}

export function hydratePreferences(storage: StorageLike | null = browserLocalStorage()): void {
  prefs.theme = parseTheme(storage?.getItem(THEME_KEY) ?? null);
  prefs.guideLayout = parseDiffLayout(storage?.getItem(GUIDE_DIFF_KEY) ?? null, PREF_DEFAULTS.guideLayout);
  prefs.diffLayout = parseDiffLayout(storage?.getItem(DIFF_KEY) ?? null, PREF_DEFAULTS.diffLayout);
  prefs.splitPct = parseSplitPct(storage?.getItem(SPLIT_KEY) ?? null);
  prefs.hideUnchanged = parseHideUnchanged(storage?.getItem(HIDE_KEY) ?? null);
  prefs.sidebarPx = parseSidebarPx(storage?.getItem(RAILS_KEY) ?? null);
  prefs.hydrated = true;
  applyTheme(prefs.theme);
  applyChromeVars();
}

export function setTheme(theme: Theme, storage: StorageLike | null = browserLocalStorage()): void {
  prefs.theme = theme;
  applyTheme(theme);
  writePref(storage, THEME_KEY, theme);
}

export function setHideUnchanged(
  next: boolean,
  storage: StorageLike | null = browserLocalStorage(),
): void {
  prefs.hideUnchanged = next;
  writePref(storage, HIDE_KEY, next ? "1" : "0");
}

export function persistSplitPct(storage: StorageLike | null = browserLocalStorage()): void {
  writePref(storage, SPLIT_KEY, String(prefs.splitPct));
}

export function persistRails(storage: StorageLike | null = browserLocalStorage()): void {
  writePref(storage, RAILS_KEY, JSON.stringify({ sidebar: prefs.sidebarPx }));
}

export function persistDiffLayout(storage: StorageLike | null = browserLocalStorage()): void {
  writePref(storage, GUIDE_DIFF_KEY, prefs.guideLayout);
  writePref(storage, DIFF_KEY, prefs.diffLayout);
}

export function applyChromeVars(): void {
  if (typeof document === "undefined") return;
  const pct = Math.min(0.85, Math.max(0.15, prefs.splitPct));
  prefs.splitPct = pct;
  document.documentElement.style.setProperty("--split-left", `${pct}fr`);
  document.documentElement.style.setProperty("--split-right", `${1 - pct}fr`);
  document.documentElement.style.setProperty("--sidebar", `${prefs.sidebarPx}px`);
}

export function setDiffLayout(
  next: DiffLayout,
  storage: StorageLike | null = browserLocalStorage(),
): void {
  prefs.diffLayout = next;
  writePref(storage, DIFF_KEY, next);
}

export function setDiffMode(
  next: DiffLayout,
  tab: "guide" | "diff" | "review",
  storage: StorageLike | null = browserLocalStorage(),
): void {
  if (tab === "guide") {
    prefs.guideLayout = next;
    writePref(storage, GUIDE_DIFF_KEY, next);
    return;
  }
  prefs.diffLayout = next;
  writePref(storage, DIFF_KEY, next);
}
