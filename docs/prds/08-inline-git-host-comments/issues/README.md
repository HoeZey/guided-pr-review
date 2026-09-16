# Inline git-host comments issues

From [08 Inline git-host comments](../).

## Delivery graph

```text
07 Provider API integration
└── 01 Define comment service and contracts
    ├── 02 Implement ADO comment adapter ─┐
    ├── 03 Implement GitHub adapter ─────┼── 05 Create and reply ── 06 Edit and delete
    ├── 04 Render inline in Guide/Diff ──┘
    └──────────────────────────────────────────────────────────────┘
                                                                    └── 07 Deliver Discussion tab
02,03,04,05,06,07 ────────────────────────── 08 Integrate and verify
```

Issues 02, 03, and 04 may start in parallel after 01. Issue 04 uses fake
CommentService data until provider stories integrate. Issue 05 reconciles both
provider adapters with shared composer/delivery state. Issue 06 builds on
successful create/reply ownership. Issue 07 follows 06 so Discussion receives
the same final interaction controls.

Before 08 branches start, reconcile target paths and interfaces against actual
07 develop. Product behavior stays locked.

## Reconciled against develop

Pinned 08 base: 0a9ffcd11cc64df218f833c3af425489dee906cf (07 implemented).
PRD behavior unchanged. Issue Touches fields now name HEAD symbols:

- No CommentService or CommentProvider yet. 08-01 adds them. GitHostAdapter is
  gone after 07-08. Production has no az rest, ADO MCP, gh api, or agent
  comment path. Do not revive leftover Astro src/pages/api/reviews/[id]/comments.ts.
- feature/post-ado-comments at 90a7111 stays read-only. Inspect only salvage
  listed in the PRD Branch salvage section. Never rebase, merge, or wholesale
  cherry-pick.
- Host identity: src/lib/shared/contracts/provenance.ts PullRequestSource,
  AzureDevOpsProviderContext (firstComparingIteration,
  secondComparingIteration, changes[path].changeTrackingId),
  GitHubProviderContext. GuideV1.source is optional PullRequestSource in
  src/lib/shared/contracts/guide.ts. Load via ReviewRepository.getReview.
- AppServices: src/lib/server/services/app.ts createAppServices (reviews,
  catalog, catalogRefresh, actions, outcomes, guides, connections,
  repositories). Wire the new comment service here.
- Credentials: src/lib/server/auth/ports.ts CredentialSource and
  CredentialIdentity.login. CLI: src/lib/server/auth/cli-credentials.ts.
- Providers today implement only ProviderRepositoryReader and
  ProviderPullRequestReader: createAdoRestAdapter in
  src/lib/server/providers/ado-rest.ts (api-version 7.1) and
  createGithubProvider in src/lib/server/providers/github/rest.ts
  (GITHUB_API_VERSION 2026-03-10). Comment REST is a new capability beside
  those adapters in 08-02 and 08-03. Errors: ProviderError in
  src/lib/server/providers/errors.ts; GithubProviderError in github/rest.ts.
- HTTP: src/lib/server/http.ts createHttpHandlers; SvelteKit routes under
  src/routes/api/. svelte.config.js csrf trustedOrigins is ["*"] (known 06
  minor). Open/Update Diff: src/routes/api/reviews/open/+server.ts and
  src/routes/api/reviews/update-diff/+server.ts.
- Review UI: src/lib/client/state/review.svelte.ts ReviewSession. ReviewTab in
  src/lib/shared/page-data.ts is "guide" | "diff" | "review". Discussion is
  08-07. Client fetch: src/lib/client/browser/fetch.ts. Code-view:
  src/lib/client/components/code/ (FileHeader.svelte, UnifiedRow.svelte,
  SplitRow.svelte, projectHunkLines). DiffView.svelte and GuideView.svelte.
  AppShell.svelte tabs. parseTab("comments") still maps to guide.

## Status

- [01 Define provider-neutral comment services and contracts](01-define-comment-service.md) — todo
- [02 Implement ADO comment adapter](02-implement-ado-comments.md) — todo
- [03 Implement GitHub comment adapter](03-implement-github-comments.md) — todo
- [04 Render existing threads inline in Guide and Diff](04-render-inline-threads.md) — todo
- [05 Create comments and replies from both views](05-create-and-reply.md) — todo
- [06 Edit and delete owned comments](06-edit-and-delete.md) — todo
- [07 Deliver the PR-wide Discussion tab](07-deliver-discussion-tab.md) — todo
- [08 Integrate and verify inline comments](08-integrate-inline-comments.md) — todo
