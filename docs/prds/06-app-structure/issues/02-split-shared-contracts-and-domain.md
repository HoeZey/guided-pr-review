---
status: todo
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
src/review-outcome.ts, related tests, new src/shared modules

**Acceptance criteria:**

- [ ] Schema families have one owner and no circular imports.
- [ ] lib/shared imports no routes, Svelte, SvelteKit, client, server, Node IO,
  or provider code.
- [ ] Existing schema rejection and pure-projection tests still pass.
- [ ] Browser and server can import required types without duplicate Guide
  shapes.
- [ ] No visible behavior or persisted shape changes.
- [ ] Architecture check passes.

**Blocked by:** 01 Lock the SvelteKit migration and regression baseline

**Blocks:** 03 repositories and 06 Svelte review shell

**Parallel-eligible:** no
