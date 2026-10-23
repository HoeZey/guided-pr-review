---
status: done
blocked_by:
  - 07-render-ssr-home
  - 09-port-guide-view
  - 10-port-diff-view
  - 11-port-outcomes-and-guide-handoff
blocks:
  - 13-integrate-sveltekit-cutover
---

# Restore cross-view interaction parity

**Type:** Story

**From PRD:** [06 App structure](../)

**Seam(s):** review-scoped state lifecycle; Svelte actions/effects; preference
adapter; route/tab restore; browser accessibility smoke

**What it delivers:** The composed Svelte app preserves every cross-view
preference, keyboard, resizing, scroll, and refresh behavior that previously
lived in viewer.boot/bindChrome.

**Scope (in):**

- Preserve theme, selected tab, Guide/Diff layouts, split percentage, sidebar
  width, hide unchanged, viewed/collapsed files, selected paths, and open/closed
  menus using existing localStorage keys.
- Mirror selected tab in a non-sensitive cookie so later SSR selects the same
  tab. On first migrated load, adopt the legacy localStorage value after
  hydration and seed the cookie.
- Preserve j/k reading-order movement, Cmd/Ctrl+B layout toggle, Escape menu
  behavior, TOC reveal/suppression, resize handles, header sizing, and
  scroll/current-file observers.
- Scope every window/document observer, timer, and pointer listener to a Svelte
  action/effect with cleanup on route/component destruction.
- Preserve active-review update, pop/back navigation, deep reload, two-second
  agent-result refresh where still required, and stale content while loading.
- Complete visual/accessibility parity against current screenshots/behavior.

**Scope (out):**

- New keyboard shortcuts or preference keys
- Visual polish
- Direct provider refresh behavior from PRD 07
- Comment drafts/state from PRD 08

**Touches:** lib/client state/browser actions, root/review components, existing
CSS, browser smoke and focused interaction tests

**Acceptance criteria:**

- [x] Every named existing preference round-trips with its existing
  localStorage key.
- [x] SSR uses tab cookie after migration; first load adopts legacy tab without
  losing it.
- [x] Keyboard shortcuts ignore editable controls and match current behavior.
- [x] Rails/split handles persist values and remove global listeners on end.
- [x] Route/review changes clean up timers, observers, and event listeners.
- [x] Back/forward/deep reload and active review identity stay correct.
- [x] Generate Guide completion can refresh current data without polling every
  mounted component.
- [x] Playwright smoke covers Home, review, all tabs, layouts, preferences,
  keyboard, rails, reload, and navigation on isolated data/port.
- [x] Visual/accessibility parity is accepted with no redesign.

**Blocked by:** 07, 09, 10, and 11

**Blocks:** 13 integration

**Parallel-eligible:** no

## code-review

Pass: 16 September 2026

base: 9e33a9aded1cb9b00b4ade79b2e9a2e776da337e
head: f2f6211a2ed993396205bc93ae67edc83d9f8443
branch: feature/06-12-restore-interaction-parity

Not blocking. Standards has no major. Spec has no missing or incorrect.

### Standards

major 0 / minor 2 / nit 1

- severity: minor
  title: Playwright keyboard smoke does not fail when j is a no-op
  location: e2e/interaction-parity.spec.ts
  startLine: 59
  endLine: 63
  explanation: After switching to Guide, the smoke reads the current file-pill path, presses j, and accepts either an unchanged path or any truthy pathAfter. That passes when reading-order movement never runs. The production keydown path is exercised only in Vitest. Rails, tabs, prefs, reload, and navigation still have real assertions.
  recommendation: Assert that the current Guide path changes after j when the fixture has at least two files, and keep the INPUT/TEXTAREA ignore check in the unit test.

- severity: minor
  title: Home list refresh can refill leftover state after leaveHome
  location: src/lib/client/state/home.svelte.ts
  startLine: 45
  endLine: 88
  reference:
    source: docs/prds/06-app-structure/issues/07-render-ssr-home.md code-review
    quote: After the first successful list refresh, homeListed returns the module listed snapshot and ignores later Home page data.
  explanation: leaveHome clears listed, pendingActionId, and the watch timer, which fixes the usual Home-away leak from 06-07. refreshHomeList still applyList after await. A tick that started while Home was mounted can finish after destroy and write listed again. The next visit to / then prefers that snapshot over the loader payload. Deep reload still resets the module.
  recommendation: Ignore the fetch result unless Home is still mounted, or drop listed unless a mutation is in flight.

- severity: nit
  title: Diff scroll spy duplicates the shared spyCurrent action
  location: src/lib/client/components/diff/DiffView.svelte
  startLine: 40
  endLine: 68
  explanation: This story added spyCurrent for Code Review observers. DiffView still binds the same IntersectionObserver, rootMargin, and disconnect lifecycle in a local spyFiles action. Behavior matches viewer observeMain. The copy will drift if one helper changes.
  recommendation: Point DiffView at spyCurrent with selector .file[id] and onHit that calls selectDiffPath.

### Spec

missing 0 / partial 0 / scope-creep 0 / incorrect 0

findings: []

