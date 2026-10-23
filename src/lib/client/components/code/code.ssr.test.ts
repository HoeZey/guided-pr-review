import { expect, test } from "vitest";
import { render } from "svelte/server";
import CodeFile from "./CodeFile.svelte";
import DiffStats from "./DiffStats.svelte";
import { CODE_VIEW_FIXTURE } from "./fixture";
import { projectHunkLines } from "./project";

const hunk = CODE_VIEW_FIXTURE.hunks![0];
const projected = projectHunkLines(hunk.lines, false);

test("SSR fixture renders unified and split rows from existing projections", () => {
  const unified = render(CodeFile, {
    props: { file: CODE_VIEW_FIXTURE, id: "f-0", layout: "unified" },
  }).body;
  const split = render(CodeFile, {
    props: { file: CODE_VIEW_FIXTURE, id: "f-0", layout: "split" },
  }).body;

  expect(projected.unified).toHaveLength(5);
  expect(projected.split).toHaveLength(4);
  expect(unified.match(/class="line /g)?.length).toBe(projected.unified.length);
  expect(split.match(/class="line split-cell /g)?.length).toBe(projected.split.length * 2);

  for (const body of [unified, split]) {
    expect(body).toContain("keep");
    expect(body).toContain(">1</span>");
    expect(body).toContain(">3</span>");
    expect(body).toContain("maps = list_maps(model.workflow_id)");
    expect(body).toContain("&lt;script");
    expect(body).not.toContain("<script>x</script>");
    expect(body).toContain("hunk-header");
    expect(body).toContain("@@ -1,4 +1,5 @@");
    expect(body).toContain('<span class="add">+2</span>');
    expect(body).toContain('<span class="del">−1</span>');
    expect(body).toContain("Viewed");
    expect(body).not.toContain("word-add");
    expect(body).not.toContain("word-del");
  }

  expect(unified).toContain('class="line context"');
  expect(unified).toContain('class="line added"');
  expect(unified).toContain('class="line removed"');
  expect(split).toContain("split-cell left context");
  expect(split).toContain("split-cell left removed");
  expect(split).toContain("split-cell right added");
  expect(split).toContain("split-cell left empty");
  expect(split).toContain('class="split-handle"');
});

test("SSR omitted stats, collapsed, and reviewed classes match current markup", () => {
  const empty = render(DiffStats, { props: { additions: 0, deletions: 0 } }).body;
  const adds = render(DiffStats, { props: { additions: 4, deletions: 0 } }).body;
  expect(empty).not.toContain('class="stats"');
  expect(adds).toContain('<span class="add">+4</span>');
  expect(adds).not.toContain('class="del"');

  const body = render(CodeFile, {
    props: {
      file: CODE_VIEW_FIXTURE,
      id: "file-1",
      layout: "unified",
      stage: true,
      collapsed: true,
      viewed: true,
      hideUnchanged: true,
    },
  }).body;
  expect(body).toContain('class="file stage"');
  expect(body).toContain('data-collapsed="true"');
  expect(body).toContain("Reviewed");
  expect(body).toContain('class="file-title"');
  expect(body).toContain("maps.py");
  expect(body).toContain('aria-expanded="false"');
  expect(body).toContain("▸");
  expect(body).toContain("unchanged-gap");
  expect(body).toContain("··· 2 unchanged");
  expect(body).not.toContain(">keep</span>");
});

test("SSR keeps the file readable when a thread card is inlined", () => {
  const body = render(CodeFile, {
    props: {
      file: CODE_VIEW_FIXTURE,
      id: "f-0",
      layout: "unified",
      headerThreads: [
        {
          id: "file-a",
          provider: "github",
          status: "active",
          outdated: false,
          anchor: { kind: "file", path: CODE_VIEW_FIXTURE.path },
          messages: [
            {
              id: "m0",
              author: { login: "ada" },
              body: "file note",
              createdAt: "2026-09-16T10:00:00.000Z",
              updatedAt: "2026-09-16T10:00:00.000Z",
              ownedByCurrentUser: true,
            },
          ],
        },
      ],
    },
  }).body;
  expect(body).toContain("comment-thread");
  expect(body).toContain("file note");
  expect(body).toContain("maps = list_maps(model.workflow_id)");
  expect(body).toContain("keep");
  expect(body).not.toContain("data-retry-comments");
});
