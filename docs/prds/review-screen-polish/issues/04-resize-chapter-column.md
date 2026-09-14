---
status: done
blocked_by: []
blocks: []
---

# Resize and persist the Guide chapter column

**Type:** Story

**From PRD:** [Review screen polish](../)

**Seam(s):** Existing rail-width preference helpers, extended so the Guide
chapter column width round-trips like the Files rail. Helper tests, not
Astro DOM.

**What it delivers:** A reviewer can drag the Guide chapter column (aside)
width and have that width survive reload.

**Scope (in):**

- A drag handle on the Guide chapter column, same idea as the Files rail.
- Clamp to a usable min and max.
- Persist the width and restore it on load.
- Guide layout still works when Reviews is gone (Files rail is unchanged).

**Scope (out):**

- Persisting Files-rail width per tab (width stays as today)
- Reviews column (removed in a sibling story)
- Type scale and Diff card chrome

**Touches:** rail preference helper, UI, tests

**Acceptance criteria:**

- [x] Dragging the chapter column changes its width.
- [x] Reload restores the last chapter-column width.
- [x] Helper tests cover parse/serialize of the persisted width, including
  a missing or invalid value falling back to the current default.
- [x] No Astro DOM assertions.

**Blocked by:** none

**Blocks:** none

**Parallel-eligible:** yes
