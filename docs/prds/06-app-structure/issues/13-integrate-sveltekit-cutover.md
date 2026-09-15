---
status: todo
blocked_by:
  - 03-introduce-repositories
  - 04-introduce-services-and-ports
  - 05-preserve-http-mcp-and-ssr
  - 06-build-svelte-review-shell
  - 07-render-ssr-home
  - 08-build-code-view-primitives
  - 09-port-guide-view
  - 10-port-diff-view
  - 11-port-outcomes-and-guide-handoff
  - 12-restore-interaction-parity
blocks:
  - ../../07-provider-api-automation/
---

# Integrate the SvelteKit cutover and remove Astro

**Type:** Story

**From PRD:** [06 App structure](../)

**Seam(s):** SvelteKit production entrypoint; full dependency graph;
persisted/public-contract compatibility; SSR/hydration/browser boundary

**What it delivers:** One reviewed feature/06-app-structure branch that
satisfies the complete structural contract and can safely become develop.

**Scope (in):**

- Continue the existing feature/06-app-structure branch created from the
  immutable develop SHA; do not reset or replay already integrated stories.
- Verify one accepted integration commit exists for each story in dependency
  order.
- Reconcile repository/service routes with client API modules.
- Resolve only overlap needed to preserve accepted story contracts.
- Replace default npm run dev, npm run build, and npm start with
  SvelteKit/adapter-node. dev/start default to the existing
  http://localhost:8765 product URL, honor HOST/PORT overrides for isolated
  checks, and keep POST /mcp; remove temporary dev:svelte/build:svelte
  migration aliases after callers move.
- Remove Astro packages, adapter, configuration, pages, duplicate shells,
  viewer.ts, and compatibility barrels only when all callers moved.
- Run Node, Svelte, architecture, persistence, route/MCP, production build, and
  browser checks.
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
- [ ] npm test, svelte-check, focused Svelte tests, npm run build,
  architecture, route/MCP, and old-store compatibility checks pass.
- [ ] viewer.ts, Astro pages/config/adapter/dependencies, and the reserved
  src/actions.ts collision are gone.
- [ ] npm run dev starts only SvelteKit at http://localhost:8765 and POST
  http://localhost:8765/mcp accepts the unchanged MCP contract.
- [ ] After npm run build, npm start launches adapter-node output, defaults to
  localhost:8765, honors an isolated PORT override, and passes GET Home/review
  plus POST /mcp smoke.
- [ ] store.ts and contracts.ts are removed or thin documented re-exports;
  neither retains mixed responsibilities.
- [ ] /, /reviews/:id, every /api path, and /mcp preserve public behavior.
- [ ] Initial Home/review HTML is filled by SSR and hydrates without duplicate
  first-load fetch or mismatch.
- [ ] Isolated Playwright/manual smoke covers Home, saved reviews, Guide, Diff,
  Code Review, Generate Guide, navigation, deep reload, preferences, keyboard,
  rails, syntax highlighting, and agent completion.
- [ ] Standards review has no major finding.
- [ ] Spec review has no missing or incorrect finding.
- [ ] Integration fast-forwards or merges to develop only after all checks.
- [ ] Stable main promotion requires explicit user authorization.

**Blocked by:** 03 through 12

**Blocks:** PRD 07

**Parallel-eligible:** no; dedicated integrator
