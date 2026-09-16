---
status: doing
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

- Verify coordinator pinned post-07 develop
  0a9ffcd11cc64df218f833c3af425489dee906cf and reconciled issue paths before
  story work.
- Verify the existing epic branch contains one accepted commit per story; do
  not reset or replay commits already integrated.
- Use feature/post-ado-comments at 90a7111 as read-only behavior reference.
- Reconstruct useful delivery/anchor/UI behavior; transplant no old transport.
- Resolve provider/Svelte component-state overlap once.
- Run full Node/Svelte tests, svelte-check, production build, and authorized
  live ADO/GitHub acceptance.
- Record fixed base/head Standards and Spec integration review.
- After accepted develop/main promotion, retire old worktree/branch only with
  user approval.

**Scope (out):**

- Rebasing/cherry-picking old feature wholesale
- Resolve/reactivate or review votes
- Product redesign during integration

**Acceptance criteria:**

- [x] Every prerequisite story has accepted independent review.
- [x] No production code invokes ADO MCP, az rest, gh api, or an agent for
  comments.
- [x] Node/Svelte tests, svelte-check, and production build pass.
- [ ] Manual ADO and GitHub checks cover line/range/file/PR-wide display,
  create, reply, edit, delete, auth Retry, ambiguous send, tab parity, and
  stale anchors.
- [x] Guide and Diff share one thread state without duplicate fetch/send.
- [x] Standards has no major finding; Spec has no missing/incorrect finding.
- [ ] Epic reaches develop before stable-main promotion.
- [ ] Main promotion and old branch deletion require explicit user approval.

**Blocked by:** 02 through 07

**Blocks:** none

**Parallel-eligible:** no; dedicated Grok integrator

## implementation

Status stays doing until integration review. No ## integration-review here.

### Epic history before this commit

Pinned 08 develop base: 0a9ffcd11cc64df218f833c3af425489dee906cf.

Coordinator reconciled issue target paths in issues/README.md at
f5da2f55354ef3a6046636a1433b94f797efb0ab before story branches. One Merged
commit per story 01-07. No extra overlap commit besides this integrate commit.
feature/post-ado-comments at 90a7111 stayed read-only; no comments.ts transport
was rebased, cherry-picked, or transplanted.

- f5da2f55354ef3a6046636a1433b94f797efb0ab Reconcile 08 issue paths with post-07 develop
- cdfe250b89dcd31ef1e52fcfa6ae2ef5686a140e Merged 08-01: Define provider-neutral comment services and contracts
- a3993991b27f4a3aa4b3f70c01f72daefb981b16 Merged 08-02: Implement ADO comment adapter
- a5787ebf167dd7f69dd5f9939250e7b23e8b904b Merged 08-03: Implement GitHub comment adapter
- 7bd9e0e229df93bc082a99fda01118a85408c528 Merged 08-04: Render existing threads inline in Guide and Diff
- a0a9c0c8d3068e5fede28e2314c06cb583987871 Merged 08-05: Create comments and replies from both views
- 1206f48228a8823eee3e0c4cb842cd00de926e61 Merged 08-06: Edit and delete owned comments
- e32413490700fbc2955cb3c2e27f8040713729cd Merged 08-07: Deliver the PR-wide Discussion tab

Parent of this integrate commit: e32413490700fbc2955cb3c2e27f8040713729cd.

01-07 reviews were accepted onto this branch. Story leftover notes stay unfixed
unless they blocked integration checks.

src has no src/pages, no leftover Astro comments.ts route, and no az rest, ADO
MCP, gh api, or agent comment path. Production comment adapters use injected or
globalThis.fetch REST only.

### Ports at HEAD

- src/lib/server/providers/comments.ts: CommentProvider, CommentError
- src/lib/server/providers/ado-comments.ts: createAdoCommentAdapter (api-version 7.1)
- src/lib/server/providers/github/comments.ts: createGithubCommentProvider
  (GITHUB_API_VERSION from github/rest.ts)
- src/lib/server/services/comments.ts: createCommentService lists/creates/replies/
  updates/deletes through stored provenance
- src/lib/server/auth/ports.ts: CredentialSource shared with catalog readers
- src/lib/client/state/threads.svelte.ts: threadSession singleton shared by Guide,
  Diff, and Discussion
- src/lib/server/services/app.ts createAppServices defaults commentProviders to
  createAdoCommentAdapter + createGithubCommentProvider on the same
  CredentialSource as readers. options.commentProviders still injects fakes.
- src/lib/server/runtime.ts production singleton passes the same live adapters
  explicitly, matching the readers pattern. UI/dev is not stuck on fake fixtures.

### Overlap resolved in this commit

- 08-01 defaulted createAppServices to fake-comments fixtures. Default is now
  live REST. Tests that need fixtures pass commentProviders.
- svelte-check failed on carried 05/07 types: setDiffMode now takes ReviewTab
  (including discussion); composer and CommentComposer read error/errorCode
  only after Delivery state === failed. No UI redesign.

### Checks

- npm test: 199 pass
- npm run test:svelte: 70 client + 20 SSR pass
- npm run check:svelte: 0 errors 0 warnings
- npm run check:architecture: 2 pass
- npx tsc --noEmit: 4 pre-existing errors, unchanged from 07-09
  (hooks.server.ts $lib/server/runtime and catalog-refresh; cli-credentials.test.ts
  expired vs connected; connections.test.ts extra argument). Recorded separately;
  not introduced by 08-08.
- npm run build: SvelteKit + @sveltejs/adapter-node, done. Comment routes present
  under api/reviews/_id_/comments.
- Isolated npm start HOST=localhost PORT=8772
  GUIDED_PR_REVIEW_DATA=/tmp/gpr-08-08-8772
  - Listening on http://[::1]:8772
  - Store v1 fixture (review r1, sample Guide, no source) loaded lossless:
    GET / 200 data-view=home title Pin pipeline, GET /reviews/r1 200 Guide Diff
    Discussion, r1 still in reviews.json
  - POST /mcp initialize 200 protocolVersion 2024-11-05
  - POST /mcp tools/list includes list_reviews; queue_action kind enum is only
    generate-guide
  - GET /api/reviews/r1/comments 400 code no-host-provenance (local-range sample
    has no PullRequestSource; no hosted fixture in the tmp store)
  - GET /api/connections 200: azure-devops connected hoshe.lee@ml6.eu, github
    connected HoeZey. JSON has login, no token
  - 8765 was not bound or killed (user node pid 17285). User checkout stayed
    develop 0a9ffcd.

### Manual ADO/GitHub

Proved on isolated 8772 with existing az/gh sessions: connections list only.

Pending, no named test PR and live comment posts are not authorized:
- live LIST against a hosted review (tmp fixture had no source)
- create, reply, edit, delete on ADO and GitHub
- line/range/file/PR-wide display on a live PR
- auth Retry, ambiguous send, tab parity, and stale anchors on a live PR

No comments posted. No user working tree checkout. feature/post-ado-comments
worktree/branch not deleted.

### Remediation

Open Diff and Update Diff now fetch ADO iterations and changeTrackingId through
createAdoRestAdapter.getCommentContext (REST 7.1 fetch, not az rest) and pass
them into catalogAsSource. pullRequestReader forwards getCommentContext so
createAppServices Open Diff keeps those ids (second integration-review hole).
Paths without a tracking id stay absent so createPayload still throws
invalid-anchor for that path only. Catalog adopt without Open still writes
zeros. Already-saved ADO reviews skip Update Diff when sourceCommit is
unchanged, so empty stored changes stay until a non-skip upsert. No live
comment POST. Third independent integration-review at
591a2dd7e92ceef8a5e3222baaa2db06f29baa1c: Pass.

### Leftover notes from 01-07 (unfixed)

- 08-01 mutation parse skip; re-list before mutate
- 08-02 catalog adopt via catalogAsSource still stores empty iterations; Open/Update Diff now persist REST ids
- 08-04 hunk-walk duplicate; double focus list
- 08-05 mouse-only composers; 5-minute reconcile ponytail
- 08-06 failed-edit drops draft; delete heuristic
- 08-07 Outdated twice; GitHub reply rule in comment-slots

## integration-review (third)

Date: 16 September 2026

Verdict: Pass

base: 0a9ffcd11cc64df218f833c3af425489dee906cf
head: 591a2dd7e92ceef8a5e3222baaa2db06f29baa1c
branch: feature/08-inline-git-host-comments

History: Same 08-01 through 08-08 Merged commits as the first review, plus
the first docs record, the first remediation, the second docs record, and
one further remediation commit.

- f5da2f55354ef3a6046636a1433b94f797efb0ab Reconcile 08 issue paths with post-07 develop
- cdfe250b89dcd31ef1e52fcfa6ae2ef5686a140e Merged 08-01: Define provider-neutral comment services and contracts
- a3993991b27f4a3aa4b3f70c01f72daefb981b16 Merged 08-02: Implement ADO comment adapter
- a5787ebf167dd7f69dd5f9939250e7b23e8b904b Merged 08-03: Implement GitHub comment adapter
- 7bd9e0e229df93bc082a99fda01118a85408c528 Merged 08-04: Render existing threads inline in Guide and Diff
- a0a9c0c8d3068e5fede28e2314c06cb583987871 Merged 08-05: Create comments and replies from both views
- 1206f48228a8823eee3e0c4cb842cd00de926e61 Merged 08-06: Edit and delete owned comments
- e32413490700fbc2955cb3c2e27f8040713729cd Merged 08-07: Deliver the PR-wide Discussion tab
- f4d1a9a515be73262e2cc75fbb36cf5f977f96a1 Merged 08-08: Integrate and verify inline comments
- 42a33f9347bcc0fca5b98607b85ec5038ba45541 Record 08 integration-review
- b0d7decd187d9edc6bedfb5f485f1e143b434163 Persist ADO iterations and change tracking on Open Diff
- e6d13d46be8eec53b2eae873a7b04ae713c748f8 Record 08 second integration-review
- 591a2dd7e92ceef8a5e3222baaa2db06f29baa1c Forward getCommentContext through pullRequestReader

The second-review major is cleared. pullRequestReader forwards
getCommentContext. createAppServices Open Diff through runtime.ts keeps
ADO iteration ids and changeTrackingId. npm test at this HEAD: 201 pass,
including createAppServices openDiff keeps ADO comment context through
pullRequestReader.

Leftovers that still hold and do not block: catalog adopt empty
iterations; already-saved ADO reviews skip Update Diff when sourceCommit
is unchanged; live named-PR mutation unauthorized; 08-01 mutation parse
skip and re-list; 08-04 hunk-walk duplicate and double focus list;
08-05 mouse-only composers and five-minute reconcile; 08-06 failed-edit
draft and delete heuristic; 08-07 Outdated twice and GitHub reply rule
in comment-slots.

No develop merge and no main promotion in this review. Issue 08 stays
doing. PRD status stays in_progress. Localhost attach skipped.

### Standards

major 0 / minor 5 / nit 6

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

missing 0 / partial 0 / scope-creep 0 / incorrect 0

findings: []

HEAD meets the 08 success criteria graded here. ADO line, range, and file
create against a fresh Open Diff through createAppServices now persist
iteration ids and changeTrackingId. Catalog adopt without Open Diff still
writes zeros. Already-saved ADO reviews skip Update Diff when
sourceCommit is unchanged. Live named-PR mutation remains unauthorized
and is not a Spec miss.

No comments posted. No user working tree checkout. No develop merge and
no main promotion in this review. Localhost attach skipped.
