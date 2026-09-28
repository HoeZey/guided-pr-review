import assert from "node:assert/strict";
import { test } from "node:test";
import type { FileChange } from "../contracts/guide.ts";
import { numberDiff, printNumberedDiff } from "./numbered-diff.ts";

function file(
  path: string,
  hunks: NonNullable<FileChange["hunks"]>,
  extra: Partial<FileChange> = {},
): FileChange {
  return { path, hunks, ...extra };
}

test("numbers changed lines 1..k across two hunks; context has no number", () => {
  const files = [
    file("src/a.ts", [
      {
        header: "@@ -10,3 +10,4 @@",
        oldStart: 10,
        newStart: 10,
        lines: [
          { type: "context", content: "def foo():" },
          { type: "removed", content: "    x = 1" },
          { type: "added", content: "    x = 2" },
          { type: "context", content: "    return x" },
        ],
      },
      {
        header: "@@ -40,2 +41,3 @@",
        oldStart: 40,
        newStart: 41,
        lines: [
          { type: "context", content: "def bar():" },
          { type: "added", content: "    y = 3" },
        ],
      },
    ]),
  ];
  const numbered = numberDiff(files);
  assert.equal(numbered.length, 1);
  assert.equal(numbered[0].kind, "file");
  if (numbered[0].kind !== "file") return;
  assert.equal(numbered[0].status, "modified");
  assert.deepEqual(
    numbered[0].hunks.flatMap((hunk) =>
      hunk.lines.map((line) => ({ number: line.number, marker: line.marker, content: line.content })),
    ),
    [
      { number: undefined, marker: " ", content: "def foo():" },
      { number: 1, marker: "-", content: "    x = 1" },
      { number: 2, marker: "+", content: "    x = 2" },
      { number: undefined, marker: " ", content: "    return x" },
      { number: undefined, marker: " ", content: "def bar():" },
      { number: 3, marker: "+", content: "    y = 3" },
    ],
  );
});

test("lockfile and a file with 1001 changed lines print as stubs with counts", () => {
  const many: NonNullable<FileChange["hunks"]>[0]["lines"] = [];
  for (let i = 0; i < 600; i += 1) many.push({ type: "added", content: `a${i}` });
  for (let i = 0; i < 401; i += 1) many.push({ type: "removed", content: `d${i}` });
  const files = [
    file("package-lock.json", [
      {
        header: "@@ -1,0 +1,2 @@",
        lines: [
          { type: "added", content: "a" },
          { type: "removed", content: "b" },
          { type: "added", content: "c" },
        ],
      },
    ]),
    file("src/big.ts", [{ header: "@@ -1 +1 @@", lines: many }]),
  ];
  const numbered = numberDiff(files);
  assert.deepEqual(numbered, [
    { path: "package-lock.json", kind: "stub", additions: 2, deletions: 1 },
    { path: "src/big.ts", kind: "stub", additions: 600, deletions: 401 },
  ]);
});

test("printNumberedDiff writes header, optional intent, files, stubs, and binary", () => {
  const files = numberDiff([
    file("src/a.ts", [
      {
        header: "@@ -10,2 +10,3 @@ def foo",
        lines: [
          { type: "context", content: "def foo():" },
          { type: "removed", content: "    x = 1" },
          { type: "added", content: "    x = 2" },
        ],
      },
    ]),
    file("package-lock.json", [
      {
        header: "@@ -1 +1 @@",
        lines: [
          { type: "added", content: "a" },
          { type: "removed", content: "b" },
        ],
      },
    ]),
    { path: "logo.png", stub: true, reason: "binary" },
  ]);
  const withIntent = printNumberedDiff({
    id: "rev-1",
    sourceCommit: "abc123",
    title: "Fix thing",
    intent: {
      description: "Why we changed it.",
      commits: [
        { sha: "c1", subject: "First commit", body: "line one\nline two" },
        { sha: "c2", subject: "Second", body: "" },
      ],
      truncated: true,
    },
    files,
  });
  assert.equal(
    withIntent,
    [
      "id: rev-1",
      "sourceCommit: abc123",
      "title: Fix thing",
      "",
      "Why we changed it.",
      "",
      "First commit",
      "  line one",
      "  line two",
      "Second",
      "",
      "[truncated]",
      "",
      "== src/a.ts (modified)",
      "@@ -10,2 +10,3 @@ def foo",
      "  def foo():",
      "1 -    x = 1",
      "2 +    x = 2",
      "",
      "== package-lock.json (stub +1 -1)",
      "",
      "== logo.png (binary)",
    ].join("\n"),
  );

  const withoutIntent = printNumberedDiff({
    id: "rev-1",
    sourceCommit: "abc123",
    title: "Fix thing",
    files,
  });
  assert.equal(withoutIntent.includes("Why we changed it."), false);
  assert.equal(withoutIntent.includes("[truncated]"), false);
  assert.ok(withoutIntent.startsWith("id: rev-1\nsourceCommit: abc123\ntitle: Fix thing\n\n== src/a.ts"));
});
