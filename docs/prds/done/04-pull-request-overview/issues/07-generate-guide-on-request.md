---
status: done
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

- [x] Generate guide is offered only for an unchaptered saved review.
- [x] The waiting agent chapters in place and keeps the same review id.
- [x] After success the Guide tab shows the walkthrough; Diff still lists each
  path.
- [x] A failed Generate guide reports a structured error and leaves the Diff
  openable.
- [x] Open of a different PR can still run after Generate guide completes.
- [x] Tests inject a fake chaptering adapter and never call a live LLM.

**Blocked by:** 03 Open the selected PR as Diff

**Blocks:** none

**Parallel-eligible:** no

## code-review

Reviewed base 235168a4e011e79d0639a477e1f40326c3624d56 and head
3e285a87cc6e73c4e1b010c2b7f43f69fe295566 on 15 Sep 2026.

Standards: 0 major / 1 minor / 1 nit

Spec: 0 missing / 0 partial / 0 scope-creep / 0 incorrect

### Standards

1. minor — Queue Generate guide without pull-request source

   queueAction accepts generate-guide when the review exists and unchaptered
   is set. It does not require guide.source. Home uses offersGenerateGuide,
   which also needs a repository. The Guide-tab CTA only checks unchaptered,
   activeId, and a connected agent.

   upsert_review and completeGenerateGuideAction both require source. A
   pasted or local unchaptered Diff can enqueue an action that cannot
   complete; the waiting agent then fails after claim.

   Reject at queueAction when source is missing, and reuse that predicate
   for the Guide-tab button.

   Location: src/store.ts:213

2. nit — Unused chaptering argument left on Open

   completeGenerateGuideAction takes ChapteringAdapter. completeOpenAction
   still declares unused _chaptering.

   Drop that parameter.

   Location: src/actions.ts:59

### Spec

Zero findings.
