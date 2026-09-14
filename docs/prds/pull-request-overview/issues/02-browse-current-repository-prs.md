---
status: done
blocked_by:
  - 01-open-saved-reviews-from-home
blocks:
  - 03-open-selected-pr-as-diff
---

# Browse current-repository PRs by relationship

**Type:** Story

**From PRD:** [Pull request overview](../)

**Seam(s):** catalog replacement commands; overview projection

**What it delivers:** A reviewer who triggers the skill without a named target
sees current-repository PRs grouped by relationship, with repository identity
and Last synced, before any guide is generated.

**Scope (in):**

- Persist a catalog snapshot for the current origin repository.
- Include the current origin repository in configuration automatically.
- Show Review requests and Authored by me from catalog metadata.
- Show compact owner and repository badges on every host PR.
- Record Last synced and isolated catalog failures.
- Open Home after catalog sync without generating a guide.
- Keep saved guides on Home when catalog sync finds no PRs.

**Scope (out):**

- Opening a Diff from a catalog card
- Generating a reading-order Guide
- Manual Refresh and lifecycle archive behavior
- Adding a second repository
- Bare git caches

**Touches:** catalog contracts, store, skill orchestration, Home grouping UI,
projection helper, tests

**Acceptance criteria:**

- [x] A bare skill trigger syncs current-origin PR metadata and opens Home.
- [x] No guide is generated before the reviewer selects one.
- [x] Each live catalog item appears once under Review requests or Authored by
  me according to reviewer versus author precedence, including the user's
  active drafts in Authored by me.
- [x] Every host PR shows a compact owner and repository badge.
- [x] Last synced is visible after a successful catalog replacement.
- [x] A failed catalog sync reports an isolated error and leaves saved reviews
  visible.
- [x] Catalog replacement never deletes a saved guide.
- [x] Projection and catalog command tests use fake host metadata, not live
  ADO.

**Blocked by:** 01 Open saved reviews from Home

**Blocks:** 03 Open the selected PR as Diff

**Parallel-eligible:** no
