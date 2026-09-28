---
status: todo
blocked_by:
  - 03-read-numbered-diff
blocks:
  - 06-rewrite-skill
---

# Chapter a saved diff by line references

**Type:** Story

**From PRD:** [10 Guide quality](../)

**Seam(s):** MCP tools/call chapter_review on the handler, read back with
get_review; the Guide tab for repeated lines with a comment

**What it delivers:** An agent sends only titles, whys, and line ranges.
The app checks that every changed line is covered once, builds the Guide
lines itself, and a hunk can be split across chapters.

**Scope (in):**

- chapter_review { id, sourceCommit, chapters: [{ title, why, refs }] }. A
  ref is { path } (whole file) or { path, from, to } over the numbers from
  03.
- Reject with no saved diff (409), and with a sourceCommit that does not
  match diff.sourceCommit case-insensitively (409, naming the current
  commit).
- Coverage: per file, the refs across all chapters cover 1..k exactly.
  Otherwise 400 with missing and duplicated (path to number ranges),
  unknownPaths, and partialStubs. Nothing is stored on a failure.
- Resolve: slice each range into hunks. Pad up to 3 unchanged lines on
  each side without crossing the original hunk edge. Recompute oldStart,
  newStart, and the @@ header from the stored line numbers, and keep the
  original hunk's section text. A stub ref resolves to stub: true with its
  counts. Refs display in the order sent; a file may appear in several
  chapters. Chapter additions and deletions are counted by the app.
- The app fills title, base, head, repo, and source from the saved review,
  sets guide.source.sourceCommit (guide.head for a local range) to
  diff.sourceCommit, clears unchaptered, sets open: true on the first
  chapter, and keeps the review id and active id. The saved diff stays.
- GuideV1: chapter kind becomes optional. summary is removed. Stored guides
  still parse.
- A line comment on Guide renders only in the first chapter that shows that
  line. If the comment line-slot change has not landed, apply the rule to
  the slot logic on HEAD.

**Scope (out):**

- open_pull_request and add_local_review (05)
- Removing add_review and upsert_review from the tool list (05)
- The skill text (06)

**Touches:** chapter_review in src/lib/server/mcp/handler.ts and the tools
contract in src/lib/shared/contracts/tools.ts; a ref resolver next to the
numbered-diff function in src/lib/shared/domain; a store write in
src/lib/server/repositories/json/store.ts; Chapter and GuideV1 in
src/lib/shared/contracts/guide.ts; projectInlineThreads in
src/lib/shared/domain/comment-slots.ts. Production path: the handler and the
store.

**Acceptance criteria:**

- [ ] One git hunk split across two chapters reads back as two hunks with
  correct oldStart, newStart, line numbers, and at most 3 padding lines
  each, inside the original hunk.
- [ ] A gap and an overlap are each rejected with the exact ranges, and
  nothing is stored.
- [ ] A stale sourceCommit is rejected and names the current commit.
- [ ] A stub accepts only a whole-file ref.
- [ ] After success the book is green, unchaptered is gone, the first
  chapter is open, and the review id and saved diff are unchanged.
- [ ] A stored guide with kind and without summary still parses, and a new
  guide has no kind.
- [ ] A comment on a padded line shows once on Guide.

**Blocked by:** 03 Read a saved diff with numbered changed lines

**Blocks:** 06 Rewrite the skill

**Parallel-eligible:** no

**Checks:** a domain test for resolve and coverage; handler.test.ts for
chapter_review through the store; guide.test.ts for the optional kind;
the comment-slots test for the repeated line.
