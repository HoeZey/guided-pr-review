---
status: done
blocked_by:
  - 01-lock-sveltekit-migration
blocks:
  - 03-introduce-repositories
  - 04-introduce-services-and-ports
  - 06-build-svelte-review-shell
  - 08-build-code-view-primitives
---

# Split shared contracts and pure domain rules

**Type:** Story

**From PRD:** [06 App structure](../)

**Seam(s):** shared/contracts export surface; shared/domain pure functions

**What it delivers:** Server and client consume small schema and pure-rule
modules without importing a root contracts or view-helper monolith.

**Scope (in):**

- Move/split contracts.ts under lib/shared/contracts by guide/file changes,
  pull-request provenance,
  catalog/actions, outcomes, persistence formats, and MCP tool inputs.
- Move overview, Guide/Diff, and outcome projections from overview.ts,
  guide-view.ts, and review-outcome.ts into capability modules under
  lib/shared/domain without behavior rewrites.
- Separate browser/server-neutral runtime schemas from transport-only tool
  declarations.
- Keep one intentional shared export surface and update imports to owning
  modules.
- Move focused tests beside their owning shared modules or document the chosen
  test convention.

**Scope (out):**

- Service orchestration or persistence
- ADO/GitHub payloads
- Browser rendering changes
- Rewriting working pure algorithms

**Touches:** src/contracts.ts, src/overview.ts, src/guide-view.ts,
src/review-outcome.ts, related tests, src/lib/shared/contracts,
src/lib/shared/domain

Issue Touches originally said new src/shared modules. PRD target owners and
this issue Scope say lib/shared under src/lib/shared/. This story uses
src/lib/shared/contracts and src/lib/shared/domain. There is no second
src/shared tree.

**Acceptance criteria:**

- [x] Schema families have one owner and no circular imports.
- [x] lib/shared imports no routes, Svelte, SvelteKit, client, server, Node IO,
  or provider code.
- [x] Existing schema rejection and pure-projection tests still pass.
- [x] Browser and server can import required types without duplicate Guide
  shapes.
- [x] No visible behavior or persisted shape changes.
- [x] Architecture check passes.

**Blocked by:** 01 Lock the SvelteKit migration and regression baseline

**Blocks:** 03 repositories and 06 Svelte review shell

**Parallel-eligible:** no

## Implementation notes

Callers import owning modules. No root src/contracts.ts barrel remains.

Contract families:

- guide.ts — Guide v1, chapters, file changes, hunks
- provenance.ts — pull-request source, host check, sync key, SHA
- catalog.ts — catalog snapshots, configured repos, stored/queue actions
- outcomes.ts — CodeReviewOutcome v1 and stored runs
- persistence.ts — Store v1, review records, list snapshot, emptyStore
- tools.ts — MCP tool input/output declarations only

Domain modules: overview.ts, guide-view.ts, outcomes.ts.

Test convention: focused Node tests sit beside those modules under
src/lib/shared. store.test.ts and actions.test.ts stay at src/ until later
stories move orchestration. npm test globs src/lib/shared/**/*.test.ts plus
those two remaining src files.

viewer.ts still has local Guide/FileChange presentation types (including
chapter _omitted). Those are delete-after-cutover in 01; this story does not
rewrite viewer HTML. Shared GuideV1 lives in one place:
src/lib/shared/contracts/guide.ts.

## code-review

Pass: 16 September 2026

base: 54f7c5499e9d752c1616c27fccf24ae6b3320ec3
head: 55ad492fcb05b1d144f4373bd12c9b9dd804df31
branch: feature/06-02-split-shared-contracts-and-domain

Not blocking. Standards has no major. Spec has no missing or incorrect.

### Standards

major 0 / minor 0 / nit 0

findings: []

### Spec

missing 0 / partial 0 / scope-creep 0 / incorrect 0

findings: []
