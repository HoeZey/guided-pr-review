# Overnight execution: epics 06–08

## Mission

Implement, review, integrate, and checkpoint:

1. [06 App structure](prds/06-app-structure/)
2. [07 Provider API automation](prds/07-provider-api-automation/)
3. [08 Inline git-host comments](prds/08-inline-git-host-comments/)

Use develop as delivery base. Keep main stable. Each epic has one integration
branch and one dedicated integrator. Story implementation and review happen in
separate repo-local worktrees/subagents.

## Source of truth

Read in this order:

1. [Documentation index](README.md)
2. This execution plan
3. Current epic README
4. Current epic issues/README.md
5. One claimed issue file
6. Relevant source context through graft

PRD controls product behavior. Issue controls one implementation slice.
Execution plan controls coordination. If they conflict, stop that story and
record the exact conflict; do not redesign in code.

## Branch policy

- main is stable and never a story base.
- develop is the accepted integration line.
- Epic integration branches:
  - feature/06-app-structure
  - feature/07-provider-api-automation
  - feature/08-inline-git-host-comments
- Story branch: feature/NN-MM-lowercase-slug.
- Story worktree: .cursor/worktrees/NN-MM-lowercase-slug.
- Integrator worktree: .cursor/worktrees/NN-integration.
- Coordinator may use detached read-only
  .cursor/worktrees/overnight-coordinator at develop because root remains on
  stable main.
- Pin one immutable develop SHA and create the epic integration branch when an
  epic starts. A story starts from the current epic integration head containing
  every accepted blocked_by story. Parallel stories share that immutable head.
- Never switch the user's main checkout.
- Never push, create a remote PR, promote main, or delete old branches without
  explicit user authorization.

Before creating any worktree, check for .cursor/worktrees.json in repository
root and new worktree. Run its setup when present; absence is normal.

develop is currently local-only. Local branches and commits are checkpoints,
not remote backup. Never push merely to improve durability unless user asks.

## Coordinator model

Coordinator stays small:

- Read issue status/indexes and short git summaries.
- Use graft before source search.
- Launch one implementation subagent per ready story.
- Keep story agents isolated in their own worktrees.
- Launch fresh independent review subagent after each story commit.
- Resume an implementation subagent once for blocking remediation.
- Launch one dedicated integrator role/worktree per epic at epic start. Resume
  it after each accepted wave and for final integration review.
- Record durable status in issue/PRD files and commits, not only chat.

Do not delegate the whole program to one implementation subagent. Do not let
coordinator absorb full source diffs unless resolving a blocker.

## Story subagent prompt contract

Every implementation prompt includes:

- Full repository and worktree path
- Pinned base SHA and branch
- PRD README and exact issue path
- Instruction to read docs/README.md and this file first
- Exact in-scope/out-of-scope statement from issue
- Expected tests and manual checks
- No push, main merge, live mutation, or unrelated cleanup
- Commit subject: Merged NN-MM: Issue title only on integration branch;
  story commit uses an imperative subject
- Requirement to leave clean git status and return head SHA, checks, changed
  files, and unresolved risks

Use Grok 4.6 xhigh for implementation and integrator subagents when model
selection is available. Use inherited model otherwise; do not substitute an
unavailable model silently.

## Story lifecycle

1. Coordinator marks issue doing on its story branch.
2. Implementation subagent reads PRD/issue and gathers graft context.
3. Subagent runs focused baseline checks.
4. Subagent implements only issue scope, runs focused and required full checks,
   commits, and reports immutable head.
5. Fresh review subagent runs code-review against pinned parent/head with
   Standards and Spec separate. It reports into the issue only; it must not
   publish outcomes to localhost or call the user's port 8765.
6. Append exact ## code-review heading at issue end when absent, then record
   fixed base/head and findings there.
7. If blocking, resume original implementation subagent once. It fixes only
   findings, tests, commits, then a fresh reviewer performs second review.
8. A second blocking result stops that story. Keep branch/worktree for human
   follow-up; continue only stories independent of it.
9. Accepted story remains available by immutable head for integrator.
10. Integrator squashes/replays accepted net diff onto epic branch before any
    dependent story starts, as one commit:
    Merged NN-MM: Issue title.
11. Mark issue done only after that commit is on epic integration branch.

Integration issues are special: 06-13, 07-09, and 08-08 run directly in the
epic integration worktree/branch, not a separate story branch. Mark them doing
on the epic branch and done after accepted integration review.

Accepted means:

- Standards: zero major findings
- Spec: zero missing or incorrect findings
- Focused checks pass
- Worktree clean

Minor/nit findings may remain only when documented and outside acceptance.

## Epic integration

Dedicated integrator receives:

- Epic PRD and issue graph
- Pinned epic base
- Every accepted story parent/head SHA
- Every review result and accepted minor
- Required full/manual checks

Integrator:

1. Creates epic integration branch/worktree from pinned develop at epic start.
2. Replays accepted stories after each wave in blocked-by order, one commit
   each. Downstream story branches start from that new integration head.
3. Resolves overlap to preserve all accepted contracts; never chooses one story
   by discarding another.
4. Adds at most one explained integration-only overlap commit.
5. Runs epic full tests, npm run build, and required manual smoke.
6. Runs graft build after large structural changes for local context refresh.
   graft remains ignored and is never staged or committed.
7. Launches fresh integration code-review against fixed base/head and full
   PRD. It records in PRD only and never publishes to localhost/port 8765.
8. Records result under ## integration-review in PRD README.
9. Merges/fast-forwards accepted epic branch to develop.
10. Marks PRD implemented only when every success criterion is verified.

Stable main promotion is a separate explicit user-authorized action after each
epic. Overnight coordinator stops at accepted develop if authorization is
absent.

## Phase 06 waves

Pinned base: develop at epic start.

Runtime handoff:

- 06-01 adds temporary dev:svelte/build:svelte commands.
- Through 06-12, default npm run dev remains Astro on localhost:8765. Svelte
  story/manual checks use dev:svelte on unique ports 8766+; never proxy or
  mount one framework inside the other.
- 06-13 makes SvelteKit the only default dev/build/start runtime, restores the
  product at http://localhost:8765 including POST /mcp, keeps HOST/PORT
  overrides for isolated checks, and removes Astro plus temporary migration
  commands.

### Wave 1

- 06-01 Lock the SvelteKit migration and regression baseline

### Wave 2

- 06-02 Split shared contracts and pure domain rules

### Wave 3, parallel

- 06-03 Introduce app-shaped repositories and JSON adapter
- 06-06 Build the Svelte review shell and shared state

Both branch from accepted 06-02 head or an epic-base branch containing 06-01
and 06-02. Shared contracts accepted in 06-02 are fixed inputs.

### Wave 4

- 06-04 Introduce feature services and provider ports

Start after 06-03 while accepted 06-06 remains on the epic branch.

### Wave 5

- 06-05 Preserve HTTP, MCP, and SSR data in SvelteKit

Start after 06-04. It uses the scaffold from 06-01 and preserves all public
transport contracts while adding server page data.

### Wave 6, parallel

- 06-07 Render Home through SvelteKit SSR
- 06-08 Build shared Svelte code-view primitives
- 06-11 Port Code Review and Guide handoff

All branch from the epic head containing accepted 06-05 and 06-06.

### Wave 7, parallel

- 06-09 Port Guide to Svelte components
- 06-10 Port Diff to Svelte components

Both require accepted 06-08 code-view primitives.

### Wave 8

- 06-12 Restore cross-view interaction parity

Start only after 06-07, 06-09, 06-10, and 06-11 are accepted.

### Integration

- 06-13 Integrate the SvelteKit cutover and remove Astro

Required gates: Node/Svelte tests, svelte-check, production build, architecture
check, route/MCP contracts, old-store compatibility, filled SSR/hydration, and
isolated Home/review/Guide/Diff/Code Review/Generate Guide/navigation/
preference/keyboard/rail smoke. Astro, viewer.ts, and the reserved actions
entrypoint collision are gone. npm start launches the adapter-node build and
passes isolated GET page plus POST /mcp smoke.

## Phase 07 reconciliation

Do not start from roadmap-planning assumptions blindly. After 06 reaches
develop:

1. Ask graft for actual service, repository, provider, credential, git-cache,
   SvelteKit route, Svelte state, and client operation symbols.
2. Coordinator updates 07 issue technical paths/interface names only before
   launching 07 story branches.
3. Confirm PRD behavior unchanged.
4. Pin new develop SHA.

## Phase 07 waves

### Wave 1

- 07-01 Connect one ADO and one GitHub CLI identity

### Wave 2, parallel

- 07-02 Read repositories and pull requests through ADO REST
- 07-03 Read repositories and pull requests through GitHub REST
- 07-05 Fetch exact commits through managed bare caches

Each uses 07-01 credential seam and independent fixtures.

### Wave 3

- 07-04 Manage explicit configured repositories

Requires both provider repository readers.

### Wave 4

- 07-06 Refresh configured PR catalogs

Requires provider readers and configured repositories.

### Wave 5

- 07-07 Open and update Diff without an agent

Requires provider metadata, refresh/catalog identity, and managed caches.

### Wave 6

- 07-08 Retire deterministic agent actions

Remove old paths only after direct services prove all callers.

### Integration

- 07-09 Integrate and verify provider automation

Required automated checks: both provider fixtures, token redaction, pagination,
multi-repository partial failure, refresh deduplication, managed-cache locking/
recovery, Open/Update failure preservation, Guide agent handoff.

Manual checks may run only with existing authorized az/gh sessions. If
credentials are unavailable, finish fake-based implementation and mark manual
acceptance pending; do not invent credentials or block unrelated work.

## Phase 08 reconciliation and old branch

After 07 reaches develop:

1. Coordinator updates comment issue paths/ports against actual provider
   clients, Svelte state, code-view primitives, and components before launching
   08 story branches.
2. Pin new develop SHA.
3. Keep feature/post-ado-comments at 90a7111 and its worktree read-only.
4. Do not rebase, merge, or wholesale cherry-pick it.
5. Inspect only named salvage behavior from PRD/issue.

No live ADO/GitHub comment mutation is authorized by this plan. Use provider
fixtures for overnight work. Manual create/reply/edit/delete waits for explicit
user authorization naming test PRs.

## Phase 08 waves

### Wave 1

- 08-01 Define provider-neutral comment services and contracts

### Wave 2, parallel

- 08-02 Implement ADO comment adapter
- 08-03 Implement GitHub comment adapter
- 08-04 Render existing threads inline in Guide and Diff using fake service

### Wave 3

- 08-05 Create comments and replies from both views

Requires both provider adapters and inline renderer.

### Wave 4

- 08-06 Edit and delete owned comments

### Wave 5

- 08-07 Deliver the PR-wide Discussion tab

Discussion follows edit/delete so it reuses complete interaction state.

### Integration

- 08-08 Integrate and verify inline comments

Required checks: provider parity, line/range/file/PR-wide placement, Guide/Diff
shared state, create/reply/edit/delete ownership, cancellation, auth recovery,
ambiguous-send reconciliation, stale anchors, no obsolete transport.

## Parallel-work safeguards

- Parallel eligibility comes from issue blocked_by, not file overlap alone.
- Parallel stories share immutable parent; they never merge each other.
- One worktree per story. Never reuse worktree across subagents.
- If two parallel stories change same shared contract, first accepted contract
  wins; integrator adapts second without altering behavior.
- Run package install once per worktree only when setup requires it.
- Use unique data files and ports 8766+ for concurrent manual checks.
- Never stop or replace user's localhost 8765 process.
- Do not commit .cursor/, .handoff/, .ignore, data/, graft/, worktrees, or
  generated agent artifacts.

## Failure and recovery

- Authentication/authorization denial: report once; continue fake-based and
  independent work. Do not investigate user accounts.
- Existing baseline failure: prove it on pinned parent and record separately.
- Introduced failure: story remains unaccepted.
- Merge conflict: integrator resolves with both issue contracts and tests.
- Second blocking review: stop story and downstream dependencies, continue
  independent frontier.
- Hung subagent: inspect worktree/commit, resume once, then preserve branch and
  continue independent work.
- Context pressure: compact coordinator into durable issue statuses, SHAs,
  reviews, and PRD integration notes. Start new subagent rather than loading
  whole prior transcript.

## Overnight stopping conditions

Stop safely when:

- Required credentials or live-mutation authorization is absent
- Second review still blocks a story
- Contract conflict requires product decision
- develop/main moved unexpectedly from pinned base
- Data-loss or security boundary cannot be proved

Do not paper over a stop. Leave:

- Clean worktrees where possible
- Exact branch/head/base SHAs
- Completed checks
- Blocking finding and owning issue
- Next unblocked action

## Final handoff

Report:

- Epic and issue status
- Integration branch/head per epic
- develop head and whether main stayed untouched
- Automated and manual checks
- Pending auth/live checks
- Remaining review findings
- Worktrees safe to remove versus preserve
- Any OAuth UX evidence; create no OAuth PRD unless CLI UX actually fails
