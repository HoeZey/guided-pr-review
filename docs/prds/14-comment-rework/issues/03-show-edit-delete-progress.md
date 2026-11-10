---
status: todo
blocked_by:
  - 01-turn-comments-on
blocks:
  - 09-integrate-and-verify
---

# Show progress when editing and deleting

**Type:** Story

**From PRD:** [14 Comment rework](../)

**Seam(s):** the review shell rendered with a fake comments API; thread state

**What it delivers:** Editing or deleting an owned comment shows progress,
and a failure never loses the typed text or the comment.

**Scope (in):**

- Save and Delete show a spinner while the host request runs.
- A failed edit keeps the editor open with the typed text and the error.
- A failed delete keeps the message and shows the error.
- Edit and Delete stay only on messages the current user owns.

**Scope (out):**

- Resolve or reactivate
- Create and reply (02)

**Touches:** comment stack, thread state, styles, tests

**Acceptance criteria:**

- [ ] Save shows a spinner until the fake resolves.
- [ ] A failed save keeps the editor open with the typed text.
- [ ] Delete shows a spinner until the fake resolves.
- [ ] A failed delete leaves the message on screen with the error.
- [ ] Another author's message has no Edit or Delete.

**Blocked by:** 01

**Blocks:** 09

**Parallel-eligible:** no
