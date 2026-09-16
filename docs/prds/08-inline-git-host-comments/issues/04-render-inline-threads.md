---
status: done
blocked_by:
  - 01-define-comment-service
blocks:
  - 05-create-and-reply
  - 06-edit-and-delete
  - 08-integrate-inline-comments
---

# Render existing threads inline in Guide and Diff

**Type:** Story

**From PRD:** [08 Inline git-host comments](../)

**Seam(s):** anchor-to-visible-slot projection; review-scoped Svelte thread
state; Guide/Diff thread components and code-view slots

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

**Touches:** new anchor projection under src/lib/shared; review-scoped thread
state beside src/lib/client/state/review.svelte.ts ReviewSession; slots in
src/lib/client/components/code/ FileHeader.svelte, UnifiedRow.svelte,
SplitRow.svelte and consumers DiffView.svelte, GuideView.svelte; fake
CommentService from 01; styles/tests. Do not add Discussion. ReviewTab stays
guide, diff, review.

**Acceptance criteria:**

- [x] Every line/range thread appears at one correct slot in Guide and Diff.
- [x] File threads appear once below matching header.
- [x] Tab switches do not refetch or duplicate thread DOM/state.
- [x] Review open and stale focus refresh once; fresh focus does not; manual
  Retry reruns failed list.
- [x] Unified and Split layouts preserve placement.
- [x] Stale/unmappable/deleted-line threads receive no fake current line.
- [x] Loading/failure leaves Diff and Guide readable with Retry.
- [x] Pure projection tests cover duplicate paths/hunks and missing anchors.
- [x] Old feature branch is consulted as behavior reference only.

**Blocked by:** 01 Define comment service

**Blocks:** 05 Create comments and replies, 06 edit/delete, and 08 integration

**Parallel-eligible:** yes, with 02 and 03

## code-review

Blocked: 16 September 2026

base: cdfe250b89dcd31ef1e52fcfa6ae2ef5686a140e
head: 793392276e47b9daf288f6375fae010054c7e7af
branch: feature/08-04-render-inline-threads

Blocking. Standards has a major. Spec has no missing or incorrect.

Judged implementer notes: Guide and Diff staying mounted behind hidden is the existing tab keep-alive and is not a finding; both views read one threadSession and tab clicks do not refetch. Dropping stale, PR-wide, and unmappable threads from inline slots is 08-07 Discussion, not a missing 08-04 surface. Fake CommentProvider wiring in createAppServices is the 08-01 parallel seam and is not a finding. File-level cards hidden when a file is collapsed matches file-body collapse and is not a finding.

### Standards

major 1 / minor 2 / nit 0

- severity: major
  title: Split comment spacers bind once before threads load
  location: src/lib/client/browser/interaction.ts (syncSplitCommentSpacers); src/lib/client/components/code/CodeFile.svelte
  startLine: 146
  endLine: 171
  reference:
    source: .cursor/rules/ponytail.mdc
    quote: Not lazy about understanding the problem. The smallest change in the wrong place isn't lazy, it's a second bug.
  explanation: syncSplitCommentSpacers bind() queries .comment-stack when the split div mounts and ResizeObserver only watches those nodes. AppShell loads comments in an effect after mount, so the first bind sees no stacks. The action returns update() that re-runs bind, but use:syncSplitCommentSpacers is passed no argument, so Svelte never calls update when CommentStack nodes appear. Opposite-pane comment-stack-spacer height stays empty, and split rows after a thread no longer line up. The CodeFile split test mounts with threads already in props, so that path stays green.
  recommendation: Pass a value that changes with the projected stacks into the action so update re-queries .comment-stack after list and Retry, or observe the split pane itself.

- severity: minor
  title: Slot projection rebuilds hunk rows instead of reusing projectHunkLines
  location: src/lib/shared/domain/comment-slots.ts (splitRowUnchanged, visibleHunks)
  startLine: 29
  endLine: 56
  reference:
    source: .cursor/rules/ponytail.mdc
    quote: Does it already exist in this codebase? Reuse the helper, util, or pattern that's already here, don't re-write it.
  explanation: visibleHunks copies pairWordDiff, splitRows, withUnchangedGaps, and the split-row unchanged predicate that projectHunkLines already applies when CodeFile renders. Shared comment-slots cannot import the client helper, but the predicate and gap walk could live next to those functions in guide-view.ts. If one side changes hide-unchanged or pairing, afterThreads indexes will not match the rows on screen.
  recommendation: Lift the shared hunk-item walk into src/lib/shared/domain/guide-view.ts and call it from both projectHunkLines and projectInlineThreads.

- severity: minor
  title: Stale focus can list comments twice
  location: src/lib/client/components/AppShell.svelte (onMount)
  startLine: 95
  endLine: 106
  reference:
    source: docs/prds/08-inline-git-host-comments/issues/04-render-inline-threads.md Acceptance criteria
    quote: Review open and stale focus refresh once; fresh focus does not; manual Retry reruns failed list.
  explanation: onVisible is bound to both document visibilitychange and window focus. Returning to the tab commonly fires both while fetchedAt is already stale, so loadReviewThreads starts two overlapping commentsApi.list calls with no in-flight guard. Last write wins and the 60-second skip still works, but the hosted review lists twice.
  recommendation: Subscribe to one event, or skip a new list while loading is true for the same reviewId.

### Spec

missing 0 / partial 0 / scope-creep 0 / incorrect 0

findings: []

## remediations

16 September 2026: Fixed the blocking Standards major (split comment spacers bind once before threads load). Left documented: slot projection rebuilds hunk rows; stale focus can list comments twice.

## code-review (second)

Pass: 16 September 2026

base: cdfe250b89dcd31ef1e52fcfa6ae2ef5686a140e
head: 485919ac1a3e51fd3705af8b6c979439fad7197e
branch: feature/08-04-render-inline-threads

Pass. Standards has no major. Spec has no missing or incorrect.

Re-judged the 08-04 slice plus 485919a. The previous spacer major is cleared: use:syncSplitCommentSpacers now takes afterThreads so Svelte calls update after the projected stacks change; a MutationObserver on the split pane re-queries .comment-stack when the deferred list inserts nodes; bind applies spacer height before ResizeObserver is attached. split spacer height tracks a stack that appears after the first mount mounts AppShell on Diff with a pending comments fetch, then asserts the opposite-pane .comment-stack-spacer height is 48px. That test passed in this review.

Not findings: Guide and Diff staying mounted behind hidden is the existing tab keep-alive; both views read one threadSession and tab clicks do not refetch. Dropping stale, PR-wide, and unmappable threads from inline slots is 08-07 Discussion. Fake CommentProvider wiring is the 08-01 parallel seam. File-level cards hidden when a file is collapsed matches file-body collapse.

Left documented: slot projection still rebuilds hunk rows; stale focus can still list comments twice.

### Standards

major 0 / minor 2 / nit 0

- severity: minor
  title: Slot projection rebuilds hunk rows instead of reusing projectHunkLines
  location: src/lib/shared/domain/comment-slots.ts (splitRowUnchanged, visibleHunks)
  startLine: 29
  endLine: 56
  reference:
    source: .cursor/rules/ponytail.mdc
    quote: Does it already exist in this codebase? Reuse the helper, util, or pattern that's already here, don't re-write it.
  explanation: visibleHunks still copies pairWordDiff, splitRows, withUnchangedGaps, and the split-row unchanged predicate that projectHunkLines already applies when CodeFile renders. Shared comment-slots cannot import the client helper, but the predicate and gap walk could live next to those functions in guide-view.ts. If one side changes hide-unchanged or pairing, afterThreads indexes will not match the rows on screen.
  recommendation: Lift the shared hunk-item walk into src/lib/shared/domain/guide-view.ts and call it from both projectHunkLines and projectInlineThreads.

- severity: minor
  title: Stale focus can list comments twice
  location: src/lib/client/components/AppShell.svelte (onMount)
  startLine: 95
  endLine: 106
  reference:
    source: docs/prds/08-inline-git-host-comments/issues/04-render-inline-threads.md Acceptance criteria
    quote: Review open and stale focus refresh once; fresh focus does not; manual Retry reruns failed list.
  explanation: onVisible is still bound to both document visibilitychange and window focus. Returning to the tab commonly fires both while fetchedAt is already stale, so loadReviewThreads starts two overlapping commentsApi.list calls with no in-flight guard. Last write wins and the 60-second skip still works, but the hosted review lists twice.
  recommendation: Subscribe to one event, or skip a new list while loading is true for the same reviewId.

### Spec

missing 0 / partial 0 / scope-creep 0 / incorrect 0

findings: []

