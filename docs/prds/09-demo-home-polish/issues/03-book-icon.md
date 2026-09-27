---
status: todo
blocked_by: []
blocks:
  - 05-persist-diffs
---

# One open state and a book icon

**Type:** Story

**From PRD:** [09 Demo home polish](../)

**Seam(s):** home overview and cards

**What it delivers:** The card title opens the one saved review, or the diff
when none is saved. A book icon is the only guide status. An archived card
says Merged or Closed, and its book never turns yellow.

**Scope (in):**

- Remove No guide, Outdated, Update Diff, Generate guide, and Open saved.
- The card title opens the one saved review, or opens the diff when none is
  saved.
- A book icon is grey when the guide is unchaptered, yellow when the
  chaptered guide's source commit differs from the commit it is compared
  against, and green when they match. In this story that comparison is the
  catalog commit, the existing outdated rule. 05 switches it to the saved
  diff.
- Hover: grey asks the coding agent to generate a guide, yellow asks the
  coding agent to update it, green says the guide matches the saved diff.
- Archived cards show a status label from the catalog status: Merged in
  green for completed, and Closed in red for closed (GitHub) or abandoned
  (Azure DevOps). The word carries the meaning, so the color only reinforces
  it.
- The book stays on archived cards and never turns yellow there, because the
  refresh click skips archived pull requests.

**Scope (out):**

- Comparing the book to the saved diff (05)
- Home column layout, the refresh icon, and the new-changes dot (04)
- Persisting diffs on click

**Touches:** src/lib/client/components/home/HomeCard.svelte and
src/lib/shared/domain/overview.ts. HomeCard gains that status, set in
catalogCard.

**Acceptance criteria:**

- [ ] The card does not offer No guide, Outdated, Update Diff, Generate
  guide, or Open saved.
- [ ] The card title opens the one saved review, or the diff when none is
  saved.
- [ ] The book is grey when the guide is unchaptered, yellow when the
  chaptered guide's source commit differs from the catalog commit, and green
  when they match.
- [ ] Hover asks the coding agent to generate a guide, asks the coding agent
  to update it, or says the guide matches the saved diff.
- [ ] An archived card says Merged for completed, and Closed for closed or
  abandoned.
- [ ] The book on an archived card never turns yellow.

**Blocked by:** none

**Blocks:** 05 Persist diffs on refresh

**Parallel-eligible:** yes, with 01, 02, and 04

**Checks:** overview.test.ts and the card cases in home.svelte.test.ts,
including one archived card per label (Merged, Closed from closed, Closed
from abandoned)
