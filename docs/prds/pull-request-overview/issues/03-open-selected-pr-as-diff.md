---
status: done
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

- [x] Selecting an unopened PR queues exactly one Open action.
- [x] The waiting agent claims that action, upserts an unchaptered review, and
  the app opens Diff.
- [x] No chaptering adapter runs for Open.
- [x] The Guide tab does not present a placeholder walkthrough.
- [x] After success the agent waits again and a second Open can fetch another
  PR.
- [x] A failed Open reports a structured error without changing other reviews.
- [x] Host-backed actions explain that the skill must be running when no agent
  is connected.
- [x] Current saved reviews remain openable while disconnected.
- [x] Action tests inject a fake host adapter and never contact live ADO.

**Blocked by:** 02 Browse current-repository PRs by relationship; Git-host 01
Open a named Azure DevOps PR as a guided review

**Blocks:** 04 Refresh outdated and closed PRs; 05 Add another repository to
the overview; 07 Generate the reading-order guide on request

**Parallel-eligible:** no

## code-review

Reviewed base 5823a1fe5bfb4da814add6111613bb56496f8df0 and head
b6c1d26a6fe69336e947fda816ecf51ebdb9962a on 15 Sep 2026.

Standards: 0 major / 2 minor / 1 nit

Spec: 0 missing / 0 partial / 0 scope-creep / 0 incorrect

### Standards

1. minor — Open completion lives in a helper MCP never calls

   SKILL says the app is renderer plus store. The waiting agent fetches, builds
   an unchaptered Guide, then calls upsert_review and complete_action.

   src/actions.ts adds GitHostAdapter, an unused ChapteringAdapter, and
   completeOpenAction. mcp.ts and /api/actions never import them.
   actions.test.ts therefore green-paths a stand-in, not the production seam.

   That stand-in also upserts when files is empty. GuideV1 allows an empty
   chapter, so the helper never fails empty-diff or skips upsert.

   Keep Open completion on upsert_review plus complete_action. If the helper
   stays, fail empty files with empty-diff and do not upsert.

   Location: src/actions.ts:55-79

2. minor — Agent looks disconnected while Open is still running

   waitForAction writes agentLastSeen only inside its 50ms poll. SKILL Open as
   Diff (host get, git hunks, upsert) runs after wait returns.
   AGENT_CONNECTED_MS is 35s. A slow fetch flips agentConnected off; Home shows
   the disconnected hint and host cards become inert divs while a claimed
   action is still in flight.

   Queued and claimed rows never expire. If the skill dies after claim, the
   card stays Opening until a new waiter retries that same claim.

   Heartbeat on complete_action as well, or fail/retry claimed actions older
   than AGENT_CONNECTED_MS.

   Location: src/store.ts:236-260

3. nit — stripHeads is copied into the new helper

   overview.ts already strips refs/heads/. actions.ts repeats the same replace.
   Reuse the existing helper instead of a second copy.

   Location: src/actions.ts:25-27

### Spec

Zero findings.
