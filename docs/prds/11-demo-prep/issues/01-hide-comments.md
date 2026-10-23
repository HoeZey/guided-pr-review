---
status: done
blocked_by: []
blocks: []
---

# Hide comments until the rework

**Type:** Story

**Parent:** 11 Demo prep

**From PRD:** [11 Demo prep](../)

**Seam(s):** stored-tab parsing and the review shell

**What it delivers:** A hosted review shows Guide and Diff only. It does not load comments.

**Scope (in):**

- A shared flag stays off.
- The Discussion tab, comment loading status, and comment error banner stay hidden.
- Opening a hosted review does not request comments.
- A stored tab of discussion or comments falls back to the landing tab.
- Comment modules, routes, and storage stay.

**Scope (out):**

- Deleting comment code
- Changing comment create, reply, edit, or delete behavior when the flag is on

**Touches:** shared page data, review shell, shell tests, stored-tab tests

**Acceptance criteria:**

- [x] A hosted review has no Discussion tab and does not request comments.
- [x] A stored discussion or comments tab opens the landing tab.
- [x] Comment behavior tests still run with the flag on.

**Blocked by:** none

**Blocks:** none

**Parallel-eligible:** yes
