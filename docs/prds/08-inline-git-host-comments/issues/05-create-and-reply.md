---
status: todo
blocked_by:
  - 02-implement-ado-comments
  - 03-implement-github-comments
  - 04-render-inline-threads
blocks:
  - 06-edit-and-delete
  - 07-deliver-discussion-tab
  - 08-integrate-inline-comments
---

# Create comments and replies from both views

**Type:** Story

**From PRD:** [08 Inline git-host comments](../)

**Seam(s):** composer anchor selection; delivery state reducer; CommentService
create/reply; pending operation reconciliation

**What it delivers:** A reviewer can leave or answer ADO/GitHub comments from
Guide and Diff without duplicate sends or lost drafts.

**Scope (in):**

- Open composer for current-side line/range and file targets in Guide or Diff.
- Create through shared service and render returned provider thread.
- Reply inside an existing thread.
- Keep one draft/pending state through tab/layout switches.
- Support Cancel, sending, failed, Retry, and succeeded states.
- On ambiguous timeout, list recent threads and reconcile client operation,
  anchor, content, and time before any resend.
- Clear request cancellation so Retry can run.

**Scope (out):**

- Edit/delete
- Resolve/reactivate
- Local-range review comments

**Touches:** composer and delivery reducer beside review thread state from 04;
CommentService create/reply; both provider adapters; code-view slots in
FileHeader.svelte, UnifiedRow.svelte, SplitRow.svelte; local pending only if
Svelte state is insufficient; styles/tests.

**Acceptance criteria:**

- [ ] Line/range/file comment can be created from Guide and Diff for both
  providers.
- [ ] Replies append to correct provider thread.
- [ ] Browser cannot alter provider/repository/PR/path outside stored review.
- [ ] Draft survives tab switch, auth/network failure, and Retry.
- [ ] Cancelled request does not block later send.
- [ ] Ambiguous create/reply reconciles before resend and avoids duplicate.
- [ ] Provider result replaces pending state without duplicate thread.
- [ ] Reducer/service tests cover every transition and provider dispatch.

**Blocked by:** 02, 03, and 04

**Blocks:** 06, 07, and 08

**Parallel-eligible:** no
