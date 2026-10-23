# Research: SvelteKit migration

Checked 16 September 2026. Primary framework sources plus current source graph.

## Framework fit

[SvelteKit routing](https://svelte.dev/docs/kit/routing) defines filesystem
routes with +page.svelte, server-only page loaders with +page.server.ts, shared
layouts, and HTTP verb handlers with +server.ts. This covers the current Home,
review, /api, and /mcp surfaces in one Node application.

[SvelteKit page options](https://svelte.dev/docs/kit/page-options) documents the
default model selected for this product: initial HTML is server-rendered, then
hydrated into an interactive client and subsequent navigation is handled by
the client router. Do not set application-wide ssr false.

[SvelteKit Node adapter](https://svelte.dev/docs/kit/adapter-node) produces a
standalone Node server and handler. It replaces the current Astro Node adapter
without creating a separate frontend/backend deployment.

[Svelte TypeScript](https://svelte.dev/docs/svelte/typescript) supports typed
component scripts. [Svelte 5 state](https://svelte.dev/docs/svelte/$state/)
provides built-in reactive state, including reusable .svelte.ts modules. No
external state library is needed for this app.

[SvelteKit integrations](https://svelte.dev/docs/kit/integrations) lists
official Vitest and Playwright setup. Preserve existing Node tests; use focused
Svelte tests for rewritten component/state behavior and one browser smoke for
SSR/hydration/navigation.

## Why not retain Astro

[Astro on-demand
rendering](https://docs.astro.build/en/guides/on-demand-rendering/) supports
server routes and dynamic pages, but Astro's differentiator is server-rendered
HTML with selectively hydrated islands. This product's Home, Guide, Diff,
outcomes, tabs, preferences, rails, keyboard navigation, and comments form one
connected interactive surface.

[Astro ClientRouter](https://docs.astro.build/en/guides/view-transitions/)
fetches the next server-rendered page and swaps document content. The current
app instead has two duplicate Astro shells and a manual History API SPA. Adding
one large Svelte island would leave Astro as a redundant outer router; multiple
islands would make shared review state harder.

## Current source evidence

viewer.ts owns:

- duplicate Guide/FileChange types
- localStorage preferences and mutable global UI state
- manual pushState/popstate navigation
- first-load and two-second JSON fetching
- Home, Guide, Diff, and Code Review HTML strings
- syntax painting, rails, file navigation, keyboard controls, and DOM binding

index.astro and reviews/[id].astro both emit Loading and call viewer.boot.
Astro does not render product content. No layouts, Astro components, islands,
or ClientRouter are present.

The current production build fails because Astro reserves src/actions.ts as an
Actions entrypoint and expects a server export. Existing npm test passes 102
checks. Phase 06 records both before migration.

## Reuse conclusions

Framework-neutral TypeScript remains TypeScript:

- contracts.ts schemas and types
- guide-view.ts file, hunk, split/unified, token-overlay, viewed-state, and
  navigation functions
- overview.ts grouping, lifecycle, repository badge, freshness, and range
  projection
- review-outcome.ts history selection and finding counts
- store.ts JSON, adoption, review, catalog, action, and outcome behavior after
  separation into domain/repository/service owners
- actions.ts orchestration after moving away from Astro's reserved root path
- mcp.ts protocol/dispatch behavior
- seed.ts initialization behavior
- current focused tests

Framework boundary code changes:

- viewer.ts HTML rendering and event binding become Svelte components
- viewer.ts manual navigation becomes SvelteKit routes/navigation
- viewer.ts mutable UI state becomes component or shared Svelte state
- Astro pages become +page.svelte and +page.server.ts
- Astro endpoints become +server.ts wrappers around the same services
- Astro configuration/dependencies become SvelteKit/Vite/adapter-node

## Migration constraints

- Direct cutover within epic 06; no permanent Astro/Svelte hybrid.
- During story work only, Astro remains default on localhost:8765 while
  SvelteKit runs through temporary migration commands on isolated ports.
  Integration flips dev/build/start to the one adapter-node product entrypoint
  and removes Astro.
- Preserve /, /reviews/:id, /api, and /mcp contracts.
- Keep review modes as internal tabs.
- Preserve current visual design and global CSS first.
- Browser-only preferences apply after hydration without mismatched initial DOM.
- Remove Astro only after full SvelteKit parity, not during initial scaffold.
- UI polish is later scope after isolated components make it cheaper.
