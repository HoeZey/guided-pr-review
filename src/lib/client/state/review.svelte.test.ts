import { afterEach, expect, test } from "vitest";
import { serializeViewed } from "$lib/shared/domain/guide-view";
import { TAB_KEY, viewedKey } from "../browser/preferences";
import {
  bindReview,
  resetReviewSession,
  session,
  setTab,
} from "./review.svelte";

afterEach(() => {
  resetReviewSession();
});

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const data = { ...initial };
  return {
    get length() {
      return Object.keys(data).length;
    },
    clear() {
      for (const key of Object.keys(data)) delete data[key];
    },
    getItem(key: string) {
      return data[key] ?? null;
    },
    key() {
      return null;
    },
    removeItem(key: string) {
      delete data[key];
    },
    setItem(key: string, value: string) {
      data[key] = value;
    },
  };
}

test("bindReview owns viewed, tab, and selection reset when the review id changes", () => {
  const storage = memoryStorage({
    [viewedKey("a")]: serializeViewed(new Set(["old.ts"])),
    [viewedKey("b")]: serializeViewed(new Set(["new.ts"])),
  });
  bindReview("a", { unchaptered: false }, storage);
  session.selectedChapterId = "core";
  session.selectedGuidePath = "old.ts";
  session.selectedDiffPath = "old.ts";
  session.selectedOutcomeId = "run-1";
  session.ops = [{ id: "op-a", kind: "generate-guide", reviewId: "a", status: "pending" }];
  setTab("review", storage);
  expect(session.tab).toBe("review");
  expect(session.viewed.has("old.ts")).toBe(true);

  bindReview("a", { unchaptered: true }, storage);
  expect(session.tab).toBe("review");
  expect(session.selectedChapterId).toBe("core");

  bindReview("b", { unchaptered: true }, storage);
  expect(session.reviewId).toBe("b");
  expect(session.tab).toBe("diff");
  expect([...session.viewed]).toEqual(["new.ts"]);
  expect([...session.collapsed]).toEqual(["new.ts"]);
  expect(session.selectedChapterId).toBeNull();
  expect(session.selectedGuidePath).toBeNull();
  expect(session.selectedDiffPath).toBeNull();
  expect(session.selectedOutcomeId).toBeNull();
  expect(session.ops).toEqual([]);
  expect(storage.getItem(TAB_KEY)).toBe("review");
});

test("setTab persists the selected tab without touching the review id", () => {
  const storage = memoryStorage();
  bindReview("a", { unchaptered: false }, storage);
  setTab("diff", storage);
  expect(session.tab).toBe("diff");
  expect(session.reviewId).toBe("a");
  expect(storage.getItem(TAB_KEY)).toBe("diff");
});
