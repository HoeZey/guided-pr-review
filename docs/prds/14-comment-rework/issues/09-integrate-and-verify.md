---
status: todo
blocked_by:
  - 01-turn-comments-on
  - 02-show-post-progress
  - 03-show-edit-delete-progress
  - 04-discussion-every-thread
  - 05-ado-missing-tracking
  - 06-outdated-when-line-changed
  - 07-load-new-commits
  - 08-block-guide-behind-diff
blocks: []
---

# Integrate and verify comments on live pull requests

**Type:** Story

**From PRD:** [14 Comment rework](../)

**Seam(s):** every seam in the PRD, plus the manual check targets

**What it delivers:** One reviewed feature/14-comment-rework branch with
every success criterion checked, including live posts on Azure DevOps and
GitHub.

**Scope (in):**

- Combine accepted stories 01 through 08 on the epic branch.
- Run npm test, npm run test:svelte, npm run check:architecture, svelte-check,
  and a production build.
- Live checks on Azure DevOps pull request 100 and a dummy GitHub pull
  request on this repository: line, range, file, and PR-wide create, reply,
  edit, delete, Retry, Outdated, Refresh, and the Discussion jump.
- On Azure DevOps pull request 100, record which thread fields show a
  changed line. If the host keeps a changed line inline, file a follow-up
  story and do not block the epic.
- Open the GitHub dummy pull request from a throwaway branch and close it
  after the check.
- Record the integration review with a fixed base and head.

**Scope (out):**

- Merging to develop or promoting main without Jose's approval
- Deleting feature/post-ado-comments

**Touches:** epic branch, issue records, PRD integration review

**Acceptance criteria:**

- [ ] All automated checks pass on the epic head.
- [ ] Every PRD success criterion is checked on Azure DevOps pull request
  100 and the GitHub dummy pull request.
- [ ] The Azure DevOps changed-line fields are recorded, with a follow-up
  story if needed.
- [ ] The GitHub dummy pull request is closed after the check.
- [ ] The integration review has no major Standards finding and no missing
  or incorrect Spec finding.

**Blocked by:** 01 through 08

**Blocks:** none

**Parallel-eligible:** no
