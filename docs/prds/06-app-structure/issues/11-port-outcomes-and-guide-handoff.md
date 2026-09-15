---
status: todo
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

- [ ] Exact/current and newest-prior/outdated outcomes match existing selection.
- [ ] Standards and Spec counts/history remain independent and complete.
- [ ] Generate Guide appears only for current unchaptered review and queues one
  deduplicated action.
- [ ] Agent state and failure/recovery copy match current behavior.
- [ ] Successful chaptering updates the same review id and fills Guide without
  full-page reload.
- [ ] Saved Guide/Diff/Code Review remain readable while agent is disconnected.
- [ ] Focused tests cover empty/exact/outdated/history/repeated outcomes and
  all Generate Guide states.

**Blocked by:** 05 and 06

**Blocks:** 12 interaction parity and 13 integration

**Parallel-eligible:** yes, with 07 and 08
