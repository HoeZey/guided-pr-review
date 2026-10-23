---
status: done
blocked_by:
  - 05-preserve-http-mcp-and-ssr
  - 06-build-svelte-review-shell
blocks:
  - 12-restore-interaction-parity
  - 13-integrate-sveltekit-cutover
---

# Port Code Review and Guide handoff

**Type:** Story

**From PRD:** [06 App structure](../)

**Seam(s):** outcome selection projection; Code Review components; Generate
Guide action state; post-hydration review refresh

**What it delivers:** Code Review history and the remaining agent-owned Guide
handoff work through Svelte state/components with current behavior.

**Scope (in):**

- Render exact, outdated, and empty Code Review outcomes with independent
  Standards/Spec counts and history selection.
- Preserve finding copy, paths/lines, severity, timestamps, base/head, and
  repeated runs.
- Render Generate Guide only for current unchaptered reviews.
- Queue/dedupe Generate Guide through existing API/action service; show Waiting,
  Generating, failed, disconnected, and Retry states.
- Refresh current review after hydration while an agent-owned operation is
  pending, without replacing SSR page data on every tab switch.
- Keep outcome and action state shared across internal tab switches.

**Scope (out):**

- Moving Guide generation into app
- Provider Open/Refresh/Update ownership from PRD 07
- Running code-review from browser
- Global keyboard/rail behavior

**Touches:** lib/client/components/outcomes, Guide empty/action component,
review client operation state, outcome/action tests

**Acceptance criteria:**

- [x] Exact/current and newest-prior/outdated outcomes match existing selection.
- [x] Standards and Spec counts/history remain independent and complete.
- [x] Generate Guide appears only for current unchaptered review and queues one
  deduplicated action.
- [x] Agent state and failure/recovery copy match current behavior.
- [x] Successful chaptering updates the same review id and fills Guide without
  full-page reload.
- [x] Saved Guide/Diff/Code Review remain readable while agent is disconnected.
- [x] Focused tests cover empty/exact/outdated/history/repeated outcomes and
  all Generate Guide states.

**Blocked by:** 05 and 06

**Blocks:** 12 interaction parity and 13 integration

**Parallel-eligible:** yes, with 07 and 08

## code-review

Pass: 16 September 2026

base: 139be4dadffd06d078a4a3eb90b35939f08ea25b
head: 64ee5d5cbdbe83c9901f9ff5a0229ceef37ba7fb
branch: feature/06-11-port-outcomes-and-guide-handoff

Not blocking. Standards has no major. Spec has no missing or incorrect.

### Standards

major 0 / minor 1 / nit 0

- severity: minor
  title: Refresh can overwrite another review overlay
  location: src/lib/client/state/review.svelte.ts (refreshCurrentReview)
  reference:
    source: ponytail.mdc edge-case safety; src/viewer.ts loadActive pathname checks after awaits
  explanation: refreshCurrentReview captures session.page, awaits GET /api/reviews and GET /api/reviews/{id}, then always writes session.page from that snapshot. Viewer loadActive returns when location.pathname changes across those awaits. AppShell clears the interval on unmount but does not abort the in-flight fetches. A pending Generate Guide poll for review A can finish after the user opened review B and replace session.page with A. Later refreshCurrentReview then returns immediately because session.reviewId and page.reviewId disagree. queueGenerateGuide on B still POSTs, then that no-op leaves session.ops pending, so Generate Guide can stay on Waiting without polling the action to succeeded or failed.
  recommendation: After both fetches, return unless session.reviewId still equals the captured page.reviewId, and skip the session.page write. Match loadActive ignoring a stale pathname.

### Spec

missing 0 / partial 0 / scope-creep 0 / incorrect 0

findings: []
