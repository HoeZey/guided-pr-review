---
status: todo
blocked_by: []
blocks:
  - 02-post-ado-comments
  - pull-request-overview/03-open-selected-pr-as-diff
---

# Open a named Azure DevOps PR as a guided review

**Type:** Story

**From PRD:** [Git-host guided reviews](../)

**Seam(s):** Guide and Store parsing; upsert_review

**What it delivers:** A reviewer can name one Azure DevOps PR and receive a
chaptered localhost guide for its exact source and target commits without
switching the working tree.

**Scope (in):**

- Detect and validate an Azure DevOps origin.
- Authenticate through the configured ADO MCP / Azure CLI session.
- Resolve one explicit PR URL or id in the current repository.
- Fetch exact source and target commits without checkout.
- Chapter the PR diff and upsert one review with stable git-host identity.
- Show structured repository identity and an Open in ADO link in the review
  header.
- Keep local SHA, branch, and range inputs working as new snapshots.
- Keep ADO-only fields inside providerContext.
- Adopt a matching unsourced local-range review (exact source branch, else
  unique ticket key) instead of adding a duplicate row.

**Scope (out):**

- Discovering or grouping a PR queue
- Posting comments
- GitHub ingest
- Cross-repository cloning

**Touches:** contracts, store, MCP and HTTP, skill orchestration, minimal UI,
tests

**Acceptance criteria:**

- [ ] Naming an active ADO PR in the current repository adds one guide for its
  reported source and target SHAs.
- [ ] The operation fetches commits without checkout or changing the user's
  current branch.
- [ ] Repeating the same PR and source SHA keeps one stable review id.
- [ ] A changed source SHA refreshes that review instead of adding a duplicate.
- [ ] Pull-request identity round-trips through Guide and Store parsing; local
  guides without source still load.
- [ ] ADO-specific iteration and change data exist only in the ADO
  providerContext variant.
- [ ] Unsupported hosts return a clear error and do not alter the store.
- [ ] The review header identifies the repository and PR and links to ADO.
- [ ] Upserting a PR whose source branch matches an unsourced local range
  (or uniquely shares a ticket key after a rename) keeps that local review
  id and attaches provenance; two locals with the same ticket stay separate.
- [ ] Store and contract checks run without live comment writes.

**Blocked by:** none

**Blocks:** 02 Post ADO comments; Pull request overview 03 Open the selected PR
as Diff

**Parallel-eligible:** yes
