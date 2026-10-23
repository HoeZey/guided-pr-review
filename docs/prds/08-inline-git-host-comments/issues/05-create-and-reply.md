---
status: done
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

- [x] Line/range/file comment can be created from Guide and Diff for both
  providers.
- [x] Replies append to correct provider thread.
- [x] Browser cannot alter provider/repository/PR/path outside stored review.
- [x] Draft survives tab switch, auth/network failure, and Retry.
- [x] Cancelled request does not block later send.
- [x] Ambiguous create/reply reconciles before resend and avoids duplicate.
- [x] Provider result replaces pending state without duplicate thread.
- [x] Reducer/service tests cover every transition and provider dispatch.

**Blocked by:** 02, 03, and 04

**Blocks:** 06, 07, and 08

**Parallel-eligible:** no

## code-review

Blocked: 16 September 2026

base: 7bd9e0e229df93bc082a99fda01118a85408c528
head: c7d7bc4bb19f6053fd26afaee28a92230f6b056c
branch: feature/08-05-create-and-reply

Blocking. Standards has one major. Spec has no missing or incorrect.

Judged implementer notes: createAppServices still uses fake comment providers; production live REST wiring is out of scope for 08-05 and is not a finding. GitHub issue-thread nested replies remaining unsupported is not a Spec miss for Guide/Diff inline work. Reducer succeeded is applied then closeComposer clears the composer; the provider thread replacing pending is the success surface and is not a finding. matchingRecentCreate byOperationId is a test hook; live adapters do not round-trip clientOperationId, and the PRD allows conservative content/anchor/time, so an unwired operation lookup is not a Spec miss.

### Standards

major 1 / minor 1 / nit 1

- severity: major
  title: Clicking the selected line after a failed send drops the pending operation
  location: src/lib/client/state/composer.svelte.ts (openCreateComposer, openLineComposer, openReplyComposer)
  startLine: 81
  endLine: 118
  reference:
    source: .cursor/rules/ponytail.mdc
    quote: correctness and edge-case safety
  explanation: After an ambiguous failure the composer stays open on the selected current-side line, which remains clickable. openLineComposer always calls openCreateComposer, which abandons the in-flight generation and replaces delivery with a draft that keeps only content. clientOperationId and failed are discarded. The next Send is not retrying, mints a new operation id, skips list/reconcile, and can create a duplicate provider thread. The same wipe happens from File Comment and Reply on the same review.
  recommendation: Keep the failed delivery when the review stays the same, or ignore a line click that does not change the create anchor. Mint a new clientOperationId only after Cancel or a completed success.

- severity: minor
  title: Line and range composers are mouse-only clickable divs
  location: src/lib/client/components/code/UnifiedRow.svelte, src/lib/client/components/code/SplitCell.svelte
  startLine: 28
  endLine: 42
  reference:
    source: .cursor/rules/ponytail.mdc
    quote: Not lazy about accessibility
  explanation: UnifiedRow and SplitCell attach onclick to a static line div and svelte-ignore a11y_click_events_have_key_events and a11y_no_static_element_interactions. Current-side line and shift-click range have no keyboard control. File Comment and Reply are real buttons, so file and reply remain reachable.
  recommendation: Add a focusable gutter button per current-side line and drive range from a keyboard modifier on that control.

- severity: nit
  title: Content and time reconcile uses a five-minute first-match heuristic with no ponytail comment
  location: src/lib/shared/domain/comment-delivery.ts (MATCH_WINDOW_MS, matchingRecentCreate)
  startLine: 28
  endLine: 114
  reference:
    source: .cursor/rules/ponytail.mdc
    quote: Mark intentional simplifications with a ponytail comment. If the shortcut has a known ceiling, the comment names the ceiling and the upgrade path.
  explanation: matchingRecentCreate takes the first listed thread with the same anchor, body, and createdAt within 5 minutes. Two legitimate identical comments in that window can bind the pending send to the wrong row, and the ceiling is unnamed.
  recommendation: Add a ponytail comment that names the window and first-match ceiling, and the upgrade of a server-side clientOperationId lookup.

### Spec

missing 0 / partial 1 / scope-creep 0 / incorrect 0

- classification: partial
  severity: minor
  title: Ambiguous retry reconciles only when Send is clicked while still failed
  location: src/lib/client/state/composer.svelte.ts (openCreateComposer, submitComposer)
  startLine: 81
  endLine: 178
  reference:
    source: docs/prds/08-inline-git-host-comments/issues/05-create-and-reply.md Acceptance criteria
    quote: Ambiguous create/reply reconciles before resend and avoids duplicate.
  explanation: submitComposer lists and matches only when delivery.state is failed. The Retry button keeps that state and avoids a duplicate when the listed thread matches. Clicking the still-selected line, File Comment, or Reply resets delivery to draft first, so the following Send is a new create/reply and does not list or reconcile.
  recommendation: Preserve failed pending across retarget on the same review so any later Send still reconciles, or treat a same-anchor line click as a no-op while failed.

## code-review (second)

Pass: 16 September 2026

base: 7bd9e0e229df93bc082a99fda01118a85408c528
head: a429b08af377004f7f385858a061fa778b429cac
branch: feature/08-05-create-and-reply

Pass. No new major. Spec has no missing, partial, or incorrect. Product head a429b08 includes the reopen-after-failed remediation.

Judged independently of the first review, including that remediation. createAppServices still defaults to fake comment providers; live REST wiring stays out of scope for 08-05 and is not a finding. GitHub issue-thread nested replies remaining unsupported is not a Spec miss for Guide/Diff inline work. closeComposer after success still leaves the provider thread as the success surface. matchingRecentCreate byOperationId remains a test hook; live GitHub create voids clientOperationId and reconciles by content, anchor, and time, which the PRD allows.

Previous blocking major is cleared: keepFailedDelivery returns before abandonSend when the same review, failed delivery, and same create/reply target are reopened. openLineComposer on the selected line, File Comment on the same file, and Reply on the same thread keep clientOperationId. The following Send still takes the failed path, lists, and reconciles. Proven by composer.svelte.test.ts (reopening the same line, file, or reply after a failed send keeps the operation id and still lists before resend): after unavailable fail, openLineComposer on that line leaves state failed with COP; submitComposer with a different mint still calls list and does not create.

Remaining first-review minor (mouse-only line composers) and nit (five-minute first-match reconcile without a ponytail comment) are still true.

### Standards

major 0 / minor 1 / nit 1

- severity: minor
  title: Line and range composers are mouse-only clickable divs
  location: src/lib/client/components/code/UnifiedRow.svelte, src/lib/client/components/code/SplitCell.svelte
  startLine: 28
  endLine: 42
  reference:
    source: .cursor/rules/ponytail.mdc
    quote: Not lazy about accessibility
  explanation: UnifiedRow and SplitCell still attach onclick to a static line div and svelte-ignore a11y_click_events_have_key_events and a11y_no_static_element_interactions. Current-side line and shift-click range have no keyboard control. File Comment and Reply remain real buttons.
  recommendation: Add a focusable gutter button per current-side line and drive range from a keyboard modifier on that control.

- severity: nit
  title: Content and time reconcile uses a five-minute first-match heuristic with no ponytail comment
  location: src/lib/shared/domain/comment-delivery.ts (MATCH_WINDOW_MS, matchingRecentCreate)
  startLine: 28
  endLine: 114
  reference:
    source: .cursor/rules/ponytail.mdc
    quote: Mark intentional simplifications with a ponytail comment. If the shortcut has a known ceiling, the comment names the ceiling and the upgrade path.
  explanation: matchingRecentCreate still takes the first listed thread with the same anchor, body, and createdAt within 5 minutes. Two legitimate identical comments in that window can bind the pending send to the wrong row, and the ceiling is unnamed. GitHub createThread already has a ponytail that it reconciles by content, anchor, and time; the matcher window itself does not.
  recommendation: Add a ponytail comment that names the window and first-match ceiling, and the upgrade of a server-side clientOperationId lookup.

### Spec

missing 0 / partial 0 / scope-creep 0 / incorrect 0
