---
status: todo
blocked_by:
  - 01-turn-comments-on
blocks:
  - 09-integrate-and-verify
---

# Show progress and the new thread when a comment posts

**Type:** Story

**From PRD:** [14 Comment rework](../)

**Seam(s):** the review shell rendered with a fake comments API; composer and
delivery state

**What it delivers:** Clicking a line opens a composer at once. Send and
Reply show a spinner until the host answers. Success puts the thread where
the composer was; failure keeps the draft with Retry.

**Scope (in):**

- A current-side line click on Guide or Diff opens the composer with no host
  call. Shift-click in the same file extends to a contiguous range. A
  deleted-only line opens a file comment. The file-header Comment button
  opens a file comment. One composer is open at a time.
- Send and Reply show the composer spinner, keep the draft, and disable Send.
- An ambiguous failure lists and matches before resending; the spinner stays
  during that check.
- On success the composer closes and the thread takes its slot with a fade
  and accent highlight of about 1.5 seconds, on Guide, Diff, and Discussion.
  No fade or highlight under prefers-reduced-motion. No toast.
- On failure the composer stays with the draft, the error, and Retry.

**Scope (out):**

- Edit and delete (03)
- Keyboard line selection
- Guide block when behind the diff (08)

**Touches:** code view rows and file header, composer, composer and thread
state, delivery reducer, styles, tests

**Acceptance criteria:**

- [ ] A line click opens a composer and sends no request.
- [ ] Shift-click selects a contiguous current-side range in one file.
- [ ] Send shows the spinner until the fake resolves.
- [ ] On success the thread replaces the composer on Guide and Diff and is
  listed in Discussion.
- [ ] The highlight runs once and is absent under reduced motion.
- [ ] A rejected send keeps the draft, shows the error, and Retry sends again.
- [ ] An ambiguous failure lists before Retry and does not post twice.

**Blocked by:** 01

**Blocks:** 09

**Parallel-eligible:** no
