---
status: todo
blocked_by:
  - 02-split-shared-contracts-and-domain
  - 05-preserve-http-mcp-and-ssr
  - 06-build-svelte-review-shell
blocks:
  - 09-port-guide-view
  - 10-port-diff-view
  - 13-integrate-sveltekit-cutover
---

# Build shared Svelte code-view primitives

**Type:** Story

**From PRD:** [06 App structure](../)

**Seam(s):** typed file/hunk/line props; SSR-safe code rows; Shiki enhancement;
split/unified projection adapters

**What it delivers:** Guide and Diff can reuse one tested Svelte rendering
vocabulary for files, hunks, line numbers, word changes, syntax, stats, gaps,
and layouts instead of duplicating viewer.ts HTML strings.

**Scope (in):**

- Build typed Svelte components for file header, hunk header, unified code row,
  split row/cell, unchanged gap, stats, and reviewed/collapsed affordance.
- Feed existing guide-view.ts projections into component props; do not rewrite
  sort, pairing, word-diff, gap, or token-overlay algorithms.
- Render safe plain code during SSR, then enhance tokens with lazy Shiki after
  hydration without replacing row identity or causing hydration mismatch.
- Preserve escaping, line numbers, additions/deletions/context classes, word
  overlays, split/unified semantics, and zero-count omission.
- Expose narrow events/props for owning Guide/Diff views.

**Scope (out):**

- Guide chapters/navigation
- Diff file tree/navigation
- Global keyboard/rail behavior
- Comment slots from PRD 08
- New visual design

**Touches:** lib/client/components/code, shared guide-view domain exports,
Shiki browser adapter, focused component tests, existing CSS

**Acceptance criteria:**

- [ ] One fixture file renders equivalent unified and split rows from existing
  pure projections.
- [ ] SSR output contains readable code/line numbers before JavaScript.
- [ ] Hydration and lazy syntax enhancement produce no mismatch or duplicated
  rows.
- [ ] User-controlled code/content remains escaped.
- [ ] Added, removed, context, gap, word-change, stats, reviewed, and collapsed
  states match current classes/appearance.
- [ ] Guide and Diff can consume primitives without importing DOM utilities.
- [ ] Component tests cover both layouts and Shiki failure fallback.

**Blocked by:** 02, 05, and 06

**Blocks:** 09 Guide, 10 Diff, and 13 integration

**Parallel-eligible:** yes, with 07 and 11
