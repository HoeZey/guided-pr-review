---
status: todo
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

- [ ] Initial / response contains projected Home content before client
  JavaScript runs.
- [ ] Hydration does not fetch the same initial list/catalog again.
- [ ] Every current grouping, badge, range, lifecycle, freshness, error, and
  action state matches existing behavior.
- [ ] Card navigation uses SvelteKit and deep reload remains valid.
- [ ] Paste Guide creates/navigates to one review through the existing API.
- [ ] Focused component tests use representative current/outdated/archived/
  local/error fixtures.
- [ ] No provider, cache, or comment behavior lands.

**Blocked by:** 05 routes/loaders and 06 shell/state

**Blocks:** 12 interaction parity and 13 integration

**Parallel-eligible:** yes, with 08 and 11
