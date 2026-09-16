import assert from "node:assert/strict";
import { test } from "node:test";
import type { CommentThread } from "../contracts/comments.ts";
import type { FileChange } from "../contracts/guide.ts";
import {
  allowsNestedReply,
  discussionPlacementLabel,
  discussionProviderLabel,
  headerThreads,
  projectComposerAnchor,
  projectDiscussionThreads,
  projectInlineThreads,
  threadsAfter,
} from "./comment-slots.ts";

const WHEN = "2026-09-16T10:00:00.000Z";

function thread(id: string, anchor: CommentThread["anchor"], extra: Partial<CommentThread> = {}): CommentThread {
  return {
    id,
    provider: "github",
    status: extra.status ?? "active",
    outdated: extra.outdated ?? false,
    anchor,
    messages: extra.messages ?? [
      {
        id: `${id}-m0`,
        author: { login: "ada" },
        body: id,
        createdAt: WHEN,
        updatedAt: WHEN,
        ownedByCurrentUser: true,
      },
    ],
  };
}

const LINES = [
  { type: "context" as const, content: "keep", oldLine: 10, newLine: 10 },
  { type: "added" as const, content: "x = 1", newLine: 11 },
  { type: "added" as const, content: "x = 2", newLine: 12 },
  { type: "added" as const, content: "x = 3", newLine: 13 },
  { type: "removed" as const, content: "gone", oldLine: 11 },
];

function file(path: string, header = "@@ -10,2 +10,4 @@"): FileChange {
  return {
    path,
    hunks: [{ header, oldStart: 10, newStart: 10, lines: LINES }],
  };
}

test("Diff places line and range threads after the last matching current-side block in unified and split", () => {
  const files = [file("src/a.ts")];
  const threads = [
    thread("line-11", { kind: "line", path: "src/a.ts", side: "current", line: 11 }),
    thread("range-12-13", {
      kind: "range",
      path: "src/a.ts",
      side: "current",
      startLine: 12,
      endLine: 13,
    }),
  ];

  const unified = projectInlineThreads(threads, files, {
    layout: "unified",
    hideUnchanged: false,
    surface: "diff",
  });
  assert.deepEqual(
    threadsAfter(unified, 0, 0, 1, "unified").map((row) => row.id),
    ["line-11"],
  );
  assert.deepEqual(
    threadsAfter(unified, 0, 0, 3, "unified").map((row) => row.id),
    ["range-12-13"],
  );
  assert.equal(threadsAfter(unified, 0, 0, 4, "unified").length, 0);

  const split = projectInlineThreads(threads, files, {
    layout: "split",
    hideUnchanged: false,
    surface: "diff",
  });
  assert.deepEqual(
    threadsAfter(split, 0, 0, 1, "right").map((row) => row.id),
    ["line-11"],
  );
  assert.deepEqual(
    threadsAfter(split, 0, 0, 3, "right").map((row) => row.id),
    ["range-12-13"],
  );
  assert.equal(threadsAfter(split, 0, 0, 1, "left").length, 0);
  assert.equal(threadsAfter(split, 0, 0, 4, "right").length, 0);
});

test("Guide places a line thread after the matching hunk, not an inner Diff line", () => {
  const files = [file("src/a.ts")];
  const threads = [thread("line-11", { kind: "line", path: "src/a.ts", side: "current", line: 11 })];
  const guide = projectInlineThreads(threads, files, {
    layout: "unified",
    hideUnchanged: false,
    surface: "guide",
  });
  assert.equal(threadsAfter(guide, 0, 0, 1, "unified").length, 0);
  assert.deepEqual(
    threadsAfter(guide, 0, 0, 3, "unified").map((row) => row.id),
    ["line-11"],
  );
});

test("file threads sit on the first matching header; stale, PR-wide, deleted-line, and missing anchors stay out", () => {
  const files = [file("src/a.ts"), file("src/a.ts"), file("src/b.ts")];
  const threads = [
    thread("file-a", { kind: "file", path: "src/a.ts" }),
    thread("pr", { kind: "pr" }),
    thread("stale", { kind: "stale", reason: "unmappable", path: "src/a.ts" }, { outdated: true }),
    thread("deleted", { kind: "stale", reason: "deleted-line", path: "src/a.ts" }),
    thread("gone-line", { kind: "line", path: "src/a.ts", side: "current", line: 99 }),
    thread("gone-file", { kind: "file", path: "src/missing.ts" }),
  ];
  const removedOnly: FileChange = {
    path: "src/gone.ts",
    hunks: [
      {
        header: "@@ -11,1 +10,0 @@",
        oldStart: 11,
        lines: [{ type: "removed", content: "gone", oldLine: 11 }],
      },
    ],
  };
  const projected = projectInlineThreads(
    [
      ...threads.slice(0, 6),
      thread("removed-only", { kind: "line", path: "src/gone.ts", side: "current", line: 11 }),
    ],
    [...files, removedOnly],
    { layout: "unified", hideUnchanged: false, surface: "diff" },
  );

  assert.deepEqual(
    headerThreads(projected, 0).map((row) => row.id),
    ["file-a"],
  );
  assert.equal(headerThreads(projected, 1).length, 0);
  assert.equal(headerThreads(projected, 2).length, 0);
  assert.equal(threadsAfter(projected, 0, 0, 1, "unified").length, 0);
  assert.equal(threadsAfter(projected, 3, 0, 0, "unified").length, 0);
  assert.equal(headerThreads(projected, 3).length, 0);
});

test("duplicate paths and hunks receive a thread once at the first matching file", () => {
  const files: FileChange[] = [
    {
      path: "src/a.ts",
      hunks: [
        { header: "@@ -10,2 +10,4 @@", oldStart: 10, newStart: 10, lines: LINES },
        { header: "@@ -10,2 +10,4 @@", oldStart: 10, newStart: 10, lines: LINES },
      ],
    },
    file("src/a.ts"),
  ];
  const threads = [thread("line-11", { kind: "line", path: "src/a.ts", side: "current", line: 11 })];
  const projected = projectInlineThreads(threads, files, {
    layout: "unified",
    hideUnchanged: false,
    surface: "diff",
  });
  const hits = [...projected.after.entries()].filter(([, rows]) => rows.some((row) => row.id === "line-11"));
  assert.equal(hits.length, 1);
  assert.equal(hits[0]?.[0].startsWith("0:"), true);
  assert.equal(threadsAfter(projected, 1, 0, 1, "unified").length, 0);
});

test("Discussion lists PR-wide and stale threads once and leaves line and file threads inline", () => {
  const files = [file("src/a.ts")];
  const threads = [
    thread("line-11", { kind: "line", path: "src/a.ts", side: "current", line: 11 }),
    thread("file-a", { kind: "file", path: "src/a.ts" }),
    thread("pr-gh", { kind: "pr" }),
    thread("pr-ado", { kind: "pr" }, { status: "closed" }),
    thread("stale-gone", { kind: "stale", reason: "unmappable", path: "src/gone.ts" }, { outdated: true }),
    thread("stale-deleted", { kind: "stale", reason: "deleted-line", path: "src/a.ts" }),
    thread("stale-old", { kind: "stale", reason: "outdated" }, { outdated: true }),
  ];
  threads[2] = { ...threads[2]!, provider: "github" };
  threads[3] = { ...threads[3]!, provider: "azure-devops" };

  const discussion = projectDiscussionThreads(threads);
  assert.deepEqual(
    discussion.map((row) => row.id),
    ["pr-gh", "pr-ado", "stale-gone", "stale-deleted", "stale-old"],
  );

  const inline = projectInlineThreads(threads, files, {
    layout: "unified",
    hideUnchanged: false,
    surface: "diff",
  });
  assert.deepEqual(
    headerThreads(inline, 0).map((row) => row.id),
    ["file-a"],
  );
  assert.deepEqual(
    threadsAfter(inline, 0, 0, 1, "unified").map((row) => row.id),
    ["line-11"],
  );
  assert.equal(
    [...inline.header.values(), ...inline.after.values()]
      .flat()
      .some((row) => row.anchor.kind === "pr" || row.anchor.kind === "stale"),
    false,
  );

  assert.equal(discussionProviderLabel("github"), "GitHub");
  assert.equal(discussionProviderLabel("azure-devops"), "Azure DevOps");
  assert.equal(discussionPlacementLabel(threads[2]!), "Pull request");
  assert.equal(discussionPlacementLabel(threads[4]!), "Unmappable · src/gone.ts");
  assert.equal(discussionPlacementLabel(threads[5]!), "Deleted line · src/a.ts");
  assert.equal(discussionPlacementLabel(threads[6]!), "Outdated");
  assert.equal(discussionPlacementLabel(threads[0]!), null);

  assert.equal(allowsNestedReply(threads[2]!), false);
  assert.equal(allowsNestedReply(threads[3]!), true);
  assert.equal(allowsNestedReply(threads[0]!), true);
});

test("composer anchors use the same Guide and Diff slots as existing threads", () => {
  const files = [file("src/a.ts")];
  const opts = { layout: "unified" as const, hideUnchanged: false, surface: "diff" as const };
  assert.deepEqual(projectComposerAnchor({ kind: "file", path: "src/a.ts" }, files, opts), {
    kind: "header",
    fileIndex: 0,
  });
  const line = projectComposerAnchor(
    { kind: "line", path: "src/a.ts", side: "current", line: 11 },
    files,
    opts,
  );
  assert.equal(line?.kind, "after");
  if (line?.kind === "after") {
    assert.deepEqual(threadsAfter(projectInlineThreads([thread("line-11", { kind: "line", path: "src/a.ts", side: "current", line: 11 })], files, opts), 0, line.hunkIndex, line.itemIndex, line.side).map((row) => row.id), [
      "line-11",
    ]);
  }
  assert.equal(projectComposerAnchor({ kind: "pr" }, files, opts), null);
});
