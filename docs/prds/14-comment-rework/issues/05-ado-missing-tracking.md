---
status: done
blocked_by: []
blocks:
  - 09-integrate-and-verify
---

# Post Azure DevOps line comments on reviews saved without change tracking

**Type:** Story

**From PRD:** [14 Comment rework](../)

**Seam(s):** CommentService with fake provider clients; the Azure DevOps
comment adapter with REST fixtures

**What it delivers:** An Azure DevOps line, range, or file comment posts on a
review whose stored provenance lacks change tracking or iterations.

**Scope (in):**

- When stored provenance has no changeTrackingId for the path or no real
  iterations, the adapter reads them from the host, then posts.
- Treat stored iteration 0 as unknown.
- Provider, host, repository, and pull request still come only from stored
  provenance.
- A path the host does not list as changed still fails with invalid-anchor.

**Scope (out):**

- Writing the fetched values back to the review store
- GitHub, which posts against the stored commit

**Touches:** Azure DevOps comment adapter, comment service tests, adapter
fixtures

**Acceptance criteria:**

- [x] A line create with empty stored changes fetches iterations and change
  tracking, then posts with them.
- [x] A create with stored change tracking makes no extra host read.
- [x] Stored iteration 0 is never sent to the host.
- [x] A path missing from the host's changes fails with invalid-anchor and
  posts nothing.

**Blocked by:** none

**Blocks:** 09

**Parallel-eligible:** yes
