---
status: done
blocked_by: []
blocks: []
---

# Fix the empty Guide tab

**Type:** Story

**From PRD:** [09 Demo home polish](../)

**Seam(s):** empty Guide outcomes

**What it delivers:** The empty Guide message is fully visible, tells the
reviewer to ask their coding agent for a reading-order guide, and has no
Generate button.

**Scope (in):**

- Remove the Generate guide button from the empty Guide state.
- The copy tells the reviewer to ask their coding agent to generate a
  reading-order guide.
- The sticky header mask no longer covers the heading.

**Scope (out):**

- Book icon, Code Review tab, home columns, diff persist, repo search, and
  skill fan-out
- Any Generate guide or Update guide button elsewhere

**Touches:** GuideView.svelte in src/lib/client/components/guide/ renders
GenerateGuideEmpty.svelte from src/lib/client/components/outcomes/ inside
.main-inner.is-guide, which has padding 0 in src/styles/global.css. The
sticky main::before mask covers the top of the heading.

**Acceptance criteria:**

- [ ] The full empty Guide message is visible.
- [ ] There is no Generate guide button.
- [ ] The copy tells the reviewer to ask their coding agent to generate a
  reading-order guide.

**Blocked by:** none

**Blocks:** none

**Parallel-eligible:** yes, with 02, 03, and 04

**Checks:** the empty-guide cases in outcomes.svelte.test.ts
