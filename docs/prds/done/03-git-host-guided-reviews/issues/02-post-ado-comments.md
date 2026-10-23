---
status: cancelled
blocked_by: []
blocks: []
superseded_by:
  - ../../../08-inline-git-host-comments/
---

# Post Azure DevOps comments from reviewed lines

**Cancelled:** [08 Inline git-host
comments](../../../08-inline-git-host-comments/) supersedes this story. The
old implementation coupled comment delivery to agent/MCP or az-rest transport
that 07 replaces. Keep this file as historical scope only; do not implement or
merge feature/post-ado-comments.

**Type:** Story

**From PRD:** [Git-host guided reviews](../)

**Seam(s):** commentAnchorForLines; provider-neutral createThread

**What it delivers:** A reviewer can write a comment beside a displayed ADO PR
diff and send it immediately to the matching Azure DevOps pull request.

**Scope (in):**

- Open a composer from a current-side line.
- Extend a contiguous current-side range with Shift-click.
- Treat a deleted-only line as a file-level comment.
- Resolve the repository and PR only from stored pull-request provenance.
- Dispatch through the provider-neutral relay to the ADO adapter.
- Authenticate the local relay with Azure CLI; never store a PAT.
- Preserve draft text and offer Retry after an auth or network failure.
- Reject foreign origins, unknown paths, invalid ranges, arbitrary targets, and
  unsupported providers.

**Scope (out):**

- Exact deleted-line anchors
- Reading existing threads or replies
- Resolving, voting, approving, or merging
- GitHub comments

**Touches:** comment UI, pure anchor helper, server relay, ADO adapter, API
boundary, tests

**Acceptance criteria:**

- [ ] Send on one current-side line creates an active ADO thread on the stored
  PR, path, and right-side line.
- [ ] Shift-click sends the selected right-side start and end lines.
- [ ] A deleted-only selection creates a file-level thread without right-side
  coordinates.
- [ ] Iteration and change-tracking values come from stored ADO
  providerContext.
- [ ] Browser input cannot select a different repository or PR.
- [ ] Auth and network failures retain the draft and can be retried.
- [ ] Credentials never appear in browser JSON, the review store, or logs.
- [ ] Automated tests use an injected adapter and never post a live comment.

**Blocked by:** 01 Open a named Azure DevOps PR as a guided review

**Blocks:** none

**Parallel-eligible:** no
