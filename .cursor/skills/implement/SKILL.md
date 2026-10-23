---
name: implement
description: >-
  Build one already-decided markdown Story under docs/prds: do not redesign,
  drive tdd at PRD seams, typecheck, full suite once, then review. Use when
  the user says /implement, implement this ticket, or points at a Story after
  to-issues. One ticket per session (own worktree if running in parallel).
disable-model-invocation: true
---

# Implement

Session orchestrator for work that is **already decided**. Read the Story,
trust the PRD, write the code. Do not grill, do not reopen the plan, do not
grow a feature.

tdd is the test loop this skill drives. qa is not this skill — file bugs
there after the fact.

## When to use

| The work is… | Reach for |
|---|---|
| A markdown Story under docs/prds/<feature>/issues/ | /implement 01-show-latest-outcome (confirm the title back first) |
| A spec not yet sliced | to-issues first |
| Not written down | grill-me / wayfinder — not this skill |
| One behaviour, no ticket | tdd directly |
| User reporting a bug | qa (file it) |
| Hard bug / "debug this" | diagnosing-bugs |

There is no Jira board in this repo. Do not fetch TCD tickets unless the
user explicitly asks.

## Hard rules

1. **One Story per invocation.** Confirm the issue title before touching code.
2. **Do not redesign.** No interview, no "better approach." Wrong ticket →
   stop; send it back to the PRD / to-issues.
3. **Seams come from the PRD** (Testing / seams plus the ticket's Seam(s)
   field). Confirm if missing; then drive tdd.
4. **Drive local tdd** — red → green → **refactor while green** (Beck). Refactor
   includes the test suite: collapse twins, fold asserts, drop tests that never
   call changed production code. This is not current Matt tdd (he moved refactor
   into review).
5. **Typecheck often.** Run the focused test file each cycle; **full suite
   once** at the end. Here: npx --no-install tsc --noEmit && npm test. Before
   that suite, collapse overlapping tests added this ticket. Do not ship
   input/output (or similar) twins of the same assertion.
6. **Checkout:** never two implement sessions in the same working copy.
   Parallel-eligible Stories (no graph blockers) each get their **own git
   worktree + branch** under .cursor/worktrees/, named like
   feature/05-01-show-latest-outcome in the repo commit rules. File overlap
   is fine; merge later. Do not use git stash (refs/stash is shared).
7. **Commit when the slice is green.** Follow the repo's commit-message
   rules. Do not open a PR unless the user asks. Do not skip hooks.
8. **Board is markdown.** Set the issue frontmatter status to doing when you
   start. When acceptance criteria pass: status done, tick the matching
   checkbox in that feature's issues/README.md. Do not close GitHub issues
   or TCD Jira unless the user asks. There is no ship-ticket / changelog
   board here.
9. **Review after there is a commit** (or in a fresh session against the
   branch point). Reviewing an empty git diff develop...HEAD is a no-op. Prefer
   a **fresh session** so the author does not grade its own exam. Two axes:
   Standards vs Spec (see code-review).

## One run

1. Fetch the Story from docs/prds/<feature>/issues/<NN-slug>.md. Restate
   what you will build. Stop if it is a wayfinder decision ticket (under
   decisions/), not a Story.
2. Read docs/prds/<feature>/README.md. Name the seam(s).
3. If parallel with another in-flight Story: work in a dedicated worktree.
   If the board marked it blocked, refuse.
4. For each acceptance criterion: tdd (red → green → refactor, including
   test collapse).
5. Typecheck + that test file as you go. Collapse overlapping tests from
   this ticket, then full suite once, green.
6. Flip the issue to done and tick issues/README.md.
7. Commit on the Story branch. Show the SHA. PR only if asked. Suggest
   code-review in a new chat against the merge-base.

## Nested under BUILD-PROGRAM

When the parent is a long-running coordinator:

- Do not suggest a new chat or start code-review.
- Run the manifest's focused checks instead of the solo full suite; the
  coordinator owns integrated full checks.
- Keep the issue doing and do not tick issues/README.md done before
  independent review; the coordinator/integrator owns accepted bookkeeping.
- Return to the coordinator: head SHA, focused checks run, remaining risks.

## Lineage

Orchestrator shape from [Matt Pocock's implement](https://www.aihero.dev/skills-implement).
Local deltas: markdown issues under docs/prds/, Beck tdd, worktrees for
parallel-eligible tickets, commit when green, review in a fresh session, qa
stays a separate loop.
