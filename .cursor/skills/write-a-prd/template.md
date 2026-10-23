# PRD Template

Copy the block below into docs/prds/<feature-slug>/README.md and fill it in. Pull text directly from the grill-me decisions log, wayfinder Decisions so far, handoff, research.md, and prototype decisions — don't rephrase crisp wording.

---

```markdown
---
status: draft
---

# PRD: <feature>

## Problem
<one paragraph — what's broken / missing / desired. No solution language yet.>

## Goal
<one sentence — the destination. No "how", no adjectives that aren't measurable.>

## Non-goals
- <thing we are explicitly NOT doing — list anything a reader might assume is included>
- <thing>

## User stories
- As a <role>, I want to <action> so that <outcome>.
- As a <role>, ...

## Implementation notes
- <constraint or design decision from grill-me / wayfinder>
- <SDK / data model choice from research>
- <interaction pattern from prototype>
(Modules, interfaces, contracts — **no file paths**.)

## Testing / seams
**Seam(s):** <public boundary we will test at — existing/highest; ideally one>
**Why this seam:** <one sentence>
**What a good test is here:** behavior through that interface, not internals
**Prior art:** <similar tests in the repo, or "none yet">

## Trade-offs (decided)
| Decision | Chose | Rejected | Why |
|---|---|---|---|
| <axis> | <option> | <option> | <one sentence> |

## Open questions (intentionally deferred)
- <thing> — will revisit when <trigger>

## Success criteria
- <observable, testable signal>
- <observable, testable signal>

## Out of scope
- <thing someone might assume is included but isn't>

## References
- [grill-me decisions log](path)
- [wayfinder map](MAP.md)
- [research.md](path)
- [prototype decision](path)
- [ADR-NNN](path)
```

---

## Field guidance

**Problem vs Goal.** Problem is the current state; Goal is the desired state. If "Goal" reads like "do X", split — the *what* belongs in user stories, the *destination* belongs in Goal.

**Non-goals are not "deferred features".** They are things you've actively decided not to do, ever (in this PRD's scope). Use "Open questions" for *not yet*.

**Seams.** Confirm with the user *before* writing the rest of the PRD. Prefer an existing public boundary. New seams only when nothing current can observe the behavior. File paths do not belong here either — name the interface.

**Implementation notes.** Modules and contracts, not `src/foo.ts`. Prototype snippets (state machine, schema, type shape) may be inlined when prose cannot hold the decision; trim to the decision, not a demo.

**Trade-offs table** — only include decisions where a real alternative was considered and rejected. Skip if the decision was obvious.

**Success criteria are observable.** "Users are happy" fails this. "p95 latency < 200ms on the dashboard endpoint" passes.

**User stories stay short.** Cover the contract, not every edge. Exhaustive lists belong in a different methodology.

**Out of scope** catches the things a reader might *infer* are included. It's the inverse of Non-goals (which are scoped to this PRD's domain).
