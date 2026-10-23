---
status: todo
blocked_by: []
blocks:
  - 06-rewrite-skill
---

# Capture the baseline guides for the five test PRs

**Type:** Story

**From PRD:** [10 Guide quality](../)

**Seam(s):** the running instance through MCP (get_review, upsert_review);
the Azure DevOps MCP read of each PR

**What it delivers:** A frozen test set with three guides per PR from the
current skill, so the rewrite has something to beat.

**Scope (in):**

- Test set: #782, #1140, #1145, #1150, #1155, the active PRs with a saved
  diff.
- Three runs per PR with the current skill's Home chaptering (get_review,
  chapter from diff.files, upsert_review with guide.source.sourceCommit set
  to diff.sourceCommit). Each run is a fresh Grok 4.7 high subagent.
- After each upsert, read the guide back with get_review. Record the
  subagent conversation id and wall time.
- Read each PR description through the Azure DevOps MCP, read-only.
- Write data/eval/guide-testset.json. One entry per PR: review id, syncKey,
  number, title, description, sourceCommit, targetCommit, diff.files, the
  skill commit SHA, and baseline runs 1 to 3 (guide, conversation id, wall
  time).
- The store ends with the run 3 guides. Their books are green.

**Scope (out):**

- Scoring or judging (07)
- Any product code or skill change
- Any review outside the five

**Touches:** data/eval/guide-testset.json only (gitignored). No tracked
file changes.

**Acceptance criteria:**

- [ ] guide-testset.json has five entries, each with three baseline guides
  that parse as Guide v1.
- [ ] Every baseline entry records its subagent conversation id and wall
  time.
- [ ] Every entry records the PR description, or an empty string when the
  PR has none.
- [ ] The five books are green on Home. No other review changed.

**Blocked by:** none

**Blocks:** 06 Rewrite the skill

**Parallel-eligible:** yes

**Checks:** node reads guide-testset.json and parses every guide with the
GuideV1 contract. No test file.
