---
status: signed
---

# PRD: Demo prep

## Problem

The comment flow is unfinished, so a demo still shows Discussion, inline threads, and comment actions. Home sections stay open, and authored pull requests mix drafts with published pull requests.

## Goal

A demo hides comments, lets each Home section collapse, and lists my published pull requests apart from my drafts.

## Non-goals

- Deleting comment code, comment routes, or comment storage

## User stories

- As a reviewer, I want comments hidden so that an unfinished comment flow stays out of the demo.
- As a reviewer, I want each Home section to collapse so that I can focus on one list.
- As an author, I want my drafts separate from my published pull requests so that I can find each list on its own.

## Implementation notes

- One shared flag, off by default, gates the Discussion tab, thread loading, and stored-tab parsing. Comment modules stay.
- A stored discussion or comments tab falls back to the review landing tab.
- Every Home group renders as a native disclosure. Archived starts closed. Other groups start open. A later choice is stored in the browser and restored on reload. A group with no stored choice keeps that default.
- Key each group by its id so a group that appears after refresh does not reuse another group's open state.
- Authored active pull requests split on the draft flag. Reviewer placement stays first. Drafts remain authored for refresh and new-change checks.

## Testing / seams

**Seam(s):** stored-tab parsing and the review shell; Home overview projection; Home server render

**Why this seam:** The flag, the group split, and the disclosure are visible at those boundaries.

**What a good test is here:** A hosted review does not request comments. A draft and a published authored pull request land in different groups. A non-archived group renders open.

**Prior art:** Shell tab tests, overview projection tests, Home server-render tests.

## Trade-offs (decided)

| Decision | Chose | Rejected | Why |
|---|---|---|---|
| Comment hide | Hide the tab, the threads, and the fetch | Read-only threads | The flow is unfinished |
| Section memory | localStorage | No storage | Jose asked to keep the choice after reload |
| Tracking | This PRD | Issues under demo home polish | Demo prep is its own contract |

## Success criteria

- A hosted review shows Guide and Diff only. It does not request comments.
- A stored discussion tab opens the landing tab.
- Each Home section can collapse. Archived starts closed. Other sections start open. Reload restores a section the reviewer has opened or closed.
- My published pull requests and my draft pull requests are separate Home sections. A pull request that is both mine and a review request stays under Review requests.
- Reviewing one part of a split file does not review or collapse the other part. A file that appears once still shares its reviewed state with Diff.

## Out of scope

- A comment rework
- New Home groups besides the draft split

## References

- Demo prep plan agreed in chat on 2026-10-20
