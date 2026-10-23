# To Issues — Worked Example

A concrete demonstration of how to slice a small PRD into vertical tickets, and what the wrong way looks like for contrast.

## Tiny PRD (input)

> **Goal:** Users can view test results for a pipeline revision.
>
> **Stories:**
> - As an analyst, I want to see whether the latest test run passed or failed for a revision.
> - As an analyst, I want to drill into a failed test to see which assertion failed.

## Bad slicing (horizontal layers)

| # | Title | Touches |
|---|---|---|
| 1 | Add `test_run_status` column to `pipeline_revision` | migration |
| 2 | Add `GET /revisions/{id}/test-results` endpoint | router |
| 3 | Build test results UI panel | UI |
| 4 | Wire the panel to the endpoint | UI |

**Why it's bad**

- Nothing is testable end-to-end until all four ship.
- Ticket 1 has zero user-observable behavior — you can't demo it.
- Unknown unknowns hide until the very end (does the endpoint shape work for the UI? does the badge fit the header? does the migration backfill correctly under load?).
- The order is a deployment order, not a value-delivery order.

## Good slicing (vertical)

| # | Title | Scope (touches) | Blocked by |
|---|---|---|---|
| 1 | Revision header shows a pass/fail badge | migration + repo + API + UI badge | — |
| 2 | Click badge → modal with per-test pass/fail list | API extension + UI modal | #1 |
| 3 | Click failed test → assertion details inline | API extension + UI expand | #2 |

**Why it's good**

- Each ticket ships a user-observable behavior — demoable on landing.
- Each is testable end-to-end (unit + integration + smoke) the moment it merges.
- Ticket 1 alone is shippable. If that's all that lands this week, analysts still get value.
- Blocking relationships are explicit: #2 needs the badge to exist; #3 needs the modal.
- The riskiest assumption ("does the test-result API shape work?") is validated by #1 — the cheapest ticket — before #2 and #3 commit to it.

## How the board reads

```
#1 (no blockers) ──► #2 ──► #3
```

A graph, not a checklist. **Parallel-eligible = no blockers** — including when tickets touch the same files. If a new ticket #4 ("export results as CSV") only needs #1, it is parallel with #2 even if both edit the results UI.

## Pattern to copy

For any PRD:

1. List the user-observable behaviors. Each behavior is a candidate ticket.
2. For each behavior, list every layer it touches (DB, API, UI, etc.). One ticket = all layers for that behavior, not one layer for all behaviors.
3. Find the smallest ticket that proves the riskiest assumption. Start there.
4. Draw arrows only when one behavior *literally cannot exist* without another. **Parallel-eligible = no blockers.** File overlap is not a reason to serialize.
