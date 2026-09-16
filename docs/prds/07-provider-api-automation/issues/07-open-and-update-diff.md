---
status: done
blocked_by:
  - 02-read-ado-pull-requests
  - 03-read-github-pull-requests
  - 05-managed-git-caches
  - 06-refresh-catalogs
blocks:
  - 08-retire-agent-actions
  - 09-integrate-provider-automation
---

# Open and update Diff without an agent

**Type:** Story

**From PRD:** [07 Provider API automation](../)

**Seam(s):** Open/Update review service; provider PR reader; managed cache;
review repository; browser operation state

**What it delivers:** A catalog PR opens or updates as a complete Diff through
one app request even when no agent is connected.

**Scope (in):**

- Resolve fresh PR metadata through owning provider adapter.
- Fetch exact source/target commits through managed cache.
- Build current unchaptered Guide/Diff payload with structured provenance.
- Upsert by provider/host/repository/PR stable key.
- Skip update when saved source commit is current.
- Preserve local-review adoption and stable id rules.
- Keep saved snapshot untouched on host, cache, parse, or empty-diff failure.
- Show scoped Opening/Updating state while existing UI remains responsive.
- Deduplicate repeated operation for the same PR.

**Scope (out):**

- Chaptering
- Comment APIs
- Provider patch-only diffs
- Persisted job queue or progress stream

**Touches:** src/lib/server/services/reviews.ts (today completeOpen /
completeUpdateDiff still go through GitHostAdapter.fetchOpen);
ProviderPullRequestReader; ManagedGitCache and GitDiff in
src/lib/server/git/ports.ts; ReviewRepository.upsertReview;
SvelteKit Open/Update +server.ts; Home queueHomeAction and
src/lib/client/state/review.svelte.ts; tests with fake providers and local
git-cache fixtures

**Acceptance criteria:**

- [x] Unopened ADO and GitHub PRs land on Diff without agent connection.
- [x] Exact source/target commits and repository identity round-trip.
- [x] Same PR keeps one review id; adoption rules remain unchanged.
- [x] Current source commit avoids an unnecessary update.
- [x] Failure never replaces the saved snapshot.
- [x] Concurrent duplicate calls share or reject one in-flight operation.
- [x] Guide tab still requests Generate Guide for unchaptered data.
- [x] Tests use fake providers and local git cache fixtures.

**Blocked by:** 02, 03, 05, and 06

**Blocks:** 08 Retire deterministic agent actions

**Parallel-eligible:** no

## code-review

Date: 16 September 2026

base: 55209c74854213f6ba228eede31cb873517fc1e8
head: 25850d15c5ccbda4f321f5939cfa5e8b389790a8
branch: feature/07-07-open-and-update-diff

Not blocking. Standards has no majors. Spec has no missing or incorrect findings.

Judged leftover notes, not findings: completeOpen and completeUpdateDiff still call GitHostAdapter.fetchOpen. MCP can still queue open and update-diff until 08. Home Open and Update Diff POST /api/reviews/open and /api/reviews/update-diff and do not queue those actions. HomeCard still shows Waiting or Opening from leftover queued host actions and hides the new buttons; that action ownership is 08. GitHub providerContext is { kind: github } only, which matches the story allowance. Generate Guide still posts /api/actions and stays gated on agentConnected.

### Standards

major 0 / minor 1 / nit 1

- severity: minor
  title: Open and Update still navigate after the user leaves Home
  location: src/lib/client/state/home.svelte.ts (runHostDiff)
  startLine: 213
  endLine: 248
  explanation: runHostDiff always refreshHomeList then navigate to the new reviewId after a 2xx. leaveHome (HomeView onDestroy) clears diffOps and diffInflight but does not cancel that promise. If the user opens a saved review on another card while Opening or Updating is in flight, the later navigate steals them onto the host PR. The old pendingActionId watch stopped navigating once leaveHome cleared the id. The success path that navigates to the review that just opened is fine; the steal is the cross-card leave.

  recommendation: Ignore the completion, or skip navigate, when leaveHome has run for that operation (an aborted flag, or compare navigate with the current pathname). Do not let finally { diffInflight.delete(key) } drop a newer in-flight promise for the same PR after leaveHome cleared the map.

- severity: nit
  title: Failure test names parse coverage it does not run
  location: src/lib/server/services/reviews-diff.test.ts
  startLine: 334
  endLine: 372
  explanation: host, cache, parse, and empty-diff failures never call upsert covers fetch-failure, empty-diff, and a missing getPullRequest. FileChange.parse and GuideV1.parse never run as a failing case. Production still throws before upsert on those paths.

  recommendation: Rename the test, or add one invalid file object from unifiedThreeDot that fails FileChange.parse and still leaves upsert at zero.

### Spec

missing 0 / partial 0 / scope-creep 0 / incorrect 0

findings: []
