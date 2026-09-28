import assert from "node:assert/strict";
import { test } from "node:test";
import type { FileChange } from "../contracts/guide.ts";
import {
  chapterCoverageError,
  resolveChapterRefs,
  type ChapterRefInput,
} from "./chapter-refs.ts";

function file(
  path: string,
  hunks: NonNullable<FileChange["hunks"]>,
  extra: Partial<FileChange> = {},
): FileChange {
  return { path, hunks, ...extra };
}

/** One hunk: 5 context, change pair, 5 context — numbers 1 (removed) and 2 (added). */
const PADDED_HUNK: NonNullable<FileChange["hunks"]>[0] = {
  header: "@@ -10,7 +10,7 @@ def foo",
  oldStart: 10,
  newStart: 10,
  lines: [
    { type: "context", content: "c0", oldLine: 10, newLine: 10 },
    { type: "context", content: "c1", oldLine: 11, newLine: 11 },
    { type: "context", content: "c2", oldLine: 12, newLine: 12 },
    { type: "context", content: "c3", oldLine: 13, newLine: 13 },
    { type: "context", content: "c4", oldLine: 14, newLine: 14 },
    { type: "removed", content: "old", oldLine: 15 },
    { type: "added", content: "new", newLine: 15 },
    { type: "context", content: "d0", oldLine: 16, newLine: 16 },
    { type: "context", content: "d1", oldLine: 17, newLine: 17 },
    { type: "context", content: "d2", oldLine: 18, newLine: 18 },
    { type: "context", content: "d3", oldLine: 19, newLine: 19 },
    { type: "context", content: "d4", oldLine: 20, newLine: 20 },
  ],
};

const TWO_HUNK_FILE = file("src/a.ts", [
  {
    header: "@@ -10,3 +10,4 @@ def foo",
    oldStart: 10,
    newStart: 10,
    lines: [
      { type: "context", content: "def foo():", oldLine: 10, newLine: 10 },
      { type: "removed", content: "    x = 1", oldLine: 11 },
      { type: "added", content: "    x = 2", newLine: 11 },
      { type: "context", content: "    return x", oldLine: 12, newLine: 12 },
    ],
  },
  {
    header: "@@ -40,2 +41,3 @@ def bar",
    oldStart: 40,
    newStart: 41,
    lines: [
      { type: "context", content: "def bar():", oldLine: 40, newLine: 41 },
      { type: "added", content: "    y = 3", newLine: 42 },
      { type: "context", content: "    return y", oldLine: 41, newLine: 43 },
    ],
  },
]);

test("splits one hunk across two chapters with padding capped at 3 and recomputed headers", () => {
  const files = [file("src/a.ts", [PADDED_HUNK])];
  const chapters: ChapterRefInput[] = [
    { title: "First", why: "Why one.", refs: [{ path: "src/a.ts", from: 1, to: 1 }] },
    { title: "Second", why: "Why two.", refs: [{ path: "src/a.ts", from: 2, to: 2 }] },
  ];
  const resolved = resolveChapterRefs(files, chapters);
  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;

  assert.equal(resolved.chapters.length, 2);
  const h0 = resolved.chapters[0].files[0].hunks![0];
  const h1 = resolved.chapters[1].files[0].hunks![0];

  assert.equal(h0.oldStart, 12);
  assert.equal(h0.newStart, 12);
  assert.equal(h0.header, "@@ -12,4 +12,3 @@ def foo");
  assert.deepEqual(
    h0.lines.map((line) => ({ type: line.type, content: line.content, oldLine: line.oldLine, newLine: line.newLine })),
    [
      { type: "context", content: "c2", oldLine: 12, newLine: 12 },
      { type: "context", content: "c3", oldLine: 13, newLine: 13 },
      { type: "context", content: "c4", oldLine: 14, newLine: 14 },
      { type: "removed", content: "old", oldLine: 15, newLine: undefined },
    ],
  );

  assert.equal(h1.oldStart, 16);
  assert.equal(h1.newStart, 15);
  assert.equal(h1.header, "@@ -16,3 +15,4 @@ def foo");
  assert.deepEqual(
    h1.lines.map((line) => ({ type: line.type, content: line.content, oldLine: line.oldLine, newLine: line.newLine })),
    [
      { type: "added", content: "new", oldLine: undefined, newLine: 15 },
      { type: "context", content: "d0", oldLine: 16, newLine: 16 },
      { type: "context", content: "d1", oldLine: 17, newLine: 17 },
      { type: "context", content: "d2", oldLine: 18, newLine: 18 },
    ],
  );

  assert.equal(resolved.chapters[0].additions, 0);
  assert.equal(resolved.chapters[0].deletions, 1);
  assert.equal(resolved.chapters[1].additions, 1);
  assert.equal(resolved.chapters[1].deletions, 0);
  assert.equal(resolved.chapters[0].open, true);
  assert.equal(resolved.chapters[1].open, undefined);
});

test("gap and overlap each report exact ranges; unknown path and partial stub too", () => {
  const lock: FileChange = {
    path: "package-lock.json",
    stub: true,
    additions: 2,
    deletions: 1,
    hunks: [
      {
        header: "@@ -1 +1 @@",
        lines: [
          { type: "added", content: "a", newLine: 1 },
          { type: "removed", content: "b", oldLine: 1 },
        ],
      },
    ],
  };
  const files = [TWO_HUNK_FILE, lock];

  const gap = chapterCoverageError(files, [
    { title: "A", why: "w", refs: [{ path: "src/a.ts", from: 1, to: 2 }] },
  ]);
  assert.ok(gap);
  assert.deepEqual(gap.missing, {
    "src/a.ts": [[3, 3]],
    "package-lock.json": [[1, 1]],
  });
  assert.deepEqual(gap.duplicated, {});
  assert.deepEqual(gap.unknownPaths, []);
  assert.deepEqual(gap.partialStubs, []);

  const overlap = chapterCoverageError(files, [
    {
      title: "A",
      why: "w",
      refs: [
        { path: "src/a.ts", from: 1, to: 2 },
        { path: "src/a.ts", from: 2, to: 3 },
        { path: "package-lock.json" },
      ],
    },
  ]);
  assert.ok(overlap);
  assert.deepEqual(overlap.duplicated, { "src/a.ts": [[2, 2]] });
  assert.deepEqual(overlap.missing, {});

  const bad = chapterCoverageError(files, [
    {
      title: "A",
      why: "w",
      refs: [
        { path: "src/a.ts", from: 1, to: 3 },
        { path: "nope.ts", from: 1, to: 1 },
        { path: "package-lock.json", from: 1, to: 1 },
      ],
    },
  ]);
  assert.ok(bad);
  assert.deepEqual(bad.unknownPaths, ["nope.ts"]);
  assert.deepEqual(bad.partialStubs, ["package-lock.json"]);
});

test("whole-file stub resolves; ranged stub is partialStub only", () => {
  const lock: FileChange = {
    path: "package-lock.json",
    hunks: [
      {
        header: "@@ -1 +1 @@",
        lines: [
          { type: "added", content: "a" },
          { type: "removed", content: "b" },
        ],
      },
    ],
  };
  const files = [file("src/a.ts", [PADDED_HUNK]), lock];
  const ok = resolveChapterRefs(files, [
    {
      title: "All",
      why: "Done.",
      refs: [{ path: "src/a.ts" }, { path: "package-lock.json" }],
    },
  ]);
  assert.equal(ok.ok, true);
  if (!ok.ok) return;
  assert.equal(ok.chapters[0].files.length, 2);
  assert.deepEqual(ok.chapters[0].files[1], {
    path: "package-lock.json",
    stub: true,
    additions: 1,
    deletions: 1,
  });

  const err = chapterCoverageError(files, [
    {
      title: "Bad",
      why: "x",
      refs: [{ path: "src/a.ts" }, { path: "package-lock.json", from: 1, to: 1 }],
    },
  ]);
  assert.ok(err);
  assert.deepEqual(err.partialStubs, ["package-lock.json"]);
});

test("refs keep send order across files; binary needs no ref", () => {
  const files = [
    TWO_HUNK_FILE,
    { path: "logo.png", stub: true, reason: "binary" } satisfies FileChange,
    file("src/b.ts", [
      {
        header: "@@ -1,1 +1,2 @@",
        oldStart: 1,
        newStart: 1,
        lines: [
          { type: "context", content: "a", oldLine: 1, newLine: 1 },
          { type: "added", content: "b", newLine: 2 },
        ],
      },
    ]),
  ];
  const resolved = resolveChapterRefs(files, [
    {
      title: "Mix",
      why: "Order.",
      refs: [
        { path: "src/b.ts", from: 1, to: 1 },
        { path: "src/a.ts", from: 1, to: 3 },
      ],
    },
  ]);
  assert.equal(resolved.ok, true);
  if (!resolved.ok) return;
  assert.deepEqual(
    resolved.chapters[0].files.map((row) => row.path),
    ["src/b.ts", "src/a.ts"],
  );
});
