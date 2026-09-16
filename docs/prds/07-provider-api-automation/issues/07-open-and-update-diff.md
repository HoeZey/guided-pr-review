---
status: todo
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

- [ ] Unopened ADO and GitHub PRs land on Diff without agent connection.
- [ ] Exact source/target commits and repository identity round-trip.
- [ ] Same PR keeps one review id; adoption rules remain unchanged.
- [ ] Current source commit avoids an unnecessary update.
- [ ] Failure never replaces the saved snapshot.
- [ ] Concurrent duplicate calls share or reject one in-flight operation.
- [ ] Guide tab still requests Generate Guide for unchaptered data.
- [ ] Tests use fake providers and local git cache fixtures.

**Blocked by:** 02, 03, 05, and 06

**Blocks:** 08 Retire deterministic agent actions

**Parallel-eligible:** no
