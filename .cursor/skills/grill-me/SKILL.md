---
name: grill-me
description: >-
  Interrogate an idea, feature, or refactor one question at a time, each with
  a recommended answer and rationale. Codebase exploration before asking. Use
  when the user says "grill me", "stress-test this plan", or before writing a
  PRD for any non-trivial change that still fits one session.
---

# Grill Me

Keep asking until you and the user share an understanding. Then stop.

If the route is still foggy and will not fit this sitting, stop and recommend `wayfinder` instead of grinding two hundred questions.

Start in a **fresh conversation**, not on top of a plan an agent already wrote.

grill-me is **stateless**: it does not write docs/ or ADRs. The decisions log may be spoken or handed to handoff / write-a-prd. For glossary + ADRs, use grill-me-with-docs. Do not create CONTEXT.md.

## Hard rules

1. **One question per turn.** Never bundle.
2. **Recommended answer + one-sentence rationale** every time. You go first; the user reacts.
3. **No questions the codebase (or environment) can answer.** `Read`/`Grep`/run the tests first.
4. **Walk the design tree.** The frontier is every decision whose prerequisites are already settled. Ask the highest-leverage frontier question; resolve the branch before opening dependents.
5. **Ungrillable → `prototype`.** "How should this feel?", "one long form or three pages?" — talking will not get you there. Stop grilling that branch, time-box a prototype, come back and answer in one line.
6. **Stop at shared understanding**, not when questions run out. Do not start implementing.

## Question format

```
Q<N>. <question>
  Recommended: <default answer>
  Why: <one-sentence rationale>
  Alternatives: <opt-in, only if real>
```

## Workflow

1. Read the brief once. Map the decision tree silently.
2. For each candidate question, try `Grep`/`Read`/run-tests first. Examples:
   - *"What auth library?"* → grep manifest files.
   - *"Does X exist?"* → glob.
   - *"What's the schema?"* → read the latest migration.
3. If the question is ungrillable, say so and switch to `prototype`.
4. Ask the highest-leverage unresolved frontier question.
5. Record the answer. Loop.
6. Close with a bullet-list **decisions log** — feeds `write-a-prd`, `prototype`, `handoff`, or a `wayfinder` ticket.

## Credit

Original mental model: [Matt Pocock's `/grill-me`](https://github.com/mattpocock/skills). One-question-per-turn kept (BONDage / May 2026 Matt); current Matt default is frontier rounds.
