---
status: implemented
---

# PRD: App structure

## Problem

The app uses Astro as a Node HTTP/file router around a homemade single-page
application. Its two .astro pages emit the same Loading shell, then viewer.ts
interprets location.pathname, calls history.pushState, fetches JSON, builds
HTML strings, replaces app.innerHTML, and binds interactions. It does not use
Astro layouts, components, islands, or ClientRouter.

The source also lacks server boundaries. viewer.ts mixes browser state, HTTP,
navigation, Home, Guide, Diff, Code Review, keyboard behavior, and rendering.
store.ts mixes JSON IO, review commands, catalog reconciliation, actions, and
summaries. contracts.ts contains every schema family and MCP tool declaration.
Astro routes and MCP reach these modules directly. Astro also reserves
src/actions.ts for its Actions entrypoint, so the current domain module name
breaks the production build by not exporting Astro's expected server object.

Adding two git hosts, authenticated API calls, managed git caches, and inline
comments on this shape would grow the same hotspots and make later changes
harder to review. Splitting frontend and backend into separate products would
add deployment cost without fixing dependency direction.

## Goal

Replace Astro and the homemade SPA with one SvelteKit Node application.
Server-render the initial Home or review page, then hydrate it for interaction
and client navigation. Separate Svelte presentation, server use cases,
persistence, provider IO, and shared pure TypeScript behind explicit
dependencies. Phase 07 and 08 can add provider and comment capabilities
without moving the app or rewriting framework-neutral TypeScript again.

## Non-goals

- New provider, authentication, repository, refresh, diff, or comment behavior
- A separate frontend and backend deployment
- A DI framework, generic BaseRepository, or class for every schema
- Visual redesign, opportunistic polish, or a component library
- Changing Guide chaptering or code-review behavior
- SQLite now
- Preserving every private TypeScript or browser HTTP shape
- Keeping Astro as a permanent shell around one Svelte island
- Turning Guide, Diff, Code Review, or Discussion tabs into separate routes

## User stories

- As a maintainer, I want browser rendering separated from server IO so a UI
  change cannot import filesystem, subprocess, or credentials.
- As a maintainer, I want routes to call feature services so HTTP and MCP do
  not duplicate business rules.
- As a maintainer, I want repositories to expose app operations rather than
  JSON details so a later SQLite adapter does not change service callers.
- As a maintainer, I want provider, auth, and git boundaries established before
  direct host APIs land.
- As a reviewer, I want a filled Home or review page on first response instead
  of an empty shell that waits for client JavaScript and a second data request.
- As a maintainer, I want framework-neutral TypeScript moved rather than
  rewritten so the migration stays reviewable.
- As a maintainer, I want each structural story to leave runnable checks so a
  large file move cannot silently change product behavior.

## Target structure

```text
src/
  routes/
    +layout.svelte
    +page.server.ts
    +page.svelte
    reviews/[id]/
      +page.server.ts
      +page.svelte
    api/.../+server.ts
    mcp/+server.ts
  lib/
    client/
      components/
        home/
        review/
        guide/
        diff/
        outcomes/
      state/
      browser/
    server/
      services/
      repositories/json/
      providers/
        ado/
        github/
      auth/
      git/
      mcp/
    shared/
      contracts/
      domain/
```

Feature names inside a layer describe app capabilities: reviews, catalog,
actions, outcomes, guides, and later comments. They are not separate
deployments.

## Dependency rules

- lib/shared imports no Svelte, SvelteKit, client, server, browser, filesystem,
  subprocess, or provider code.
- lib/client imports Svelte, lib/shared, and browser-safe client modules only.
- Svelte components use TypeScript and built-in Svelte 5 state. No external
  client state library.
- server services depend on shared contracts and narrow ports. They do not
  know JSON layout or raw provider payloads.
- repositories implement app-shaped persistence operations. Callers do not
  know file names, Store v1 layout, cache strategy, or future SQLite schema.
- provider adapters translate provider payloads behind capability-specific
  ports. There is no god GitHost interface.
- +page.server.ts loaders call services for initial Home/review data.
  +server.ts handlers parse transport input, call one service, and map one
  response. Business rules do not live in routes.
- MCP calls the same services as HTTP.
- Functions and narrow interfaces are preferred over framework-managed classes.

## Implementation notes

- Move schema families into shared/contracts: guide and file changes,
  pull-request provenance, catalog and actions, outcomes, persistence formats,
  and MCP tool inputs.
- Move pure overview, Guide/Diff, and outcome projections into shared/domain.
  Browser-safe domain logic remains framework-free.
- Define repository ports from use cases such as upsert a review, replace a
  catalog snapshot, claim an action, append an outcome, and set active review.
  Do not expose generic table or JSON mutation methods.
- Keep Store v1 parsing inside the JSON repository adapter. Existing
  reviews.json data must load without manual repair. If the stored shape
  changes, migrate automatically and test old fixtures.
- Add feature services for reviews, catalog, actions, outcomes, and Guide
  handoff. Current agent-owned behavior remains until PRD 07.
- Move GitHostAdapter and ChapteringAdapter into explicit server ports. Add
  credential-source, provider, and git-cache ports needed by 07 without
  implementing direct host behavior.
- Add SvelteKit, Svelte 5, Vite, and the official Node adapter. Use default SSR
  plus hydration; do not disable SSR for the app.
- During story migration, keep Astro on default npm run dev and localhost:8765.
  Run Svelte work through temporary dev:svelte/build:svelte commands and
  isolated ports 8766+. Integration switches dev, build, start, and port 8765
  to SvelteKit/adapter-node, then removes the temporary aliases and Astro.
- Preserve /, /reviews/:id, all existing /api paths, and /mcp. Home and review
  become real SvelteKit routes. Guide, Diff, Code Review, and later Discussion
  remain internal review tabs so scroll, selection, and drafts stay alive.
- +page.server.ts calls feature services directly for initial data. Hydration
  must reuse serialized page data rather than issue the current duplicate
  first-load fetch.
- Replace viewer.ts HTML-string rendering and manual History API routing with
  typed Svelte components and SvelteKit navigation. Extract reusable pure
  calculations before deleting the old renderer.
- Keep localStorage keys for theme, selected tab, Diff layouts, panel widths,
  hidden unchanged lines, and viewed files. Read browser-only values after
  hydration without changing server/client DOM shape unexpectedly.
- Reuse global CSS for visual parity. Move rules beside components only when
  mechanical and behavior-neutral. Do not adopt a design system.
- Preserve syntax highlighting, keyboard navigation, resizable rails,
  sticky/collapsible Diff behavior, reviewed state, and accessible controls.
- Private TypeScript APIs and browser-only HTTP payloads may change in lockstep.
  Review URLs, persisted user data, MCP tool names/payloads, Guide payloads,
  and visible behavior must work at epic integration.
- Remove Astro, its Node adapter/configuration, duplicate page shells, and
  reserved src/actions.ts collision only after SvelteKit routes pass parity.
- Intermediate commits may be incomplete. Every issue ends green before its
  integration commit is accepted.

## TypeScript reuse map

Move or split; do not rewrite behavior:

- contracts.ts schemas and inferred types into lib/shared/contracts
- guide-view.ts Diff/Guide projections into lib/shared/domain
- overview.ts grouping, route resolution inputs, and Home projection into
  lib/shared/domain
- review-outcome.ts selection/count logic into lib/shared/domain
- store.ts persistence and adoption behavior into repository/domain owners
- actions.ts orchestration into server services
- mcp.ts protocol/dispatch behavior behind the SvelteKit /mcp route
- seed.ts behavior behind server startup/repository ownership
- existing focused Node tests for all modules above

Rewrite at framework boundaries:

- viewer.ts rendering, mutable globals, event delegation, manual navigation,
  boot, and polling become Svelte components/state/browser effects
- index.astro and reviews/[id].astro become SvelteKit pages/loaders
- Astro API route files become behavior-equivalent +server.ts adapters
- astro.config.mjs and Astro dependencies become SvelteKit/Vite configuration

Delete only after caller migration:

- duplicate Guide/FileChange types in viewer.ts
- manual navigate/loadActive first-load routing
- duplicate Loading page shells
- compatibility barrels with no remaining callers

## Testing / seams

**Seams:** shared contracts and domain functions; feature services with
injected repositories and ports; JSON repository compatibility loader;
SvelteKit server loaders/routes; typed Svelte component props and shared review
state; browser-only effects.

**Why these seams:** They establish the dependency direction that later
provider and comment work relies on, while testing migrated presentation at
component and browser boundaries rather than HTML-string internals.

**Good checks:**

- Record that the starting npm test has 102 passing checks and the Astro build
  fails because src/actions.ts does not export the reserved server object.
- Existing Node tests remain; focused Vitest checks cover Svelte state and
  component behavior; one Playwright smoke covers SSR, hydration, and
  navigation.
- An architecture check fails when shared imports Svelte/server/client code,
  client imports Node-only code, or routes contain service logic.
- Existing Store v1 fixtures load through the JSON repository; any migration
  is automatic and lossless.
- SvelteKit HTTP, server loaders, and MCP adapters invoke the same services.
- svelte-check, npm test, focused UI tests, and the SvelteKit production build
  pass.
- Playwright and manual isolated-port smoke cover filled first response,
  hydration, Home/navigation, Guide/Diff, Code Review history, preferences,
  deep reload, and Generate Guide handoff.

## Trade-offs (decided)

- SvelteKit with its Node adapter, not Astro around a homemade SPA.
- Direct cutover inside epic 06, not a permanent or staged hybrid architecture.
- Default SSR plus hydration, not client-only Loading-first SPA.
- One review URL with internal tabs, not one route per display mode.
- Existing visual design and CSS first, not migration-time polish or a
  component library.
- One layered monolith, not separate frontend/backend apps.
- Conventional client/server/shared boundaries, not a full repeated
  domain/application/infrastructure tree for each capability.
- Feature-oriented services and app-shaped repositories, not generic CRUD.
- Structural seams now, provider behavior later.
- Stable product behavior at integration gates; flexible private internals.
- Automatic compatibility over silent local-data loss.

## Success criteria

- / and /reviews/:id return server-rendered Home/review data and hydrate into
  an interactive app without a duplicate first-load data request.
- Existing /api and /mcp URLs, methods, payloads, and error behavior continue
  to work through thin SvelteKit adapters over shared services.
- Source follows the documented SvelteKit/lib target boundaries and import
  direction.
- viewer.ts is removed. store.ts and contracts.ts no longer own unrelated
  persistence, command, and schema responsibilities.
- Astro packages/config/pages are removed and the production build passes.
- npm run dev serves the SvelteKit app at http://localhost:8765 and the
  existing POST /mcp endpoint remains at the same origin.
- npm start runs the adapter-node production build with the same default
  host/port and supports an isolated HOST/PORT override for checks.
- JSON persistence is hidden behind repository operations shaped around app
  needs.
- Provider, credential, git-cache, and Guide chaptering ports have explicit
  ownership without direct provider implementation.
- Existing reviews.json data loads or migrates automatically with no lost
  guides, catalog entries, actions, or outcomes.
- Home, navigation, Guide, Diff, Code Review, Generate Guide, syntax
  highlighting, keyboard controls, reviewed state, layouts, rails, and saved
  preferences preserve behavior and appearance through automated/manual
  checks.
- No phase 07 or 08 product behavior lands in this PRD.

## Out of scope

- ADO/GitHub REST calls and managed git caches ([07 Provider API
  automation](../07-provider-api-automation/))
- Host comments ([08 Inline git-host
  comments](../08-inline-git-host-comments/))
- Svelte UI polish after parity; capture requirements later without reserving
  PRD 09 now
- Webhooks, remote hosting, multi-user auth, analytics, search, votes, or merge

## References

- [01 Guided PR review](../done/01-guided-pr-review/)
- [04 Pull request overview](../done/04-pull-request-overview/)
- [SvelteKit migration research](research.md)
- [SvelteKit routing](https://svelte.dev/docs/kit/routing)
- [SvelteKit page options](https://svelte.dev/docs/kit/page-options)
- [SvelteKit Node adapter](https://svelte.dev/docs/kit/adapter-node)
- [Svelte TypeScript](https://svelte.dev/docs/svelte/typescript)
- Current hotspots: src/viewer.ts, src/store.ts, src/contracts.ts, src/actions.ts
- Grill decisions: direct SvelteKit cutover, SSR then hydration, internal
  review tabs, behavior/visual parity, no UI library

## integration-review

Date: 16 September 2026

base: e58839e61237e1bac403a607abb0b964601e2ff7
head: 44023083daa32d4f09ab47d7cbbd52a8a5da63a0
branch: feature/06-app-structure

History: 13 Merged commits, one per story 06-01 through 06-13, plus one overlap
commit b8d4cad19ebdd716393a63fc9852b8c531da3ecb Adapt Diff keep-alive test to
GuideView keep-alive.

Not blocking. Standards has no major. Spec has no missing or incorrect finding.

Story minors that no longer apply at this head are omitted: 06-04 early delete
of src/actions.ts is now the required cutover state; 06-09 Guide spy-while-hidden
and 06-11 stale refresh overlay are fixed. The 06-13 smoke note that
HOST=localhost listened on ::1 rather than 127.0.0.1 is environmental Node
bind behavior, not a product miss of the HOST/PORT override.

### Standards

major 0 / minor 5 / nit 3

- severity: minor
  title: Architecture import rules miss relative sibling-layer paths
  location: scripts/check-architecture.ts
  explanation: The check classifies files under src/lib/shared, src/lib/client,
  and src/routes, then compares each import specifier to alias and package
  patterns such as $lib/server and node:fs. A shared or client module can still
  import a forbidden layer with a relative path into src/lib/server or
  src/lib/client. HEAD source inspected for that shape does not do so, so this
  does not fail the import-direction success criterion. The executable policy
  still looks stricter than it is. Documented on 06-01; still true.

- severity: minor
  title: Extra-function route rule is untested and skips common handlers
  location: scripts/check-architecture.ts
  explanation: checkArchitecture flags extra function names in +page.server.ts
  and +server.ts. The suite proves a shared svelte import fails, the scaffold
  is clean, and Astro runtime files are gone. Nothing fails for
  route-heavy-logic. The const-arrow matcher also requires a simple parameter
  list, so a handler written as an async arrow with a destructured argument is
  not seen as a function. Product routes at HEAD are thin re-exports, so this
  is a checker gap, not a route-logic miss. Documented on 06-01; still true.

- severity: minor
  title: CSRF star origin is unused for JSON MCP and API
  location: svelte.config.js
  explanation: kit.csrf.trustedOrigins is still ["*"]. SvelteKit origin checks
  run in production and only for form content types. Existing /api and /mcp
  clients send JSON, so they never hit that check. After 06-13, npm start is
  the adapter-node production server, so the star list now disables production
  form CSRF on the product runtime before any form client exists. It is not
  required for the HTTP/MCP contract. Documented on 06-05; still true.

- severity: minor
  title: Home list refresh can refill leftover state after leaveHome
  location: src/lib/client/state/home.svelte.ts
  explanation: leaveHome clears listed, pendingActionId, and the watch timer.
  refreshHomeList still applyList after await. A tick that started while Home
  was mounted can finish after destroy and write listed again. The next visit
  to / then prefers that snapshot over the loader payload. Deep reload still
  resets the module. First hydration still uses serialized page data. Documented
  on 06-07 and 06-12; still true. Does not fail filled first-load SSR.

- severity: minor
  title: Playwright keyboard smoke does not fail when j is a no-op
  location: e2e/interaction-parity.spec.ts
  explanation: After switching to Guide, the smoke reads the current file-pill
  path, presses j, and accepts either an unchanged path or any truthy pathAfter.
  That passes when reading-order movement never runs. The production keydown
  path is exercised in Vitest via bindReviewChrome. Rails, tabs, prefs, reload,
  and navigation still have real assertions. Documented on 06-12; still true.

- severity: nit
  title: Hydration fetch assertion overlaps the existing review-shell test
  location: src/lib/client/components/shell.svelte.test.ts
  explanation: The review-shell test already stubs fetch and asserts it is not
  called when AppShell receives review page data. The hydration test repeats
  that review assertion and adds a Home case. Both mount AppShell with fakes;
  neither runs +page.server.ts. Documented on 06-05; still true.

- severity: nit
  title: Diff scroll spy duplicates the shared spyCurrent action
  location: src/lib/client/components/diff/DiffView.svelte
  explanation: spyCurrent exists for Code Review observers. DiffView still
  binds the same IntersectionObserver, rootMargin, and disconnect lifecycle in
  a local spyFiles action. Behavior matches the old observeMain path. The copy
  will drift if one helper changes. Documented on 06-12; still true.

- severity: nit
  title: Migration-proof route remains after the Astro cutover
  location: src/routes/migration-proof
  explanation: 06-01 added /migration-proof as a minimal SSR/hydration scaffold.
  Product Home and review routes now provide that proof. The extra public route
  still renders a click-counter page and is not a preserved product URL. 06-13
  did not require its removal. Harmless leftover, not 07 or 08 behavior.

### Spec

missing 0 / partial 0 / scope-creep 0 / incorrect 0

findings: []

HEAD meets the 06 success criteria and 06-13 acceptance criteria graded here.
SvelteKit plus adapter-node is the only runtime. Astro packages, config, pages,
viewer.ts, and src/actions.ts are gone. npm run dev/build/start are SvelteKit;
dev and start default to localhost:8765; start honors HOST/PORT; POST /mcp is
same origin. Home and review SSR then hydrate without a duplicate first-load
data request; Guide, Diff, and Code Review stay internal tabs. Source follows
lib/client, lib/server, lib/shared, and routes with JSON repositories, feature
services, and provider/auth/git/chaptering ports and no 07/08 product behavior.
Public /, /reviews/:id, /api, and /mcp are preserved. Root store.ts and
contracts.ts are gone. Visual CSS is the reused global sheet, not a design
system.
