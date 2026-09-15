---
status: todo
blocked_by:
  - 02-implement-ado-comments
  - 03-implement-github-comments
  - 04-render-inline-threads
  - 05-create-and-reply
  - 06-edit-and-delete
  - 07-deliver-discussion-tab
blocks: []
---

# Integrate and verify inline comments

**Type:** Story

**From PRD:** [08 Inline git-host comments](../)

**What it delivers:** One reviewed feature/08-inline-git-host-comments branch
with complete ADO/GitHub parity and no obsolete transport.

**Scope (in):**

- Verify coordinator pinned post-07 develop and reconciled issue paths before
  story work.
- Verify the existing epic branch contains one accepted commit per story; do
  not reset or replay commits already integrated.
- Use feature/post-ado-comments at 90a7111 as read-only behavior reference.
- Reconstruct useful delivery/anchor/UI behavior; transplant no old transport.
- Resolve provider/client overlap once.
- Run full tests/build and authorized live ADO/GitHub acceptance.
- Record fixed base/head Standards and Spec integration review.
- After accepted develop/main promotion, retire old worktree/branch only with
  user approval.

**Scope (out):**

- Rebasing/cherry-picking old feature wholesale
- Resolve/reactivate or review votes
- Product redesign during integration

**Acceptance criteria:**

- [ ] Every prerequisite story has accepted independent review.
- [ ] No production code invokes ADO MCP, az rest, gh api, or an agent for
  comments.
- [ ] Full tests/build pass.
- [ ] Manual ADO and GitHub checks cover line/range/file/PR-wide display,
  create, reply, edit, delete, auth Retry, ambiguous send, tab parity, and
  stale anchors.
- [ ] Guide and Diff share one thread state without duplicate fetch/send.
- [ ] Standards has no major finding; Spec has no missing/incorrect finding.
- [ ] Epic reaches develop before stable-main promotion.
- [ ] Main promotion and old branch deletion require explicit user approval.

**Blocked by:** 02 through 07

**Blocks:** none

**Parallel-eligible:** no; dedicated Grok integrator
