---
status: todo
blocked_by:
  - 01-capture-baseline
  - 04-chapter-by-reference
  - 05-app-opens-diffs
blocks:
  - 07-compare-guides
---

# Rewrite the skill around read_diff and chapter_review

**Type:** Story

**From PRD:** [10 Guide quality](../)

**Seam(s):** the skill contract test on SKILL.md

**What it delivers:** Home, a named PR, and a local range all chapter the
same way, with change-based chapters, a why that uses the author's intent,
and a subagent brief that carries the rules.

**Scope (in):**

- Home: list_reviews, pick grey or yellow reviewer reviews as today, one
  subagent per id with the fixed brief (read the Chapter section of the
  skill, read_diff for the id, chapter_review with that sourceCommit, on a
  400 fix only the named ranges and retry up to twice, reply with one line:
  id, chapter count, ok or error). Writer model: Grok 4.7 high.
- Named: open_pull_request with the URL or a PR number resolved against
  origin; skip when chaptered and not behind (set_active and open the
  review URL); otherwise read_diff then chapter_review.
- Local: pin the range as today, add_local_review, then read_diff and
  chapter_review.
- Remove from the skill: Azure DevOps MCP ingest, fetch in the local clone,
  az rest iteration calls, the handwritten source JSON, add_review,
  upsert_review, chapter kinds, summary, and the rule against splitting a
  hunk.
- Chapter rules from the PRD: one self-contained change with its contract,
  callers, wiring, and tests; the three split checks; one chapter only when
  the PR does one thing; order so each reads with only the earlier ones;
  skim last.
- Title and why shape from the PRD. No Jira fetch. Code wins over the
  description without a flag. Formatting rules stay.
- The MCP tools section lists the new tool set.

**Scope (out):**

- App code
- Running the comparison (07)

**Touches:** SKILL.md at the repo root; src/lib/shared/skill-contract.test.ts.

**Acceptance criteria:**

- [ ] Home, Named, and Local each name read_diff and chapter_review.
- [ ] The Home section contains the fixed subagent brief and the retry
  rule.
- [ ] The skill no longer mentions add_review, upsert_review, core,
  consequences, glue, summary, az rest, or git fetch.
- [ ] The Chapter section states the split checks, the order rule, and the
  why shape.
- [ ] The tools section matches the handler tool list.

**Blocked by:** 01 Capture the baseline, 04 Chapter by reference, 05 The
app opens diffs

**Blocks:** 07 Compare guides

**Parallel-eligible:** no

**Checks:** skill-contract.test.ts, including a check that the skill's tool
list equals the handler's tools/list names.
