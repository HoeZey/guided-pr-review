---
status: todo
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

- [ ] PR-wide ADO and GitHub comments appear in Discussion.
- [ ] Stale/unmappable threads remain findable and explain why they are not
  inline.
- [ ] Create/reply/edit/delete uses same state and services as Guide/Diff.
- [ ] New PR-wide comments work for ADO and GitHub.
- [ ] Line and file threads remain inline, not duplicated in Discussion.
- [ ] Discussion does not shift Diff/Guide content below a persistent top
  block.
- [ ] Keyboard/tab accessibility matches existing review tabs.

**Blocked by:** 01, 05, and 06

**Blocks:** 08 integration

**Parallel-eligible:** no
