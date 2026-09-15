---
status: todo
blocked_by:
  - 02-implement-ado-comments
  - 03-implement-github-comments
  - 04-render-inline-threads
  - 05-create-and-reply
blocks:
  - 07-deliver-discussion-tab
  - 08-integrate-inline-comments
---

# Edit and delete owned comments

**Type:** Story

**From PRD:** [08 Inline git-host comments](../)

**Seam(s):** normalized ownership; CommentService update/delete;
review-scoped Svelte optimistic state and rollback

**What it delivers:** Connected user can correct or remove their ADO/GitHub
comments while other authors remain read-only.

**Scope (in):**

- Show edit/delete only for normalized current-user messages.
- Edit body through provider adapter and update shared thread state.
- Confirm delete, call provider, and reflect provider deleted/removal result.
- Use optimistic state only with deterministic rollback/refetch on failure.
- Validate thread/comment ids against stored review and fetched thread
  collection.
- Treat provider authorization as final.

**Scope (out):**

- Edit/delete another author
- Resolve/reactivate thread
- Bulk deletion, reactions, or moderation

**Touches:** CommentService, ADO/GitHub adapters, shared Svelte thread state,
thread controls/components/styles/tests

**Acceptance criteria:**

- [ ] Current-user ADO and GitHub messages expose edit/delete.
- [ ] Other-author messages expose neither control.
- [ ] Forged ownership or cross-PR ids are rejected server-side.
- [ ] Successful edit updates both Guide and Diff state.
- [ ] Successful delete follows normalized provider result in both views.
- [ ] Failure rolls back or refetches without losing original thread.
- [ ] Provider and client tests cover ownership and failures.

**Blocked by:** 02, 03, 04, and 05

**Blocks:** 07 Discussion and 08 integration

**Parallel-eligible:** no
