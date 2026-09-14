---
status: todo
blocked_by: []
blocks: []
---

# Persist Reviews rail per Guide, Diff, and Code Review

**Type:** Story

**From PRD:** [Review screen polish](../)

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

- [ ] Collapsing Reviews on Guide leaves Diff and Code Review as they were.
- [ ] Collapsing Reviews on Code Review leaves Guide and Diff as they were.
- [ ] Reload restores each tab's last rail state.
- [ ] Old guide/diff-only JSON still loads; missing Code Review key uses the
  Diff default (open).
- [ ] Helper tests cover parse/serialize, including the legacy string form.
  No Astro DOM assertions.

**Blocked by:** none

**Blocks:** none

**Parallel-eligible:** yes
