---
status: cancelled
blocked_by: []
blocks: []
---

# Persist Reviews rail per Guide, Diff, and Code Review

**Type:** Story

**From PRD:** [Review screen polish](../)

**Status:** cancelled. The signed follow-up removes the saved-PR Reviews
column from the review screen. Home (brand or compact back) is the
switcher. Do not persist that rail per tab.

The original scope is kept below only as history.

**Seam(s):** parseReviewsRails and serializeReviewsRails, extended so each
main tab has its own open/collapsed rail. Existing Guide collapsed / Diff
open defaults stay. Legacy JSON without a Code Review key must not throw
away Guide or Diff.

**What it delivers:** Opening or collapsing the Reviews rail on Guide, Diff,
or Code Review is remembered for that tab only, including across reload.

**Scope (in):**

- Store open vs collapsed independently for Guide, Diff, and Code Review.
- Keep today's defaults: Guide collapsed, Diff open. Code Review defaults
  to open (same as Diff) unless a saved Code Review value exists.
- Load old localStorage (legacy string or guide/diff JSON) without dropping
  Guide or Diff.
- [ still toggles the active tab's rail.

**Scope (out):**

- Home (no Reviews rail)
- Persisting rail pixel width per tab (width stays global)
- Files-rail collapse
- Overview grouping chrome

**Touches:** rail preference helper, UI, tests

**Acceptance criteria:**

- [ ] Cancelled — do not implement.

**Blocked by:** none

**Blocks:** none

**Parallel-eligible:** n/a
