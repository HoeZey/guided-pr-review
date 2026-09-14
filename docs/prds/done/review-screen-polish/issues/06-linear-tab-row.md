---
status: done
blocked_by: []
blocks: []
---

# Place mode tabs in a Linear tab row

**Type:** Story

**From PRD:** [Review screen polish](../)

**Seam(s):** Review header chrome. Manual browser check. Do not assert
Astro DOM or pixel values in tests.

**What it delivers:** Guide / Diff / Code Review sit in their own row
under the identity header, like Linear Overview / Files / Commits. The
selected tab has an accent underline. They are not options next to the
title in the top bar.

**Scope (in):**

- Identity row stays brand, back, title, source, stats, Display.
- Tab row is below that row, left-aligned text tabs at chrome 13px.
- Unselected tabs are muted. Selected uses the accent underline, not a
  filled background and not a boxed segmented control.
- Names stay Guide / Diff / Code Review.

**Scope (out):**

- Renaming tabs to Overview / Files / Commits
- Phrase-to-diff underlines in why copy
- Type scale already covered by 01

**Touches:** UI, CSS

**Acceptance criteria:**

- [x] Guide / Diff / Code Review are not inlined with the title in the
  identity bar.
- [x] The selected tab shows an accent underline on a manual pass.
- [x] No automated Astro DOM or pixel assertions.

**Blocked by:** none

**Blocks:** none

**Parallel-eligible:** yes
