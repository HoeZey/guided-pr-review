import { afterEach, expect, test, vi } from "vitest";
import { mount, tick, unmount } from "svelte";
import { FAKE_REVIEW_OK } from "$lib/shared/shell-fakes";
import { prefs, resetPreferences } from "../state/preferences.svelte";
import { resetReviewSession, session } from "../state/review.svelte";
import AppShell from "../components/AppShell.svelte";
import { isEditableKeyTarget, resizeRail } from "./interaction";

let mounted: ReturnType<typeof mount> | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  if (mounted) unmount(mounted);
  mounted = null;
  host?.remove();
  host = null;
  resetReviewSession();
  resetPreferences();
  vi.unstubAllGlobals();
  localStorage.clear();
});

test("keyboard shortcuts ignore INPUT and TEXTAREA the way the current viewer does", () => {
  const input = document.createElement("input");
  const area = document.createElement("textarea");
  const button = document.createElement("button");
  expect(isEditableKeyTarget(input)).toBe(true);
  expect(isEditableKeyTarget(area)).toBe(true);
  expect(isEditableKeyTarget(button)).toBe(false);
  expect(isEditableKeyTarget(null)).toBe(false);
});

test("rail pointermove updates sidebar width and destroy removes listeners", () => {
  class FakePointer extends Event {
    clientX: number;
    pointerId: number;
    constructor(type: string, init: { clientX: number; pointerId: number }) {
      super(type, { bubbles: true });
      this.clientX = init.clientX;
      this.pointerId = init.pointerId;
    }
  }
  const app = document.createElement("div");
  app.id = "app";
  Object.defineProperty(app, "getBoundingClientRect", {
    value: () => ({ left: 10, right: 400, top: 0, bottom: 100, width: 390, height: 100 }),
  });
  const handle = document.createElement("button");
  handle.dataset.rail = "sidebar";
  app.appendChild(handle);
  document.body.appendChild(app);
  const persist = vi.fn();
  const action = resizeRail(handle, {
    persist,
    setPointerCapture: false,
  });
  handle.dispatchEvent(new FakePointer("pointerdown", { clientX: 200, pointerId: 1 }));
  handle.dispatchEvent(new FakePointer("pointermove", { clientX: 310, pointerId: 1 }));
  expect(prefs.sidebarPx).toBe(300);
  handle.dispatchEvent(new FakePointer("pointerup", { clientX: 310, pointerId: 1 }));
  expect(persist).toHaveBeenCalledTimes(1);
  action.destroy?.();
  handle.dispatchEvent(new FakePointer("pointermove", { clientX: 500, pointerId: 1 }));
  expect(prefs.sidebarPx).toBe(300);
  app.remove();
});

test("j and k move reading order unless an editable control is focused", async () => {
  host = document.createElement("div");
  document.body.appendChild(host);
  mounted = mount(AppShell, {
    target: host,
    props: {
      data: {
        ...FAKE_REVIEW_OK,
        guide: {
          ...FAKE_REVIEW_OK.guide!,
          chapters: [
            {
              id: "core",
              kind: "core",
              title: "Core",
              why: "Why.",
              files: [
                { path: "a.ts", stub: true },
                { path: "b.ts", stub: true },
              ],
            },
          ],
        },
      },
    },
  });
  await tick();
  session.selectedChapterId = "core";
  session.selectedGuidePath = "a.ts";
  const input = document.createElement("input");
  host.appendChild(input);
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "j", bubbles: true, cancelable: true }));
  expect(session.selectedGuidePath).toBe("a.ts");
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "j", bubbles: true, cancelable: true }));
  await tick();
  expect(session.selectedGuidePath).toBe("b.ts");
});
