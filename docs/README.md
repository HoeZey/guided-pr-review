# Guided PR review documentation

Each feature owns one folder under prds/. Its README.md is the signed product
contract. New delivery work lives in that feature's issues/ folder as small
vertical slices.

## Features

Epic numbers are the two-digit folder prefix. The prefix stays stable when a
PRD moves under done/.

- [01 Guided PR review](prds/done/01-guided-pr-review/) — implemented
- [02 Review screen polish](prds/done/02-review-screen-polish/) — implemented
- [03 Git-host guided reviews](prds/done/03-git-host-guided-reviews/) — implemented
- [04 Pull request overview](prds/done/04-pull-request-overview/) — implemented
- [05 Code-review outcomes](prds/done/05-code-review-outcomes/) — implemented
- [06 App structure](prds/06-app-structure/) — implemented
- [07 Provider API automation](prds/07-provider-api-automation/) — implemented
- [08 Inline git-host comments](prds/08-inline-git-host-comments/) — implemented
- [09 Demo home polish](prds/09-demo-home-polish/) — implemented

## Status

- draft — decisions are still open
- signed — contract is agreed; implementation has not started
- in_progress — at least one issue is being implemented or success criteria are
  not all verified
- implemented — every success criterion passes

A PRD is not implemented because most code exists. Mark it implemented only
after its success criteria pass. Issue status lives in each issue file: todo,
doing, done, or cancelled. Cancelled work names the PRD that supersedes it.

## Decisions

Product decisions live in each PRD's implementation notes and decided
trade-offs. Issue files apply those decisions; they do not reopen them.
Runtime review data stays local and is not committed.

## Git

Story branches use feature/04-03-open-selected-pr-as-diff. Prefix feature/,
bugfix/, hotfix/, or chore/. Then two-digit epic, two-digit story from
issues/NN-slug.md, then a lowercase slug.

Each epic owns an integration branch such as feature/07-provider-api-automation.
Story branches never merge directly to develop. Squash an accepted story onto
the epic branch as Merged 07-03: Read pull requests through GitHub REST. A
dedicated integrator combines every accepted story, runs the PRD integration
checks, and records one fixed-point review before the epic reaches develop.
Promote an accepted develop cut to stable main only after the user authorizes
it.
