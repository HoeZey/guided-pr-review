---
name: 10x-engineer
description: >-
  Route a non-trivial idea through planning then execution: grill or wayfinder
  → PRD → markdown issues under docs/prds → implement (tdd) ⇄ qa; hard bugs →
  diagnosing-bugs. One skill per phase. Use when the user says 10x engineer
  or ai-native workflow.
---

# 10x Engineer

One phase, one goal, one agent at a time — so agents don't develop
main-character syndrome and "plan, prompt, pray" doesn't ship.

**This skill is a router.** Invoke **one** skill per turn.

```
too big for one session? ─ yes → wayfinder (decision map)
                         └ no  → grill-me / grill-me-with-docs
                                      ↓
                         research / prototype  (ungrillable → prototype)
                                      ↓
                                 write-a-prd
                                      ↓
                                  to-issues      (markdown Stories)
                                      ↓
                    one Story ── implement ── code-review (fresh chat)
                    many Stories unattended ── long-running plan
                                                    ↓ approve
                                               long-running run
                                                    (nested implement / review / integrate)
```

Do not start implement or long-running until the board exists. Do not use
tdd / implement / long-running to plan.

| Phase | Skill | What it does |
|---|---|---|
| 00 · SCALE | wayfinder | Multi-session **decision** map. One feature folder = one map. Plan, don't do. |
| 01 · IDEA | grill-me | Interrogate until shared understanding (one sitting). |
| 01 · IDEA (alt) | grill-me-with-docs | Same, grounded in docs/README.md and signed PRDs. |
| 02 · RESEARCH *(opt)* | research | Cited primary-source docs/research/<topic>.md. |
| 03 · PROTOTYPE *(opt)* | prototype | Throwaway probe — one ungrillable question. |
| — · CROSS-CUTTING | handoff | Package decisions when context will reset. |
| 04 · PRD | write-a-prd | Short contract at docs/prds/<feature>/README.md. |
| 05 · BOARD | to-issues | Vertical markdown Stories; quiz; then write issues/. |
| 05b · PROGRAM-PLAN | long-running plan | Switch to Plan mode. After a multi-story board: fill Cursor's plan artifact from the manifest template. Stop for approval. Same PRD/issue contract; no second ticket format. |
| 06 · BUILD | implement | One Story; no redesign; drives tdd. |
| 06 · BUILD (loop) | tdd | Red / green / **refactor while green** (Beck; collapse overlapping tests in that refactor). |
| 06b · BUILD-PROGRAM | long-running run | After approval, save the manifest at .runs/<id>/manifest.md. Fresh Agent chat runs /long-running run with that path. Nested implement, review, remediation, integrate. |
| 07 · QA | qa | User-reported problems → durable issues under the feature. |
| 07 · DIAGNOSE | diagnosing-bugs | Hard bugs: red loop first, then cause, then tdd regression. |
| 08 · REVIEW | code-review | Standards vs Spec, fresh session, after a commit. Report only; do not implement. |

## Operating rules

- **If it will not fit one session** → wayfinder. Else grill.
- **No PRD before shared understanding.**
- **Ungrillable interrupt:** leave grill, prototype, return.
- **Skip research/prototype** on well-trodden ground; don't skip new SDKs /
  regulated / unfamiliar code.
- **PRD is a contract.** Not in the PRD = not in scope.
- **Board is a graph.** Parallel-eligible = no blockers (file overlap is fine).
- **implement trusts the board.** One ticket, own worktree if parallel,
  commit when green. PR only if asked. After a full board: one ticket with
  you in the loop → /implement KEY. Many tickets unattended →
  /long-running plan, then save .runs/<id>/manifest.md and start a fresh
  /long-running run <manifest-path>.
- **Nested Task is allowed inside BUILD-PROGRAM only.** A fresh subagent is
  the fresh session for implement and code-review. Do not paste "open a new
  chat" at the user. Nested implement / review / integrate are roles inside
  that one phase.
- **Mode boundary is mandatory.** PROGRAM-PLAN runs in Plan mode and stops
  for approval. BUILD-PROGRAM runs in Agent mode after approval.
- **qa files; diagnosing-bugs hunts.** Obvious bug → ticket then implement.
  No red loop yet / intermittent / "debug this" → diagnosing-bugs. Neither
  is planning.
- **tdd here is Beck** (refactor in the loop). Current Matt tdd is red-green
  only.
- **Capture is docs/, not context/.** No TCD Jira unless the user asks.

## Worth adopting once

- Domain language lives in the feature PRD and in handoff Domain language
  additions. Do not create CONTEXT.md.
- docs/adrs/ — only when a decision is hard to reverse **and** surprising
  **and** a real trade-off.

## Lineage

[Matt Pocock](https://github.com/mattpocock/skills) (grill / wayfinder /
spec / tickets / implement-as-orchestrator). Local tdd stays Beck. This
clone uses markdown under docs/prds/, not Atlassian. Theo Depraetere
([BONDage](https://www.linkedin.com/feed/update/urn:li:activity:7463151557669228546/)).
