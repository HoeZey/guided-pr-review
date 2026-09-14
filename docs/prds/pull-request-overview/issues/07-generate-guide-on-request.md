---
status: todo
blocked_by:
  - 03-open-selected-pr-as-diff
blocks: []
---

# Generate the reading-order guide on request

**Type:** Story

**From PRD:** [Pull request overview](../)

**Seam(s):** action claim and completion; upsert_review; injected chaptering
adapter

**What it delivers:** A reviewer who already has a Diff can request a
reading-order Guide; the waiting agent chapters in place and the Guide tab
becomes the walkthrough.

**Scope (in):**

- Queue Generate guide from the Guide tab or the Home card of an unchaptered
  review.
- Chapter the already-fetched source and target commits without checkout.
- Replace the placeholder snapshot with real chapters on the same review id.
- Leave Diff content in place aside from chapter assignment.
- Show Generating guide, success, and failure states.
- Keep the unchaptered Diff readable if chaptering fails.

**Scope (out):**

- Opening a PR that has no Diff yet
- Refresh and archive behavior
- Adding repositories
- Bare caches (covered by 06)

**Touches:** action queue, skill chaptering path, Guide tab CTA, tests

**Acceptance criteria:**

- [ ] Generate guide is offered only for an unchaptered saved review.
- [ ] The waiting agent chapters in place and keeps the same review id.
- [ ] After success the Guide tab shows the walkthrough; Diff still lists each
  path.
- [ ] A failed Generate guide reports a structured error and leaves the Diff
  openable.
- [ ] Open of a different PR can still run after Generate guide completes.
- [ ] Tests inject a fake chaptering adapter and never call a live LLM.

**Blocked by:** 03 Open the selected PR as Diff

**Blocks:** none

**Parallel-eligible:** no
