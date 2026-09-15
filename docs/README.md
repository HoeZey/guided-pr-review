# Guided PR review documentation

Each feature owns one folder under prds/. Its README.md is the signed product
contract. New delivery work lives in that feature's issues/ folder as small
vertical slices.

## Features

Epic numbers are this list order (two digits in git branch names).

- 01 [Guided PR review](prds/done/guided-pr-review/) — implemented
- 02 [Review screen polish](prds/done/review-screen-polish/) — implemented
- 03 [Git-host guided reviews](prds/git-host-guided-reviews/) — in progress
- 04 [Pull request overview](prds/pull-request-overview/) — in progress
- 05 [Code-review outcomes](prds/done/code-review-outcomes/) — implemented

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

## Git

Story branches: feature/04-03-open-selected-pr-as-diff. Prefix feature/,
bugfix/, hotfix/, or chore/. Then two-digit epic from Features above, two-digit
story from issues/NN-slug.md, then a lowercase slug.

Squash onto dev as Merged 04-03: Open the selected PR as Diff. Title is the
issue title. Fast-forward when the branch is already a straight line on dev.
Promote a stable cut to main by fast-forward when the user asks. Do not
merge epic 03 (Git-host) onto main until that PRD's remaining story is done.
