---
name: research
description: >-
  Gather primary-source docs, SDK references, and specs into a cited
  research.md. Use when the user says "do some research" or "/research", a
  wayfinder research ticket is unblocked, or the work touches a new SDK,
  regulated domain, or unfamiliar codebase. Skip for pure refactors and
  well-trodden ground.
---

# Research

Pull the world in before writing a spec. One focused `research.md`, then move. Discovery tool — not ticket execution.

**Research is a discovery tool, not a stalling tool.** Reading for a third day means you're avoiding the next step.

## Skip rules

- **Skip:** pure refactor, well-trodden ground.
- **Don't skip:** new SDK/API, regulated domain, unfamiliar codebase, wayfinder research ticket.

## Workflow

1. **Frame the question in one sentence.** If you can't, go back to `grill-me` (or the wayfinder ticket's Question).
2. **Primary sources first:** official docs, source code, specs, first-party APIs — not a blog that quotes them. Then live versioned docs via MCP, then dependency source, then broader synthesis.
3. May run as a **background agent** so the parent session can keep working (especially wayfinder research tickets).
4. **Write `research.md`** at a sensible path (e.g. `docs/research/<topic>.md`):

   ```markdown
   # Research: <topic>

   ## Question
   <one sentence>

   ## Findings
   - <fact> [source: link or file:line]

   ## Recommended approach
   <opinionated paragraph>

   ## Trade-offs considered
   | Option | Pros | Cons |

   ## Open questions for `grill-me`
   - <thing docs couldn't resolve>
   ```

5. **Cite everything.** A finding without a source is a hallucination risk. Follow every claim back to the source that owns it.
6. **Stop when the question is answered**, not when sources run out. Link the file from the wayfinder ticket or `handoff`; don't paste it.
