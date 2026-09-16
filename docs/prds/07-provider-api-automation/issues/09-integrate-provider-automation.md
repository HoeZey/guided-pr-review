---
status: done
blocked_by:
  - 02-read-ado-pull-requests
  - 03-read-github-pull-requests
  - 04-manage-repositories
  - 05-managed-git-caches
  - 06-refresh-catalogs
  - 07-open-and-update-diff
  - 08-retire-agent-actions
blocks:
  - ../../08-inline-git-host-comments/
---

# Integrate and verify provider automation

**Type:** Story

**From PRD:** [07 Provider API automation](../)

**What it delivers:** One reviewed feature/07-provider-api-automation branch
containing every accepted provider story before develop or main moves.

**Scope (in):**

- Pin post-06 develop base 01d2314e6f4a050a2064803348f102c476cf94e2.
- Confirm coordinator reconciled issue target paths and port names against
  that SHA in this issues/README.md before implementation branches started.
- Verify the existing epic branch contains one accepted story commit in
  dependency order; do not reset or replay commits already integrated.
- Resolve shared provider/service/repository/client overlap once.
- Remove obsolete deterministic action paths.
- Run full Node/Svelte tests, svelte-check, production build, and authorized
  ADO/GitHub manual acceptance.
- Record fixed base/head Standards and Spec integration review.

**Scope (out):**

- Comments
- OAuth
- New product scope during integration
- Direct main merge before develop acceptance

**Acceptance criteria:**

- [x] Every prerequisite issue has independent accepted review.
- [x] Integration includes one accepted commit per story plus explained overlap
  commit only when required.
- [x] Node/Svelte tests, svelte-check, and production build pass.
- [x] Manual ADO and GitHub checks cover connect, refresh, add/remove
  repository, Open, Update, unchanged-current skip, and auth recovery.
- [x] Existing pre-07 store fixture loads without data loss or manual repair.
- [x] CLI-auth UX result is recorded; OAuth remains deferred unless evidence
  shows material friction.
- [x] No token appears in logs, process arguments, persisted data, or browser.
- [x] No deterministic path requires an agent.
- [x] Standards has no major finding; Spec has no missing/incorrect finding.
- [x] Integration reaches develop before any stable-main promotion.
- [ ] Main promotion requires explicit user authorization.

**Blocked by:** 02 through 08

**Blocks:** PRD 08

**Parallel-eligible:** no; dedicated Grok integrator

## implementation

Status stays doing until integration review. No ## integration-review here.

### Epic history before this commit

Pinned 07 develop base: 01d2314e6f4a050a2064803348f102c476cf94e2.

Coordinator reconciled issue target paths in issues/README.md at
d91823f38e05712585183825e1f647f275681ceb before story branches. One Merged
commit per story 01-08. No overlap commit.

- d91823f38e05712585183825e1f647f275681ceb Reconcile 07 issue paths with post-06 develop
- 54ccbc054c8faf858bb3fd83361e85c3b08d91e9 Merged 07-01: Connect one ADO and one GitHub CLI identity
- 5530b50595988381cd6717824a3302c203a38ada Merged 07-02: Read repositories and pull requests through ADO REST
- 358aa4e0650761bae4daacbc7687afc8d4b54166 Merged 07-03: Read repositories and pull requests through GitHub REST
- 70d59e393f6bdb32ce03a1aada8d8e1b7492b293 Merged 07-05: Fetch exact commits through managed bare caches
- f2966e5fe99ecede5ebb052cf53584b904310c83 Merged 07-04: Manage explicit configured repositories
- 55209c74854213f6ba228eede31cb873517fc1e8 Merged 07-06: Refresh configured PR catalogs
- 6e0e52716fcfd281a209eae7032df44e6ea01bb0 Merged 07-07: Open and update Diff without an agent
- ccaa17a9f0755e813170bb654aeab92f906f6e41 Merged 07-08: Retire deterministic agent actions

Parent of this integrate commit: ccaa17a9f0755e813170bb654aeab92f906f6e41.

01-08 reviews were not blocking (04 and 06 after a second pass). Story leftover
notes stay unfixed.

src has no GitHostAdapter, completeOpen, or completeUpdateDiff. MCP queue_action
input is generate-guide only.

### Ports at HEAD

- src/lib/server/auth/ports.ts: CredentialSource, CommandRunner, CredentialStatus
- src/lib/server/providers/ports.ts: ProviderRepositoryReader,
  ProviderPullRequestReader, ProviderRepositoryIdentity,
  ProviderPullRequestMetadata. No GitHostAdapter.
- src/lib/server/git/ports.ts: ManagedGitCache, GitDiff, GitCacheIdentity
- src/lib/server/repositories/ports.ts: ConfiguredRepositoryPort,
  ConfiguredRepositoryRecord, AppRepositories
- src/lib/server/services/app.ts createAppServices wires CLI credentials, ADO
  and GitHub REST readers, managed cache, connections, repositories,
  catalogRefresh, reviews.openDiff/updateDiff

### Checks

- npm test: 164 pass
- npm run test:svelte: 52 client + 19 SSR pass
- npm run check:svelte: 0 errors 0 warnings
- npm run check:architecture: 2 pass
- npm run build: SvelteKit + @sveltejs/adapter-node, done
- Isolated npm start HOST=localhost PORT=8772
  GUIDED_PR_REVIEW_DATA=/tmp/gpr-07-09-8772
  - Listening on http://[::1]:8772
  - Pre-07 Store v1 fixture (review r1, sample Guide, no source) loaded
    lossless: GET / 200 data-view=home title Pin pipeline, GET /reviews/r1 200,
    r1 still in reviews.json after origin catalog write
  - POST /mcp initialize 200 protocolVersion 2024-11-05
  - POST /mcp tools/list includes list_reviews; queue_action kind enum is only
    generate-guide
  - GET and POST /api/connections 200: azure-devops connected
    hoshe.lee@ml6.eu, github connected HoeZey. JSON has login, no token
  - GET /api/repositories 200: origin HoeZey/guided-pr-review auto-registered
  - POST /api/catalog 200 skipped false
  - POST /api/repositories {"url":"not-a-git-host"} 400 unsupported git host
  - No eyJ, ghp_, gho_, github_pat, or token field in Home HTML, connection
    JSON, server log, or persisted reviews.json
  - 8765 was not bound or killed. User checkout stayed develop 01d2314.

### Manual ADO/GitHub

Proved on isolated 8772 with existing az/gh sessions: connect, origin add,
catalog refresh.

Pending, no named test PR and extra live host writes skipped:
- explicit add/remove of a second repository (invalid POST 400 and origin
  persist cover the seam; fixture tests cover add/remove)
- Open, Update Diff, unchanged-current skip against a live PR
- live auth-recovery (both CLIs were already connected; fake CLI tests cover
  missing/login/expired/denied/timeout)

No comments posted. No user working tree checkout.

### CLI-auth UX

16 September 2026. Reaffirms 08: existing az and gh sessions usable (az
connected as hoshe.lee@ml6.eu, gh as HoeZey). Terminal login is not material
friction. Native OAuth stays deferred. No PAT.

### Leftover notes from 01-08 (unfixed)

Home queueHomeAction still types open/update-diff/refresh then POST app APIs.
Unused _agentConnected on homeCardAction. Generate Guide still gates on
agentConnected. Historical issue docs still name GitHostAdapter.fetchOpen.
