---
status: todo
blocked_by: []
blocks:
  - 05-persist-diffs
  - 06-repo-search
---

# Home columns and a refresh icon with a new-changes dot

**Type:** Story

**From PRD:** [09 Demo home polish](../)

**Seam(s):** home layout and the new-changes dot; catalog refresh, including
the startup latch

**What it delivers:** Pull-request cards sit on the left. Current auth and
repository controls sit on the right. Refresh is a circular double-arrow
that dots when there are new changes to pull. Reload and tab return stay
responsive and only badge those changes.

**Scope (in):**

- Pull-request cards on the left, current auth and repository controls on
  the right.
- Remove the header Add button and the paste-JSON modal.
- Replace the Refresh label with a circular double-arrow.
- Server startup stops awaiting the catalog refresh, so first paint never
  waits on the host.
- On Home mount and when the tab becomes visible, start a background catalog
  check and do not fetch diffs. That check does not add a card or change a
  book.
- When that check finds an active reviewer or authored pull request with no
  saved review, or a catalog commit that differs from the saved review's
  source commit, show a dot on the icon. Hover: new changes to pull.
- In this story the click runs the existing manual catalog refresh. The
  arrow animates only while the user-started click is in progress, and the
  page stays usable.
- No pull-down gesture and no interval timer.
- The repository URL field may stay until 06. The download of diffs lands
  in 05.

**Scope (out):**

- Persisting diffs, creating cards only after a saved diff, or switching the
  book to the saved diff (05)
- Replacing the URL field with repository search (06)
- Fetching diffs on reload or tab return

**Touches:** src/lib/client/components/home/HomeView.svelte; remove the
header Add button and the paste-JSON modal in HomeActions.svelte.
src/hooks.server.ts stops awaiting the startup catalog refresh. Production
path: src/hooks.server.ts.

**Acceptance criteria:**

- [ ] Pull-request cards sit on the left. Current auth and repository
  controls sit on the right.
- [ ] The header Add button and the paste-JSON modal are gone.
- [ ] Refresh is a circular double-arrow.
- [ ] First paint does not wait on the host. The startup catalog refresh no
  longer blocks a request.
- [ ] A reload or tab return runs a background catalog check only. That
  check does not fetch diffs, add a card, or change a book.
- [ ] When the check finds an active reviewer or authored pull request with
  no saved review, or a catalog commit that differs from the saved review's
  source commit, the refresh icon shows a dot. Hover says there are new
  changes to pull.
- [ ] The click runs the existing manual catalog refresh. The arrow animates
  only while that click is in progress, and the page stays usable.
- [ ] There is no pull-down gesture and no interval timer.

**Blocked by:** none

**Blocks:** 05 Persist diffs on refresh, and 06 Searchable repo dropdown

**Parallel-eligible:** yes, with 01, 02, and 03

**Checks:** the home layout and dot cases in home.svelte.test.ts, and
catalog-refresh.test.ts for the startup latch no longer blocking a request
