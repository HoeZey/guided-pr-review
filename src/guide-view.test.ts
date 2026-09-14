import assert from "node:assert/strict";
import { test } from "node:test";
import { GuideV1 } from "./contracts.ts";
import {
  collapsedOnDiff,
  filesForDiff,
  markViewed,
  parseViewed,
  serializeViewed,
  unmarkViewed,
  wordSegments,
  pairWordDiff,
  overlaySegments,
  splitRows,
  withUnchangedGaps,
  compareDirPaths,
  fileTree,
  guideStops,
  stepGuide,
  parseDiffLayout,
  formatCopy,
} from "./guide-view.ts";

function guide(chapters: GuideV1["chapters"], omitted?: GuideV1["omitted"]): GuideV1 {
  return GuideV1.parse({
    version: 1,
    title: "T",
    base: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    head: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    chapters,
    omitted,
  });
}

function file(
  path: string,
  hunks: NonNullable<GuideV1["chapters"][0]["files"][0]["hunks"]>,
) {
  return { path, language: "python", hunks };
}

test("filesForDiff is directory-tree-sorted and one row per path", () => {
  const data = guide([
    {
      id: "core",
      kind: "core",
      title: "Core",
      why: "Behavior.",
      files: [
        file("z.py", [{ oldStart: 1, lines: [{ type: "added", content: "z", newLine: 1 }] }]),
        file("a.py", [{ oldStart: 10, lines: [{ type: "added", content: "a1", newLine: 10 }] }]),
      ],
    },
    {
      id: "tests",
      kind: "tests",
      title: "Tests",
      why: "Assert.",
      files: [
        file("a.py", [{ oldStart: 4, lines: [{ type: "added", content: "a0", newLine: 4 }] }]),
      ],
    },
  ]);
  const rows = filesForDiff(data);
  assert.deepEqual(
    rows.map((row) => row.path),
    ["a.py", "z.py"],
  );
  assert.equal(rows.length, 2);
});

test("filesForDiff orders a path hunks by oldStart", () => {
  const data = guide([
    {
      id: "core",
      kind: "core",
      title: "Core",
      why: "Behavior.",
      files: [
        file("a.py", [{ oldStart: 10, lines: [{ type: "added", content: "later", newLine: 10 }] }]),
      ],
    },
    {
      id: "tests",
      kind: "tests",
      title: "Tests",
      why: "Assert.",
      files: [
        file("a.py", [{ oldStart: 4, lines: [{ type: "added", content: "earlier", newLine: 4 }] }]),
      ],
    },
  ]);
  const [row] = filesForDiff(data);
  assert.deepEqual(
    (row.hunks || []).map((hunk) => hunk.oldStart),
    [4, 10],
  );
});

test("filesForDiff adds omitted paths as stubs", () => {
  const data = guide(
    [
      {
        id: "core",
        kind: "core",
        title: "Core",
        why: "Behavior.",
        files: [file("a.py", [{ lines: [{ type: "added", content: "a", newLine: 1 }] }])],
      },
    ],
    [{ path: "docs/diagram.png", reason: "binary" }],
  );
  const rows = filesForDiff(data);
  assert.deepEqual(
    rows.map((row) => row.path),
    ["docs/diagram.png", "a.py"],
  );
  const stub = rows[0];
  assert.equal(stub.stub, true);
  assert.equal(stub.reason, "binary");
});

test("markViewed puts a Guide-viewed path into the Diff collapsed set", () => {
  const next = markViewed(new Set<string>(), new Set(["other.py"]), "a.py");
  assert.equal(next.viewed.has("a.py"), true);
  const onDiff = collapsedOnDiff(next.viewed, next.collapsed);
  assert.equal(onDiff.has("a.py"), true);
  assert.equal(onDiff.has("other.py"), true);
  const expanded = collapsedOnDiff(next.viewed, new Set());
  assert.equal(expanded.has("a.py"), true);
  const cleared = unmarkViewed(next.viewed, next.collapsed, "a.py");
  assert.equal(cleared.viewed.has("a.py"), false);
  assert.equal(collapsedOnDiff(cleared.viewed, cleared.collapsed).has("a.py"), false);
});

test("viewed set round-trips through JSON", () => {
  const raw = serializeViewed(new Set(["b.py", "a.py"]));
  assert.equal(raw, '["a.py","b.py"]');
  assert.deepEqual([...parseViewed(raw)], ["a.py", "b.py"]);
  assert.equal(parseViewed("not-json").size, 0);
  assert.equal(parseViewed(null).size, 0);
});

test("wordSegments marks the renamed token on a worked example", () => {
  const { before, after } = wordSegments(
    "maps = list_maps(model.workflow_id)",
    "maps = list_maps(snapshot.workflow_id)",
  );
  assert.deepEqual(
    before.filter((seg) => seg.changed).map((seg) => seg.text),
    ["model"],
  );
  assert.deepEqual(
    after.filter((seg) => seg.changed).map((seg) => seg.text),
    ["snapshot"],
  );
});

test("pairWordDiff pairs a deleted line with the following added line", () => {
  const lined = pairWordDiff([
    { type: "context", content: "keep" },
    { type: "removed", content: "maps = list_maps(model.workflow_id)" },
    { type: "added", content: "maps = list_maps(snapshot.workflow_id)" },
    { type: "added", content: "extra = 1" },
  ]);
  assert.deepEqual(
    lined[1].segments?.filter((seg) => seg.changed).map((seg) => seg.text),
    ["model"],
  );
  assert.deepEqual(
    lined[2].segments?.filter((seg) => seg.changed).map((seg) => seg.text),
    ["snapshot"],
  );
  assert.equal(lined[0].segments, undefined);
  assert.equal(lined[3].segments, undefined);
});

test("overlaySegments marks changed ranges on highlighter tokens", () => {
  const painted = overlaySegments(
    [
      { content: "maps = list_maps(", color: "#111" },
      { content: "model", color: "#00f" },
      { content: ".workflow_id)", color: "#111" },
    ],
    wordSegments(
      "maps = list_maps(model.workflow_id)",
      "maps = list_maps(snapshot.workflow_id)",
    ).before,
  );
  assert.deepEqual(
    painted.filter((tok) => tok.changed).map((tok) => tok.content),
    ["model"],
  );
});

test("splitRows puts a replace on one row and leftover adds on the right", () => {
  const rows = splitRows(
    pairWordDiff([
      { type: "context", content: "keep", oldLine: 1, newLine: 1 },
      { type: "removed", content: "old", oldLine: 2 },
      { type: "added", content: "new", newLine: 2 },
      { type: "added", content: "extra", newLine: 3 },
    ]),
  );
  assert.equal(rows.length, 3);
  assert.equal(rows[0].left?.content, "keep");
  assert.equal(rows[0].right?.content, "keep");
  assert.equal(rows[1].left?.type, "removed");
  assert.equal(rows[1].right?.type, "added");
  assert.equal(rows[1].right?.content, "new");
  assert.equal(rows[2].left, null);
  assert.equal(rows[2].right?.content, "extra");
});

test("splitRows puts leftover removes on the left", () => {
  const rows = splitRows(
    pairWordDiff([
      { type: "removed", content: "gone", oldLine: 1 },
      { type: "removed", content: "also", oldLine: 2 },
      { type: "added", content: "kept", newLine: 1 },
    ]),
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0].left?.content, "gone");
  assert.equal(rows[0].right?.content, "kept");
  assert.equal(rows[1].left?.content, "also");
  assert.equal(rows[1].right, null);
});

test("withUnchangedGaps collapses a context run and keeps the add", () => {
  const out = withUnchangedGaps(
    [
      { type: "context", content: "a" },
      { type: "context", content: "b" },
      { type: "added", content: "c" },
      { type: "context", content: "d" },
    ],
    true,
    (line) => line.type === "context",
  );
  assert.equal(out.length, 3);
  assert.deepEqual(out[0], { type: "gap", count: 2 });
  assert.equal(out[1].type, "added");
  assert.deepEqual(out[2], { type: "gap", count: 1 });
});

test("compareDirPaths puts directories before files at each level", () => {
  const paths = ["README.md", "app/a.py", "app/routers/x.py", "tests/b.py"];
  assert.deepEqual(paths.slice().sort(compareDirPaths), [
    "app/routers/x.py",
    "app/a.py",
    "tests/b.py",
    "README.md",
  ]);
});

test("fileTree compact-folds single-child dirs and lists root files", () => {
  const tree = fileTree([
    ".gitignore",
    ".cursor/rules/personal/caveman.mdc",
    ".cursor/rules/personal/backticks.mdc",
    "app/a.py",
    "app/routers/x.py",
  ]);
  assert.deepEqual(tree, [
    {
      kind: "dir",
      name: ".cursor / rules / personal",
      path: ".cursor/rules/personal",
      children: [
        { kind: "file", name: "backticks.mdc", path: ".cursor/rules/personal/backticks.mdc" },
        { kind: "file", name: "caveman.mdc", path: ".cursor/rules/personal/caveman.mdc" },
      ],
    },
    {
      kind: "dir",
      name: "app",
      path: "app",
      children: [
        {
          kind: "dir",
          name: "routers",
          path: "app/routers",
          children: [{ kind: "file", name: "x.py", path: "app/routers/x.py" }],
        },
        { kind: "file", name: "a.py", path: "app/a.py" },
      ],
    },
    { kind: "file", name: ".gitignore", path: ".gitignore" },
  ]);
});

test("stepGuide walks to the next file then the next chapter", () => {
  const stops = guideStops([
    { id: "a", files: [{ path: "1.ts" }, { path: "2.ts" }] },
    { id: "b", files: [{ path: "3.ts" }] },
  ]);
  assert.deepEqual(stepGuide(stops, "a", "1.ts", 1), { chapterId: "a", path: "2.ts" });
  assert.deepEqual(stepGuide(stops, "a", "2.ts", 1), { chapterId: "b", path: "3.ts" });
  assert.deepEqual(stepGuide(stops, "b", "3.ts", 1), { chapterId: "b", path: "3.ts" });
  assert.deepEqual(stepGuide(stops, "a", "2.ts", -1), { chapterId: "a", path: "1.ts" });
});

test("parseDiffLayout keeps a saved Diff mode and falls back per tab", () => {
  assert.equal(parseDiffLayout("split", "unified"), "split");
  assert.equal(parseDiffLayout("unified", "split"), "unified");
  assert.equal(parseDiffLayout(null, "unified"), "unified");
  assert.equal(parseDiffLayout("nope", "split"), "split");
});

test("formatCopy renders paragraphs, code, and bold without raw HTML", () => {
  const html = formatCopy("Pin `SNAPSHOT`.\n\nThen **rebuild**.\nKeep <script>.");
  assert.equal(
    html,
    "<p>Pin <code>SNAPSHOT</code>.</p><p>Then <strong>rebuild</strong>.<br>Keep &lt;script&gt;.</p>",
  );
});
