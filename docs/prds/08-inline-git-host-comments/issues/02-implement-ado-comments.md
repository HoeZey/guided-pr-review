---
status: todo
blocked_by:
  - 01-define-comment-service
blocks:
  - 05-create-and-reply
  - 06-edit-and-delete
---

# Implement ADO comment adapter

**Type:** Story

**From PRD:** [08 Inline git-host comments](../)

**Seam(s):** ADO thread/comment REST adapter; ADO normalizer; CommentProvider
contract tests

**What it delivers:** CommentService can list, create, reply, update, and
delete ADO PR comments through direct REST.

**Scope (in):**

- List PR threads/comments with ADO REST 7.1.
- Normalize current-side ranges, file-level, PR-wide, thread status, messages,
  authors, ownership, timestamps, and stale context.
- Create threads with stored iterations and change-tracking ids when required.
- Reply inside existing thread.
- Update/delete one current-user comment.
- Map auth/scope, permission, stale anchor, missing thread/comment, rate,
  timeout, and malformed errors.

**Scope (out):**

- az rest, ADO MCP, PATs
- Resolve/reactivate
- Exact deleted-line placement without valid provider coordinates
- UI

**Touches:** server/providers/ado comments capability, fixtures, provider
contract tests

**Acceptance criteria:**

- [ ] Every CommentProvider operation uses direct authenticated fetch.
- [ ] Provider URL and PR identity come only from service-resolved provenance.
- [ ] Line/range creation includes valid iteration/change-tracking context.
- [ ] Deleted/unmappable anchors downgrade safely without fabricated line.
- [ ] Reply parent and edit/delete comment ids are validated inside one PR.
- [ ] ADO current-user identity controls normalized ownership.
- [ ] Fixture tests cover every operation and structured failure.

**Blocked by:** 01 Define comment service

**Blocks:** 05 and 06

**Parallel-eligible:** yes, with 03, 04, and 07
