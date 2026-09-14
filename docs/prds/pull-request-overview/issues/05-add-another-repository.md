---
status: todo
blocked_by:
  - 03-generate-selected-pr
blocks:
  - 06-generate-without-local-clone
---

# Add another repository to the overview

**Type:** Story

**From PRD:** [Pull request overview](../)

**Seam(s):** repository registration; catalog replacement; overview projection

**What it delivers:** A reviewer can add an explicit Azure DevOps repository to
Home, see its PRs beside the current origin, and remove it from future syncs
without deleting saved guides.

**Scope (in):**

- Persist an explicit repository list with the current origin included.
- Queue Add repository to the waiting agent for validation and save.
- Sync catalog metadata for every configured repository.
- Show owner and repository badges so identical PR numbers stay distinct.
- Isolate per-repository sync failures.
- Stop future catalog syncs when a repository is removed, without deleting
  saved guides from that repository.

**Scope (out):**

- Scanning every accessible repository
- Generating a guide for an uncloned repository
- GitHub repositories

**Touches:** repository configuration, catalog, Home repo management, tests

**Acceptance criteria:**

- [ ] Add repository validates through the waiting agent and persists the
  repository.
- [ ] Home lists PRs from the current origin plus added repositories.
- [ ] Each host PR shows its owner and repository badge.
- [ ] One repository's sync failure does not drop another repository's catalog.
- [ ] Removing a repository stops future syncs and keeps saved guides.
- [ ] Repository registration tests use fake host validation, not live ADO.

**Blocked by:** 03 Generate the selected PR while the agent waits

**Blocks:** 06 Generate a guide without a local clone

**Parallel-eligible:** no
