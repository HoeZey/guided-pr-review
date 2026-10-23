---
status: done
blocked_by:
  - 02-read-ado-pull-requests
  - 03-read-github-pull-requests
  - 04-manage-repositories
blocks:
  - 07-open-and-update-diff
  - 09-integrate-provider-automation
---

# Refresh configured PR catalogs

**Type:** Story

**From PRD:** [07 Provider API automation](../)

**Seam(s):** refresh service; in-flight deduplication; per-repository catalog
replacement; Home loading/error projection

**What it delivers:** Home refreshes ADO/GitHub PR state at startup, stale
focus, or manual request without a waiting agent.

**Scope (in):**

- Refresh every configured repository through its provider reader.
- Trigger at server startup, stale browser focus, and manual Refresh.
- Treat latest refresh attempt as stale after 60 seconds, held in one
  configuration constant.
- Share one in-flight refresh per repository/whole refresh as appropriate.
- Keep prior catalog visible while loading.
- Replace successful snapshots independently and retain prior failed
  snapshots with structured error and attempted time.
- Include saved PRs that became completed/abandoned so they archive.
- Preserve relationship grouping, adoption, freshness, and Last synced.

**Scope (out):**

- Fixed-interval polling, SSE, jobs, webhooks, or background app process
- Comment refresh
- Deleting saved reviews

**Touches:** src/lib/server/services/catalog.ts, CatalogRepository in
src/lib/server/repositories/ports.ts, src/routes/api/catalog/+server.ts;
ProviderPullRequestReader; createAppServices in src/lib/server/services/app.ts
and src/lib/server/runtime.ts; Home src/lib/client/state/home.svelte.ts
(today queueHomeAction refresh still posts /api/actions);
src/lib/shared/domain/overview.ts; tests

**Acceptance criteria:**

- [x] Startup, stale focus, and manual requests call the same refresh service.
- [x] Focus inside 60 seconds does not refresh; focus at or after 60 seconds
  does.
- [x] Overlapping triggers do not duplicate provider calls.
- [x] One repository failure does not drop another result or prior snapshot.
- [x] Auth failure identifies affected provider and preserves saved data.
- [x] Closed saved PRs archive; closed unsaved catalog items disappear.
- [x] No agent action is queued.
- [x] Tests cover ADO/GitHub, multiple repositories, deduplication, partial
  failure, and lifecycle transitions.

**Blocked by:** 02, 03, and 04

**Blocks:** 07 Open and update Diff

**Parallel-eligible:** no

## code-review

Date: 16 September 2026

base: f2966e5fe99ecede5ebb052cf53584b904310c83
head: aed0d026ecec0165d39c3867439b046ab8fdfcce
branch: feature/07-06-refresh-catalogs

Blocking. Standards has a major. Spec has no missing or incorrect findings.

Judged implementer notes: first request awaits startup refresh through src/hooks.server.ts. That matches the same catalogRefresh.refresh reason startup path, but a rejected startup promise is latched for the process (Standards major below). GitHub saved reviews still cannot persist PullRequestSource, which stays azure-devops only; GitHub coverage is live catalog plus unsaved closed drop. GitHostAdapter.fetchOpen is unused. Open and Update still queue agent actions; that is 07-07, not a miss here.

### Standards

major 1 / minor 1 / nit 1

- severity: major
  title: A failed startup refresh latches every later request to that rejection
  location: src/hooks.server.ts (handle)
  startLine: 6
  endLine: 10
  explanation: handle assigns startup ??= catalogRefresh.refresh({ reason: "startup" }) and awaits it on every request. The operator does not clear on failure. If that promise rejects, later GET pages, POST /api/catalog, and POST /mcp await the same rejected promise and never call refresh again. run() rejects when listRepositories throws or when any refreshOne throws (replaceCatalog failure after the per-repository catch, or a throw from the error replace itself). Those paths are narrower than provider list/get failures, which runOne absorbs, but they exist (unexpected list errors, store write failures). The latch also blocks the recovery POST that Home uses for manual refresh, because hooks run first.

  recommendation: On rejection, clear the module binding so a later request can retry. Do not let a failed startup promise be the permanent handle result. Serving the prior catalog after a failed attempt matches the story's keep-prior rule.

- severity: minor
  title: Home refresh failures are unhandled and have no error on the page
  location: src/lib/client/state/home.svelte.ts (refreshCatalog)
  startLine: 168
  endLine: 196
  explanation: refreshCatalog awaits fetchJson then refreshHomeList inside try/finally with no catch. HomeActions and HomeView call it with void. A non-OK POST (handle 500 from a rejected startup, or catalogRefresh throwing) becomes an unhandled rejection. homeUi.refreshing clears. Per-repository catalog errors only appear after a successful POST plus GET /api/reviews. The button re-enables with no Home error and no structured provider message.

  recommendation: Catch fetchJson and list errors, set a Home error string, and keep the prior list. Do not rely on void to swallow rejection.

- severity: nit
  title: Per-repository inflight map cannot run under the whole-refresh lock
  location: src/lib/server/services/catalog-refresh.ts (refreshOne)
  startLine: 40
  endLine: 52
  explanation: run() returns the same whole-refresh promise while inflight is set, and inflight stays set until every repository finishes. refreshOne's repoInflight map is never observed by a second caller. Overlap sharing is entirely the whole-refresh promise.

  recommendation: Delete repoInflight unless a later caller refreshes one repository on its own.

### Spec

missing 0 / partial 0 / scope-creep 0 / incorrect 0

findings: []

## code-review-2

Date: 16 September 2026

base: f2966e5fe99ecede5ebb052cf53584b904310c83
head: 84a85479ca01705e9dbce9cf4f2f917305a4be12
branch: feature/07-06-refresh-catalogs

Not blocking. Standards has no majors. Spec has no missing or incorrect findings.

First-review major is gone: createCatalogStartupLatch clears the module promise on rejection and handle still resolves, so a failed startup refresh does not latch later GET pages, POST /api/catalog, or MCP. Test failed startup refresh does not latch later handle or manual refresh covers retry after listRepositories failure.

Judged leftover notes, not findings: run() still rejects when listRepositories throws or when replaceCatalog throws outside the per-repository catch (including a failed error replace). POST /api/catalog maps that to 500; applyCatalogReplacement keeps prior pullRequests when error is set, so this is not a new latch or snapshot drop. GitHub saved reviews still cannot persist PullRequestSource (provider stays azure-devops only); savedNumbersFor therefore cannot see a GitHub saved identity. GitHub coverage for this story is live catalog plus unsaved closed drop (test closed saved PRs archive; closed unsaved catalog items disappear). GitHostAdapter.fetchOpen stays unused. Open and Update still queue agent actions; that is 07-07, not a miss here.

### Standards

major 0 / minor 0 / nit 0

findings: []

### Spec

missing 0 / partial 0 / scope-creep 0 / incorrect 0

findings: []
