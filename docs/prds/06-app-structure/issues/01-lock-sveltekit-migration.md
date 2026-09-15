---
status: todo
blocked_by: []
blocks:
  - 02-split-shared-contracts-and-domain
  - 05-preserve-http-mcp-and-ssr
---

# Lock the SvelteKit migration and regression baseline

**Type:** Story

**From PRD:** [06 App structure](../)

**What it delivers:** Maintainers and implementation agents have one exact
reuse/move/rewrite map, dependency policy, verified baseline, and runnable
SvelteKit Node scaffold before product routes move.

**Scope (in):**

- Record every current src module as move/reuse, framework-boundary rewrite, or
  delete-after-cutover under the PRD target.
- State allowed imports and forbidden dependencies from the PRD.
- Identify stable product contracts: review URLs, Guide payloads, MCP tool
  names/payloads, persisted user data, and visible behavior at integration.
- Capture the 102-pass npm test baseline and the existing Astro build failure
  caused by reserved src/actions.ts.
- Add current stable SvelteKit, Svelte 5, Vite, adapter-node, svelte-check,
  focused Vitest, and Playwright configuration without a UI library.
- Add a minimal typed SSR/hydration proof and standalone Node production build
  on an isolated route/configuration. Add temporary npm run dev:svelte and npm
  run build:svelte commands; Svelte stories run dev:svelte on ports 8766+.
  Keep default npm run dev and product port 8765 on Astro until issue 13.
- Add the smallest runnable architecture check that catches forbidden layer
  imports and heavy logic in routes.
- Add isolated-port manual smoke instructions that never touch port 8765 or
  live reviews.json.

**Scope (out):**

- Moving product routes or feature modules
- Fixing unrelated bugs
- Adding provider or comment behavior
- New architecture-analysis dependencies when a small script or test suffices

**Touches:** migration/reuse documentation, package and SvelteKit/Vite/test
configuration, minimal scaffold, architecture check

**Acceptance criteria:**

- [ ] Every existing src file has one documented target owner.
- [ ] Allowed import direction is executable as a check.
- [ ] Check fails on one proved forbidden-import fixture and passes on
  scaffold.
- [ ] npm test reports 102 passes on pinned develop and story head.
- [ ] Existing Astro build failure and exact reserved-entrypoint cause are
  recorded rather than attributed to SvelteKit.
- [ ] Minimal SvelteKit SSR/hydration proof passes svelte-check, focused test,
  and standalone Node production build.
- [ ] npm run dev remains Astro on localhost:8765; npm run dev:svelte exposes
  only the migration runtime on an explicit isolated port.
- [ ] Manual smoke uses isolated data and a non-8765 port.
- [ ] No production behavior changes.

**Blocked by:** none

**Blocks:** 02 Split shared contracts and pure domain rules

**Parallel-eligible:** no
