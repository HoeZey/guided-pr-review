# Research: inline git-host comments

Checked 15 September 2026. Primary sources only.

## Azure DevOps

[Pull request
threads](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-threads?view=azure-devops-rest-7.1)
list and create threads for one repository and pull request. Thread context
carries file path and right/left line coordinates; iteration context and
change-tracking ids tie comments to PR changes.

[Pull request thread
comments](https://learn.microsoft.com/en-us/rest/api/azure/devops/git/pull-request-thread-comments?view=azure-devops-rest-7.1)
supports list, create, update, and delete inside one thread. Replies use parent
comment identity. API version is 7.1.

The documented scopes include code read/write and threads_full. Phase 08 uses
the CLI-issued Entra token from PRD 07 and reports insufficient scope as a
structured connection error.

## GitHub

[Pull request review
comments](https://docs.github.com/en/rest/pulls/comments) supports listing
inline review comments, creating a line/range/file comment, replying to a
top-level review comment, updating, and deleting.

Replies to replies are not supported; the adapter must normalize each reply
under the top-level thread rather than expose impossible nesting.

[Issue comments](https://docs.github.com/en/rest/issues/comments) manage
pull-request-wide conversation comments because every pull request is also an
issue. These comments use separate endpoints from inline review comments.

Phase 08 pins the documented GitHub API version header already chosen in PRD
07. Provider endpoint and payload differences stay in adapters.

## Common model conclusions

- One thread has provider id, provider kind, status, ordered messages, author,
  created/updated times, and normalized anchor.
- Anchors are current-side line/range, file-level, PR-wide, or
  stale/unmappable.
- ADO and GitHub provider ids are opaque strings in shared contracts.
- Edit/delete are exposed only when normalized current-user identity matches
  message author. Provider remains final authorization authority.
- GitHub PR-wide issue comments and inline review comments normalize into the
  same Discussion/thread collection while preserving anchor kind.
- Remote threads are provider-owned and fetched on review open/stale focus/
  manual retry. They are not copied into Guide or reviews.json.
- Local draft/pending state may use browser storage keyed by provider, host,
  repository id, PR number, and client operation id.
