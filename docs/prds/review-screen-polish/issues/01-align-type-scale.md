---
status: done
blocked_by: []
blocks: []
---

# Align chrome type and Linear mode tabs

**Type:** Story

**From PRD:** [Review screen polish](../)

**Seam(s):** CSS type scale and header tabs; existing copy formatter for
why. Manual browser check. Do not assert Astro DOM or pixel values in tests.

**What it delivers:** A reviewer sees Guide / Diff / Code Review as Linear
header tabs (text, selected underline) at Display-menu size. Chapter title
stays editorial. Why copy stays formatted body. Home and Code Review chrome
match, so sizes do not jump across surfaces.

**Scope (in):**

- Default UI chrome (tabs, Display menu, buttons, chips, rails, Home meta)
  uses the Display menu item size (13px).
- Guide / Diff / Code Review are plain header text tabs with a selected
  underline, not a boxed segmented control.
- Chapter title stays about 26px / -0.04em.
- Why / description stays formatted (paragraphs, inline code, bold) at
  about 15px / 1.55 muted.
- Code Review axis heads match chapter title scale. Finding title and prose
  match why scale. Severity, classification, path, and reference stay
  meta-sized (11px mono).
- Home card titles match review chrome; badge stays meta.

**Scope (out):**

- Linear phrase-to-diff underlines inside why copy
- A new Shiki theme
- Rounded Diff cards, chapter-column resize, removing the Reviews column

**Touches:** UI, CSS

**Acceptance criteria:**

- [x] Guide / Diff / Code Review read as Linear header underline tabs at
  chrome 13px on a manual pass.
- [x] Chapter title stays editorial scale; why copy still renders formatted
  paragraphs, inline code, and bold at body scale.
- [x] Code Review axis heads match chapter title; finding cards use why
  scale; meta stays meta-sized.
- [x] Home card titles match review chrome; range and repository badge match
  header meta.
- [x] No automated Astro DOM or pixel assertions.

**Blocked by:** none

**Blocks:** none

**Parallel-eligible:** yes
