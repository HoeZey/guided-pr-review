---
name: to-issues
description: >-
  Slice a PRD into markdown Stories under docs/prds/<feature>/issues/ with
  explicit blocked-by links. Quiz the breakdown before writing files. Use
  when the user says /to-issues, turn this PRD into tickets, or break this
  down, after write-a-prd. Next is implement, not coding in this skill.
---

# To Issues

Each ticket is a thin **vertical** Story — a little frontend, a little
backend — testable end-to-end the moment it is done. These are delivery
Stories under a signed PRD, **not** wayfinder decision tickets.

This repo has no Jira board. Publish is markdown files. Do not call
Atlassian MCP.

## Vertical, not horizontal

| Good slice | Bad slice |
|---|---|
| User can submit feedback (DB + endpoint + minimal form) | Feedback table migration |
| Pipeline list shows status badge (field + API + UI) | Add status column |
| Login with email/password (DB + endpoint + form + redirect) | Build the auth middleware |

**Read [examples.md](examples.md)** for a worked comparison.

## The board is a graph

- **Parallel-eligible = no graph blockers.** Shared files do not serialize.
  Merge conflicts later beat idle time.
- If a ticket needs another's *behavior*, **draw the block** (blocked_by /
  blocks in frontmatter and body).
- Prefactor goes first only when it is a real dependency (the change is not
  easy until this tangle is gone) — not because of file overlap.

## Prefactor and wide refactors

- Look for "make the change easy, then make the easy change." If a
  prefactor must land before any vertical slice can stay green, it is
  ticket 0 and **blocks** the rest.
- **Wide mechanical change** (rename a column, retype a shared symbol) is
  the exception to vertical slicing. Sequence expand → migrate in batches →
  contract. Don't force it into a fake tracer bullet.

## One-window size

Each Story should fit **one fresh agent context window**. If it doesn't fit
on a screen or would blow a session, split.

## Workflow

1. Read the PRD at docs/prds/<feature>/README.md (user stories, success
   criteria, Testing / seams). Do not slice a wayfinder map — collapse it
   with write-a-prd first.
2. Draft vertical slices. Each names the **seam(s)** it covers (point at
   the PRD Testing section).
3. **Quiz before any file write.** For each ticket show: Title, Blocked by,
   What it delivers, Parallel-eligible (yes iff no blockers), Seam(s). Ask:
   granularity, edges, merge/split. Iterate until approved.
4. Only then write docs/prds/<feature>/issues/NN-slug.md (01, 02, …) using
   the template below, plus issues/README.md (delivery graph + Status
   checkboxes). Do not change the parent PRD status except in_progress when
   the first issue starts. Add the feature to docs/README.md if it is new.
5. **Stop.** Next skill is implement (one Story per session). Do not start
   coding in this skill.

Draft path if needed: .handoff/<feature>-tickets.md until the quiz passes.

## Template

```markdown
---
status: todo
blocked_by: []
blocks: []
---

# <imperative, user-facing>

**Type:** Story

**From PRD:** [<feature>](../)

**Seam(s):** <from PRD Testing / seams>

**What it delivers:** <end-to-end behavior, user's perspective>

**Scope (in):**

- <observable behaviors>

**Scope (out):**

- <deferred>

**Touches:** contracts / store / HTTP / MCP / UI / tests

**Acceptance criteria:**

- [ ] <observable, testable>

**Blocked by:** none

**Blocks:** none

**Parallel-eligible:** yes | no
```

blocked_by / blocks in frontmatter use sibling slugs (02-browse-outcome-history).
No file paths in the body (they go stale). Exception: a prototype snippet
that encodes a decision more precisely than prose — trim to the decision.

Issue status is todo, doing, or done (see docs/README.md).

## Anti-patterns

- One ticket per layer (DB / API / UI). That's not a slice; it's a stack trace.
- Publishing before the quiz.
- Dumping wayfinder decision tickets into the delivery board.
- "Refactor X" with no user-facing acceptance criteria → fold into a slice,
  or expand–contract.
- Hidden dependencies → draw the block.
- Mega-tickets that don't fit one context window → split.
- Handing off to tdd here — implement wraps tdd. This skill only publishes
  the board.
- Opening TCD Jira or Atlassian MCP for this product.
