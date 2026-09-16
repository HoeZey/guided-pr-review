---
status: done
blocked_by:
  - 02-split-shared-contracts-and-domain
blocks:
  - 07-render-ssr-home
  - 08-build-code-view-primitives
  - 09-port-guide-view
  - 10-port-diff-view
  - 11-port-outcomes-and-guide-handoff
  - 13-integrate-sveltekit-cutover
---

# Build the Svelte review shell and shared state

**Type:** Story

**From PRD:** [06 App structure](../)

**Seam(s):** root layout; review shell props/context; built-in Svelte state;
SSR-safe browser preference adapter; SvelteKit navigation

**What it delivers:** Home and review view stories receive one typed,
SSR-compatible Svelte shell, navigation model, tab state, and browser-effect
boundary instead of viewer.ts globals.

**Scope (in):**

- Build root Svelte layout, shared header/chrome, Home/review navigation, review
  tab bar, loading/error surfaces, and typed page-data boundaries.
- Keep / and /reviews/:id as SvelteKit routes. Keep Guide, Diff, Code Review,
  and future Discussion as internal tabs.
- Define built-in Svelte 5 state modules for active review, current tab,
  layout/preferences, viewed/collapsed files, and in-flight UI operations.
- Define SSR-safe preference defaults and browser-only localStorage hydration.
- Extract browser fetch/error mapping for post-hydration mutations.
- Replace duplicate handwritten Guide types with browser-safe shared
  contracts.
- Reuse current global CSS and DOM structure needed for visual parity.
- Provide fake page data/slots so 07–10 can develop independently.

**Scope (out):**

- Visual redesign
- Comment UI from feature/post-ado-comments
- External state library
- Final Home, Guide, Diff, or Code Review rendering
- Keyboard/file/rail interactions owned by 12
- Splitting CSS solely for folder symmetry

**Touches:** src/routes/+layout.svelte, lib/client shell/state/browser modules,
src/styles/global.css, typed component tests

**Acceptance criteria:**

- [x] Root layout and review shell SSR/hydrate without DOM mismatch.
- [x] SvelteKit handles Home/review navigation; no new manual pushState router.
- [x] Review tabs switch internally without route navigation or component-wide
  refetch.
- [x] Shared state has explicit owner/reset rules when review id changes.
- [x] Existing localStorage keys have SSR-safe defaults and typed browser
  adapters.
- [x] Client imports no filesystem, subprocess, repository, provider, or MCP
  runtime code.
- [x] Duplicate Guide shape is removed.
- [x] Fake Home/review data renders shell, tabs, loading, and errors in focused
  Svelte tests.
- [x] No comment UI or provider feature is copied from the old branch.

**Blocked by:** 02 Split shared contracts and pure domain rules

**Blocks:** 07–11 view stories and 13 integration

**Parallel-eligible:** yes; starts with 03 after 02 and remains independent
while 04 follows 03

## code-review

Pass: 16 September 2026

base: 7840b8e96a280715389655e8aa961632049cfb11
head: e505e846c6935428c267cf805302bffe2f07fa5c
branch: feature/06-06-build-svelte-review-shell

Not blocking. Standards has no major. Spec has no missing or incorrect.

### Standards

major 0 / minor 0 / nit 0

findings: []

### Spec

missing 0 / partial 0 / scope-creep 0 / incorrect 0

findings: []
