---
status: todo
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

- [ ] Publishing another run never overwrites an older run.
- [ ] The newest exact base/head run opens without a warning.
- [ ] If the guide has moved, the newest old run stays visible behind a
  prominent outdated warning.
- [ ] The history selector lists every run by date and short head SHA and can
  open any run.
- [ ] Repeated runs at the same head remain separate entries.
- [ ] Removing a review removes all of its outcome history.
- [ ] Empty history returns the no-outcome state.

**Blocked by:** 01 Show the latest code-review outcome beside Guide and Diff

**Blocks:** none

**Parallel-eligible:** no
