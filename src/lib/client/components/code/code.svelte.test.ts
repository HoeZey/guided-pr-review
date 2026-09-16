import { afterEach, expect, test, vi } from "vitest";
import { mount, tick, unmount } from "svelte";
import CodeFile from "./CodeFile.svelte";
import { CODE_VIEW_FIXTURE } from "./fixture";
import { projectHunkLines } from "./project";
import { paintLineHtml, resetSyntax, setHighlighterLoader } from "$lib/client/browser/syntax";

let mounted: ReturnType<typeof mount> | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  if (mounted) unmount(mounted);
  mounted = null;
  host?.remove();
  host = null;
  resetSyntax();
});

function echoHighlighter() {
  setHighlighterLoader(async () => ({
    codeToTokens(code: string) {
      return { tokens: [[{ content: code, color: "#111" }]] };
    },
  }));
}

function renderFile(props: {
  layout: "unified" | "split";
  hideUnchanged?: boolean;
  collapsed?: boolean;
  viewed?: boolean;
  stage?: boolean;
  ontoggle?: (path: string) => void;
  onviewed?: (path: string, viewed: boolean) => void;
}) {
  host = document.createElement("div");
  document.body.appendChild(host);
  mounted = mount(CodeFile, {
    target: host,
    props: { file: CODE_VIEW_FIXTURE, id: "f-0", theme: "dark", ...props },
  });
  return host;
}

test("one fixture file renders equivalent unified and split rows from projections", async () => {
  echoHighlighter();
  const projected = projectHunkLines(CODE_VIEW_FIXTURE.hunks![0].lines, false);
  const unified = renderFile({ layout: "unified" });
  expect(unified.querySelectorAll(".line").length).toBe(projected.unified.length);
  expect(unified.querySelector(".line.context")?.textContent).toContain("keep");
  expect(unified.querySelector(".line.removed")?.textContent).toContain("model");
  expect(unified.querySelector(".line.added")?.textContent).toContain("snapshot");
  expect(unified.querySelector(".stats")?.textContent).toContain("+2");
  expect(unified.querySelector(".stats")?.textContent).toContain("−1");
  expect(unified.querySelector(".word-del")).toBeNull();
  await vi.waitFor(() => {
    expect(unified.querySelector(".word-del")?.textContent).toBe("model");
    expect(unified.querySelector(".word-add")?.textContent).toBe("snapshot");
  });
  expect(unified.querySelectorAll(".line").length).toBe(projected.unified.length);
  unmount(mounted!);
  mounted = null;
  unified.remove();

  const split = renderFile({ layout: "split" });
  expect(split.querySelectorAll(".line.split-cell").length).toBe(projected.split.length * 2);
  expect(split.querySelector(".split-cell.left.removed")?.textContent).toContain("model");
  expect(split.querySelector(".split-cell.right.added")?.textContent).toContain("snapshot");
  expect(split.querySelector(".split-cell.left.empty")).toBeTruthy();
  await vi.waitFor(() => {
    expect(split.querySelector(".word-del")?.textContent).toBe("model");
    expect(split.querySelector(".word-add")?.textContent).toBe("snapshot");
  });
  expect(split.querySelectorAll(".line.split-cell").length).toBe(projected.split.length * 2);
});

test("Guide and Diff consume primitives through props and events", async () => {
  const ontoggle = vi.fn();
  const onviewed = vi.fn();
  const root = renderFile({ layout: "unified", ontoggle, onviewed });
  (root.querySelector(".chevron") as HTMLButtonElement).click();
  (root.querySelector('input[data-viewed-path]') as HTMLInputElement).click();
  await tick();
  expect(ontoggle).toHaveBeenCalledWith("src/maps.py");
  expect(onviewed).toHaveBeenCalledWith("src/maps.py", true);
  expect(root.querySelector("[data-toggle-path]")?.getAttribute("data-toggle-path")).toBe(
    "src/maps.py",
  );
});

test("Shiki failure falls back to escaped code", async () => {
  setHighlighterLoader(async () => {
    throw new Error("no highlighter");
  });
  const html = await paintLineHtml({
    content: "<b>x</b>",
    lang: "python",
    theme: "dark",
    lineType: "added",
  });
  expect(html).toBeNull();

  const root = renderFile({ layout: "unified" });
  await tick();
  await Promise.resolve();
  const code = [...root.querySelectorAll(".code")].find((el) =>
    el.textContent?.includes("<script>"),
  );
  expect(code?.innerHTML).toContain("&lt;script&gt;");
  expect(code?.querySelector("script")).toBeNull();
  expect(root.querySelector(".word-add")).toBeNull();
  expect(root.querySelectorAll(".line").length).toBe(5);
});
