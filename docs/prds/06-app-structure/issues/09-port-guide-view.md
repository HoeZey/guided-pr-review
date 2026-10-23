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

- [x] Initial /reviews/:id response contains readable Guide content when Guide
  is the selected/default server-safe view.
- [x] Chapter order, why copy, progress, file pills, hunks, omissions, and
  selected file match current behavior.
- [x] Scroll spy and chapter/file navigation update state without document-wide
  event delegation.
- [x] Viewed/collapsed state uses existing persistence format.
- [x] Tab switch away/back preserves Guide selection and scroll state.
- [x] Unchaptered review shows Generate Guide, never a fake walkthrough.
- [x] Focused tests cover chaptered, omitted, all-viewed, and unchaptered data.

**Blocked by:** 05, 06, and 08

**Blocks:** 12 interaction parity and 13 integration

**Parallel-eligible:** yes, with 10

## code-review

Pass: 16 September 2026

base: 1bef2d0a422287a387ba8cf57ccdabf2a4b0e2f6
head: cc85286505aee083f8d9279d056c8b19e1cc0da8
branch: feature/06-09-port-guide-view

Not blocking. Standards has no major. Spec has no missing or incorrect.

### Standards

major 0 / minor 1 / nit 0

- severity: minor
  title: Guide scroll spy stays bound while the Guide pane is hidden
  location: src/lib/client/components/guide/GuideView.svelte (spyScroll)
  startLine: 152
  reference:
    source: src/viewer.ts syncGuideSpy and observeMain; docs/prds/06-app-structure/issues/09-port-guide-view.md Acceptance criteria
    quote: Scroll spy and chapter/file navigation update state without document-wide event delegation. Tab switch away/back preserves Guide selection and scroll state.
  explanation: spyScroll adds a scroll listener on the Guide main and never checks the hidden flag. viewer.ts syncGuideSpy returns when the tab is not guide, and observeMain unbinds the spy when leaving Guide. AppShell keeps GuideView mounted with hidden set so Diff and Code Review stay fake and selection/scroll survive. While hidden, display none makes getBoundingClientRect zeros and can make atEnd true. A stray scroll would call readGuideSpy and overwrite selectedChapterId and selectedGuidePath. Clicks and the main scroll action stay on the component; this is not document-wide delegation.
  recommendation: Return from the scroll handler when hidden is true, matching the old tab !== guide guard. Keep the node mounted.

### Spec

missing 0 / partial 0 / scope-creep 0 / incorrect 0

findings: []

Chaptered SSR includes why copy, progress, pills, hunks, omissions, and a selected file. Unchaptered SSR and the client test show Generate guide, no chapter walkthrough, and no fetch on click. Viewed round-trips through serializeViewed / viewedKey. Tab away sets hidden on the same main and restores selection and scrollTop. Diff and Code Review stay fake. CodeFile is the 08 primitive. guideStops, selectGuidePath, stepGuide, guideSpyFileIndex, and formatCopy are reused. TOC reveal/suppression stays with issue 12.
