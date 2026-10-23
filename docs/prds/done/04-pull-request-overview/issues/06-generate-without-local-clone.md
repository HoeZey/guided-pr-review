---
status: cancelled
blocked_by: []
blocks: []
superseded_by:
  - ../../../07-provider-api-automation/
---

# Open a PR without a local clone

**Cancelled:** [07 Provider API
automation](../../../07-provider-api-automation/) supersedes this story. Its
managed cache belongs behind app-owned provider and git services, not the
waiting-agent action path. Keep this file as historical scope only.

**Type:** Story

**From PRD:** [Pull request overview](../)

**Seam(s):** action claim and completion; injected git-cache adapter;
upsert_review

**What it delivers:** A reviewer can Open a configured repository that is not
cloned locally into Diff, using a managed bare git cache that never changes a
user working tree.

**Scope (in):**

- Keep a managed bare git cache per configured repository under local app
  data.
- Fetch exact target and source commits into that cache without checkout.
- Upsert one unchaptered review with structured repository identity and land
  on Diff.
- Leave every user working tree and branch unchanged.
- Reuse the same Open and Update Diff actions as the current-repository path.
- Generate guide on that review still uses the cache (covered with 07).

**Scope (out):**

- Requiring the user to register a local clone
- Building diffs only from host APIs
- GitHub caches

**Touches:** git-cache adapter, action completion, skill fetch path, tests

**Acceptance criteria:**

- [ ] Selecting an unopened PR from a configured foreign repository opens Diff
  from exact source and target commits.
- [ ] The agent uses a managed bare cache and does not checkout or change a
  user working tree.
- [ ] Repeating the same repository and PR upserts the same review id when the
  source commit is unchanged.
- [ ] Cache and fetch failures report a structured error without altering other
  reviews.
- [ ] Tests inject a fake git-cache adapter and never clone a private
  repository.

**Blocked by:** 05 Add another repository to the overview

**Blocks:** none

**Parallel-eligible:** no
