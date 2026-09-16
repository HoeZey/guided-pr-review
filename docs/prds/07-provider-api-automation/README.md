---
status: in_progress
blocked_by:
  - ../06-app-structure/
---

# PRD: Provider API automation

## Problem

Opening or refreshing a PR currently requires a guided-pr-review agent to wait
for browser actions, authenticate through provider tooling, fetch metadata and
commits, then write results back through MCP. These are deterministic
operations. Waiting for an agent makes Home, lifecycle refresh, and Diff feel
slow and disconnected.

The unfinished multi-repository and managed-cache stories would deepen that
agent dependency if built on the old action loop. GitHub is also unsupported,
despite provider-neutral identities already existing.

## Goal

One connected Azure DevOps identity and one connected GitHub identity can
refresh explicitly configured repositories, browse current PR state, and open
or update complete diffs through localhost services without a waiting agent.
Guide generation and code-review remain the only agent tasks.

## Non-goals

- Host comments; PRD 08 owns that capability end to end
- Native OAuth in this PRD
- Accepting or storing pasted PATs
- Calling host operations through Cursor MCP, ADO MCP, az rest, az devops, or
  gh api
- Scanning every repository the identity can access
- Requiring a local clone or changing user working trees
- Webhooks, timers while the app is closed, SSE, or a persisted job queue
- Votes, approvals, merge, abandon, or repository administration
- Bitbucket or Linear

## User stories

- As a reviewer, I want Home to refresh without an agent so PR lists and
  lifecycle state arrive as normal app data.
- As a reviewer, I want ADO and GitHub repositories in one configured list so
  I can review work from either host.
- As a reviewer, I want current origin included automatically and other
  repositories added explicitly so the app does not scan hidden breadth.
- As a reviewer, I want Open and Update Diff to fetch exact commits without
  checkout so every PR is readable even without a local clone.
- As a reviewer, I want stale data to remain visible while refresh runs and one
  repository failure not to erase another.
- As a reviewer, I want clear login recovery when az or gh is unavailable or
  expired.
- As a reviewer, I want Generate Guide to remain an explicit agent task after
  Diff is already available.

## Ownership

- Credential sources run az account get-access-token or gh auth token and
  return a token plus provider identity. They perform no host action.
- ADO and GitHub provider adapters use server-side fetch for repository and PR
  APIs.
- Repository services own configured repository persistence and catalog
  snapshots.
- A managed git adapter keeps bare caches, fetches exact immutable commits, and
  computes local unified diffs.
- Review services own Open Diff and Update Diff.
- Hydrated Svelte components call thin SvelteKit +server.ts handlers, but
  server use cases complete in the request. In-flight operations are
  deduplicated.
- guided-pr-review only chapters an existing Diff. code-review remains a
  separate report and outcome publisher.

## Implementation notes

- Support one active identity for dev.azure.com and one for github.com.
  Enterprise hosts are a later extension unless their CLI session already
  satisfies the same validated adapter contract.
- Current origin is registered automatically when it parses as supported.
  Additional repositories are explicit provider/repository identities.
- Catalog normalization retains provider, host, repository id/owner/name/web
  URL, PR number/title/web URL, draft/lifecycle, source/target refs and commits,
  author, reviewer/author relationship, and updated time.
- Each repository refresh replaces only that repository snapshot. Errors are
  isolated and retain prior data plus an error and attempted timestamp.
- Refresh runs once at server startup, after browser focus when the latest
  attempt is at least 60 seconds old, and manually. Concurrent triggers share
  one in-flight operation. There is no fixed timer.
- A saved closed PR remains archived. A closed unsaved catalog PR disappears.
  Existing grouping/adoption/freshness behavior stays.
- Keep one bare cache per provider/host/repository id under local app data.
  Fetch exact source and target commits with no checkout. Serialize writes per
  cache and recover a corrupt cache without touching user repositories.
- ADO and GitHub APIs resolve PR metadata and exact commit ids. Git computes
  the complete diff. Do not depend on provider patch fields, which may be
  truncated or provider-specific.
- Open and Update Diff upsert an unchaptered Guide payload using stable
  provider/host/repository/PR identity. An unchanged source commit avoids
  unnecessary update. Failure leaves the saved review intact.
- Svelte state/components show scoped Connecting, Refreshing, Opening,
  Updating, and recovery states while SSR/stale/saved content stays usable.
- Remove Open, Update Diff, Refresh, and Add repository from agent action
  ownership. Keep Generate Guide queue/claim/complete because chaptering is an
  agent task.
- OAuth is conditional roadmap work. The CLI UX acceptance check records
  whether terminal login, refresh, or missing binaries materially harms use.

## Testing / seams

**Seams:** credential command runner; provider HTTP transport; ADO/GitHub
normalizers; configured repository and catalog repositories; managed git cache
process/filesystem adapter; refresh/Open/Update services; Svelte operation
state and components.

**Good checks:**

- Fake CLI results cover connected, missing command, login required, expiry,
  denied scope, timeout, and redacted stderr.
- Provider fixtures cover pagination, draft/lifecycle, authored/reviewer
  grouping, refs/commits, malformed responses, and rate/auth errors.
- Multi-repository refresh isolates failure and deduplicates concurrent calls.
- Local fixture remotes prove cache creation, exact fetch, no checkout,
  unchanged skip, corruption recovery, and complete diff.
- Open/Update failure never changes the saved review.
- Tests never contact a private host or inspect SvelteKit internals.
- Manual acceptance uses one authorized ADO PR and one authorized GitHub PR.

## Trade-offs (decided)

- CLI-backed credentials first; native OAuth only after measured UX failure.
- Direct REST via fetch, not provider MCP/CLI actions.
- Explicit repositories, not account-wide discovery.
- Managed bare caches and local git diff, not provider patch normalization.
- Normal REST requests with focused spinners and deduplication, not SSE/jobs.
- One identity per provider, not account switching.
- Comment APIs stay out so PRD 08 remains one cohesive vertical capability.

## Success criteria

- ADO and GitHub connection states use existing CLI sessions and expose no
  token in browser, logs, command arguments, or persisted data.
- Current origin plus explicitly configured repositories persist and refresh
  through direct host REST adapters.
- Home groups ADO and GitHub PRs with correct identity, relationship,
  lifecycle, freshness, and isolated repository errors.
- Startup, stale-focus, and manual refresh share in-flight work and retain
  prior data while loading.
- Selecting an unopened PR creates a complete Diff from exact managed-cache
  commits without a local clone, checkout, or agent.
- Update Diff replaces only a changed snapshot and leaves saved data intact on
  failure.
- Add/remove repository, Open, Update, and Refresh work when no agent is
  connected.
- Generate Guide still requires the explicit guided-pr-review agent and keeps
  the same review id. code-review remains independent.
- Existing stores without configured-repository/provider additions load
  automatically with no lost reviews, catalog, actions, or outcomes.
- Automated tests cover both providers, auth failure, pagination, cache/diff,
  deduplication, and compatibility loading through injected seams.

## Out of scope

- Inline or PR-wide comments ([08 Inline git-host
  comments](../08-inline-git-host-comments/))
- OAuth app registration and token persistence
- Existing host discussions, reviews, approvals, or merge actions
- Background service while localhost app is stopped
- Cache retention policy beyond safe per-repository storage

## References

- [Research](research.md)
- [06 App structure](../06-app-structure/)
- [03 Git-host guided reviews](../done/03-git-host-guided-reviews/)
- [04 Pull request overview](../done/04-pull-request-overview/)
- Supersedes 04 issues 05 and 06

## integration-review

Pending implementation.
