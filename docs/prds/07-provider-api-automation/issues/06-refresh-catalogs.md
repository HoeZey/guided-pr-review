---
status: todo
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

- [ ] Startup, stale focus, and manual requests call the same refresh service.
- [ ] Focus inside 60 seconds does not refresh; focus at or after 60 seconds
  does.
- [ ] Overlapping triggers do not duplicate provider calls.
- [ ] One repository failure does not drop another result or prior snapshot.
- [ ] Auth failure identifies affected provider and preserves saved data.
- [ ] Closed saved PRs archive; closed unsaved catalog items disappear.
- [ ] No agent action is queued.
- [ ] Tests cover ADO/GitHub, multiple repositories, deduplication, partial
  failure, and lifecycle transitions.

**Blocked by:** 02, 03, and 04

**Blocks:** 07 Open and update Diff

**Parallel-eligible:** no
