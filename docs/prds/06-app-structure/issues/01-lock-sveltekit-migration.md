---
status: done
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

- [x] Every existing src file has one documented target owner.
- [x] Allowed import direction is executable as a check.
- [x] Check fails on one proved forbidden-import fixture and passes on
  scaffold.
- [x] npm test reports 102 passes on pinned develop and story head.
- [x] Existing Astro build failure and exact reserved-entrypoint cause are
  recorded rather than attributed to SvelteKit.
- [x] Minimal SvelteKit SSR/hydration proof passes svelte-check, focused test,
  and standalone Node production build.
- [x] npm run dev remains Astro on localhost:8765; npm run dev:svelte exposes
  only the migration runtime on an explicit isolated port.
- [x] Manual smoke uses isolated data and a non-8765 port.
- [x] No production behavior changes.

**Blocked by:** none

**Blocks:** 02 Split shared contracts and pure domain rules

**Parallel-eligible:** no

## Baseline (coordinator)

Pinned develop and story parent: e58839e61237e1bac403a607abb0b964601e2ff7
(Reslice phase 06 for SvelteKit migration). Recorded 16 September 2026 from
.cursor/worktrees/overnight-coordinator. Node v20.20.2.

- npm test: 102 pass, 0 fail (`# tests 102` / `# pass 102` / `# fail 0`).
- npm run build: fails. Exact cause, not a SvelteKit regression:
  `"server" is not exported by "src/actions.ts", imported by "virtual:astro:actions/entrypoint"`.
  Astro reserves src/actions.ts as the Actions entrypoint and expects a server
  export.

Do not treat that Astro failure as introduced by this story. Story head must
still report 102 npm test passes. SvelteKit checks are additional.

## Story-head confirmation

Recorded from this worktree on feature/06-01-lock-sveltekit-migration. Node
v20.20.2.

- npm test: 102 pass, 0 fail. Same five Node files as develop. New Svelte and
  architecture checks are extra scripts, not folded into npm test.
- npm run build: still fails with the reserved Astro Actions entrypoint, not a
  SvelteKit regression:

```
"server" is not exported by "src/actions.ts", imported by "virtual:astro:actions/entrypoint"
```

- npm run check:architecture: fail-fixture plus pass-scaffold.
- npm run test:svelte: focused SSR render and jsdom hydration.
- npm run check:svelte: 0 errors, 0 warnings.
- npm run build:svelte: @sveltejs/adapter-node writes build/.
- npm run dev remains astro dev --host localhost --port 8765.
- npm run dev:svelte binds Vite/SvelteKit to localhost:8766 only.

## Target owners (every current src file)

Kind is move/reuse, framework-boundary rewrite, or delete-after-cutover. This
story documents owners; it does not move product modules.

- src/actions.test.ts — move/reuse — travel with actions orchestration into
  lib/server/services focused Node tests
- src/actions.ts — move/reuse, then delete-after-cutover of this reserved path
  — orchestration into lib/server/services; the src/actions.ts filename goes
  away only at issue 13 after Astro is removed
- src/contracts.ts — move/reuse — lib/shared/contracts (schema families and
  MCP tool input/output)
- src/env.d.ts — delete-after-cutover — Astro client types; SvelteKit uses
  src/app.d.ts
- src/guide-view.test.ts — move/reuse — with guide-view into lib/shared/domain
- src/guide-view.ts — move/reuse — lib/shared/domain (Diff/Guide projections)
- src/mcp.ts — move/reuse — protocol/dispatch behind
  src/routes/mcp/+server.ts, calling the same services as HTTP
- src/overview.test.ts — move/reuse — with overview into lib/shared/domain
- src/overview.ts — move/reuse — lib/shared/domain (grouping, route resolution
  inputs, Home projection)
- src/pages/api/actions.ts — framework-boundary rewrite —
  src/routes/api/actions/+server.ts
- src/pages/api/actions/[id]/complete.ts — framework-boundary rewrite —
  src/routes/api/actions/[id]/complete/+server.ts
- src/pages/api/actions/wait.ts — framework-boundary rewrite —
  src/routes/api/actions/wait/+server.ts
- src/pages/api/catalog.ts — framework-boundary rewrite —
  src/routes/api/catalog/+server.ts
- src/pages/api/reviews.ts — framework-boundary rewrite —
  src/routes/api/reviews/+server.ts
- src/pages/api/reviews/[id].ts — framework-boundary rewrite —
  src/routes/api/reviews/[id]/+server.ts
- src/pages/api/reviews/[id]/active.ts — framework-boundary rewrite —
  src/routes/api/reviews/[id]/active/+server.ts
- src/pages/api/reviews/[id]/outcomes.ts — framework-boundary rewrite —
  src/routes/api/reviews/[id]/outcomes/+server.ts
- src/pages/index.astro — framework-boundary rewrite, then
  delete-after-cutover — src/routes/+page.svelte and +page.server.ts
- src/pages/mcp.ts — framework-boundary rewrite, then delete-after-cutover —
  src/routes/mcp/+server.ts
- src/pages/reviews/[id].astro — framework-boundary rewrite, then
  delete-after-cutover — src/routes/reviews/[id]/+page.svelte and
  +page.server.ts
- src/review-outcome.test.ts — move/reuse — with review-outcome into
  lib/shared/domain
- src/review-outcome.ts — move/reuse — lib/shared/domain
- src/seed.ts — move/reuse — server startup / repository ownership
- src/store.test.ts — move/reuse — with persistence/adoption tests for
  repository and domain owners
- src/store.ts — move/reuse (split) — Store v1 IO and adoption into
  lib/server/repositories/json plus shared domain; commands into feature
  services
- src/styles/global.css — move/reuse — keep global CSS for visual parity;
  move beside components only when mechanical and behavior-neutral
- src/viewer.ts — framework-boundary rewrite, then delete-after-cutover —
  lib/client components, state, and browser effects; duplicate Guide and
  FileChange types deleted after callers migrate

New this story, not a product-module move: src/lib/shared/migration-proof.ts,
src/routes/migration-proof/ (isolated SSR/hydration proof), src/app.html,
src/app.d.ts, src/routes/+layout.svelte.

## Allowed imports (from the PRD)

Executable as npm run check:architecture (scripts/check-architecture.ts, no
analysis dependency). Scans src/lib and src/routes. Skips *.test.* and
*.spec.*.

- lib/shared imports no Svelte, SvelteKit, $app, $lib/client, $lib/server,
  filesystem, or subprocess modules.
- lib/client may import Svelte, lib/shared, and browser-safe client modules.
  It must not import filesystem, subprocess, or $lib/server.
- Route .svelte files must not import $lib/server.
- Route +page.server.ts / +layout.server.ts / +server.ts must not import
  filesystem or subprocess modules, and may only declare load plus HTTP
  handlers (GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS, fallback, actions,
  and SvelteKit page options). Extra functions fail as route-heavy-logic.

Proved forbidden-import fixture:
scripts/architecture-fixtures/src/lib/shared/forbidden-svelte-import.ts
(imports svelte from a shared path). The check must fail on that tree and
pass on this scaffold.

## Stable product contracts (unchanged this story)

Review URLs:

- / — Home
- /reviews/:id — one review; Guide, Diff, and Code Review stay internal tabs

HTTP:

- GET, POST, PUT /api/reviews
- GET, DELETE /api/reviews/:id
- POST /api/reviews/:id/active
- POST /api/reviews/:id/outcomes
- PUT /api/catalog
- POST /api/actions
- POST /api/actions/wait
- POST /api/actions/:id/complete
- GET, POST /mcp

MCP tool names: list_reviews, replace_catalog, queue_action, wait_for_action,
complete_action, add_review, upsert_review, publish_review_outcome,
remove_review, get_review, set_active. Payloads stay the contracts.ts tools
schemas (Guide v1 on add/upsert/get; CodeReviewOutcome v1 on publish).

Persisted user data:

- Store v1 JSON under GUIDED_PR_REVIEW_DATA (local data/reviews.json is
  gitignored and is not the product contract)
- localStorage keys: guided-pr-review-theme, guided-pr-review-tab,
  guided-pr-review-diff, guided-pr-review-guide-diff, guided-pr-review-split,
  guided-pr-review-hide-unchanged, guided-pr-review-rails,
  guided-pr-review-viewed: plus review id

Visible behavior at epic integration: Home, navigation, Guide, Diff, Code
Review, Generate Guide, syntax highlighting, keyboard controls, reviewed
state, layouts, rails, and saved preferences. Private TypeScript and
browser-only HTTP shapes may change later in lockstep.

## Manual smoke (isolated; never port 8765 or live reviews.json)

Dev (SvelteKit only, port 8766):

```
mkdir -p /tmp/gpr-06-01-smoke
GUIDED_PR_REVIEW_DATA=/tmp/gpr-06-01-smoke npm run dev:svelte
```

Open http://localhost:8766/migration-proof. Expect the typed SSR message
SvelteKit SSR proof and a click counter that starts at 0.

Standalone adapter-node (example port 8767):

```
npm run build:svelte
GUIDED_PR_REVIEW_DATA=/tmp/gpr-06-01-smoke HOST=127.0.0.1 PORT=8767 node build/index.js
curl http://127.0.0.1:8767/migration-proof
```

Do not point GUIDED_PR_REVIEW_DATA at data/. Do not use port 8765. Default
npm run dev stays Astro on localhost:8765 until issue 13. Playwright config
lives at playwright.config.ts with baseURL localhost:8766; a full browser
smoke waits for later stories.

This story does not change production Astro behavior.

## code-review

Pass: 16 September 2026

base: e58839e61237e1bac403a607abb0b964601e2ff7
head: 7319951cf2b7f6778aaf2822d9a2492fe07175f6
branch: feature/06-01-lock-sveltekit-migration

Not blocking. Standards has no major. Spec has no missing or incorrect. The two Standards minors are documented heuristic gaps in the architecture check; they do not fail this story's acceptance criteria.

### Standards

major 0 / minor 2 / nit 1

- severity: minor
  title: Architecture import rules miss relative sibling-layer paths
  location: scripts/check-architecture.ts (SHARED_FORBIDDEN, CLIENT_FORBIDDEN, checkArchitecture specifier loop)
  explanation: The check classifies files under src/lib/shared, src/lib/client, and src/routes, then compares each import specifier to alias and package patterns such as $lib/server and node:fs. A shared or client module can still import a forbidden layer with a relative path into src/lib/server or src/lib/client. The check records no violation for that shape. Later stories will add those directories, so the executable policy will look stricter than it is.
  recommendation: Reject specifiers that point at a sibling layer directory, or state that only $lib and node: specifiers are in scope.

- severity: minor
  title: Extra-function route rule is untested and skips common handlers
  location: scripts/check-architecture.ts (functionNames) and scripts/check-architecture.test.ts
  explanation: checkArchitecture flags extra function names in +page.server.ts and +server.ts. The only test proves a shared svelte import fails and the scaffold is clean. Nothing fails for route-heavy-logic. The const-arrow matcher also requires a simple parameter list, so a handler written as an async arrow with a destructured argument is not seen as a function. An extra helper written the same way would not fail the check.
  recommendation: Add one fixture that declares a disallowed helper, and treat object-destructuring arrows as functions, or narrow the documented rule to function declarations.

- severity: nit
  title: Issue documentation uses inline markdown code spans
  location: docs/prds/06-app-structure/issues/01-lock-sveltekit-migration.md (Baseline npm test summary)
  reference: .cursor/rules/backticks.mdc
  explanation: Repository guidance forbids wrapping identifiers in markdown code spans in prose. The baseline line wraps the TAP summary tokens that way.

### Spec

major 0 / minor 0 / nit 0

findings: []

