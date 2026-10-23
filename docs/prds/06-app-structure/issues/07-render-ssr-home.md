---
status: done
blocked_by:
  - 05-preserve-http-mcp-and-ssr
  - 06-build-svelte-review-shell
blocks:
  - 12-restore-interaction-parity
  - 13-integrate-sveltekit-cutover
---

# Render Home through SvelteKit SSR

**Type:** Story

**From PRD:** [06 App structure](../)

**Seam(s):** Home +page.server.ts data; Home projection; Home Svelte
components; SvelteKit navigation

**What it delivers:** GET / returns the complete grouped Home HTML and
hydrates into the current interactive overview without viewer.ts.

**Scope (in):**

- Render Review requests, Authored by me, Other saved PRs, Local ranges, and
  Archived from server-loaded projected data.
- Preserve repository badges, target/source display, Guide presence,
  lifecycle/freshness, Last synced, isolated errors, and current actions.
- Preserve Paste Guide, Open, Update Diff, Generate Guide, Refresh, and current
  waiting-agent states without changing ownership.
- Navigate cards to /reviews/:id through SvelteKit.
- Keep stale data visible during client mutations.
- Reuse visual classes/CSS and accessible controls.

**Scope (out):**

- Direct provider execution from PRD 07
- Review page/Guide/Diff/Code Review rendering
- Visual polish or component library

**Touches:** src/routes/+page.server.ts, src/routes/+page.svelte,
lib/client/components/home, existing overview domain helpers, Home tests

**Acceptance criteria:**

- [x] Initial / response contains projected Home content before client
  JavaScript runs.
- [x] Hydration does not fetch the same initial list/catalog again.
- [x] Every current grouping, badge, range, lifecycle, freshness, error, and
  action state matches existing behavior.
- [x] Card navigation uses SvelteKit and deep reload remains valid.
- [x] Paste Guide creates/navigates to one review through the existing API.
- [x] Focused component tests use representative current/outdated/archived/
  local/error fixtures.
- [x] No provider, cache, or comment behavior lands.

**Blocked by:** 05 routes/loaders and 06 shell/state

**Blocks:** 12 interaction parity and 13 integration

**Parallel-eligible:** yes, with 08 and 11

## code-review

Pass: 16 September 2026

base: 139be4dadffd06d078a4a3eb90b35939f08ea25b
head: 1ac7583872008fb471c736b01667233a09645f22
branch: feature/06-07-render-ssr-home

Not blocking. Standards has no major. Spec has no missing or incorrect.

### Standards

major 0 / minor 1 / nit 2

- severity: minor
  title: Home module state outlives the Home view
  location: src/lib/client/state/home.svelte.ts (homeListed, syncHomeWatch)
  startLine: 47
  endLine: 156
  explanation: After the first successful list refresh, homeListed returns the module listed snapshot and ignores later Home page data. HomeView cleanup only stops the watch. Client navigation away from / therefore keeps listed, pendingActionId, and pasteError. A later SvelteKit load of / is ignored, and Open success navigation that viewer.ts performed from its process-wide two-second loadActive loop only runs while HomeView is mounted. Deep reload still resets the module. First hydration still uses serialized page data and does not refetch. Two-second polling only while queued, claimed, or pending matches the story notes and is not this finding.
  recommendation: Clear listed, pendingActionId, pasteError, and the watch on HomeView destroy, or keep the module snapshot only while mutating or inflight and otherwise render the loader payload.

- severity: nit
  title: Vitest navigation alias lives in production client code
  location: src/lib/client/browser/app-navigation.ts
  startLine: 1
  endLine: 4
  reference:
    source: docs/prds/06-app-structure/issues/06-build-svelte-review-shell.md
    quote: SvelteKit handles Home/review navigation; no new manual pushState router.
  explanation: Production Home dynamically imports $app/navigation. Vitest remaps that module to a helper that calls history.pushState. The helper is unused in the app graph, but it sits beside real browser adapters, so a future production import would skip SvelteKit routing.
  recommendation: Point the Vitest alias at a file under a test directory, not src/lib/client.

- severity: nit
  title: mutating is written and never read
  location: src/lib/client/state/home.svelte.ts (homeUi.mutating)
  startLine: 30
  explanation: queueHomeAction and pasteGuide set mutating true then false. No component branches on it. Stale Home during the POST is already preserved because listed is not cleared.
  recommendation: Delete the flag, or use it if a later story needs an explicit busy bit.

### Spec

missing 0 / partial 0 / scope-creep 0 / incorrect 0

findings: []
