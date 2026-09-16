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

Date: 16 September 2026

base: 01d2314e6f4a050a2064803348f102c476cf94e2
head: 197d7122787157fc5ec76e943797f06dab110e4b
branch: feature/07-provider-api-automation

History: Reconcile 07 issue paths plus one Merged commit per story 07-01
through 07-09. No overlap commit. 07-05 sits before 07-04 because that is
blocked-by acceptance order (caches did not wait on configured repositories),
not a missing story.

- d91823f38e05712585183825e1f647f275681ceb Reconcile 07 issue paths with post-06 develop
- 54ccbc054c8faf858bb3fd83361e85c3b08d91e9 Merged 07-01: Connect one ADO and one GitHub CLI identity
- 5530b50595988381cd6717824a3302c203a38ada Merged 07-02: Read repositories and pull requests through ADO REST
- 358aa4e0650761bae4daacbc7687afc8d4b54166 Merged 07-03: Read repositories and pull requests through GitHub REST
- 70d59e393f6bdb32ce03a1aada8d8e1b7492b293 Merged 07-05: Fetch exact commits through managed bare caches
- f2966e5fe99ecede5ebb052cf53584b904310c83 Merged 07-04: Manage explicit configured repositories
- 55209c74854213f6ba228eede31cb873517fc1e8 Merged 07-06: Refresh configured PR catalogs
- 6e0e52716fcfd281a209eae7032df44e6ea01bb0 Merged 07-07: Open and update Diff without an agent
- ccaa17a9f0755e813170bb654aeab92f906f6e41 Merged 07-08: Retire deterministic agent actions
- 197d7122787157fc5ec76e943797f06dab110e4b Merged 07-09: Integrate and verify provider automation

Not blocking. Standards has no major. Spec has no missing or incorrect finding.

Story leftovers that still hold at this head stay minor or nit. They do not
fail a success criterion. Live Open, Update, and unchanged-skip against a
named host PR remain pending on 07-09 because no test PR was named; fixtures
cover those paths. OAuth stays deferred. Comments stay out.

### Standards

major 0 / minor 8 / nit 6

- severity: minor
  title: GitHub identity uses English gh auth status text on the live CLI
  location: src/lib/server/auth/cli-credentials.ts
  startLine: 66
  endLine: 210
  explanation: readGithub runs gh auth token then gh auth status --hostname
  with no JSON flag. githubLogin can parse JSON hosts and login fields, then
  falls back to the English regex Logged in to host account-or-as login.
  Default gh auth status prints English text, so the JSON branch does not run
  against the live CLI. A wording change would mark a valid token malformed
  and drop login for relationship classification. Documented on 07-01; still
  true.

- severity: minor
  title: Shared provider errors always speak as Azure DevOps
  location: src/lib/server/providers/errors.ts
  startLine: 31
  endLine: 43
  explanation: ProviderError stores provider but messageFor always returns
  Azure DevOps authentication failed and the other Azure DevOps sentences.
  The ADO adapter throws this type. GitHub throws GithubProviderError with
  GitHub copy, so live GitHub refresh and Open do not show the wrong host
  name. The shared class is still host-biased if a GitHub path throws it.
  Documented on 07-02; still true.

- severity: minor
  title: GitHub 403 responses are treated as authentication failure
  location: src/lib/server/providers/github/rest.ts
  startLine: 147
  endLine: 162
  explanation: throwHttp maps 403 to unauthorized unless the rate-limit
  remaining header is 0 or the body mentions rate limit. Fine-grained
  permission denial and SSO 403 then become auth in configured-repository
  mapping. Denied still appears only when a reader throws code denied.
  Documented on 07-03 and 07-04; still true. Does not fail CLI connection
  states or REST ingest.

- severity: minor
  title: Catalog refresh run can still 500 outside per-repository isolation
  location: src/lib/server/services/catalog-refresh.ts
  startLine: 104
  endLine: 119
  explanation: runOne catches provider failures and replaceCatalog with
  error set, and applyCatalogReplacement keeps prior pullRequests. run()
  still rejects when listRepositories throws or when replaceCatalog throws
  outside that catch. POST /api/catalog maps that to 500. Home now catches
  the fetch and sets refreshError. Prior snapshots remain. Documented on
  07-06; still true. Isolated repository errors still hold for host read
  failures.

- severity: minor
  title: Open and Update still navigate after the user leaves Home
  location: src/lib/client/state/home.svelte.ts
  startLine: 213
  endLine: 248
  explanation: runHostDiff always refreshHomeList then navigate to the new
  reviewId after a 2xx. leaveHome clears diffOps and the inflight map but
  does not cancel that promise. A later success can steal the user onto the
  host PR after they opened another review. The success path that stays on
  the PR they opened is fine. Documented on 07-07; still true.

- severity: minor
  title: Corrupt-fetch retry refetches only the pre-wipe missing list
  location: src/lib/server/git/managed-cache.ts
  startLine: 184
  endLine: 216
  explanation: fetchCommits records SHAs that cat-file rejected, then on a
  corrupt fetch it deletes the cache and fetches only that missing list.
  Commits that passed cat-file before the wipe are gone and are not
  refetched, yet fetchCommits can still return. unifiedThreeDot then fails
  missing-commit for the dropped SHA. Happy-path Open still fetches exact
  commits with no checkout. Documented on 07-05; still true.

- severity: minor
  title: Git process redaction rewrites stdout that becomes the Diff
  location: src/lib/server/git/process.ts
  startLine: 8
  endLine: 36
  explanation: createGitProcessRunner runs redactGitOutput on stdout and
  stderr before callers see them. unifiedThreeDot parses that stdout as
  FileChange hunks. Lines that look like a GitHub token, a JWT, or an https
  user:pass URL become [redacted] inside the Diff. The CLI runner redacts
  stderr only. Tokens stay out of argv and ConnectionView. Documented on
  07-05; still true.

- severity: minor
  title: Hunk-less non-binary files fail existing FileChange rules
  location: src/lib/server/git/parse-unified.ts
  startLine: 123
  endLine: 144
  explanation: toFileChange always sets hunks to the collected list. Binary
  paths become stub reason binary. A rename-only or mode-only file from git
  diff -M has a diff --git header and no hunks, so the parser emits a
  non-stub FileChange with empty hunks. FileChange.parse in syncDiff rejects
  that object and Open fails before upsert. Typical text diffs still open.
  Documented on 07-05; still true.

- severity: nit
  title: ADO login is decoded from an unverified JWT payload
  location: src/lib/server/auth/cli-credentials.ts
  startLine: 154
  endLine: 172
  explanation: jwtIdentity base64-decodes the access-token payload and takes
  unique_name, upn, preferred_username, or email with no signature, alg, or
  aud check. The token comes from a local az account get-access-token the
  app spawned. There is still no ponytail naming that ceiling. Documented
  on 07-01; still true.

- severity: nit
  title: Eight-mebibyte git output cap has no ponytail
  location: src/lib/server/git/process.ts
  startLine: 5
  endLine: 6
  explanation: GIT_MAX_OUTPUT_BYTES is 8 MiB. A larger unified diff is
  killed and mapped to a git error. The in-process cache lock documents its
  ceiling; this cap does not. Documented on 07-05; still true.

- severity: nit
  title: Port comments still say implementation lands later
  location: src/lib/server/git/ports.ts
  startLine: 54
  endLine: 64
  explanation: ManagedGitCache and GitDiff comments still say Implementation
  lands in PRD 07 after this epic landed the implementation. Documented on
  07-05; still true.

- severity: nit
  title: Failure test names parse coverage it does not run
  location: src/lib/server/services/reviews-diff.test.ts
  startLine: 334
  endLine: 372
  explanation: host, cache, parse, and empty-diff failures never call upsert
  covers fetch-failure, empty-diff, and a missing getPullRequest.
  FileChange.parse and GuideV1.parse never run as a failing case.
  Production still throws before upsert on those paths. Documented on
  07-07; still true.

- severity: nit
  title: Home host link is labeled Azure DevOps for every provider
  location: src/lib/client/components/home/HomeCard.svelte
  startLine: 120
  endLine: 136
  explanation: card.webUrl always renders the Azure DevOps mark with
  aria-label Open in Azure DevOps. GitHub catalog cards use that same
  control for github.com URLs. Grouping still uses provider, host, owner,
  and name. Harmless leftover chrome, not a grouping miss.

- severity: nit
  title: Skill upsert_review blurb still names only ADO
  location: SKILL.md
  startLine: 307
  endLine: 307
  explanation: MCP tools still say upsert_review is a stable id for a named
  ADO PR. Open and Update now upsert GitHub PullRequestSource as well.
  queue_action is Generate guide only. Copy leftover in the skill, not a
  runtime miss.

### Spec

missing 0 / partial 0 / scope-creep 0 / incorrect 0

findings: []

HEAD meets the 07 success criteria and 07-09 acceptance criteria graded
here.

Quote, PRD success criteria: ADO and GitHub connection states use existing
CLI sessions and expose no token in browser, logs, command arguments, or
persisted data. createCliCredentialSource runs az account get-access-token
and gh auth token. ConnectionView is login or recovery only. Store v1 has
no token field. Git fetch uses GIT_ASKPASS env, not argv. Tests assert
connection JSON omits tokens.

Quote, PRD success criteria: Current origin plus explicitly configured
repositories persist and refresh through direct host REST adapters. Origin
auto-registers when the remote parses. add and refresh call ADO and GitHub
fetch adapters, not az rest, az devops, or gh api.

Quote, PRD success criteria: Home groups ADO and GitHub PRs with correct
identity, relationship, lifecycle, freshness, and isolated repository
errors. Catalog snapshots carry both providers. One repository host failure
keeps the other snapshot and prior pullRequests when error is set.

Quote, PRD success criteria: Startup, stale-focus, and manual refresh share
in-flight work and retain prior data while loading. hooks.server.ts awaits
a startup latch that clears on rejection. catalogRefresh and Home share
in-flight work. Focus inside 60 seconds skips.

Quote, PRD success criteria: Selecting an unopened PR creates a complete
Diff from exact managed-cache commits without a local clone, checkout, or
agent. Update Diff replaces only a changed snapshot and leaves saved data
intact on failure. openDiff and updateDiff POST app handlers. Unchanged
sourceCommit skips git and upsert. Failures throw before upsert.
FORBIDDEN blocks checkout, switch, restore, worktree, submodule, lfs, and
clone. Home Open and Update run with agentConnected false.

Quote, PRD success criteria: Add/remove repository, Open, Update, and
Refresh work when no agent is connected. Generate Guide still requires the
explicit guided-pr-review agent and keeps the same review id. code-review
remains independent. queue_action input is generate-guide only.
GitHostAdapter, completeOpen, and completeUpdateDiff are gone. Stored Open,
Update Diff, and Refresh actions drop on load.

Quote, PRD success criteria: Existing stores without
configured-repository/provider additions load automatically with no lost
reviews, catalog, actions, or outcomes. Automated tests cover both
providers, auth failure, pagination, cache/diff, deduplication, and
compatibility loading through injected seams.

Quote, 07-09: Manual ADO and GitHub checks cover connect, refresh,
add/remove repository, Open, Update, unchanged-current skip, and auth
recovery. The issue records pending live Open, Update, unchanged-skip, and
auth-recovery because no named test PR was authorized. Fixtures cover those
behaviors. That pending note is not a Spec miss.

Quote, 07-09: CLI-auth UX result is recorded; OAuth remains deferred.
16 September 2026 record: existing az and gh sessions usable; terminal
login is not material friction; no PAT.

No comments. No OAuth app. No develop merge and no main promotion in this
review.
