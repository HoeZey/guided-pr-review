---
status: done
blocked_by: []
blocks: []
---

# Split authored pull requests into published and draft

**Type:** Story

**Parent:** 11 Demo prep

**From PRD:** [11 Demo prep](../)

**Seam(s):** Home overview projection

**What it delivers:** Home shows My published PRs and My draft PRs instead of one authored list.

**Scope (in):**

- An active authored pull request that is not a draft goes to My published PRs.
- An active authored draft goes to My draft PRs.
- A pull request that is both mine and a review request stays under Review requests.
- Drafts stay in the authored set for refresh and new-change checks.
- Section order is review requests, my published PRs, my draft PRs, other saved PRs, local ranges, archived.

**Scope (out):**

- Changing reviewer or archived placement
- A new draft flag on the host adapters

**Touches:** Home overview projection and its tests, Home server-render text

**Acceptance criteria:**

- [x] A published authored pull request and a draft authored pull request land in different sections.
- [x] A pull request that is both mine and a review request stays under Review requests.
- [x] Home renders the titles My published PRs and My draft PRs for those sections.

**Blocked by:** none

**Blocks:** none

**Parallel-eligible:** yes
