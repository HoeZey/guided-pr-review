---
status: done
blocked_by: []
blocks:
  - 09-integrate-and-verify
---

# Mark a thread Outdated only when its line changed

**Type:** Story

**From PRD:** [14 Comment rework](../)

**Seam(s):** the Azure DevOps and GitHub comment adapters with REST
fixtures; the review shell rendered with a fake comments API

**What it delivers:** Threads stay inline while their line is on the current
diff. Outdated threads move to Discussion with their old location as text.

**Scope (in):**

- Azure DevOps: drop the older-iteration Outdated check. A thread the host
  places on a current right-side line is inline with no Outdated tag. A
  thread the host cannot place is Outdated.
- GitHub: keep the current rule. A null line with an original line is
  Outdated.
- The stale anchor carries an optional old line. Discussion shows Outdated
  with the old path and line as plain text, no link.
- Outdated shows once on a thread.

**Scope (out):**

- Telling a moved Azure DevOps line from a changed one when the host still
  places it. The live check in 09 confirms the fields; a gap becomes a
  follow-up story.
- Old-code snippets

**Touches:** comment contracts, both comment adapters, comment slots
projection, comment stack, fixtures, tests

**Acceptance criteria:**

- [x] An Azure DevOps thread from an older iteration that the host places on
  a current line renders inline without Outdated.
- [x] An Azure DevOps thread with no current right-side position renders in
  Discussion as Outdated.
- [x] A GitHub thread with a null line and an original line renders in
  Discussion as Outdated with its old path and line.
- [x] Outdated threads have no location link and show Outdated once.

**Blocked by:** none

**Blocks:** 09

**Parallel-eligible:** yes
