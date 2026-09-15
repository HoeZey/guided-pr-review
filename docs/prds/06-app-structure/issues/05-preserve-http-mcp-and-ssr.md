---
status: todo
blocked_by:
  - 01-lock-sveltekit-migration
  - 03-introduce-repositories
  - 04-introduce-services-and-ports
blocks:
  - 07-render-ssr-home
  - 08-build-code-view-primitives
  - 09-port-guide-view
  - 10-port-diff-view
  - 11-port-outcomes-and-guide-handoff
  - 13-integrate-sveltekit-cutover
---

# Preserve HTTP, MCP, and SSR data in SvelteKit

**Type:** Story

**From PRD:** [06 App structure](../)

**Seam(s):** +page.server.ts loaders; +server.ts handlers; shared feature
services; HTTP/MCP contract fixtures

**What it delivers:** Existing browser and skill clients keep their URLs and
payloads while SvelteKit can server-render Home/review data without a duplicate
first-load fetch.

**Scope (in):**

- Implement / and /reviews/[id] server loaders through review/catalog/outcome
  services.
- Implement behavior-equivalent +server.ts handlers for every existing /api
  method and nested path.
- Implement /mcp GET/POST through the existing MCP protocol and shared
  services.
- Serve these paths from the temporary dev:svelte runtime on an explicit
  8766+ port until issue 13 switches the default entrypoint. Do not proxy or
  mount SvelteKit inside Astro.
- Keep status codes, JSON payloads, validation, seeding, stable review ids,
  and structured errors compatible.
- Return serializable Home/review page data once during SSR so hydration does
  not call the list/get endpoint again.
- Keep browser mutation endpoints available for interaction stories and PRD
  07.
- Add request-level contract tests with isolated data.

**Scope (out):**

- Rendering final Home/review components
- Provider APIs, managed caches, or comments
- Renaming public routes
- SvelteKit form actions that replace established /api contracts

**Touches:** src/routes, old src/pages adapters, lib/server services, MCP
handler, route contract tests

**Acceptance criteria:**

- [ ] /, /reviews/:id, every existing /api method/path, and /mcp resolve under
  npm run dev:svelte and the SvelteKit production build.
- [ ] HTTP/MCP adapters contain parsing/response mapping only.
- [ ] HTTP and MCP invoke the same service behavior for shared commands.
- [ ] SSR loaders call services directly and serialize no Store v1, filesystem
  path, provider payload, or credential.
- [ ] Hydration consumes page data without a duplicate initial review/catalog
  request.
- [ ] Unknown review preserves current Home fallback/recovery behavior.
- [ ] Existing route/MCP contract fixtures pass without live port 8765.
- [ ] npm run dev and localhost:8765 still run the old Astro product; Svelte
  story checks use dev:svelte on unique 8766+ ports until issue 13.

**Blocked by:** 01, 03, and 04

**Blocks:** 07, 08, 11, and 13

**Parallel-eligible:** no
