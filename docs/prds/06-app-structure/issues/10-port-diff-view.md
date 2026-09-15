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

# Port Diff to Svelte components

**Type:** Story

**From PRD:** [06 App structure](../)

**Seam(s):** full-file projection; compact file tree; Diff local state; shared
code-view primitives

**What it delivers:** A saved review server-renders and hydrates its complete
Diff, file navigation, and layout controls without viewer.ts.

**Scope (in):**

- Render every file once from filesForDiff, including omitted/stub paths.
- Render compact directory tree, current file, file stats, hunks, collapsed
  files, reviewed state, and split/unified layouts.
- Reuse fileTree, splitRows, withUnchangedGaps, word/token overlays, layout
  parsing, and viewed/collapsed domain behavior.
- Preserve hide-unchanged and per-tab Diff layout preferences.
- Preserve file jump/scroll highlighting with component-scoped actions.
- Keep state alive when switching internal review tabs.

**Scope (out):**

- Guide chapter navigation
- Comments from PRD 08
- Global keyboard/rail behavior owned by 12
- Provider refresh/Open changes from PRD 07

**Touches:** lib/client/components/diff, review shell tab content, shared Diff
domain helpers, focused Svelte tests

**Acceptance criteria:**

- [ ] Initial /reviews/:id response contains readable Diff content when Diff
  is the selected/default server-safe view.
- [ ] Every path renders exactly once in compact-tree order.
- [ ] Split/unified rows, hidden unchanged gaps, word changes, stubs, stats,
  and line numbers match existing behavior.
- [ ] File jump/current highlighting and collapse/review state work without
  document-wide event delegation.
- [ ] Tab switch away/back preserves selected file, layout, collapse, and
  scroll state.
- [ ] Focused tests cover multiple hunks, omitted path, replacement pairs,
  leftover adds/removes, gaps, and both layouts.

**Blocked by:** 05, 06, and 08

**Blocks:** 12 interaction parity and 13 integration

**Parallel-eligible:** yes, with 09
