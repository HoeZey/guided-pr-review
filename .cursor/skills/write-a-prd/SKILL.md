---
name: write-a-prd
description: >-
  Turn a completed grilling session or a cleared wayfinder map into a short
  Product Requirements Document (a contract, not an exhaustive story dump).
  Use when the user says "write a PRD" or "/write-a-prd", after grill-me /
  wayfinder / handoff, before to-issues.
---

# Write a PRD

Write the destination down. Short, specific, free of vague aspiration. Colleagues can review this; `to-issues` slices it.

## Precondition

Shared understanding first: `grill-me` has closed its decisions log, **or** a `wayfinder` map is clear (no open decision tickets, fog empty). If asked sooner, push back: *"I'd rather grill (or finish the map) first — that produces a much better PRD."*

A cleared wayfinder map is **not** a spec. Collapse linked decisions into this document. Do not skip this step at work.

## The PRD is a contract

- **Not in the PRD = not in scope.**
- **New scope during build goes back into the PRD first.**
- Keep it shorter than the grilling / map that produced it. Do not write an exhaustive user-story dump.

## Workflow

1. Read every discovery artifact (decisions log, wayfinder Decisions so far, `handoff`, `research.md`, prototype decisions).
2. **Sketch test seams before drafting.** Existing seams over new ones. Highest seam possible. Ideally one across the change. Confirm with the user.
3. **Read [`template.md`](template.md)** for structure and per-field guidance.
4. Draft from artifacts; don't rephrase crisp decisions. Implementation notes name **modules / interfaces / contracts**, never file paths.
5. Flag contradictions; resolve before shipping.
6. Show the diff. Both parties sign.
7. Hand off to `to-issues`, then `implement`. Do not start coding here.

Default output path: docs/prds/<feature-slug>/README.md. Add the feature to docs/README.md. Frontmatter status starts as draft.

## Anti-patterns

- Vague aspirations ("delight users", "modern UX") → replace with observable criteria.
- "How" sneaking into the Goal → keep in implementation notes.
- File paths in implementation notes → they go stale; use module/interface names.
- A PRD longer than the grilling that produced it → the grill wasn't tight enough.
