---
status: todo
blocked_by:
  - 01-turn-comments-on
blocks:
  - 09-integrate-and-verify
---

# Block Guide line comments while the Guide is behind the Diff

**Type:** Story

**From PRD:** [14 Comment rework](../)

**Seam(s):** the review shell rendered with a fake comments API

**What it delivers:** Guide never starts a comment on code that is older
than the Diff.

**Scope (in):**

- When the Guide head differs from the stored diff commit, Guide offers no
  line, range, or file composer.
- The Guide shows a note: the Guide is from an older commit; comment on Diff
  or generate the Guide again.
- Threads still render on Guide, and Reply, edit, and delete still work.
- Diff is unaffected.

**Scope (out):**

- Generating the Guide again from the review page
- Placing threads on Guide lines that moved

**Touches:** Guide view, Guide chapter, code view, review state, tests

**Acceptance criteria:**

- [ ] A Guide behind the diff opens no composer on line click or file
  Comment.
- [ ] The note shows on that Guide.
- [ ] Reply works on a thread shown on that Guide.
- [ ] A Guide at the diff commit opens composers as before.

**Blocked by:** 01

**Blocks:** 09

**Parallel-eligible:** no
