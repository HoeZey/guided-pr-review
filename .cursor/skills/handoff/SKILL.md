---
name: handoff
description: >-
  Package discovery-phase decisions, research, and prototype outcomes into a
  single file so nothing is lost when context is reset. Use when the user says
  "handoff", "package this for the next session", after grill-me / wayfinder /
  prototype, or before write-a-prd.
---

# Handoff

Prevent LLM context rot. Decisions, not code. Link, don't duplicate. Cross-cutting — not a prototype phase.

## When to run

- After `prototype` produces a decision, before the next planning skill.
- After a long `grill-me` or `wayfinder` session, before a new chat / day.
- Any time the next phase will run in a fresh context window.

## Workflow

1. Pick a location: `.handoff/<feature-slug>.md` (committed if days away; tmp if same-session).
2. Pull in: grill-me decisions log, wayfinder Decisions so far (link docs/prds/<feature>/MAP.md), research.md (link), prototype **decisions** only, new PRD glossary lines / ADRs.
3. Write using the template below.
4. Tell the user where it is and which skill comes next.

## Template

```markdown
# Handoff: <feature>

## Goal
<one sentence>

## Decisions made
- <decision> — because <reason>

## Research artifacts
- [research.md](path) · [ADR-NNN](path) · [wayfinder map](docs/prds/<feature>/MAP.md)

## Prototype outcomes
- Question: <probed> · Decision: <learned>

## Open questions (intentionally deferred)
- <thing> — and why

## Domain language additions
- <term> — <definition>

## Next skill
`write-a-prd` | `wayfinder` | `grill-me` | `implement` | other

## Watch out
- <gotcha future-you would forget>
```

## Hard rules

- **Decisions, not code snapshots.**
- **Link to research.md, ADRs, prototype files, PRDs — don't inline.**
- **Redact** API keys, passwords, tokens, and personally identifiable information.
- **Name the next skill.** Planning chain next is usually `write-a-prd` or `wayfinder`, not `tdd`.
- **One handoff per feature.** Update in place; no `handoff-v2.md`.
