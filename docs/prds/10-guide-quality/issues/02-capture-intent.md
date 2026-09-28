---
status: todo
blocked_by: []
blocks:
  - 05-app-opens-diffs
---

# Save the PR description and commit messages with the diff

**Type:** Story

**From PRD:** [10 Guide quality](../)

**Seam(s):** the review service syncDiff with fake provider readers and a
fake git runner; get_review through MCP

**What it delivers:** A refresh stores the author's intent next to the
saved diff, so the agent can explain why a change exists without the app
calling the host again.

**Scope (in):**

- ProviderPullRequestMetadata gains description. The Azure DevOps reader
  maps the pull request description. The GitHub reader maps body. Missing
  maps to no description.
- syncDiff runs git log target..source in the managed cache after the
  commits are fetched: sha, subject, and body per commit, oldest first.
- ReviewDiff gains optional intent: { description?, commits: [{ sha,
  subject, body }], truncated? }. Old rows without intent still validate.
  No migration.
- Caps: 8,000 characters of description, 100 commits. truncated is set when
  either cap hits.
- Intent is written together with the diff. A refresh that skips because
  diffCommit already matches does not rewrite intent. A changed
  description alone does not move the book.
- get_review returns diff.intent when present.

**Scope (out):**

- read_diff printing intent (03)
- add_local_review commits (05)
- Showing intent in the UI

**Touches:** ProviderPullRequestMetadata in src/lib/server/providers/ports.ts;
getPullRequest in src/lib/server/providers/ado-rest.ts and
src/lib/server/providers/github/rest.ts; a commit log on the managed cache in
src/lib/server/git/ports.ts and src/lib/server/git/managed-cache.ts; syncDiff
in src/lib/server/services/reviews.ts; ReviewDiff in
src/lib/shared/contracts/persistence.ts; the tools contract in
src/lib/shared/contracts/tools.ts. Production path: syncDiff.

**Acceptance criteria:**

- [ ] After syncDiff, the saved diff holds the description and the commits
  between target and source, oldest first.
- [ ] A 9,000-character description is stored as 8,000 characters with
  truncated set. 101 commits store 100 with truncated set.
- [ ] Both provider readers map the description, and a PR with none stores
  no description.
- [ ] A skipped refresh leaves intent unchanged.
- [ ] A stored row without intent still validates.
- [ ] get_review returns the intent.

**Blocked by:** none

**Blocks:** 05 The app opens diffs for named PRs and local ranges

**Parallel-eligible:** yes

**Checks:** reviews-diff.test.ts through the real review service with fake
readers and a fake git log; ado-rest and GitHub rest reader tests for the
description field; managed-cache.test.ts for the log command.
