---
status: todo
blocked_by:
  - 01-define-comment-service
blocks:
  - 05-create-and-reply
  - 06-edit-and-delete
---

# Implement GitHub comment adapter

**Type:** Story

**From PRD:** [08 Inline git-host comments](../)

**Seam(s):** GitHub review/issue comment REST adapter; GitHub normalizer;
CommentProvider contract tests

**What it delivers:** CommentService provides the same operations for GitHub
inline review comments and PR-wide issue comments as for ADO.

**Scope (in):**

- List pull-request review comments and PR issue comments.
- Group review-comment replies beneath top-level thread; GitHub does not allow
  replies to replies.
- Normalize line/range, file-level, PR-wide, authorship, timestamps, edited
  state, and stale positions.
- Create review comments for line/range/file targets and issue comments for
  PR-wide Discussion.
- Reply, update, and delete through documented endpoints.
- Pin GitHub API version/accept headers from PRD 07 client.

**Scope (out):**

- gh api, GraphQL, GitHub Reviews submission/votes
- Commit comments outside pull-request review/timeline
- UI

**Touches:** server/providers/github comments capability, fixtures, provider
contract tests

**Acceptance criteria:**

- [ ] Review and issue comments normalize into common thread anchors.
- [ ] Replies group under valid top-level review comment.
- [ ] Create/reply/edit/delete use direct REST and stored PR identity.
- [ ] Current-user ownership is normalized from 07 identity.
- [ ] Stale/missing diff positions never attach to invented lines.
- [ ] Pagination and rate/auth/permission/not-found failures are covered.
- [ ] Fixture tests satisfy the same CommentProvider contract as ADO.

**Blocked by:** 01 Define comment service

**Blocks:** 05 and 06

**Parallel-eligible:** yes, with 02, 04, and 07
