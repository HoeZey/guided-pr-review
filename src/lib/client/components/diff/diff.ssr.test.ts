import { expect, test } from "vitest";
import { render } from "svelte/server";
import { filesForDiff } from "$lib/shared/domain/guide-view";
import { FAKE_UNCHAPTERED_REVIEW } from "$lib/shared/shell-fakes";
import type { ReviewPageData } from "$lib/shared/page-data";
import AppShell from "../AppShell.svelte";
import { DIFF_GUIDE } from "./fixture";
import DiffView from "./DiffView.svelte";

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

test("SSR Diff is readable when Diff is the landing view", () => {
  const rows = filesForDiff(DIFF_GUIDE);
  expect(rows.map((row) => row.path)).toEqual([
    ".cursor/rules/personal/hook.ts",
    "docs/diagram.png",
    "pkg/src/a.ts",
    "pkg/src/b.ts",
    "pkg/util.ts",
    "README.md",
  ]);

  const view = render(DiffView, { props: { guide: DIFF_GUIDE, visible: true } }).body;
  const page = render(AppShell, { props: { data: DIFF_REVIEW } }).body;
  const unchaptered = render(AppShell, { props: { data: FAKE_UNCHAPTERED_REVIEW } }).body;

  for (const body of [view, page]) {
    expect(body).toContain('aria-label="Files"');
    expect(body).not.toMatch(/aria-label="Files"[^>]*\bhidden\b/);
    expect(body).toContain("tree-slash");
    expect(body).toContain(".cursor");
    expect(body).toContain("hook.ts");
    expect(body).toContain("Body omitted · binary.");
    expect(body).toContain("pkg/src/a.ts");
    expect(body).toContain("@@ -1,4 +1,5 @@");
    expect(body).toContain("@@ -20,2 +21,2 @@");
    expect(body).toContain(">1</span>");
    expect(body).toContain(">3</span>");
    expect(body).toContain("maps = list_maps(model.workflow_id)");
    expect(body).toContain("&lt;script");
    expect(body).not.toContain("<script>x</script>");
    expect(body).toContain("split-cell left empty");
    expect(body).toContain("split-cell right empty");
    expect(body).toContain('id="diff-file-0"');
    expect(body).toContain('id="diff-file-5"');
    expect(body).toContain('<span class="add">');
    expect(body).toContain('<span class="del">');
    expect(body).toContain("Viewed");
    expect(body).not.toContain("word-add");
  }

  const order = [...page.matchAll(/<section class="file"[^>]*data-path="([^"]+)"/g)].map(
    (match) => match[1],
  );
  expect(order).toEqual(rows.map((row) => row.path));
  expect(new Set(order).size).toBe(order.length);

  expect(unchaptered).toContain('data-tab="diff"');
  expect(unchaptered).toContain("src/app.ts");
  expect(unchaptered).toContain("Body omitted");
});
