---
status: done
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

**Touches:** CommentService update/delete; ownership from 01 contracts; shared
thread state from 04; thread controls on GuideView.svelte and DiffView.svelte
cards; styles/tests.

**Acceptance criteria:**

- [x] Current-user ADO and GitHub messages expose edit/delete.
- [x] Other-author messages expose neither control.
- [x] Forged ownership or cross-PR ids are rejected server-side.
- [x] Successful edit updates both Guide and Diff state.
- [x] Successful delete follows normalized provider result in both views.
- [x] Failure rolls back or refetches without losing original thread.
- [x] Provider and client tests cover ownership and failures.

**Blocked by:** 02, 03, 04, and 05

**Blocks:** 07 Discussion and 08 integration

**Parallel-eligible:** no

## code-review

Pass: 16 September 2026

base: a0a9c0c8d3068e5fede28e2314c06cb583987871
head: 9d75a0ec79784328ed51929ad96443e8faf30ed9
branch: feature/08-06-edit-and-delete

Not blocking. Standards has no major. Spec has no missing or incorrect.

Judged implementer notes: GitHub omitting deleted comments versus ADO deleted:true is adapter-normalized and is not a Spec miss. createAppServices remaining on fake comment providers is out of scope for 08-06 and is not a finding. Edit/delete controls live on CommentStack used by CodeFile for both Guide and Diff; that shared threadSession collection is not a miss. CommentService update/delete, PATCH/DELETE HTTP, and both live adapters were already on the 08-05 parent; this story wires the owned UI, optimistic state, fake GitHub removal, and ownership/failure tests. Failed-save draft loss is Standards only: 08-06 acceptance requires keeping the original thread, which rollback does. Localhost attach was skipped per EXECUTION overnight override.

### Standards

major 0 / minor 1 / nit 1

- severity: minor
  title: Failed edit leaves the composer and drops the typed draft
  location: src/lib/client/components/code/CommentStack.svelte (save, confirmDelete)
  startLine: 83
  endLine: 121
  reference:
    source: .cursor/rules/ponytail.mdc
    quote: Not lazy about understanding the problem, input validation at trust boundaries, error handling that prevents data loss.
  explanation: save calls updateOwnedComment, which rolls the thread body back on failure. The catch then sets editingId and draft to empty, so the textarea unmounts and the typed text is gone. confirmDelete likewise clears confirmingId on failure. Create/reply keep composerSession drafts across auth and network errors. The original thread is not lost, but Retry is re-open Edit and retype rather than Save again. The Guide/Diff test follows that retype path, so it stays green.
  recommendation: On failure keep editingId and draft (and confirmingId for delete), show the error beside the still-open composer, and let Save or Delete retry.

- severity: nit
  title: Client delete guesses GitHub omit versus ADO deleted from thread.provider
  location: src/lib/client/state/threads.svelte.ts (deleteOwnedComment)
  startLine: 185
  endLine: 206
  reference:
    source: .cursor/rules/ponytail.mdc
    quote: Mark intentional simplifications with a ponytail comment. If the shortcut has a known ceiling, the comment names the ceiling and the upgrade path.
  explanation: commentsApi.delete returns { ok: true }. deleteOwnedComment then keeps the optimistic GitHub removal or ADO deleted true from thread.provider instead of a list refetch. That matches current adapter list shape, and failure restores the snapshot. There is no ponytail comment naming the ceiling (a provider that changes list shape) or the upgrade (refetch list after 200).
  recommendation: Keep the branch. Add a ponytail comment, or refetch the thread list after a successful delete if a third shape appears.

### Spec

missing 0 / partial 0 / scope-creep 0 / incorrect 0

findings: []

