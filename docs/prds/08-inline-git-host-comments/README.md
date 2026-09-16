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

Date: 16 September 2026

Verdict: Blocked

base: 0a9ffcd11cc64df218f833c3af425489dee906cf
head: f4d1a9a515be73262e2cc75fbb36cf5f977f96a1
branch: feature/08-inline-git-host-comments

History: Reconcile 08 issue paths plus one Merged commit per story 08-01
through 08-08. No extra overlap commit besides 08-08. Pinned develop is the
accepted 07 head.

- f5da2f55354ef3a6046636a1433b94f797efb0ab Reconcile 08 issue paths with post-07 develop
- cdfe250b89dcd31ef1e52fcfa6ae2ef5686a140e Merged 08-01: Define provider-neutral comment services and contracts
- a3993991b27f4a3aa4b3f70c01f72daefb981b16 Merged 08-02: Implement ADO comment adapter
- a5787ebf167dd7f69dd5f9939250e7b23e8b904b Merged 08-03: Implement GitHub comment adapter
- 7bd9e0e229df93bc082a99fda01118a85408c528 Merged 08-04: Render existing threads inline in Guide and Diff
- a0a9c0c8d3068e5fede28e2314c06cb583987871 Merged 08-05: Create comments and replies from both views
- 1206f48228a8823eee3e0c4cb842cd00de926e61 Merged 08-06: Edit and delete owned comments
- e32413490700fbc2955cb3c2e27f8040713729cd Merged 08-07: Deliver the PR-wide Discussion tab
- f4d1a9a515be73262e2cc75fbb36cf5f977f96a1 Merged 08-08: Integrate and verify inline comments

Blocked. Standards has 1 major. Spec has 1 incorrect finding.

Story leftovers that still hold stay minor or nit except 08-02, which this
review promotes. 08-02 was accepted as minor while createAppServices still
defaulted to fake comment providers. 08-08 made live REST the production
default and did not fill Azure DevOps iterations or changeTrackingId, so
that leftover now fails a success criterion.

Live list/create/reply/edit/delete against named host PRs remain pending on
08-08 because EXECUTION forbids live mutation without named test PRs.
Fixtures and isolated smoke cover those paths. That pending note is not a
Spec miss, matching 07-09 pending Open/Update.

No develop merge and no main promotion in this review. Issue 08 stays doing.
PRD status stays in_progress.

### Standards

major 1 / minor 5 / nit 6

- severity: major
  title: Live ADO line and file create cannot use Open Diff provenance
  location: src/lib/shared/domain/reviews.ts
  startLine: 65
  endLine: 99
  reference:
    source: docs/prds/08-inline-git-host-comments/issues/02-implement-ado-comments.md
    quote: catalog has no iteration payload; comment APIs fill changes
  explanation: catalogAsSource is the production PullRequestSource writer
  used by syncDiff. For Azure DevOps it stores firstComparingIteration 0,
  secondComparingIteration 0, and changes {}. createPayload in
  ado-comments.ts throws invalid-anchor when changes[path] has no
  changeTrackingId, before any host POST. Open Diff reviews therefore cannot
  create ADO line, range, or file threads. iterationOutdated treats stored 0
  as a real iteration, so a live thread with secondComparingIteration 2 is
  marked outdated even when the line still maps. Fixtures inject tracking
  ids and iteration 2, so adapter tests stay green. 08-02 recorded this
  while fakes were the app default. 08-08 defaulted createAppServices and
  runtime.ts to createAdoCommentAdapter and did not fetch iterations at
  comment time. GitHub create uses sourceCommit, which Open Diff does
  write. ADO PR-wide create does not need tracking ids.
  recommendation: Treat stored iteration 0 and empty changes as unknown.
  Fetch iterations and changeTrackingId inside the ADO comment adapter, or
  write them during Open Diff. Skip outdated comparison until a real
  secondComparingIteration exists. Do not POST iteration 0.

- severity: minor
  title: Mutation responses skip the strict comment contract parse
  location: src/lib/server/services/comments.ts
  startLine: 106
  endLine: 162
  explanation: list runs CommentThreadList.parse. createThread returns
  normalizeListedThread, and reply and update return a spread message with
  ownedByCurrentUser overwritten, with no CommentThread or CommentMessage
  parse. A later adapter can put pullRequestThreadId or node_id on that
  object and the JSON response will include it. Documented on 08-01; still
  true.

- severity: minor
  title: Slot projection rebuilds hunk rows instead of reusing projectHunkLines
  location: src/lib/shared/domain/comment-slots.ts
  startLine: 29
  endLine: 56
  explanation: visibleHunks still copies pairWordDiff, splitRows,
  withUnchangedGaps, and the split-row unchanged predicate that
  projectHunkLines already applies when CodeFile renders. If one side
  changes hide-unchanged or pairing, afterThreads indexes will not match
  the rows on screen. Documented on 08-04; still true.

- severity: minor
  title: Stale focus can list comments twice
  location: src/lib/client/components/AppShell.svelte
  startLine: 97
  endLine: 108
  explanation: onVisible is still bound to both document visibilitychange
  and window focus. Returning to the tab commonly fires both while
  fetchedAt is already stale, so loadReviewThreads starts two overlapping
  commentsApi.list calls with no in-flight guard. Last write wins and the
  60-second skip still works, but the hosted review lists twice.
  Documented on 08-04; still true.

- severity: minor
  title: Line and range composers are mouse-only clickable divs
  location: src/lib/client/components/code/UnifiedRow.svelte
  startLine: 28
  endLine: 42
  explanation: UnifiedRow and SplitCell still attach onclick to a static
  line div and svelte-ignore a11y_click_events_have_key_events and
  a11y_no_static_element_interactions. Current-side line and shift-click
  range have no keyboard control. File Comment and Reply remain real
  buttons. Documented on 08-05; still true.

- severity: minor
  title: Failed edit leaves the composer and drops the typed draft
  location: src/lib/client/components/code/CommentStack.svelte
  startLine: 90
  endLine: 127
  explanation: save calls updateOwnedComment, which rolls the thread body
  back on failure. The catch then sets editingId and draft to empty, so the
  textarea unmounts and the typed text is gone. confirmDelete likewise
  clears confirmingId on failure. Create and reply keep composerSession
  drafts. The original thread is not lost. Documented on 08-06; still true.

- severity: nit
  title: Reply and owned edits re-list every thread first
  location: src/lib/server/services/comments.ts
  startLine: 79
  endLine: 143
  explanation: reply and requireOwned call listedThreads, a full provider
  list, before the mutate. Against a live host that is an extra list
  round-trip. There is still no ponytail naming that ceiling. Documented
  on 08-01; still true.

- severity: nit
  title: Non-numeric ids become unknown-thread or unknown-comment
  location: src/lib/server/providers/ado-comments.ts
  startLine: 298
  endLine: 306
  explanation: resourceId rejects anything that is not a positive decimal
  integer, including a cop_ client operation id, as unknown-thread or
  unknown-comment. CommentService rejectOperationAsResource throws
  operation-id-as-resource first, so HTTP through the service still fails
  closed. Direct adapter calls disagree on the code. Documented on 08-02;
  still true.

- severity: nit
  title: Content and time reconcile uses a five-minute first-match heuristic with no ponytail comment
  location: src/lib/shared/domain/comment-delivery.ts
  startLine: 28
  endLine: 114
  explanation: matchingRecentCreate still takes the first listed thread
  with the same anchor, body, and createdAt within 5 minutes. Two
  legitimate identical comments in that window can bind the pending send
  to the wrong row. Documented on 08-05; still true.

- severity: nit
  title: Client delete guesses GitHub omit versus ADO deleted from thread.provider
  location: src/lib/client/state/threads.svelte.ts
  startLine: 185
  endLine: 206
  explanation: commentsApi.delete returns { ok: true }. deleteOwnedComment
  then keeps the optimistic GitHub removal or ADO deleted true from
  thread.provider instead of a list refetch. Failure restores the
  snapshot. Documented on 08-06; still true.

- severity: nit
  title: Stale outdated threads show Outdated twice
  location: src/lib/client/components/code/CommentStack.svelte
  startLine: 146
  endLine: 150
  explanation: When discussion is true, thread.outdated still renders
  Outdated, and discussionPlacementLabel for reason outdated also returns
  Outdated. Documented on 08-07; still true.

- severity: nit
  title: GitHub issue-reply rule lives in slot projection
  location: src/lib/shared/domain/comment-slots.ts
  startLine: 239
  endLine: 241
  explanation: allowsNestedReply hard-codes github plus pr. That matches
  the GitHub adapter, which rejects non-review replies. comment-slots.ts
  is otherwise Guide and Diff placement. Documented on 08-07; still true.

### Spec

missing 0 / partial 0 / scope-creep 0 / incorrect 1

- classification: incorrect
  severity: major
  title: ADO line, range, and file create cannot succeed on Open Diff reviews
  location: src/lib/server/providers/ado-comments.ts
  startLine: 254
  endLine: 292
  reference:
    source: docs/prds/08-inline-git-host-comments/README.md
    quote: Connected user can create line/range and file threads and reply from Guide or Diff; PR-wide creation works from Discussion.
  explanation: Production Open and Update Diff persist catalogAsSource
  provenance with empty changes. The ADO adapter requires
  changeTrackingId for every non-PR create and throws invalid-anchor
  without calling the host. A connected user on an ADO review opened
  through the app therefore cannot create a line, range, or file thread
  from Guide or Diff. Reply, edit, delete, and PR-wide Discussion create
  do not need tracking ids. GitHub line, range, file, and PR-wide create
  use sourceCommit, which Open Diff does write. Adapter fixtures populate
  changes, so automated create tests do not see this path. This is not
  the pending live-mutation gap. Even a named ADO test PR would fail
  inline create against stored provenance.

HEAD meets the other 08 success criteria graded here.

Quote, PRD success criteria: Existing ADO and GitHub line and range
threads normalize to current-side anchors and project once after the
matching visible line in Guide and Diff. File-level threads render below
the file header. PR-wide and stale or unmappable threads, including
deleted-line fallbacks, render in Discussion. Deleted-line comments are
not attached to a fabricated right-side line.

Quote, PRD success criteria: Guide and Diff share one threadSession.
Tab switching does not refetch. Load runs on review open, stale focus
after 60 seconds, and manual Retry.

Quote, PRD success criteria: Create, reply, edit, and delete go through
CommentService and stored provenance. Browser bodies cannot set provider,
host, repository, number, or URL. Foreign Origin is rejected. Ownership
is recomputed from the connected login and gates edit and delete on the
server and in CommentStack. GitHub create, reply, edit, and delete are
implemented against REST fixtures. ADO reply, edit, delete, and PR-wide
create are implemented; ADO inline create is the incorrect finding
above.

Quote, PRD success criteria: Failed create and reply keep
composerSession drafts. Cancel bumps the in-flight generation and does
not block Retry. Ambiguous network or unavailable failures list and
reconcile before resend.

Quote, PRD success criteria: No comment operation uses an agent, MCP, az
rest, or gh api. Adapters use injected or globalThis.fetch. MCP
tools/list is still the 07 tool set. createAppServices and runtime.ts
default to live REST adapters. Tests inject fakes.

Quote, 08-08: Manual ADO and GitHub checks cover line, range, file, and
PR-wide display, create, reply, edit, delete, auth Retry, ambiguous
send, tab parity, and stale anchors. The issue records those pending
because no named test PR was authorized. Fixtures cover the behaviors
except ADO inline create against empty Open Diff changes. That live
pending note is not itself a Spec miss.

No comments posted. No user working tree checkout. No develop merge and
no main promotion in this review.

