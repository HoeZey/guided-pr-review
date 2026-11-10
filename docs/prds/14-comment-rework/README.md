---
status: signed
blocked_by:
  - ../08-inline-git-host-comments/
---

# PRD: Comment rework

## Problem

Comments are hidden behind a flag that is off, because the flow was unfinished
for a demo. When the flag is on, clicking a line or pressing Send can show
nothing, so the reviewer cannot tell whether the post is running, succeeded,
or failed. Discussion only holds PR-wide and unmappable threads. A review left
open never pulls new commits, and Azure DevOps marks a thread Outdated after
any push even when its line did not change.

## Goal

A reviewer comments on a hosted review the way they would on GitHub or Azure
DevOps, and every fetch and post shows whether it is running, succeeded, or
failed.

## Non-goals

- Rebasing, merging, or replaying feature/post-ado-comments
- Agent, MCP, az rest, or gh api comment transport
- Resolve, reactivate, reactions, votes, approve, or merge
- Comments on a local diff with no host pull request
- A comment layout for Guide that differs from Diff
- Copying host threads into the review store

## User stories

- As a reviewer, I want to click a line on Guide or Diff and write a comment
  so that it posts to that line on the host.
- As a reviewer, I want a spinner while a comment posts and the thread in its
  place when it lands so that I know it worked.
- As a reviewer, I want my draft kept with Retry when a post fails so that I
  do not lose the text.
- As a reviewer, I want every thread in Discussion, with a link from a code
  thread to its line on Diff, so that I can read the whole conversation.
- As a reviewer, I want threads whose line changed marked Outdated and moved
  off the code so that inline threads match the code on screen.
- As a reviewer, I want new commits to load when I open a review and a
  Refresh prompt while I read so that the diff does not move under me.

## Implementation notes

**Base**

- Build on the 08 comment contracts, CommentService, the Azure DevOps and
  GitHub comment adapters, threadSession, composerSession, and the delivery
  reducer. Remove the commentsEnabled flag. A stored discussion tab opens
  Discussion again.

**Placement**

- Guide and Diff render the same threads from one threadSession. A line or
  range thread sits after its line; a file thread sits below its file header.
- Discussion lists every thread, PR-wide and code, oldest first, with the
  PR-wide composer at the bottom. Its tab count is every thread.
- On a code thread in Discussion, the path and line in the header is the only
  jump. It selects Diff, expands the file when collapsed, and scrolls to the
  thread. PR-wide and outdated threads have no jump.

**Starting a comment**

- A click on a current-side line opens the composer at once, with no host
  call. Shift-click in the same file extends to a contiguous current-side
  range. A deleted-only line opens a file comment. One composer is open at a
  time.
- The file-header Comment button opens a file comment.
- Discussion starts PR-wide comments only. Reply works inline and in
  Discussion.
- Guide line and file comments are blocked while the Guide head differs from
  the stored diff commit. The Guide shows a note to comment on Diff or
  generate the Guide again. Replies stay available.

**Posting**

- Send shows a spinner in the composer, keeps the textarea and its draft, and
  disables Send. Reply uses the same composer.
- On success the composer closes and the thread takes its slot with a short
  fade and accent highlight, about 1.5 seconds. No highlight or fade under
  prefers-reduced-motion. No toast.
- On failure the composer stays with the draft, the error, and Retry. An
  ambiguous failure lists threads and matches before resending, as in 08;
  the spinner stays during that check.
- Edit and delete show a spinner while in flight. A failed edit keeps the
  typed text in the editor. A failed delete keeps the message and shows the
  error.
- Diff comments post against the stored diff commit on GitHub and the stored
  iterations on Azure DevOps, even when the pull request has newer commits.
- When stored Azure DevOps provenance lacks changeTrackingId or iterations for
  the path, the Azure DevOps adapter fetches them before posting, instead of
  rejecting with invalid-anchor. Provider, host, repository, and pull request
  still come only from stored provenance.

**Loading**

- One status on the review tab row covers Diff, Guide, and Discussion: Loading
  comments, or Updating diff. Guide and Diff stay usable.
- A failed list shows the review banner with Retry; the code stays. A reload
  keeps the threads on screen until the new list replaces them.
- Open, stale focus, Retry, and Refresh list threads. Switching tabs does not.
  One list runs at a time per review.

**Outdated threads**

- A thread is inline when the host places it on a current right-side line.
  It is Outdated only when that line changed. It is not Outdated because an
  older Azure DevOps iteration created it.
- Outdated and unmappable threads render in Discussion with their old path
  and line as plain text.

**New commits**

- On review open, when the pull request head differs from the stored diff
  commit, the review runs Update Diff, then lists threads.
- On focus, at most once a minute, the review reads this pull request through
  the provider pull request reader. New commits show the outdated banner with
  Refresh. The diff does not change until Refresh.
- Refresh runs Update Diff, then lists threads. An open draft keeps its text.
  Its line selection clears when that line no longer exists on the new diff.

## Testing / seams

**Seam(s):** the review shell rendered with a fake comments API and a fake
review API; CommentService with fake provider clients; the Azure DevOps and
GitHub comment adapters with REST fixtures.

**Why this seam:** every decision here is visible in the shell (spinners,
placement, jump, block, Refresh) or in what the service sends to a host.

**What a good test is here:** a line click opens a composer with no request;
Send shows the spinner until the fake resolves, then the thread replaces the
composer on Guide, Diff, and Discussion; a rejected send keeps the draft and
Retry; a Discussion location link selects Diff and scrolls to the thread; a
Guide behind the diff has no line composer; a focus with a moved head shows
Refresh and keeps the old diff; Azure DevOps create with missing tracking
fetches it and posts; a moved but unchanged Azure DevOps thread is not
Outdated.

**Prior art:** inline-threads and discussion Svelte tests, composer and thread
state tests, comment-delivery tests, CommentService tests, Azure DevOps and
GitHub comment adapter tests, reviews-diff tests.

## Trade-offs (decided)

| Decision | Chose | Rejected | Why |
|---|---|---|---|
| Starting point | 08 services and UI | Replaying feature/post-ado-comments | 08 already rebuilt comments on current services. |
| Discussion | Every thread | PR-wide and unmappable only | One place to read the whole conversation, as on GitHub Conversation. |
| Jump control | Path and line in the thread header | A separate View in Diff control | Copies GitHub. Revisit after use. |
| Post feedback | Spinner in the composer, then the thread | A toast or status line | The thread is the success signal. |
| Diff behind the pull request | Allow comments on the stored commit | Block until updated | Both hosts tie a comment to the code you saw. |
| Guide behind the diff | Block line and file comments | Allow | Chapters keep no commit or iteration per line. |
| New commits while open | Banner with Refresh | Swap the diff | Neither host swaps code under the reader. |
| Outdated | Only when the line changed | Any older Azure DevOps iteration | Matches GitHub and keeps moved threads inline. |

## Open questions (intentionally deferred)

- Which Azure DevOps thread fields show that the commented line changed.
  Confirm at the integration check, on Azure DevOps pull request 100. Until
  then an Azure DevOps thread is Outdated only when the host cannot place it
  on a current line. A mismatch becomes a follow-up story, not an epic
  blocker.
- Showing the old code beside an Outdated thread. Revisit after this ships.
- Keyboard line and range selection. Revisit after this ships.
- A separate View in Diff control in Discussion. Revisit if the location link
  is hard to find.

## Success criteria

- A hosted review shows Diff, Guide, and Discussion, and lists threads on
  open.
- Clicking a current-side line on Guide or Diff opens a composer with no
  delay.
- Send shows a spinner until the host answers. Success puts the thread on
  Guide, Diff, and Discussion. Failure keeps the draft with Retry.
- An ambiguous failure never creates a second host comment on Retry.
- Edit and delete show progress, and a failure keeps the text or the comment.
- Discussion lists every thread. A code thread's location opens Diff at that
  thread.
- Loading and Updating diff show on the tab row; a failed list shows Retry
  and keeps the code usable.
- A thread whose line only moved stays inline without Outdated on both hosts.
  A thread whose line changed shows in Discussion as Outdated.
- Opening a review with new commits loads them first. A push while reading
  shows Refresh and leaves the diff as it was.
- A Guide behind the diff offers no line or file composer.
- An Azure DevOps line, range, or file comment posts on a review saved
  without change tracking.
- Manual checks on one named Azure DevOps and one named GitHub pull request
  cover line, range, file, and PR-wide create, reply, edit, delete, Retry,
  Outdated, Refresh, and the Discussion jump.

## Manual check targets

- Azure DevOps: braid-data / Braid / braid-connection-designer pull request
  100, https://dev.azure.com/braid-data/Braid/_git/braid-connection-designer/pullrequest/100.
  Posting test comments there is authorized.
- GitHub: a dummy pull request on this repository, opened from a throwaway
  branch at the integration check and closed after it.

## Out of scope

- Old-code snippets on Outdated threads
- Keyboard commenting
- Generating the Guide again from the review page
- Background polling while the app is closed
- Changes to Home refresh or Home Update Diff

## References

- Comment rework grilling, 10 November 2026, this chat
- [08 Inline git-host comments](../08-inline-git-host-comments/)
- [11 Demo prep](../11-demo-prep/), story 01 Hide comments until the rework
- Historical branch feature/post-ado-comments at 90a7111, read-only
