---
status: done
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

- [x] /, /reviews/:id, every existing /api method/path, and /mcp resolve under
  npm run dev:svelte and the SvelteKit production build.
- [x] HTTP/MCP adapters contain parsing/response mapping only.
- [x] HTTP and MCP invoke the same service behavior for shared commands.
- [x] SSR loaders call services directly and serialize no Store v1, filesystem
  path, provider payload, or credential.
- [x] Hydration consumes page data without a duplicate initial review/catalog
  request.
- [x] Unknown review preserves current Home fallback/recovery behavior.
- [x] Existing route/MCP contract fixtures pass without live port 8765.
- [x] npm run dev and localhost:8765 still run the old Astro product; Svelte
  story checks use dev:svelte on unique 8766+ ports until issue 13.

**Blocked by:** 01, 03, and 04

**Blocks:** 07, 08, 11, and 13

**Parallel-eligible:** no

## code-review

Pass: 16 September 2026

base: 9718747274c35724f7ad352e39cc93100e7dea00
head: 5ddf47ef590d1d1e7b7daae5175d50d04fa0b40b
branch: feature/06-05-preserve-http-mcp-and-ssr

Not blocking. Standards has no major. Spec has no missing or incorrect.

### Standards

major 0 / minor 1 / nit 1

- severity: minor
  title: CSRF star origin is unused for JSON MCP and API
  location: svelte.config.js (kit.csrf.trustedOrigins)
  reference:
    source: svelte.config.js; node_modules/@sveltejs/kit/src/runtime/server/respond.js CSRF form-content-type check; docs/prds/06-app-structure/issues/05-preserve-http-mcp-and-ssr.md Scope (out)
    quote: SvelteKit CSRF checks only apply in production, not in local development. If the array contains '*', all origins will be trusted. This is generally not recommended! SvelteKit CSRF only rejects form content types. No SvelteKit form actions that replace established /api contracts.
  explanation: SvelteKit origin checks run only in production and only for form content types (urlencoded, multipart, text/plain). Existing /api and /mcp clients send JSON, so they never hit that check. trustedOrigins ["*"] is the documented switch that turns the form check off for every mutating route. This product stays local-only (dev:svelte binds localhost:8766; default npm run dev stays Astro on localhost:8765). Issue 05 also forbids form actions in place of /api. The star list is not required for the HTTP/MCP contract and it disables production form CSRF before any form client exists.
  recommendation: Remove the csrf.trustedOrigins block. If a later story adds form-encoded clients, list explicit origins or add a ponytail comment that names the localhost ceiling.

- severity: nit
  title: Hydration fetch assertion overlaps the existing review-shell test
  location: src/lib/client/components/shell.svelte.test.ts (hydration consumes Home and review page data)
  explanation: The earlier review-shell test already stubs fetch and asserts it is not called when AppShell receives review page data. The new test repeats that review assertion and adds a Home case. Both mount AppShell with fakes; neither runs +page.server.ts.
  recommendation: Keep the Home fetch assertion on the existing shell test and drop the duplicate case.

### Spec

missing 0 / partial 0 / scope-creep 0 / incorrect 0

findings: []
