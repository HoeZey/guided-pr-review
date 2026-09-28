---
name: prototype
description: >-
  Build a scoped throwaway probe that answers exactly one design question.
  The decision is the artifact; the code gets deleted. Use when the user says
  "prototype this", "let's spike", grilling hits an ungrillable question, or a
  wayfinder prototype ticket needs a cheap artifact to react to.
---

# Prototype

Throwaway code, real answers. Hash out design decisions while it's still cheap. Discovery tool — not ticket execution.

Prototypes hunt **unknown unknowns** — the gaps a PRD can't predict because nobody has seen the thing yet.

## A prototype answers exactly one of

1. *"Does this logic / state model feel right?"* (behavioral probe)
2. *"What should this look like?"* (visual / interaction probe)

Can't pick one → scope is too big. Cut it.

## Hard rules

- **The decision is the artifact, not the code.** Delete (or move to `prototypes/`) when done. Do not commit throwaway branches to main.
- **No tests. No production paths.** Don't touch real auth, data, or users.
- **Time-box up front.** State it. Stop when it rings.
- **One question per prototype.** Build a second one for a second question.
- **Locate it next to the real module**, named so a casual reader sees it is a prototype.
- **Trivial to run** — one command, or a file you can open. No thinking to start it.
- **No persistence by default.** State in memory. If the question *is* persistence, use a scratch store named `PROTOTYPE-wipe-me`.
- **Surface the full relevant state** after every action (logic) or variant switch (UI).

## Workflow

1. Write the question + time-box at the top of the file.
2. Pick the cheapest substrate:
   - Logic: script / notebook / small interactive probe that pushes the state machine through cases that are hard on paper.
   - UI: **several radically different** variants, switchable — not one pretty mock.
3. Build until the question is answered, not until the code is "good".
4. Write the decision at the bottom:

   ```markdown
   ## What I built
   ## What I learned
   ## Decision
   ```

5. Hand the **decision** off via `handoff` (or onto the wayfinder ticket). Delete the code.

## Lineage

Two-question split from [Matt Pocock's prototype](https://github.com/mattpocock/skills). Time-box and delete-over-commit kept (BONDage).
