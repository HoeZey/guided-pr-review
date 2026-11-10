---
status: done
blocked_by: []
blocks:
  - 02-show-post-progress
  - 03-show-edit-delete-progress
  - 04-discussion-every-thread
  - 07-load-new-commits
  - 08-block-guide-behind-diff
  - 09-integrate-and-verify
---

# Turn comments back on and show loading

**Type:** Story

**From PRD:** [14 Comment rework](../)

**Seam(s):** the review shell rendered with a fake comments API

**What it delivers:** A hosted review shows Diff, Guide, and Discussion again
and lists threads on open. The reviewer can always see whether the list is
loading, loaded, or failed.

**Scope (in):**

- Remove the commentsEnabled flag. A stored discussion tab opens Discussion.
- The review tab row shows Loading comments with a spinner while a list runs.
- A failed list shows the review banner with Retry. Guide and Diff stay
  usable.
- A reload keeps the threads on screen until the new list replaces them.
- One list runs at a time per review. Focus and visibility firing together
  start one list.

**Scope (out):**

- Updating diff status (07)
- Discussion content changes (04)

**Touches:** shared page data, review shell, thread state, styles, tests

**Acceptance criteria:**

- [x] A hosted review has a Discussion tab and requests threads on open.
- [x] A stored discussion tab reopens Discussion.
- [x] Loading comments shows on the tab row until the list succeeds or fails.
- [x] A failed list shows Retry, and Retry lists again.
- [x] Threads already on screen stay during a reload.
- [x] Focus plus visibility on return starts one list, not two.
- [x] A local review with no host pull request requests no threads.

**Blocked by:** none

**Blocks:** 02, 03, 04, 07, 08, 09

**Parallel-eligible:** yes
