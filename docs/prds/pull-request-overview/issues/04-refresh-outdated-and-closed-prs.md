---
status: todo
blocked_by:
  - 03-open-selected-pr-as-diff
blocks: []
---

# Refresh outdated and closed PRs

**Type:** Story

**From PRD:** [Pull request overview](../)

**Seam(s):** catalog replacement; action lifecycle; overview projection

**What it delivers:** A reviewer can refresh host state and see whether a saved
guide is current, outdated, merged, or abandoned without losing that guide.

**Scope (in):**

- Queue a manual Refresh action to the waiting agent.
- Replace catalog snapshots for configured repositories.
- Mark a saved PR outdated when the catalog source commit changed.
- Offer Update Diff as the main outdated action and Open saved as the
  secondary action.
- Keep a persistent Outdated warning when opening the saved review.
- Move saved merged or abandoned PRs into a collapsed Archived group.
- Adopt matching unsourced local-range reviews onto catalog PRs (exact source
  branch, else unique ticket key) so they leave Local ranges.
- Drop closed catalog items that have no saved guide.
- Never auto-delete a saved guide.

**Scope (out):**

- Timer-based refresh
- Adding repositories
- Bare git caches

**Touches:** catalog replacement, action queue, Home card states, review
outdated banner, tests

**Acceptance criteria:**

- [ ] Manual Refresh updates Last synced and replaces catalog snapshots.
- [ ] A changed source commit shows Outdated with Update Diff plus Open saved.
- [ ] Update Diff refreshes the snapshot through upsert without requiring
  chaptering.
- [ ] Open saved preserves the old review and shows a persistent Outdated
  warning.
- [ ] A saved merged or abandoned PR moves to collapsed Archived and remains
  openable as read-only.
- [ ] A closed unguided catalog item disappears after refresh.
- [ ] Refresh never deletes a saved guide.
- [ ] An unsourced local-range review whose range head matches a catalog PR
  (or uniquely shares a ticket key) is adopted onto that PR and leaves Local
  ranges; two locals with the same ticket stay local.
- [ ] Projection tests cover current, outdated, archived, and removed-unguided
  cases with fake catalog data.

**Blocked by:** 03 Open the selected PR as Diff

**Blocks:** none

**Parallel-eligible:** no
