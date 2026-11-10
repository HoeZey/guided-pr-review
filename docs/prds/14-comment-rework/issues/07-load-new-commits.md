---
status: done
blocked_by:
  - 01-turn-comments-on
blocks:
  - 09-integrate-and-verify
---

# Load new commits on open and offer Refresh while reading

**Type:** Story

**From PRD:** [14 Comment rework](../)

**Seam(s):** the review shell rendered with a fake review API and a fake
comments API

**What it delivers:** Opening a review shows the latest commits. A push while
reading shows Refresh, and the diff stays as it was until the reviewer
chooses.

**Scope (in):**

- On open, when the pull request head differs from the stored diff commit,
  run Update Diff, then list threads. The tab row shows Updating diff.
- On focus, at most once a minute, read this pull request through the
  provider pull request reader. New commits show the outdated banner with
  Refresh.
- Refresh runs Update Diff, then lists threads.
- An open draft keeps its text across Refresh. Its line selection clears when
  that line is not on the new diff.
- A failed update keeps the old diff and shows the banner with Retry.
- Diff comments still post against the stored diff commit.

**Scope (out):**

- Home refresh and Home Update Diff
- Generating the Guide again
- Background polling while the app is closed

**Touches:** review HTTP route for the head check, review service, review
shell, review state, banner, tests

**Acceptance criteria:**

- [x] Opening a review whose head moved runs Update Diff before listing
  threads, with Updating diff on the tab row.
- [x] A focus with a moved head shows Refresh and does not change the diff.
- [x] A second focus within a minute makes no host read.
- [x] Refresh updates the diff, then lists threads.
- [x] A draft keeps its text after Refresh; a selection on a removed line
  clears.
- [x] A failed update keeps the old diff and offers Retry.

**Blocked by:** 01

**Blocks:** 09

**Parallel-eligible:** no
