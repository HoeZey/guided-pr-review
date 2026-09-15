---
status: todo
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

- Pin post-06 develop base.
- Confirm coordinator reconciled issue target paths and port names against
  actual 06 output before implementation branches started.
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

- [ ] Every prerequisite issue has independent accepted review.
- [ ] Integration includes one accepted commit per story plus explained overlap
  commit only when required.
- [ ] Node/Svelte tests, svelte-check, and production build pass.
- [ ] Manual ADO and GitHub checks cover connect, refresh, add/remove
  repository, Open, Update, unchanged-current skip, and auth recovery.
- [ ] Existing pre-07 store fixture loads without data loss or manual repair.
- [ ] CLI-auth UX result is recorded; OAuth remains deferred unless evidence
  shows material friction.
- [ ] No token appears in logs, process arguments, persisted data, or browser.
- [ ] No deterministic path requires an agent.
- [ ] Standards has no major finding; Spec has no missing/incorrect finding.
- [ ] Integration reaches develop before any stable-main promotion.
- [ ] Main promotion requires explicit user authorization.

**Blocked by:** 02 through 08

**Blocks:** PRD 08

**Parallel-eligible:** no; dedicated Grok integrator
