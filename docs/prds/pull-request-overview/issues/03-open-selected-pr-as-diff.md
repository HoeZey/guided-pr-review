---
status: todo
blocked_by:
  - 02-browse-current-repository-prs
  - git-host-guided-reviews/01-open-named-ado-pr
blocks:
  - 04-refresh-outdated-and-closed-prs
  - 05-add-another-repository
  - 07-generate-guide-on-request
---

# Open the selected PR as Diff

**Type:** Story

**From PRD:** [Pull request overview](../)

**Seam(s):** action claim and completion; upsert_review; injected git-host
adapter

**What it delivers:** A reviewer can open one current-repository PR from Home
straight into Diff after the waiting agent fetches exact commits, without LLM
chaptering.

**Scope (in):**

- Queue Open from a catalog card that has no saved review.
- Keep the agent long-polling for browser actions after catalog sync.
- Claim, succeed, or fail one action at a time.
- Fetch exact source and target commits without checkout.
- Upsert one unchaptered review through the git-host identity seam.
- Land on the Diff tab. Guide shows Generate guide, not a walkthrough.
- Show Waiting, Opening, failure, and Agent disconnected states.
- Keep saved reviews openable when the agent is disconnected.
- Accept another Open after a completed fetch.

**Scope (out):**

- Generating a reading-order Guide
- Updating an outdated snapshot
- Archiving merged or abandoned PRs
- Adding another repository
- Bare caches for uncloned repositories

**Touches:** action queue, skill wait loop, Home card actions, Diff landing,
Guide empty state, tests

**Acceptance criteria:**

- [ ] Selecting an unopened PR queues exactly one Open action.
- [ ] The waiting agent claims that action, upserts an unchaptered review, and
  the app opens Diff.
- [ ] No chaptering adapter runs for Open.
- [ ] The Guide tab does not present a placeholder walkthrough.
- [ ] After success the agent waits again and a second Open can fetch another
  PR.
- [ ] A failed Open reports a structured error without changing other reviews.
- [ ] Host-backed actions explain that the skill must be running when no agent
  is connected.
- [ ] Current saved reviews remain openable while disconnected.
- [ ] Action tests inject a fake host adapter and never contact live ADO.

**Blocked by:** 02 Browse current-repository PRs by relationship; Git-host 01
Open a named Azure DevOps PR as a guided review

**Blocks:** 04 Refresh outdated and closed PRs; 05 Add another repository to
the overview; 07 Generate the reading-order guide on request

**Parallel-eligible:** no
