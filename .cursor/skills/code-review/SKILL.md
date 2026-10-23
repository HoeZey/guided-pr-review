---
name: code-review
description: >-
  Two-axis review of the diff since a fixed point: Standards (applicable
  repository guidance plus a general engineering-quality baseline) and Spec
  (markdown Story / PRD under docs/prds). Use when the user says "/code-review", "review this
  branch", or after implement in a fresh session.
---

# Code Review

Review the three-dot diff from a fixed point to HEAD on **two axes**, in parallel so neither pollutes the other. Do not merge or rerank findings across axes.

Pin a **non-empty** diff first. If implement has not committed, commit or stash is the human's job — this skill will not invent a baseline.

## Axes

- **Standards:** how well the change is engineered.
  1. Discover and apply repository guidance relevant to the changed files:
     SKILL.md, docs/README.md, applicable .cursor/rules (including path-scoped rules),
     CONTRIBUTING.md if present, coding standards, and ADRs. Repository guidance overrides
     the general baseline. Reference the relevant rule when reporting a rule
     violation. Skip checks already enforced by formatters and linters.
  2. Apply general engineering judgement where repository guidance is silent:
     correctness and edge-case safety; clarity, cohesion, and maintainability;
     appropriate coupling and duplication; KISS and YAGNI; focused tests that
     provide meaningful confidence without redundant setup or assertions
     (overlapping twins of the same assertion; tests that never execute a
     changed production path);
     sound error handling and trust-boundary validation; compatibility with
     existing public contracts and conventions; and proportionality between
     implementation/test volume, risk, and changed behavior.
  3. Fowler code smells may be used as vocabulary for maintainability findings,
     not as an exhaustive checklist or proof that code is wrong.

- **Spec:** whether the change implements the originating markdown Story and PRD
  under docs/prds/.
  Report missing or partial requirements, scope creep, and incorrect behavior.
  Quote the relevant specification line. Spec does not grade test volume or
  style.

## Process

1. Fixed point: user-supplied SHA / branch / main. Default: merge-base with the default branch. Confirm git rev-parse and a non-empty three-dot diff.
2. Spec source: Story slug in commits or the issue implement used (docs/prds/<feature>/issues/); else ask.
3. Spawn two subagents (Standards / Spec). Instruct each to return under 400 words.
   - Standards: provide the applicable repository rules and instruct it to use
     the Standards quality baseline above. Exclude product-requirement review.
   - Spec: provide the product contract and restrict it to the Spec axis above.
     Exclude code-quality review.
4. Report under the headings Standards and Spec. One-line count per axis. Do not pick a winner across axes.
5. Do not implement. Report findings only. Do not write product code, tests, or "while we're here" patches in this chat — even when the author agrees with a finding. Follow-up is a new /implement chat (or the human). Agreeing is not a request to patch here. If the user asks to fix a finding in this chat, refuse product code. Point at a new /implement chat. Issue/docs edits are OK when asked.
6. After the chat report, try to attach the same structured result to a matching localhost guide. Failure to publish does not invalidate the chat report.

   Pin full 40-character base and head SHAs (git rev-parse of the fixed point and HEAD). Then:

   ```bash
   curl -sS http://localhost:8765/api/reviews
   ```

   Match reviews where base and head equal those SHAs. If **exactly one** review matches, POST CodeReviewOutcome v1 (strict; no stored counts; unknown fields rejected) to that review:

   ```bash
   curl -sS -X POST http://localhost:8765/api/reviews/<id>/outcomes \
     -H 'content-type: application/json' \
     --data-binary @outcome.json
   ```

   Or MCP tools/call publish_review_outcome with { reviewId, outcome } at http://localhost:8765/mcp.

   Payload shape:

   ```json
   {
     "version": 1,
     "base": "40-character commit SHA",
     "head": "40-character commit SHA",
     "branch": "optional-display-name",
     "standards": { "findings": [] },
     "spec": { "findings": [] }
   }
   ```

   Finding fields: severity (major | minor | nit), title, explanation required. recommendation, location, reference optional. location needs path and startLine; endLine optional. reference needs source; quote optional. Spec findings also require classification (missing | partial | scope-creep | incorrect). Empty findings arrays are explicit zero. Do not add a count field or an aggregate verdict.

   Format explanation, recommendation, and the chat report like Guide why:
   Markdown code spans for identifiers, paths, routes, flags, and symbols;
   Markdown bold only for a true stress; blank lines start paragraphs. No
   raw HTML. Title stays a short plain sentence.

   If the app is down, the URL fails, no review matches, or more than one review matches: keep the chat report and say that nothing was attached to a localhost guide.

A change can pass Standards and fail Spec (wrong thing, clean code) or the reverse. That split is the point.

## Nested under BUILD-PROGRAM

When the parent is a long-running coordinator:

- The coordinator is the review lead. It launches Standards and Spec
  reviewers directly. Do not spawn a further review-lead wrapper.
- If you are one axis: review only that axis, return under 400 words, do not
  spawn further agents.
- Return findings only. Do not patch product code or tests.
- Do not tell the user to open a new implement chat. The coordinator decides
  remediation.
- Skip attaching to a localhost guide unless the frozen run manifest
  explicitly authorizes that exact write.
