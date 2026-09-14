---
status: todo
blocked_by:
  - 05-add-another-repository
blocks: []
---

# Generate a guide without a local clone

**Type:** Story

**From PRD:** [Pull request overview](../)

**Seam(s):** action claim and completion; injected git-cache adapter;
upsert_review

**What it delivers:** A reviewer can generate a guide for a configured
repository that is not cloned locally, using a managed bare git cache that
never changes a user working tree.

**Scope (in):**

- Keep a managed bare git cache per configured repository under local app
  data.
- Fetch exact target and source commits into that cache without checkout.
- Diff those commits and upsert one guide with structured repository identity.
- Leave every user working tree and branch unchanged.
- Reuse the same Generate and Update actions as the current-repository path.

**Scope (out):**

- Requiring the user to register a local clone
- Building diffs only from host APIs
- GitHub caches

**Touches:** git-cache adapter, action completion, skill fetch path, tests

**Acceptance criteria:**

- [ ] Selecting an unguided PR from a configured foreign repository produces
  one guide from exact source and target commits.
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
