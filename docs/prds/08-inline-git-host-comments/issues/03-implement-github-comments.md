---
status: done
blocked_by:
  - 01-define-comment-service
blocks:
  - 05-create-and-reply
  - 06-edit-and-delete
  - 08-integrate-inline-comments
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

**Touches:** comment REST beside src/lib/server/providers/github/rest.ts
createGithubProvider (GITHUB_API_VERSION 2026-03-10); CredentialIdentity.login
for ownership; GithubProviderError; CommentProvider contract tests shared with
02; fixtures. Do not call gh api.

**Acceptance criteria:**

- [x] Review and issue comments normalize into common thread anchors.
- [x] Replies group under valid top-level review comment.
- [x] Create/reply/edit/delete use direct REST and stored PR identity.
- [x] Current-user ownership is normalized from 07 identity.
- [x] Stale/missing diff positions never attach to invented lines.
- [x] Pagination and rate/auth/permission/not-found failures are covered.
- [x] Fixture tests satisfy the same CommentProvider contract as ADO.

**Blocked by:** 01 Define comment service

**Blocks:** 05, 06, and 08

**Parallel-eligible:** yes, with 02 and 04

## code-review

Pass: 16 September 2026

base: cdfe250b89dcd31ef1e52fcfa6ae2ef5686a140e
head: fcb7392e6d551e42897073acdc3a948022620acd
branch: feature/08-03-implement-github-comments

Not blocking. Standards has no major. Spec has no missing or incorrect.

Judged implementer notes: GitHub issue comments have no nested replies; reply rejects issue: ids with unknown-thread and is not a Spec miss. Default createAppServices still wires fake comment providers and is not a finding. GitHub HTTP helpers copied beside rest.ts match the 08-01 beside-adapter seam; 403 permission maps to CommentError denied so CommentService does not collapse it into auth. update/delete use GitHub's repo-scoped comment URLs (no pull number); CommentService requireOwned remains the PR membership gate. LEFT-side comments normalize to stale deleted-line; file-level fallback is 08-04 placement. clientOperationId is intentionally unused with a ponytail for 08-05 reconciliation.

### Standards

major 0 / minor 0 / nit 0

findings: []

### Spec

missing 0 / partial 0 / scope-creep 0 / incorrect 0

findings: []

