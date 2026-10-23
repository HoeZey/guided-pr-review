---
name: qa
description: >-
  Turn a user-reported problem into a durable, domain-language markdown issue
  under docs/prds with a failing-test sketch. Use when the user says /qa,
  let's QA this, or I'm seeing a bug. Not triage; not implement.
---

# QA

Closes the **execution** loop. implement / tdd build a Story; qa turns what
the user sees going wrong into a board item that can become the next Story
(or a failing test on the current one).

Not on the planning path (wayfinder → PRD → to-issues). Not a replacement
for tdd.

## A durable issue

- **Survives a week without chat context.**
- **Uses domain language** from the feature PRD and docs/README.md.
- **Points to a test that doesn't exist yet.**
- **Describes the observed problem**, not a guessed cause.

## Workflow

1. Read docs/README.md and the relevant docs/prds/<feature>/README.md.
2. Let the user describe the problem freely.
3. Clarify one question at a time (grill-me discipline).
4. **Reproduce or locate.** Don't ask what you can grep.
5. Classify:
   - **Bug, cause/seam already obvious** → durable issue; next is implement
     / tdd.
   - **Hard bug** (no tight repro, intermittent, "staring at code"): file
     what you have, then **diagnosing-bugs**. Do not guess-fix from this
     skill.
   - **Missing feature** → to-issues slice; say so if the PRD didn't cover
     it.
   - **Working-as-designed** → explain; glossary/ADR only if non-obvious.
6. **Read [template.md](template.md).** Write. After the user agrees, add
   the next NN-slug.md under that feature's issues/ and a Status line in
   issues/README.md — same quiz-before-publish habit as to-issues. Do not
   publish to Jira or GitHub Issues unless the user asks.

## Closing a fix

When the user confirms a filed issue is actually fixed: set status done and
tick issues/README.md. This skill still does not implement the fix.

## Hard rules

- **Don't ask what you can grep for.**
- **One issue per problem.**
- **Domain language only.**
- **A title that needs the body to be understood is a bad title.**
- Do not start implementing or debugging from this skill. Obvious bugs →
  implement / tdd. Hard bugs → diagnosing-bugs.
- Do not write context/. Capture is docs/.
