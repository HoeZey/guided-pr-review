import { afterEach, expect, test } from "vitest";
import { TAB_COOKIE, parseStoredTab } from "$lib/shared/page-data";
import {
  DIFF_KEY,
  GUIDE_DIFF_KEY,
  HIDE_KEY,
  PREF_DEFAULTS,
  RAILS_KEY,
  SPLIT_KEY,
  TAB_KEY,
  THEME_KEY,
  VIEWED_PREFIX,
  parseHideUnchanged,
  parseSidebarPx,
  parseSplitPct,
  parseTab,
  parseTheme,
  viewedKey,
  writeTabCookie,
} from "./preferences";
import { parseDiffLayout } from "$lib/shared/domain/guide-view";
import {
  hydratePreferences,
  persistRails,
  persistSplitPct,
  prefs,
  resetPreferences,
  setDiffMode,
  setHideUnchanged,
  setTheme,
} from "../state/preferences.svelte";

afterEach(() => {
  resetPreferences();
});

test("preference keys match the existing localStorage contract", () => {
  expect(THEME_KEY).toBe("guided-pr-review-theme");
  expect(TAB_KEY).toBe("guided-pr-review-tab");
  expect(DIFF_KEY).toBe("guided-pr-review-diff");
  expect(GUIDE_DIFF_KEY).toBe("guided-pr-review-guide-diff");
  expect(SPLIT_KEY).toBe("guided-pr-review-split");
  expect(HIDE_KEY).toBe("guided-pr-review-hide-unchanged");
  expect(RAILS_KEY).toBe("guided-pr-review-rails");
  expect(viewedKey("abc")).toBe(`${VIEWED_PREFIX}abc`);
  expect(VIEWED_PREFIX).toBe("guided-pr-review-viewed:");
});

test("SSR-safe parsers fall back to product defaults", () => {
  expect(PREF_DEFAULTS).toEqual({
    theme: "dark",
    tab: "guide",
    diffLayout: "split",
    guideLayout: "unified",
    splitPct: 0.5,
    hideUnchanged: false,
    sidebarPx: 280,
  });
  expect(parseTheme(null)).toBe("dark");
  expect(parseTheme("sepia")).toBe("dark");
  expect(parseTheme("light")).toBe("light");
  expect(parseTab(null)).toBe("guide");
  expect(parseTab("comments")).toBe("discussion");
  expect(parseTab("discussion")).toBe("discussion");
  expect(parseTab("review")).toBe("guide");
  expect(parseDiffLayout(null, PREF_DEFAULTS.diffLayout)).toBe("split");
  expect(parseDiffLayout("unified", PREF_DEFAULTS.guideLayout)).toBe("unified");
  expect(parseSplitPct(null)).toBe(0.5);
  expect(parseSplitPct("nope")).toBe(0.5);
  expect(parseSplitPct("0.25")).toBe(0.25);
  expect(parseHideUnchanged(null)).toBe(false);
  expect(parseHideUnchanged("1")).toBe(true);
  expect(parseSidebarPx(null)).toBe(280);
  expect(parseSidebarPx("{")).toBe(280);
  expect(parseSidebarPx(JSON.stringify({ sidebar: 320 }))).toBe(320);
});

test("hydratePreferences reads stored values after SSR defaults", () => {
  resetPreferences();
  expect(prefs.theme).toBe("dark");
  expect(prefs.hydrated).toBe(false);
  const data: Record<string, string> = {
    [THEME_KEY]: "light",
    [TAB_KEY]: "review",
    [DIFF_KEY]: "unified",
    [GUIDE_DIFF_KEY]: "split",
    [SPLIT_KEY]: "0.4",
    [HIDE_KEY]: "1",
    [RAILS_KEY]: JSON.stringify({ sidebar: 300 }),
  };
  hydratePreferences({
    getItem: (key) => data[key] ?? null,
    setItem: () => undefined,
  });
  expect(prefs.theme).toBe("light");
  expect(prefs.diffLayout).toBe("unified");
  expect(prefs.guideLayout).toBe("split");
  expect(prefs.splitPct).toBe(0.4);
  expect(prefs.hideUnchanged).toBe(true);
  expect(prefs.sidebarPx).toBe(300);
  expect(prefs.hydrated).toBe(true);
});

test("tab cookie name matches the existing localStorage tab key", () => {
  expect(TAB_COOKIE).toBe(TAB_KEY);
  expect(TAB_COOKIE).toBe("guided-pr-review-tab");
  expect(parseStoredTab("review")).toBe("guide");
  expect(parseStoredTab("diff")).toBe("diff");
  expect(parseStoredTab("guide")).toBe("guide");
  expect(parseStoredTab("discussion")).toBe("discussion");
  expect(parseStoredTab(null)).toBeNull();
  expect(parseStoredTab("comments")).toBe("discussion");
});

test("every named preference setter writes its existing localStorage key", () => {
  const data: Record<string, string> = {};
  const storage = {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
  };
  setTheme("light", storage);
  setHideUnchanged(true, storage);
  prefs.splitPct = 0.3;
  persistSplitPct(storage);
  prefs.sidebarPx = 360;
  persistRails(storage);
  setDiffMode("split", "guide", storage);
  setDiffMode("unified", "diff", storage);
  expect(data[THEME_KEY]).toBe("light");
  expect(data[HIDE_KEY]).toBe("1");
  expect(data[SPLIT_KEY]).toBe("0.3");
  expect(data[RAILS_KEY]).toBe(JSON.stringify({ sidebar: 360 }));
  expect(data[GUIDE_DIFF_KEY]).toBe("split");
  expect(data[DIFF_KEY]).toBe("unified");
  writeTabCookie("review");
  expect(document.cookie).toContain(`${TAB_COOKIE}=review`);
});
