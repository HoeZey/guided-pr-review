import { afterEach, expect, test, vi } from "vitest";
import { serializeViewed } from "$lib/shared/domain/guide-view";
import { TAB_COOKIE } from "$lib/shared/page-data";
import { TAB_KEY, viewedKey } from "../browser/preferences";
import type { ReviewPageData } from "$lib/shared/page-data";
import { FAKE_GUIDE, FAKE_REVIEW_OK } from "$lib/shared/shell-fakes";
import {
  adoptLegacyTab,
  bindReview,
  nextReadingTarget,
  refreshCurrentReview,
  resetReviewSession,
  session,
  setTab,
} from "./review.svelte";

afterEach(() => {
  resetReviewSession();
  localStorage.clear();
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
  expect(document.cookie).toContain(`${TAB_COOKIE}=diff`);
});

test("bindReview uses the SSR tab when provided and otherwise the landing tab", () => {
  const storage = memoryStorage();
  bindReview("a", { unchaptered: true }, storage, "review");
  expect(session.tab).toBe("review");
  bindReview("b", { unchaptered: true }, storage);
  expect(session.tab).toBe("diff");
});

test("adoptLegacyTab takes the stored tab after hydration and seeds the cookie", () => {
  const storage = memoryStorage({ [TAB_KEY]: "diff" });
  bindReview("a", { unchaptered: false }, storage, "guide");
  expect(session.tab).toBe("guide");
  adoptLegacyTab(storage);
  expect(session.tab).toBe("diff");
  expect(storage.getItem(TAB_KEY)).toBe("diff");
  expect(document.cookie).toContain(`${TAB_COOKIE}=diff`);
});

test("refreshCurrentReview ignores a stale overlay after the review id changes", async () => {
  const pageA: ReviewPageData = { ...FAKE_REVIEW_OK, reviewId: "a", title: "A" };
  const pageB: ReviewPageData = {
    ...FAKE_REVIEW_OK,
    reviewId: "b",
    title: "B",
    guide: { ...FAKE_GUIDE, title: "B" },
  };
  bindReview("a", pageA.guide ?? {}, memoryStorage(), "guide");
  session.page = pageA;
  session.ops = [{ id: "gen-a", kind: "generate-guide", reviewId: "a", status: "pending" }];
  let releaseA: () => void = () => undefined;
  const fetchSpy = vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    if (url === "/api/reviews") {
      return new Promise((resolve) => {
        releaseA = () =>
          resolve({
            ok: true,
            statusText: "OK",
            json: async () => ({
              reviews: [],
              actions: [],
              catalog: [],
              agentConnected: false,
              activeId: "a",
              repositories: [],
            }),
          });
      });
    }
    if (url === "/api/reviews/a") {
      return Promise.resolve({
        ok: true,
        statusText: "OK",
        json: async () => ({ guide: pageA.guide, outcomes: [] }),
      });
    }
    throw new Error(`unexpected ${url}`);
  });
  vi.stubGlobal("fetch", fetchSpy);
  const pending = refreshCurrentReview(true);
  bindReview("b", pageB.guide ?? {}, memoryStorage(), "guide");
  session.page = pageB;
  releaseA();
  await pending;
  expect(session.page?.reviewId).toBe("b");
  expect(session.page?.title).toBe("B");
  vi.unstubAllGlobals();
});

test("nextReadingTarget walks Guide files, Diff files, and Code Review axes", () => {
  bindReview("a", FAKE_REVIEW_OK.guide ?? {}, memoryStorage(), "guide");
  session.page = {
    ...FAKE_REVIEW_OK,
    guide: {
      ...FAKE_GUIDE,
      chapters: [
        {
          id: "core",
          kind: "core",
          title: "Core",
          why: "Why.",
          files: [{ path: "a.ts", stub: true }, { path: "b.ts", stub: true }],
        },
      ],
    },
  };
  session.selectedChapterId = "core";
  session.selectedGuidePath = "a.ts";
  expect(nextReadingTarget(1)?.id).toBe("file-core-1");
  session.tab = "diff";
  session.selectedDiffPath = "a.ts";
  expect(nextReadingTarget(1)?.id).toBe("diff-file-1");
  session.tab = "review";
  session.selectedOutcomeSection = "outcome-standards";
  expect(nextReadingTarget(1)?.id).toBe("outcome-spec");
});
