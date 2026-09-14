# Guided PR review documentation

Each feature owns one folder under prds/. Its README.md is the signed product
contract. New delivery work lives in that feature's issues/ folder as small
vertical slices.

## Features

- [Guided PR review](prds/guided-pr-review/) — in progress
- [Review screen polish](prds/review-screen-polish/) — signed
- [Git-host guided reviews](prds/git-host-guided-reviews/) — signed
- [Pull request overview](prds/pull-request-overview/) — signed
- [Code-review outcomes](prds/code-review-outcomes/) — signed

## Status

- draft — decisions are still open
- signed — contract is agreed; implementation has not started
- in_progress — at least one issue is being implemented or success criteria are
  not all verified
- implemented — every success criterion passes

A PRD is not implemented because most code exists. Mark it implemented only
after its success criteria pass. Issue status lives in each issue file:
todo, doing, or done.

## Decisions

Product decisions live in each PRD's implementation notes and decided
trade-offs. Issue files apply those decisions; they do not reopen them.
Runtime review data stays local and is not committed.
