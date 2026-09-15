---
status: todo
blocked_by:
  - 01-define-comment-service
blocks:
  - 05-create-and-reply
---

# Render existing threads inline in Guide and Diff

**Type:** Story

**From PRD:** [08 Inline git-host comments](../)

**Seam(s):** anchor-to-visible-slot projection; shared client thread store;
Guide/Diff thread renderer

**What it delivers:** Existing provider discussions appear once at the code
they concern in both review modes instead of one block above Diff.

**Scope (in):**

- Load one thread collection per hosted review through CommentService client.
- Project current-side line/range threads after matching unified/split line
  block in Diff and matching hunk in Guide.
- Place file-level threads under file header.
- Keep stale/unmappable and PR-wide threads out of inline slots for Discussion.
- Render ordered messages, author, time, edited/deleted state, and provider
  status.
- Preserve one shared state through Guide/Diff tab switches.
- Refresh list on review open, browser focus when thread data is at least 60
  seconds old, and manual Retry. Tab switching alone does not refetch.
- Use fake fixtures while 02/03 run in parallel.

**Scope (out):**

- Compose/reply/edit/delete
- PR-wide Discussion tab
- Pixel-perfect reuse of old viewer patches

**Touches:** shared anchor projection, client thread state, Guide/Diff
renderers, styles, tests

**Acceptance criteria:**

- [ ] Every line/range thread appears at one correct slot in Guide and Diff.
- [ ] File threads appear once below matching header.
- [ ] Tab switches do not refetch or duplicate thread DOM/state.
- [ ] Review open and stale focus refresh once; fresh focus does not; manual
  Retry reruns failed list.
- [ ] Unified and Split layouts preserve placement.
- [ ] Stale/unmappable/deleted-line threads receive no fake current line.
- [ ] Loading/failure leaves Diff and Guide readable with Retry.
- [ ] Pure projection tests cover duplicate paths/hunks and missing anchors.
- [ ] Old feature branch is consulted as behavior reference only.

**Blocked by:** 01 Define comment service

**Blocks:** 05 Create comments and replies

**Parallel-eligible:** yes, with 02 and 03
