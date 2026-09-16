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
- [ ] Standards has no major finding; Spec has no missing/incorrect finding.
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
comment POST. Awaits a fresh independent integration-review.

### Leftover notes from 01-07 (unfixed)

- 08-01 mutation parse skip; re-list before mutate
- 08-02 catalog adopt via catalogAsSource still stores empty iterations; Open/Update Diff now persist REST ids
- 08-04 hunk-walk duplicate; double focus list
- 08-05 mouse-only composers; 5-minute reconcile ponytail
- 08-06 failed-edit drops draft; delete heuristic
- 08-07 Outdated twice; GitHub reply rule in comment-slots
