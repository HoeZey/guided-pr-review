---
status: done
blocked_by: []
blocks: []
---

# Round and border Diff and Guide stage cards

**Type:** Story

**From PRD:** [Review screen polish](../)

**Seam(s):** Visual Diff and Guide stage file panels. Manual browser check.
Do not assert Astro DOM or pixel values in tests.

**What it delivers:** A reviewer reading Diff (and Guide stage files) sees
each file as a rounded card with its own border and elevated background,
inset from the pane, like the Linear Files screenshot.

**Scope (in):**

- Diff file panels are rounded, bordered, elevated, and inset.
- Guide stage file panels match that card treatment.
- Sticky file heads still work inside the card.

**Scope (out):**

- Type scale, mode tabs, chapter-column resize, Reviews column removal
- A new Shiki theme

**Touches:** UI, CSS

**Acceptance criteria:**

- [x] Diff files read as rounded bordered cards, not flush to the pane, on
  a manual pass of Unified and Split.
- [x] Guide stage files match that card treatment.
- [x] File heads still stick while scrolling that file.
- [x] No automated Astro DOM or pixel assertions.

**Blocked by:** none

**Blocks:** none

**Parallel-eligible:** yes
