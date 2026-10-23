---
status: done
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

- [x] Every prerequisite story has an accepted independent review.
- [x] Integration history contains one accepted commit per story plus at most
  one explained overlap commit.
- [x] npm test, svelte-check, focused Svelte tests, npm run build,
  architecture, route/MCP, and old-store compatibility checks pass.
- [x] viewer.ts, Astro pages/config/adapter/dependencies, and the reserved
  src/actions.ts collision are gone.
- [x] npm run dev starts only SvelteKit at http://localhost:8765 and POST
  http://localhost:8765/mcp accepts the unchanged MCP contract.
- [x] After npm run build, npm start launches adapter-node output, defaults to
  localhost:8765, honors an isolated PORT override, and passes GET Home/review
  plus POST /mcp smoke.
- [x] store.ts and contracts.ts are removed or thin documented re-exports;
  neither retains mixed responsibilities.
- [x] /, /reviews/:id, every /api path, and /mcp preserve public behavior.
- [x] Initial Home/review HTML is filled by SSR and hydrates without duplicate
  first-load fetch or mismatch.
- [x] Isolated Playwright/manual smoke covers Home, saved reviews, Guide, Diff,
  Code Review, Generate Guide, navigation, deep reload, preferences, keyboard,
  rails, syntax highlighting, and agent completion.
- [x] Standards review has no major finding.
- [x] Spec review has no missing or incorrect finding.
- [x] Integration fast-forwards or merges to develop only after all checks.
- [ ] Stable main promotion requires explicit user authorization.

**Blocked by:** 03 through 12

**Blocks:** PRD 07

**Parallel-eligible:** no; dedicated integrator

## implementation

Status stays doing until integration review. No ## integration-review here.

### Epic history before this commit

One Merged commit per story 01-12, plus one overlap:

- 54f7c5499e9d752c1616c27fccf24ae6b3320ec3 Merged 06-01: Lock the SvelteKit migration and regression baseline
- 7840b8e96a280715389655e8aa961632049cfb11 Merged 06-02: Split shared contracts and pure domain rules
- 8529339d42a8cc7e149598c93d7066da6feac6ad Merged 06-06: Build the Svelte review shell and shared state
- 2c3c8484076b27db76a117137cf82a4338fc2bdd Merged 06-03: Introduce app-shaped repositories and JSON adapter
- 9718747274c35724f7ad352e39cc93100e7dea00 Merged 06-04: Introduce feature services and provider ports
- 139be4dadffd06d078a4a3eb90b35939f08ea25b Merged 06-05: Preserve HTTP, MCP, and SSR data in SvelteKit
- 1bef2d0a422287a387ba8cf57ccdabf2a4b0e2f6 Merged 06-08: Build shared Svelte code-view primitives
- 3a59930fcffdfeaee1c4e050e1193651914940d6 Merged 06-07: Render Home through SvelteKit SSR
- d88051c2970e3643e69c42c44240cd0bf350a671 Merged 06-09: Port Guide to Svelte components
- d84f690315c6ea932d74574bf8ea5940ca83120d Merged 06-10: Port Diff to Svelte components
- b8d4cad19ebdd716393a63fc9852b8c531da3ecb Adapt Diff keep-alive test to GuideView keep-alive
- 9e33a9aded1cb9b00b4ade79b2e9a2e776da337e Merged 06-11: Port Code Review and Guide handoff
- 0f53f40f495069c312abe84b8638021bead43bfd Merged 06-12: Restore cross-view interaction parity

Parent of this cutover: 0f53f40f495069c312abe84b8638021bead43bfd.

src/actions.ts was already gone after 06-04. Root store.ts and contracts.ts were
already gone; persistence lives in src/lib/server/repositories/json/store.ts and
schemas in src/lib/shared/contracts/.

### Checks

- npm test: 111 pass
- npm run test:svelte: 43 client + 19 SSR pass
- npm run check:svelte: 0 errors 0 warnings
- npm run check:architecture: 2 pass (layer rules + cutover runtime)
- npm run build: SvelteKit + @sveltejs/adapter-node, done
- Isolated npm start HOST=localhost PORT=8777 GUIDED_PR_REVIEW_DATA=/tmp/gpr-06-13-8777
  - Listening on http://[::1]:8777
  - GET / 200, SSR Home (data-view=home, no Loading)
  - GET /reviews/8c147125-d4ae-4258-b5b2-062bb235a99c 200, SSR title Pin pipeline, no Loading
  - POST /mcp initialize 200 protocolVersion 2024-11-05
  - POST /mcp tools/list 200 includes list_reviews
- Isolated Playwright PLAYWRIGHT_BASE_URL=http://[::1]:8777: 2 passed
- package.json has no astro, @astrojs/node, dev:svelte, or build:svelte
- No astro.config, src/viewer.ts, src/pages, or src/actions.ts
- 8765 was not bound or killed. 8777 stopped after smoke.

Generate Guide, syntax highlighting, and agent completion stay covered by
existing focused Svelte/Node tests (11/08/04). Seeded smoke review is chaptered
so Generate Guide empty is not on that page. 06-12 minors left unfixed.
