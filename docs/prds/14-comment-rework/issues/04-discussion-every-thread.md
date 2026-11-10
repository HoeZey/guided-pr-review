---
status: todo
blocked_by:
  - 01-turn-comments-on
blocks:
  - 09-integrate-and-verify
---

# List every thread in Discussion with a jump to Diff

**Type:** Story

**From PRD:** [14 Comment rework](../)

**Seam(s):** the review shell rendered with a fake comments API

**What it delivers:** Discussion holds the whole conversation. A code
thread's location opens Diff at that thread.

**Scope (in):**

- Discussion lists every thread, PR-wide and code, oldest first, with the
  PR-wide composer at the bottom.
- The Discussion tab count is every thread.
- A line, range, or file thread shows its path and line in the header as a
  link. The link selects Diff, expands the file when collapsed, and scrolls
  to the thread.
- PR-wide and outdated threads have no link.
- Discussion starts PR-wide comments only. Reply works there.

**Scope (out):**

- A separate View in Diff control
- Old path and line text on outdated threads (06)

**Touches:** Discussion view, comment stack, comment slots projection, review
state, styles, tests

**Acceptance criteria:**

- [ ] Discussion shows line, range, file, PR-wide, and outdated threads,
  oldest first.
- [ ] The tab count equals the number of threads.
- [ ] Clicking a code thread's location selects Diff and scrolls to that
  thread, expanding a collapsed file.
- [ ] PR-wide and outdated threads render no location link.
- [ ] The Discussion composer creates a PR-wide thread only.

**Blocked by:** 01

**Blocks:** 09

**Parallel-eligible:** no
