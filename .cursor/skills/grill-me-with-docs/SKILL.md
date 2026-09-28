---
name: grill-me-with-docs
description: >-
  Run the grill-me loop while grounding every question in docs/README.md and
  signed PRDs, updating domain language inline. Use when the user says grill
  me with docs, grill-with-docs, or works in a mature codebase with
  established conventions.
---

# Grill Me (with docs)

Same loop as grill-me (one question per turn, ungrillable → prototype,
design tree), calibrated to the project's language and past decisions.

## Prerequisites

- **docs/README.md** — feature index and status vocabulary.
- **docs/prds/<feature>/README.md** — signed (or in-progress) contracts.
  Domain language lives here, not in CONTEXT.md.
- **docs/adrs/** — optional; only if ADRs already exist.

If docs/README.md is missing, ask once: scaffold docs/ as we go, or run
plain grill-me?

Do not create CONTEXT.md or context/.

## Workflow

1. Read docs/README.md and the relevant PRD before the first question. Use
   the project's terms.
2. Run the grill-me loop (see that skill). Challenge terms that conflict
   with the PRD immediately.
3. **Update the feature PRD or .handoff/<feature>.md Domain language** when
   a term resolves — one-line definition + example. Show the diff before
   writing. Do not batch until the end. Do not put implementation in the
   glossary.
4. **Propose an ADR** only when **all three** are true:
   - hard to reverse
   - surprising without prior reading
   - the result of a real trade-off

```
docs/adrs/NNN-short-title.md
── Status · Context · Decision · Consequences
```

5. Close with the same decisions log as grill-me, plus glossary additions
   and ADRs created.

Skip the ADR if any of the three is missing. Most sessions add glossary
lines and few or no ADRs.
