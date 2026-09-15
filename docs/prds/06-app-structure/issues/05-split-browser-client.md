---
status: todo
blocked_by:
  - 02-split-shared-contracts-and-domain
blocks:
  - 06-integrate-app-structure
---

# Split the browser client by responsibility

**Type:** Story

**From PRD:** [06 App structure](../)

**Seam(s):** client API; client state; Home and review renderers; boot and
navigation

**What it delivers:** Browser presentation can change by capability without
editing one viewer monolith or importing Node-only logic.

**Scope (in):**

- Extract browser fetch/error mapping into client/api.
- Extract application state and persisted UI preferences into client/state.
- Split Home, review shell, Guide/Diff, Code Review, navigation, keyboard, and
  boot responsibilities into client modules.
- Replace duplicate handwritten Guide types with browser-safe shared
  contracts.
- Keep Shiki and DOM-specific rendering under client.
- Preserve current localStorage keys, navigation URLs, polling/action behavior,
  accessibility, and visual output.
- Reconcile changed browser endpoints with 04 on the epic integration branch.

**Scope (out):**

- Visual redesign
- Comment UI from feature/post-ado-comments
- New state library or client framework
- Splitting CSS solely for folder symmetry

**Touches:** src/viewer.ts, src/styles/global.css, src/pages/index.astro,
src/pages/reviews/[id].astro, browser-safe tests, new src/client modules

**Acceptance criteria:**

- [ ] No single client module owns Home, review modes, HTTP, state, and boot.
- [ ] Client imports no filesystem, subprocess, repository, provider, or MCP
  runtime code.
- [ ] Duplicate Guide shape is removed.
- [ ] Existing browser preferences and URLs continue to work.
- [ ] Automated pure/client checks pass.
- [ ] Manual smoke finds no visible regression on Home, Guide, Diff, or Code
  Review.
- [ ] No comment UI or provider feature is copied from the old branch.

**Blocked by:** 02 Split shared contracts and pure domain rules

**Blocks:** 06 integration

**Parallel-eligible:** yes, with 03 after 02
