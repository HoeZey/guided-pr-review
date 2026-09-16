---
status: done
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

- [x] Initial /reviews/:id response contains readable Diff content when Diff
  is the selected/default server-safe view.
- [x] Every path renders exactly once in compact-tree order.
- [x] Split/unified rows, hidden unchanged gaps, word changes, stubs, stats,
  and line numbers match existing behavior.
- [x] File jump/current highlighting and collapse/review state work without
  document-wide event delegation.
- [x] Tab switch away/back preserves selected file, layout, collapse, and
  scroll state.
- [x] Focused tests cover multiple hunks, omitted path, replacement pairs,
  leftover adds/removes, gaps, and both layouts.

**Blocked by:** 05, 06, and 08

**Blocks:** 12 interaction parity and 13 integration

**Parallel-eligible:** yes, with 09

## code-review

Date: 16 September 2026

base: 1bef2d0a422287a387ba8cf57ccdabf2a4b0e2f6
head: b4a2275f3bb1049b209e376fbd0f6b5c7c8b0661
branch: feature/06-10-port-diff-view

Not blocking. Standards has no major. Spec has no missing or incorrect.

### Standards

major 0 / minor 0 / nit 0

findings: []

### Spec

missing 0 / partial 0 / scope-creep 0 / incorrect 0

findings: []
