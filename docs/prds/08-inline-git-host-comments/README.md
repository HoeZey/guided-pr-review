---
status: in_progress
blocked_by:
  - ../07-provider-api-automation/
---

# PRD: Inline git-host comments

## Problem

The old ADO comment branch renders provider discussion above the Diff and
couples delivery to az-rest/MCP-era code. A long comment block separates
discussion from the lines it concerns. It is absent from Guide, conflicts with
the post-06 Svelte component model, and cannot support GitHub through the phase
07 provider services.

Rebasing that branch after structural and provider work would create a large,
low-signal merge across viewer, Guide helpers, CSS, and transport. Replaying
its transport would also restore architecture that phase 07 removes.

## Goal

ADO and GitHub threads appear at their review location in both Guide and Diff.
The connected user can create threads, reply, edit, and delete their comments
through provider-neutral services without leaving the app.

## Non-goals

- Rebasing or merging feature/post-ado-comments
- Reusing az rest, ADO MCP, or agent comment delivery
- Resolving/reactivating threads
- Reactions, votes, approve/reject, merge, or abandon
- Exact deleted-line anchors where provider/current snapshot cannot prove them
- Persisting remote thread history in Guide or reviews.json
- Provider-specific client screens
- Comments on local-range reviews with no host provenance

## User stories

- As a reviewer, I want existing line comments beside the changed line in
  Guide and Diff so discussion stays in context.
- As a reviewer, I want one shared thread state so switching tabs does not
  duplicate comments, drafts, or sends.
- As a reviewer, I want file-level comments below the file header and PR-wide
  comments in a separate Discussion tab.
- As a reviewer, I want to create a line/range or file comment from either
  review mode and a PR-wide comment from Discussion.
- As a reviewer, I want to reply to a thread and edit/delete my comments.
- As a reviewer, I want stale or unmappable comments retained with clear state
  rather than attached to invented coordinates.
- As a reviewer, I want failed or ambiguous sends to retain text and reconcile
  before Retry so duplicate provider comments are not created.

## Shared contracts

- CommentThread: opaque provider thread id, provider, status, normalized
  anchor, ordered messages, and outdated state.
- CommentMessage: opaque provider comment id, author identity, body,
  created/updated time, current-user ownership, and deleted state where
  provider returns it.
- CommentAnchor variants:
  - current-side line or contiguous range
  - file-level path
  - PR-wide
  - stale/unmappable with original provider context retained server-side
- CommentService capabilities: list, create thread, reply, update owned
  comment, and delete owned comment.

ADO and GitHub payloads and anchor fields remain inside their adapters. Remote
comments are not repositories: provider is source of truth. Repositories may
store local draft/pending state only if Svelte/browser storage is
insufficient.

## Placement and interaction

- A current-side line/range thread renders immediately after its matching diff
  line block in Unified and Split layouts.
- Guide and Diff map against the same file/hunk identities and share one thread
  collection in review-scoped Svelte state.
- A file-level thread renders below the matching file header before first hunk.
- A deleted-line comment falls back to file level unless exact mapping is
  proved. Never fake a right-side line.
- PR-wide and stale/unmappable threads render in a dedicated Discussion tab.
  This removes the current always-open top stack and follows host separation
  between code review comments and general conversation.
- Inline thread cards show ordered messages, current status, author, time, and
  reply composer. Edit/delete controls appear only for current-user messages.
- New comment composer in Guide/Diff targets selected current-side line/range
  or file. Discussion creates PR-wide comments through the same service.
- Loading is per review. Review open, browser focus when thread data is at
  least 60 seconds old, and manual Retry refresh threads; tab switching alone
  does not refetch.

## Security and reliability

- Browser sends review id, normalized anchor, content, and opaque thread/
  comment id when required.
- Server resolves provider, host, repository, PR, commits, path, and current
  identity from stored review provenance and phase 07 connection.
- Reject foreign Origin, unknown review/path, anchor outside current Diff,
  cross-provider ids, arbitrary URLs, invalid ranges, and edits/deletes not
  owned by current identity.
- Provider remains final permission check.
- Keep drafts through tab switches and auth/network failure.
- A timed-out create/reply is ambiguous. Before Retry, list recent provider
  threads and match a client operation marker or conservative content/anchor/
  time identity. Never blindly resend.
- Cancellation aborts only the current request and cannot permanently block
  Retry.
- Errors and logs contain no credential or unredacted provider response.

## Branch salvage

feature/post-ado-comments at 90a7111 is a read-only behavior reference.

Salvage:

- comment-delivery state-machine ideas and tests
- pure anchor and visible-slot helpers/tests
- draft, Retry, ambiguous-send, composer, and thread-rendering behavior
- CSS/fixture intent

Discard or rewrite:

- comments.ts transport and any az-rest/MCP subprocess code
- MCP framing commit 70ef428
- old comments route when it conflicts with phase 07 route/service conventions
- viewer/CSS patches that overwrite post-06 Svelte components

Do not cherry-pick feature commits wholesale. Reconstruct behavior under
post-07 services and Svelte modules. Keep old worktree until 08 integration is
accepted; remove only with user approval.

## Testing / seams

**Seams:** normalized comment contracts; provider comment adapters; comment
service with stored review provenance; anchor-to-visible-slot projection;
delivery state reducer; review-scoped Svelte thread state and per-view
projection.

**Good checks:**

- ADO and GitHub fixtures normalize equivalent line/range, file, PR-wide,
  reply, edited, deleted, and stale threads.
- list/create/reply/update/delete dispatch by stored provider, never browser
  URL.
- Anchor projection places each thread once in Guide and Diff.
- Deleted/unmappable anchors never receive fabricated coordinates.
- Current-user ownership gates edit/delete UI and server requests.
- Cancel, auth failure, timeout, reconciliation, and Retry preserve drafts and
  prevent duplicate send.
- CI uses fake provider clients. Manual acceptance uses explicitly authorized
  ADO and GitHub PRs.

## Trade-offs (decided)

- One vertical comment PRD, not headless comment APIs in PRD 07.
- ADO/GitHub parity behind capability-specific adapters.
- Dedicated Discussion tab for PR-wide/unmappable threads, not an always-open
  top panel.
- File-level fallback over fake deleted-line anchors.
- Provider source of truth over copying threads into local review store.
- Reconstruct selected old behavior over rebasing a transport-coupled branch.
- Edit/delete owned comments in scope; resolve/reactivate out.

## Success criteria

- Existing ADO and GitHub line/range threads render inline at the correct
  current snapshot location in Guide and Diff.
- File-level threads render below file header; PR-wide and unmappable threads
  render in Discussion.
- Guide/Diff switching reuses one fetched thread collection and never
  duplicates drafts or sends.
- Connected user can create line/range and file threads and reply from Guide
  or Diff; PR-wide creation works from Discussion.
- Connected user can edit/delete their ADO and GitHub comments; other-author
  controls are absent and server rejects forged ownership.
- Stale/deleted-line comments remain visible without invented coordinates.
- Failure retains draft and Retry works after cancellation/auth recovery.
  Ambiguous create/reply reconciles before resend.
- Browser cannot target a different host/repository/PR/path than stored review.
- No comment operation uses an agent, MCP, az rest, or gh api.
- Automated provider, service, projection, and delivery tests pass; authorized
  manual checks cover both providers.

## Out of scope

- Local-range comments
- Thread resolution, reactions, review votes, or merge
- Existing commit comments outside PR review/timeline comments
- Offline comment history
- Background polling while app is closed

## References

- [Research](research.md)
- [07 Provider API automation](../07-provider-api-automation/)
- [03 Git-host guided reviews](../done/03-git-host-guided-reviews/)
- Historical branch feature/post-ado-comments at 90a7111

## integration-review

Pending implementation.
