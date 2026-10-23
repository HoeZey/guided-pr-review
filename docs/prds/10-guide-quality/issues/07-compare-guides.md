---
status: todo
blocked_by:
  - 06-rewrite-skill
blocks: []
---

# Compare new guides against the baseline

**Type:** Story

**From PRD:** [10 Guide quality](../)

**Seam(s):** the eval script on a fixture test set; the running instance
through MCP for the new runs

**What it delivers:** A report that says, per PR and overall, whether the
rewritten skill beats the baseline on judged quality, coverage, and tokens.

**Scope (in):**

- Three new runs per test PR with the rewritten skill, each a fresh Grok
  4.7 high subagent. Record guide, conversation id, and wall time in
  guide-testset.json under new.
- Judging: 15 fresh Opus 5.5 subagents, one per matched pair (baseline run
  n against new run n). Each gets the saved diff, the description, and the
  two guides as A and B in random order. It scores coverage, reading order,
  why matches intent, and no findings, 1 to 5 each, with a quoted chapter
  id or file and line per score. The A/B key goes to a separate file in
  data/eval.
- A committed eval script reads data/eval and computes per guide:
  uncovered and duplicated changed lines against the saved diff, chapter
  count, and guide JSON size. It reads input and output tokens per writer
  conversation from Cursor usage events, the run-efficiency method.
- data/eval/report.md: per PR and overall, each side's median and spread
  per criterion, the automatic metrics, and every judgment with its
  evidence.
- The maintainer reviews the report afterwards.

**Scope (out):**

- Changing the skill based on the result (a later story)
- A judge other than Opus 5.5

**Touches:** a new script under scripts/; data/eval (gitignored).

**Acceptance criteria:**

- [ ] guide-testset.json holds three new runs per PR next to the baseline.
- [ ] 15 judgments exist, each from its own subagent, each score with
  evidence, and the A/B key is separate.
- [ ] report.md shows medians, spreads, coverage, chapter counts, sizes,
  and tokens for both sides.
- [ ] The script run on a two-PR fixture produces the same coverage numbers
  as a hand count.

**Blocked by:** 06 Rewrite the skill

**Blocks:** none

**Parallel-eligible:** no

**Checks:** one small test for the eval script's coverage count on a
fixture. No model call in the test.
