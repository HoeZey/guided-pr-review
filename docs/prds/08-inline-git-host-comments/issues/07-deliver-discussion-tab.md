---
status: done
blocked_by:
  - 01-define-comment-service
  - 05-create-and-reply
  - 06-edit-and-delete
blocks:
  - 08-integrate-inline-comments
---

# Deliver the PR-wide Discussion tab

**Type:** Story

**From PRD:** [08 Inline git-host comments](../)

**Seam(s):** PR-wide/unmappable thread projection; review-scoped Svelte thread
state; Discussion tab component

**What it delivers:** General PR conversation remains available without
pushing line comments into an always-open block above Diff.

**Scope (in):**

- Add Discussion beside Guide, Diff, and Code Review.
- List PR-wide provider comments and stale/unmappable review threads.
- Reuse shared message, reply, edit, delete, draft, and delivery state.
- Create new PR-wide ADO and GitHub comments through provider-neutral service.
- Show source provider and stale/unmappable reason without raw payloads.
- Keep tab count derived from shared thread state.

**Scope (out):**

- Moving inline line/file threads into Discussion
- Reactions, status changes, review summaries, votes, or merge
- Separate top-of-Diff comment stack

**Touches:** extend ReviewTab in src/lib/shared/page-data.ts and setTab in
src/lib/client/state/review.svelte.ts; AppShell.svelte tabs; new Discussion
components; shared thread projection from 04; PR-wide create through
CommentService.

**Acceptance criteria:**

- [x] PR-wide ADO and GitHub comments appear in Discussion.
- [x] Stale/unmappable threads remain findable and explain why they are not
  inline.
- [x] Create/reply/edit/delete uses same state and services as Guide/Diff.
- [x] New PR-wide comments work for ADO and GitHub.
- [x] Line and file threads remain inline, not duplicated in Discussion.
- [x] Discussion does not shift Diff/Guide content below a persistent top
  block.
- [x] Keyboard/tab accessibility matches existing review tabs.

**Blocked by:** 01, 05, and 06

**Blocks:** 08 integration

**Parallel-eligible:** no

## code-review

Pass: 16 September 2026

base: 1206f48228a8823eee3e0c4cb842cd00de926e61
head: 10fbda9e405b28260a5f21e22de685db0cb46c83
branch: feature/08-07-deliver-discussion-tab

Not blocking. Standards has no major. Spec has no missing or incorrect.

Judged implementer notes: Hiding nested Reply on GitHub PR-wide issue threads is adapter policy (issue: reply rejected) and is not a Spec miss; PR-wide create still posts provider-neutral anchor kind pr. Leftover comments maps to discussion in parseStoredTab for cookie SSR, localStorage adoptLegacyTab, and parseTab. Line and file threads stay in projectInlineThreads; Discussion lists projectDiscussionThreads. No persistent top-of-Diff stack. Discussion mounts like Code Review, not hidden Guide/Diff; create and reply drafts still live in composerSession.

### Standards

major 0 / minor 0 / nit 2

- severity: nit
  title: Stale outdated threads show Outdated twice
  location: src/lib/client/components/code/CommentStack.svelte (thread-meta)
  startLine: 146
  endLine: 150
  reference:
    source: docs/prds/08-inline-git-host-comments/issues/07-deliver-discussion-tab.md Scope (in)
    quote: Show source provider and stale/unmappable reason without raw payloads.
  explanation: When discussion is true, thread.outdated still renders the existing Outdated flag, and discussionPlacementLabel for reason outdated also returns Outdated. A stale outdated thread then shows two identical flags beside the provider label.
  recommendation: Skip the generic outdated flag when discussion placement already names Outdated, or omit the reason word when thread.outdated is already shown.

- severity: nit
  title: GitHub issue-reply rule lives in slot projection
  location: src/lib/shared/domain/comment-slots.ts (allowsNestedReply)
  startLine: 239
  endLine: 241
  reference:
    source: .cursor/rules/ponytail.mdc
    quote: Mark intentional simplifications with a ponytail comment. If the shortcut has a known ceiling, the comment names the ceiling and the upgrade path.
  explanation: allowsNestedReply hard-codes github plus pr. That matches the GitHub adapter, which rejects non-review replies. comment-slots.ts is otherwise Guide/Diff placement. There is no ponytail comment naming the ceiling (only GitHub issue comments lack nested replies) or the upgrade (a capability from the adapter).
  recommendation: Keep the guard. Add a ponytail comment, or move the rule next to GitHub thread normalization.

### Spec

missing 0 / partial 0 / scope-creep 0 / incorrect 0

findings: []
