import { afterEach, expect, test, vi } from "vitest";
import { mount, tick, unmount } from "svelte";
import { serializeViewed } from "$lib/shared/domain/guide-view";
import { viewedKey } from "$lib/client/browser/preferences";
import { prefs, resetPreferences } from "$lib/client/state/preferences.svelte";
import { bindReview, resetReviewSession, session } from "$lib/client/state/review.svelte";
import type { ReviewPageData } from "$lib/shared/page-data";
import AppShell from "../AppShell.svelte";
import GuideView from "./GuideView.svelte";
import { GUIDE_CHAPTERED, GUIDE_UNCHAPTERED } from "./fixture";

let mounted: ReturnType<typeof mount> | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  if (mounted) unmount(mounted);
  mounted = null;
  host?.remove();
  host = null;
  resetReviewSession();
  resetPreferences();
  localStorage.clear();
  vi.unstubAllGlobals();
});

function renderGuide(
  guide = GUIDE_CHAPTERED,
  opts: { reviewId?: string; agentConnected?: boolean } = {},
) {
  const reviewId = opts.reviewId ?? "rev-1";
  bindReview(reviewId, guide);
  host = document.createElement("div");
  document.body.appendChild(host);
  mounted = mount(GuideView, {
    target: host,
    props: {
      guide,
      reviewId,
      agentConnected: opts.agentConnected ?? false,
    },
  });
  return host;
}

function chapteredPage(): ReviewPageData {
  return {
    kind: "review",
    status: "ok",
    reviewId: "rev-1",
    title: GUIDE_CHAPTERED.title,
    guide: GUIDE_CHAPTERED,
    outcomes: [],
    catalog: [],
    actions: [],
    agentConnected: false,
  };
}

test("all-viewed Guide uses persisted viewed format and collapsed reviewed files", async () => {
  localStorage.setItem(
    viewedKey("rev-1"),
    serializeViewed(new Set(["src/maps.py", "tests/maps_test.py"])),
  );
  const root = renderGuide();
  await tick();
  const files = [...root.querySelectorAll<HTMLElement>(".file.stage")];
  expect(files).toHaveLength(2);
  expect(files.every((el) => el.getAttribute("data-collapsed") === "true")).toBe(true);
  expect(
    [...root.querySelectorAll<HTMLInputElement>("input[data-viewed-path]")].every((el) => el.checked),
  ).toBe(true);
  expect(
    [...root.querySelectorAll<HTMLInputElement>("input[data-reviewed-chapter]")].every(
      (el) => el.checked,
    ),
  ).toBe(true);
  expect(root.querySelector(".file-pill.viewed-link")).toBeTruthy();
  expect(localStorage.getItem(viewedKey("rev-1"))).toBe(
    serializeViewed(new Set(["src/maps.py", "tests/maps_test.py"])),
  );

  const coreBox = root.querySelector(
    'input[data-reviewed-chapter="core"]',
  ) as HTMLInputElement;
  coreBox.click();
  await tick();
  expect(JSON.parse(localStorage.getItem(viewedKey("rev-1")) || "[]")).toEqual([
    "tests/maps_test.py",
  ]);
});

test("chapter and file nav update Guide state without document-wide listeners", async () => {
  const root = renderGuide();
  await tick();
  const pill = [...root.querySelectorAll<HTMLButtonElement>(".file-pill")].find(
    (btn) => btn.getAttribute("data-path") === "tests/maps_test.py",
  );
  expect(pill).toBeTruthy();
  pill!.click();
  await tick();
  expect(session.selectedChapterId).toBe("tests");
  expect(session.selectedGuidePath).toBe("tests/maps_test.py");
  expect(pill!.getAttribute("aria-current")).toBe("true");
  expect(
    root.querySelector('.chapter-btn[data-chapter="tests"]')?.getAttribute("aria-current"),
  ).toBe("true");

  const main = root.querySelector("main") as HTMLElement;
  const stages = [...root.querySelectorAll<HTMLElement>(".file.stage")];
  const box = (top: number, bottom: number) => ({
    top,
    bottom,
    height: bottom - top,
    width: 800,
    left: 0,
    right: 800,
    x: 0,
    y: top,
    toJSON() {},
  });
  main.getBoundingClientRect = () => box(0, 400);
  stages[0].getBoundingClientRect = () => box(0, 500);
  stages[1].getBoundingClientRect = () => box(500, 900);
  Object.defineProperty(main, "scrollTop", { value: 80, writable: true });
  Object.defineProperty(main, "clientHeight", { value: 400 });
  Object.defineProperty(main, "scrollHeight", { value: 2000 });
  main.dispatchEvent(new Event("scroll"));
  await tick();
  expect(session.selectedChapterId).toBe("core");
  expect(session.selectedGuidePath).toBe("src/maps.py");
});

test("tab away and back keeps Guide selection and scroll", async () => {
  host = document.createElement("div");
  document.body.appendChild(host);
  mounted = mount(AppShell, { target: host, props: { data: chapteredPage() } });
  await tick();
  const pill = [...host.querySelectorAll<HTMLButtonElement>(".file-pill")].find(
    (btn) => btn.getAttribute("data-path") === "tests/maps_test.py",
  );
  pill!.click();
  await tick();
  const guideMain = host.querySelector(".main-inner.is-guide")?.closest("main") as HTMLElement;
  guideMain.scrollTop = 96;
  (host.querySelector('[data-tab="diff"]') as HTMLButtonElement).click();
  await tick();
  expect(session.tab).toBe("diff");
  expect(guideMain.hasAttribute("hidden")).toBe(true);
  (host.querySelector('[data-tab="guide"]') as HTMLButtonElement).click();
  await tick();
  expect(session.tab).toBe("guide");
  expect(session.selectedChapterId).toBe("tests");
  expect(session.selectedGuidePath).toBe("tests/maps_test.py");
  expect(guideMain.scrollTop).toBe(96);
  expect(guideMain.hasAttribute("hidden")).toBe(false);
});

test("unchaptered Guide button is an affordance and does not queue an action", async () => {
  const fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
  const root = renderGuide(GUIDE_UNCHAPTERED, { agentConnected: true, reviewId: "rev-2" });
  await tick();
  const btn = root.querySelector("[data-queue-generate]") as HTMLButtonElement;
  expect(btn.textContent).toBe("Generate guide");
  expect(btn.disabled).toBe(false);
  btn.click();
  await tick();
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(root.querySelector(".guide-section")).toBeNull();
});

test("Guide hunks follow the saved split preference", async () => {
  prefs.guideLayout = "split";
  const root = renderGuide();
  await tick();
  expect(root.querySelector(".diff.split")).toBeTruthy();
  expect(root.querySelector(".split-cell")).toBeTruthy();
});
