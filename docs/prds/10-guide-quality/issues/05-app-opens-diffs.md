---
status: todo
blocked_by:
  - 02-capture-intent
blocks:
  - 06-rewrite-skill
---

# The app opens diffs for named PRs and local ranges

**Type:** Story

**From PRD:** [10 Guide quality](../)

**Seam(s):** MCP tools/call open_pull_request and add_local_review on the
handler; the review service syncDiff; tools/list

**What it delivers:** A named PR URL or a local branch becomes a saved
review with its diff and intent in one tool call, and full-guide writes are
no longer offered to agents.

**Scope (in):**

- open_pull_request { url }. Parse an Azure DevOps URL (dev.azure.com or a
  visualstudio.com host, .../{org}/{project}/_git/{repo}/pullrequest/{n})
  or a GitHub URL (github.com/{owner}/{repo}/pull/{n}). Resolve the
  repository through the existing repository reader, run syncDiff, and
  return { id, chaptered, behind }. behind is true when the guide's source
  commit differs from the saved diff's. An unsupported host or a malformed
  URL is a 400.
- add_local_review { repoPath, base, head, title? }. Through the existing
  git process runner: git rev-parse both, git diff -U3 -M base...head, and
  git log base..head. Parse with the existing unified-diff parser. Save an
  unchaptered review with diff and intent commits (no description). title
  defaults to the head commit subject. Reject a path that is not a git work
  tree, an unknown commit, and an empty diff. The app never checks out or
  fetches in that repository.
- Remove add_review and upsert_review from the MCP tool list. The store
  functions stay for syncDiff, the seeded sample, local adoption, and tests.

**Scope (out):**

- Chaptering (04)
- The skill text (06)
- Adding the repository to the configured list

**Touches:** open_pull_request and add_local_review in
src/lib/server/mcp/handler.ts and the tools contract in
src/lib/shared/contracts/tools.ts; syncDiff and a local-diff entry in
src/lib/server/services/reviews.ts; the git process runner in
src/lib/server/git/process.ts; the unified-diff parser in
src/lib/server/git/parse-unified.ts. Production path: the handler and the
review service.

**Acceptance criteria:**

- [ ] An Azure DevOps and a GitHub PR URL each return a review id with a
  saved diff and intent, through fake readers and a fake git runner.
- [ ] A second open_pull_request at the same commit reports chaptered and
  behind correctly and does not rewrite the diff.
- [ ] add_local_review on a temporary git repository saves a diff that
  read_diff can number, with commits in intent.
- [ ] A non-repository path, an unknown commit, and an empty diff are each
  rejected.
- [ ] tools/list offers open_pull_request and add_local_review and no
  longer offers add_review or upsert_review.

**Blocked by:** 02 Save the PR description and commit messages with the
diff

**Blocks:** 06 Rewrite the skill

**Parallel-eligible:** no. After 02 lands, yes with 03 and 04

**Checks:** handler.test.ts for both tools and the tool list;
reviews-diff.test.ts for open through syncDiff; a temporary-repository test
for add_local_review with the real git runner.
