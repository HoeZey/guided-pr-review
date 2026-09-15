---
status: done
blocked_by:
  - 01-show-latest-outcome
blocks: []
---

# Browse prior review runs and spot stale findings

**Type:** Story

**From PRD:** [Code-review outcomes](../)

**Seam(s):** publish_review_outcome; selectReviewOutcome

**What it delivers:** A reviewer can inspect every saved code-review run and
cannot mistake findings from an older commit for current findings.

**Scope (in):**

- Keep every published outcome as an immutable run, including repeat runs at
  one head.
- Select the newest exact base/head run by default.
- Fall back to the newest prior run when no exact match exists.
- Show a prominent outdated warning for that fallback.
- List all runs by date and short head SHA in a history selector.
- Remove outcome history when its parent review is removed.

**Scope (out):**

- Comparing two runs or showing finding deltas
- Importing old chat-only reviews
- Retention limits or SQLite
- Sharing history between users or machines

**Touches:** store, outcome-selection helper, history UI, tests

**Acceptance criteria:**

- [x] Publishing another run never overwrites an older run.
- [x] The newest exact base/head run opens without a warning.
- [x] If the guide has moved, the newest old run stays visible behind a
  prominent outdated warning.
- [x] The history selector lists every run by date and short head SHA and can
  open any run.
- [x] Repeated runs at the same head remain separate entries.
- [x] Removing a review removes all of its outcome history.
- [x] Empty history returns the no-outcome state.

**Blocked by:** 01 Show the latest code-review outcome beside Guide and Diff

**Blocks:** none

**Parallel-eligible:** no

## code-review

Reviewed 5823a1fe5bfb4da814add6111613bb56496f8df0...c44dfb035e4fa2593d7bf070e217aeb8b2e03f67 on 15 Sep 2026.

Standards: 1 finding (0 major, 1 minor, 0 nit)
Spec: 0 findings (0 missing, 0 partial, 0 scope-creep, 0 incorrect)

### Standards

minor — History labels skip the existing UTC date helper

outcomeRunLabel builds the run timestamp by slicing addedAt. The same module already has formatLastSynced, which parses the ISO string, keeps the original text when Date is invalid, and returns a UTC minute string.

The new slice does none of that. StoredOutcome.addedAt is only a non-empty string, so a bad row in the local store becomes a garbage option label. The ponytail: comment names Intl.DateTimeFormat as the upgrade and misses the helper that is already UTC, not locale.

Recommendation: reuse formatLastSynced(entry.addedAt) and append shortHead.

Location: src/viewer.ts:632

Reference: ponytail.mdc — Does it already exist in this codebase? Reuse the helper, util, or pattern that's already here, don't re-write it.

### Spec

Zero findings.
