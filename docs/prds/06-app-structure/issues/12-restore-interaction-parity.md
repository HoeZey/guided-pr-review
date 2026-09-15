---
status: todo
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

- [ ] Every named existing preference round-trips with its existing
  localStorage key.
- [ ] SSR uses tab cookie after migration; first load adopts legacy tab without
  losing it.
- [ ] Keyboard shortcuts ignore editable controls and match current behavior.
- [ ] Rails/split handles persist values and remove global listeners on end.
- [ ] Route/review changes clean up timers, observers, and event listeners.
- [ ] Back/forward/deep reload and active review identity stay correct.
- [ ] Generate Guide completion can refresh current data without polling every
  mounted component.
- [ ] Playwright smoke covers Home, review, all tabs, layouts, preferences,
  keyboard, rails, reload, and navigation on isolated data/port.
- [ ] Visual/accessibility parity is accepted with no redesign.

**Blocked by:** 07, 09, 10, and 11

**Blocks:** 13 integration

**Parallel-eligible:** no
