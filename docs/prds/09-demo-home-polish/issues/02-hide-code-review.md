---
status: done
blocked_by: []
blocks: []
---

# Hide the Code Review tab

**Type:** Story

**From PRD:** [09 Demo home polish](../)

**Seam(s):** shell tabs and stored-tab fallback

**What it delivers:** The Code Review tab is hidden. Outcome storage and
publish stay. A stored review tab opens Guide.

**Scope (in):**

- Drop Code Review from the visible tabs.
- Keep outcome storage and publish.
- A stored tab of review falls back to guide.

**Scope (out):**

- Removing code-review outcome storage or publish
- Findings, history, or publish behavior beyond hiding the tab

**Touches:** visible tabs in src/lib/client/components/AppShell.svelte.
TAB_KEY in src/lib/client/state/review.svelte.ts.

**Acceptance criteria:**

- [ ] The Code Review tab is absent.
- [ ] Outcome storage and publish still work.
- [ ] A tab of review stored under TAB_KEY falls back to guide.

**Blocked by:** none

**Blocks:** none

**Parallel-eligible:** yes, with 01, 03, and 04

**Checks:** the tab cases in shell.svelte.test.ts and the stored-tab
fallback in review.svelte.test.ts
