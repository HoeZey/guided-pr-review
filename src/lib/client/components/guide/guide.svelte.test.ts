import { afterEach, expect, test, vi } from "vitest";
import { mount, tick, unmount } from "svelte";
import { GuideV1 } from "$lib/shared/contracts/guide";
import { guideFileKey, serializeViewed } from "$lib/shared/domain/guide-view";
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

function renderGuide(guide = GUIDE_CHAPTERED, reviewId = "rev-1") {
  bindReview(reviewId, guide);
  host = document.createElement("div");
  document.body.appendChild(host);
  mounted = mount(GuideView, {
    target: host,
    props: { guide },
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
  const chapter = session.selectedChapterId;
  const path = session.selectedGuidePath;
  guideMain.dispatchEvent(new Event("scroll"));
  await tick();
  expect(session.selectedChapterId).toBe(chapter);
  expect(session.selectedGuidePath).toBe(path);
  (host.querySelector('[data-tab="guide"]') as HTMLButtonElement).click();
  await tick();
  expect(session.tab).toBe("guide");
  expect(session.selectedChapterId).toBe("tests");
  expect(session.selectedGuidePath).toBe("tests/maps_test.py");
  expect(guideMain.scrollTop).toBe(96);
  expect(guideMain.hasAttribute("hidden")).toBe(false);
});

test("unchaptered Guide shows coding-agent copy with no Generate guide button", async () => {
  const root = renderGuide(GUIDE_UNCHAPTERED, "rev-2");
  await tick();
  expect(root.querySelector(".outcome-empty h2")?.textContent).toBe("No guide");
  expect(root.textContent).toContain(
    "Ask your coding agent to generate a reading-order guide.",
  );
  expect(root.querySelector(".outcome-empty button")).toBeNull();
  expect(root.querySelector("[data-queue-generate]")).toBeNull();
  expect(root.querySelector(".guide-section")).toBeNull();
});

test("reviewing a file keeps its header and stays on that file", async () => {
  const root = renderGuide();
  await tick();
  const main = root.querySelector("main") as HTMLElement;
  const head = root.querySelector("#file-core-0 .file-head") as HTMLElement;
  Object.defineProperty(head, "offsetParent", { configurable: true, value: null });
  const next = root.querySelector("#file-tests-0") as HTMLElement;
  let reads = 0;
  head.getBoundingClientRect = () => {
    reads += 1;
    const top = reads === 1 ? 80 : 240;
    return {
      top,
      bottom: top + 32,
      height: 32,
      width: 100,
      left: 0,
      right: 100,
      x: 0,
      y: top,
      toJSON() {},
    } as DOMRect;
  };
  const jumped = vi.fn();
  next.scrollIntoView = jumped;
  main.scrollTop = 500;
  (root.querySelector('#file-core-0 input[data-viewed-path="src/maps.py"]') as HTMLInputElement).click();

  expect(root.querySelector("#file-core-0")?.getAttribute("data-collapsed")).toBe("true");
  expect(main.scrollTop).toBe(660);
  expect(session.selectedChapterId).toBe("core");
  expect(session.selectedGuidePath).toBe("src/maps.py");
  expect(jumped).not.toHaveBeenCalled();
});

test("collapsing a file from lower in the diff jumps to its header", async () => {
  const root = renderGuide();
  await tick();
  const main = root.querySelector("main") as HTMLElement;
  const file = root.querySelector("#file-core-0") as HTMLElement;
  const head = file.querySelector(".file-head") as HTMLElement;
  Object.defineProperty(head, "offsetParent", { configurable: true, value: main });
  Object.defineProperty(head, "offsetTop", { configurable: true, value: 40 });
  const jumped = vi.fn();
  file.scrollIntoView = jumped;
  main.scrollTop = 500;
  (file.querySelector("button.chevron") as HTMLButtonElement).click();

  expect(file.getAttribute("data-collapsed")).toBe("true");
  expect(jumped).toHaveBeenCalledWith({ behavior: "auto", block: "start" });
});

test("reviewing one slice of a shared file leaves the other slice clear", async () => {
  const shared = "src/shared.py";
  const unique = "src/only.py";
  const hunk = {
    oldStart: 1,
    newStart: 1,
    lines: [{ type: "added" as const, content: "x", newLine: 1 }],
  };
  const guide = GuideV1.parse({
    version: 1,
    title: "Split",
    base: "a",
    head: "b",
    chapters: [
      {
        id: "chapter-1",
        kind: "core",
        title: "First",
        why: "One slice.",
        files: [{ path: shared, language: "python", hunks: [hunk] }],
      },
      {
        id: "chapter-2",
        kind: "core",
        title: "Second",
        why: "Other slice.",
        files: [
          { path: shared, language: "python", hunks: [hunk] },
          { path: unique, language: "python", hunks: [hunk] },
        ],
      },
    ],
  });
  const root = renderGuide(guide, "rev-split");
  await tick();
  const first = root.querySelector(
    '.guide-section[data-chapter="chapter-1"] input[data-viewed-path="src/shared.py"]',
  ) as HTMLInputElement;
  first.click();
  await tick();

  const firstStage = root.querySelector(
    '.guide-section[data-chapter="chapter-1"] .file.stage[data-path="src/shared.py"]',
  );
  const secondStage = root.querySelector(
    '.guide-section[data-chapter="chapter-2"] .file.stage[data-path="src/shared.py"]',
  );
  const uniqueStage = root.querySelector('.file.stage[data-path="src/only.py"]');
  expect(first.checked).toBe(true);
  expect(firstStage?.getAttribute("data-collapsed")).toBe("true");
  expect(
    (secondStage?.querySelector('input[data-viewed-path="src/shared.py"]') as HTMLInputElement)
      .checked,
  ).toBe(false);
  expect(secondStage?.getAttribute("data-collapsed")).toBe("false");
  expect(
    (uniqueStage?.querySelector('input[data-viewed-path="src/only.py"]') as HTMLInputElement)
      .checked,
  ).toBe(false);
  expect(uniqueStage?.getAttribute("data-collapsed")).toBe("false");
  expect(JSON.parse(localStorage.getItem(viewedKey("rev-split")) || "[]")).toEqual([
    guideFileKey(shared, "chapter-1"),
  ]);
});

test("Guide hunks follow the saved split preference", async () => {
  prefs.guideLayout = "split";
  const root = renderGuide();
  await tick();
  expect(root.querySelector(".diff.split")).toBeTruthy();
  expect(root.querySelector(".split-cell")).toBeTruthy();
});
