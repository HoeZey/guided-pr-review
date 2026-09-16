import { afterEach, expect, test, vi } from "vitest";
import { mount, tick, unmount } from "svelte";
import { filesForDiff, fileTree } from "$lib/shared/domain/guide-view";
import type { ReviewPageData } from "$lib/shared/page-data";
import { resetPreferences, prefs } from "$lib/client/state/preferences.svelte";
import { resetReviewSession, session } from "$lib/client/state/review.svelte";
import { resetSyntax, setHighlighterLoader } from "$lib/client/browser/syntax";
import AppShell from "../AppShell.svelte";
import { DIFF_GUIDE } from "./fixture";
import DiffView from "./DiffView.svelte";

let mounted: ReturnType<typeof mount> | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  if (mounted) unmount(mounted);
  mounted = null;
  host?.remove();
  host = null;
  resetReviewSession();
  resetPreferences();
  resetSyntax();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function echoHighlighter() {
  setHighlighterLoader(async () => ({
    codeToTokens(code: string) {
      return { tokens: [[{ content: code, color: "#111" }]] };
    },
  }));
}

function renderDiff() {
  host = document.createElement("div");
  document.body.appendChild(host);
  mounted = mount(DiffView, { target: host, props: { guide: DIFF_GUIDE, visible: true } });
  return host;
}

const DIFF_REVIEW: ReviewPageData = {
  kind: "review",
  status: "ok",
  reviewId: "diff-review",
  title: "Diff fixture",
  guide: DIFF_GUIDE,
  outcomes: [],
  catalog: [],
  actions: [],
  agentConnected: false,
};

const PATHS = filesForDiff(DIFF_GUIDE).map((row) => row.path);

test("every Diff path renders once in compact-tree order", () => {
  const root = renderDiff();
  const files = [...root.querySelectorAll<HTMLElement>("section.file")].map((el) => el.dataset.path);
  expect(files).toEqual(PATHS);
  expect(new Set(files).size).toBe(PATHS.length);

  const treeOrder: string[] = [];
  function walk(nodes: ReturnType<typeof fileTree>) {
    for (const node of nodes) {
      if (node.kind === "dir") walk(node.children);
      else treeOrder.push(node.path);
    }
  }
  walk(fileTree(PATHS));
  expect(treeOrder).toEqual(PATHS);

  const links = [...root.querySelectorAll<HTMLElement>(".file-link.tree-file")].map(
    (el) => el.dataset.path,
  );
  expect(links).toEqual(PATHS);
  expect(root.querySelector('[data-path="docs/diagram.png"] .stub')?.textContent).toContain(
    "binary",
  );
});

test("split, unified, gaps, leftovers, replacements, and hunks match projections", async () => {
  echoHighlighter();
  const root = renderDiff();
  expect(root.querySelector(".diff.split")).toBeTruthy();
  expect(root.querySelectorAll("#diff-file-2 .hunk-header")).toHaveLength(2);
  expect(
    [...root.querySelectorAll("#diff-file-2 .hunk-header")].map((el) => el.textContent),
  ).toEqual(["@@ -1,4 +1,5 @@", "@@ -20,2 +21,2 @@"]);
  expect(root.querySelector("#diff-file-2 .split-cell.left.removed")?.textContent).toContain(
    "model",
  );
  expect(root.querySelector("#diff-file-2 .split-cell.right.added")?.textContent).toContain(
    "snapshot",
  );
  expect(root.querySelector("#diff-file-2 .split-cell.left.empty")).toBeTruthy();
  expect(root.querySelector("#diff-file-3 .split-cell.right.empty")).toBeTruthy();
  expect(root.querySelector("#diff-file-2 .stats")?.textContent).toContain("+3");
  expect(root.querySelector("#diff-file-2 .stats")?.textContent).toContain("−2");
  expect(root.querySelector("#diff-file-2 .gutter")?.textContent).toBe("1");
  await vi.waitFor(() => {
    expect(root.querySelector(".word-del")?.textContent).toBe("model");
    expect(root.querySelector(".word-add")?.textContent).toBe("snapshot");
  });

  (root.querySelector('[data-diff-mode="unified"]') as HTMLButtonElement).click();
  await tick();
  expect(prefs.diffLayout).toBe("unified");
  expect(root.querySelector(".diff.split")).toBeNull();
  expect(root.querySelector("#diff-file-2 .line.removed")?.textContent).toContain("model");
  expect(root.querySelector("#diff-file-2 .line.added")?.textContent).toContain("snapshot");
  expect(root.querySelectorAll("#diff-file-2 .hunk-header")).toHaveLength(2);

  (root.querySelector("[data-hide-unchanged]") as HTMLButtonElement).click();
  await tick();
  expect(prefs.hideUnchanged).toBe(true);
  expect(root.querySelector("#diff-file-4 .unchanged-gap")?.textContent).toContain("2 unchanged");
  expect(root.querySelector("#diff-file-4 .line.added")?.textContent).toContain("gamma");
  expect(root.querySelector("#diff-file-4")?.textContent).not.toContain("alpha");

  (root.querySelector('[data-diff-mode="split"]') as HTMLButtonElement).click();
  await tick();
  expect(root.querySelector("#diff-file-4 .unchanged-gap")).toBeTruthy();
  expect(root.querySelector(".diff.split")).toBeTruthy();
});

test("file jump, collapse, and viewed stay on the Diff component", async () => {
  let io: {
    cb: IntersectionObserverCallback;
    root: Element | Document | null;
    observe: (el: Element) => void;
  } | null = null;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe = vi.fn();
      disconnect = vi.fn();
      unobserve = vi.fn();
      constructor(cb: IntersectionObserverCallback, opts?: IntersectionObserverInit) {
        io = { cb, root: opts?.root ?? null, observe: this.observe };
      }
    },
  );

  const root = renderDiff();
  await tick();
  expect(io?.root).toBe(root.querySelector("main"));
  expect(io?.root).not.toBe(document);

  const target = root.querySelector<HTMLButtonElement>('.tree-file[data-path="pkg/src/b.ts"]');
  const section = root.querySelector("#diff-file-3") as HTMLElement;
  const scroll = vi.fn();
  section.scrollIntoView = scroll;
  target?.click();
  await tick();
  expect(session.selectedDiffPath).toBe("pkg/src/b.ts");
  expect(target?.getAttribute("aria-current")).toBe("true");
  expect(
    root.querySelector('.tree-file[data-path=".cursor/rules/personal/hook.ts"]')?.getAttribute(
      "aria-current",
    ),
  ).toBe("false");
  expect(scroll).toHaveBeenCalled();

  io?.cb(
    [
      {
        isIntersecting: true,
        boundingClientRect: { top: 12 },
        target: root.querySelector("#diff-file-4") as HTMLElement,
      } as IntersectionObserverEntry,
    ],
    io as unknown as IntersectionObserver,
  );
  await tick();
  expect(session.selectedDiffPath).toBe("pkg/util.ts");
  expect(
    root.querySelector('.tree-file[data-path="pkg/util.ts"]')?.getAttribute("aria-current"),
  ).toBe("true");

  (root.querySelector("#diff-file-4 .chevron") as HTMLButtonElement).click();
  await tick();
  expect(root.querySelector("#diff-file-4")?.getAttribute("data-collapsed")).toBe("true");
  expect(session.collapsed.has("pkg/util.ts")).toBe(true);

  (root.querySelector('#diff-file-4 input[data-viewed-path]') as HTMLInputElement).click();
  await tick();
  expect(session.viewed.has("pkg/util.ts")).toBe(true);
  expect(root.querySelector('.tree-file[data-path="pkg/util.ts"]')?.classList.contains("viewed-link")).toBe(
    true,
  );

  (root.querySelector('[data-tree-dir="pkg"]') as HTMLButtonElement).click();
  await tick();
  expect(session.collapsedDirs.has("pkg")).toBe(true);
  expect(root.querySelector('.tree-file[data-path="pkg/src/a.ts"]')).toBeNull();
});

test("tab away and back keeps Diff selection, layout, collapse, and scroll", async () => {
  host = document.createElement("div");
  document.body.appendChild(host);
  mounted = mount(AppShell, { target: host, props: { data: DIFF_REVIEW } });
  const root = host;
  await tick();
  expect(root.querySelector("#app")?.getAttribute("data-tab")).toBe("diff");

  (root.querySelector('.tree-file[data-path="pkg/src/a.ts"]') as HTMLButtonElement).click();
  (root.querySelector("#diff-file-2 .chevron") as HTMLButtonElement).click();
  (root.querySelector('[data-diff-mode="unified"]') as HTMLButtonElement).click();
  await tick();
  const main = root.querySelector("#diff-file-2")?.closest("main") as HTMLElement;
  Object.defineProperty(main, "scrollTop", { value: 42, writable: true, configurable: true });
  main.scrollTop = 42;

  (root.querySelector('[data-tab="guide"]') as HTMLButtonElement).click();
  await tick();
  expect(root.querySelector("#app")?.getAttribute("data-tab")).toBe("guide");
  expect(root.querySelector(".main-inner.is-guide")?.closest("main")?.hasAttribute("hidden")).toBe(
    false,
  );
  expect(root.querySelector("[data-tab-panel]")).toBeNull();
  expect((root.querySelector('nav[aria-label="Files"]') as HTMLElement).hidden).toBe(true);

  (root.querySelector('[data-tab="diff"]') as HTMLButtonElement).click();
  await tick();
  expect(root.querySelector("#app")?.getAttribute("data-tab")).toBe("diff");
  expect(session.selectedDiffPath).toBe("pkg/src/a.ts");
  expect(prefs.diffLayout).toBe("unified");
  expect(session.collapsed.has("pkg/src/a.ts")).toBe(true);
  expect(root.querySelector("#diff-file-2")?.getAttribute("data-collapsed")).toBe("true");
  expect(root.querySelector(".diff.split")).toBeNull();
  expect((root.querySelector("#diff-file-2")?.closest("main") as HTMLElement).scrollTop).toBe(42);
  expect((root.querySelector('nav[aria-label="Files"]') as HTMLElement).hidden).toBe(false);
});
