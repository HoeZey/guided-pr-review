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

test("filesForDiff is path-sorted and one row per path", () => {
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
    ["a.py", "docs/diagram.png"],
  );
  const stub = rows[1];
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
