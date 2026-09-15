---
status: todo
blocked_by:
  - 03-introduce-repositories
  - 04-introduce-services-and-adapters
  - 05-split-browser-client
blocks:
  - ../../07-provider-api-automation/
---

# Integrate and verify app structure

**Type:** Story

**From PRD:** [06 App structure](../)

**Seam(s):** full dependency graph; persisted-data compatibility; browser and
MCP boundaries

**What it delivers:** One reviewed feature/06-app-structure branch that
satisfies the complete structural contract and can safely become develop.

**Scope (in):**

- Continue the existing feature/06-app-structure branch created from the
  immutable develop SHA; do not reset or replay already integrated stories.
- Verify one accepted integration commit exists for each story in dependency
  order.
- Reconcile repository/service routes with client API modules.
- Resolve only overlap needed to preserve accepted story contracts.
- Remove compatibility barrels or dead modules only when all callers moved.
- Run complete automated, architecture, persistence, build, and browser checks.
- Record fixed base/head Standards and Spec integration review in PRD README.

**Scope (out):**

- New provider behavior or comments
- Opportunistic UI cleanup
- Redesigning accepted issue contracts
- Merging directly to main before develop acceptance

**Touches:** feature/06-app-structure integration branch, 06 PRD review record,
any conflict files

**Acceptance criteria:**

- [ ] Every prerequisite story has an accepted independent review.
- [ ] Integration history contains one accepted commit per story plus at most
  one explained overlap commit.
- [ ] npm test, npm run build, architecture check, and old-store compatibility
  checks pass.
- [ ] Legacy viewer.ts, store.ts, and contracts.ts are removed or thin
  documented re-export/boot shims; none retain mixed responsibilities.
- [ ] Isolated browser smoke covers Home, saved reviews, Guide, Diff, Code
  Review, and Generate Guide handoff.
- [ ] Standards review has no major finding.
- [ ] Spec review has no missing or incorrect finding.
- [ ] Integration fast-forwards or merges to develop only after all checks.
- [ ] Stable main promotion requires explicit user authorization.

**Blocked by:** 03 repositories, 04 services, and 05 browser client

**Blocks:** PRD 07

**Parallel-eligible:** no; dedicated integrator
