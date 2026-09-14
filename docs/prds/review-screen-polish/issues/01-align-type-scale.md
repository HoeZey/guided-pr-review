---
status: todo
blocked_by: []
blocks: []
---

# Align Code Review and Home type with Guide density

**Type:** Story

**From PRD:** [Review screen polish](../)

**Seam(s):** CSS type scale on Home and Code Review; no new store contract.
Manual browser check. Do not assert Astro DOM or pixel values in tests.

**What it delivers:** A reviewer reading Home or Code Review sees the same
editorial and chrome sizes as Guide, so finding titles, axis heads, and
meta lines do not jump when switching tabs.

**Scope (in):**

- Match Code Review axis heads to Guide chapter title scale (about 26px /
  -0.04em).
- Match finding title, explanation, and recommendation to Guide why / body
  scale (about 15px / 1.55 muted for prose; chrome 13px; meta 11px mono).
- Match Home card title and range/badge to review chrome and meta, not a
  third scale.
- Keep Inter for UI and IBM Plex Mono for code, paths, and counts.

**Scope (out):**

- A new Shiki theme or token contrast pass
- Changing Guide chapter or why sizes that already match the density notes
- Sticky heads, collapse, or highlight bugs

**Touches:** UI, CSS

**Acceptance criteria:**

- [ ] Code Review axis headings match Guide chapter title scale on a manual
  pass of the seeded sample plus a published outcome.
- [ ] Finding cards use Guide why/body scale for title and prose; severity,
  classification, path, and reference stay meta-sized.
- [ ] Home card titles match review chrome; range and repository badge match
  header meta.
- [ ] No automated Astro DOM or pixel assertions.

**Blocked by:** none

**Blocks:** none

**Parallel-eligible:** yes
