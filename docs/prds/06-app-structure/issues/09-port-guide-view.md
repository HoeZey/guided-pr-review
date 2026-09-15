---
status: todo
blocked_by:
  - 05-preserve-http-mcp-and-ssr
  - 06-build-svelte-review-shell
  - 08-build-code-view-primitives
blocks:
  - 12-restore-interaction-parity
  - 13-integrate-sveltekit-cutover
---

# Port Guide to Svelte components

**Type:** Story

**From PRD:** [06 App structure](../)

**Seam(s):** Guide page-data props; chapter/file projection; Guide local state;
shared code-view primitives

**What it delivers:** A chaptered review server-renders and hydrates the full
reading-order Guide without viewer.ts.

**Scope (in):**

- Render chapter navigation, why copy, progress, file pills, selected file,
  code hunks, omitted files, and reviewed/collapsed state.
- Reuse guideStops, selectGuidePath, stepGuide, viewed serialization, and
  file/hunk projections from shared domain.
- Preserve scroll/spy selection and chapter/file navigation with Svelte
  effects/actions scoped to the Guide component.
- Preserve current split/unified Guide preference and component styling.
- Render the unchaptered Guide empty state and Generate Guide affordance for
  issue 11 wiring.
- Keep state alive when switching internal review tabs.

**Scope (out):**

- Diff file tree/full-diff navigation
- Code Review history
- Global keyboard/rail behavior owned by 12
- New Guide copy or visual polish

**Touches:** lib/client/components/guide, review shell tab content, shared Guide
domain helpers, focused Svelte tests

**Acceptance criteria:**

- [ ] Initial /reviews/:id response contains readable Guide content when Guide
  is the selected/default server-safe view.
- [ ] Chapter order, why copy, progress, file pills, hunks, omissions, and
  selected file match current behavior.
- [ ] Scroll spy and chapter/file navigation update state without document-wide
  event delegation.
- [ ] Viewed/collapsed state uses existing persistence format.
- [ ] Tab switch away/back preserves Guide selection and scroll state.
- [ ] Unchaptered review shows Generate Guide, never a fake walkthrough.
- [ ] Focused tests cover chaptered, omitted, all-viewed, and unchaptered data.

**Blocked by:** 05, 06, and 08

**Blocks:** 12 interaction parity and 13 integration

**Parallel-eligible:** yes, with 10
