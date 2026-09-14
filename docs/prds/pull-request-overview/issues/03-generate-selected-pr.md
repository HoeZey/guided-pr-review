---
status: todo
blocked_by:
  - 02-browse-current-repository-prs
  - git-host-guided-reviews/01-open-named-ado-pr
blocks:
  - 04-refresh-outdated-and-closed-prs
  - 05-add-another-repository
---

# Generate the selected PR while the agent waits

**Type:** Story

**From PRD:** [Pull request overview](../)

**Seam(s):** action claim and completion; upsert_review; injected git-host
adapter

**What it delivers:** A reviewer can select one unguided current-repository PR
on Home; the waiting guided-review agent chapters only that PR, opens the
resulting guide, and then waits for another selection.

**Scope (in):**

- Queue Generate review from an unguided catalog card.
- Keep the agent long-polling for browser actions after catalog sync.
- Claim, succeed, or fail one action at a time.
- Fetch exact source and target commits without checkout.
- Upsert one guide through the git-host identity seam.
- Show Waiting, Generating, failure, and Agent disconnected states.
- Keep saved guides openable when the agent is disconnected.
- Accept another selection after a completed generation.

**Scope (out):**

- Updating an outdated guide
- Archiving merged or abandoned PRs
- Adding another repository
- Bare caches for uncloned repositories

**Touches:** action queue, skill wait loop, Home card actions, review
navigation, tests

**Acceptance criteria:**

- [ ] Selecting an unguided PR queues exactly one Generate action.
- [ ] The waiting agent claims that action, upserts one guide, and the app
  opens that review.
- [ ] After success the agent waits again and a second selection can generate
  another PR.
- [ ] A failed generation reports a structured error without changing other
  reviews.
- [ ] Host-backed actions explain that the skill must be running when no agent
  is connected.
- [ ] Current saved guides remain openable while disconnected.
- [ ] Action tests inject a fake host adapter and never contact live ADO.

**Blocked by:** 02 Browse current-repository PRs by relationship; Git-host 01
Open a named Azure DevOps PR as a guided review

**Blocks:** 04 Refresh outdated and closed PRs; 05 Add another repository to
the overview

**Parallel-eligible:** no
