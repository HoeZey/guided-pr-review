---
status: done
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

- [x] Manual Refresh updates Last synced and replaces catalog snapshots.
- [x] A changed source commit shows Outdated with Update Diff plus Open saved.
- [x] Update Diff refreshes the snapshot through upsert without requiring
  chaptering.
- [x] Open saved preserves the old review and shows a persistent Outdated
  warning.
- [x] A saved merged or abandoned PR moves to collapsed Archived and remains
  openable as read-only.
- [x] A closed unguided catalog item disappears after refresh.
- [x] Refresh never deletes a saved guide.
- [x] An unsourced local-range review whose range head matches a catalog PR
  (or uniquely shares a ticket key) is adopted onto that PR and leaves Local
  ranges; two locals with the same ticket stay local.
- [x] Projection tests cover current, outdated, archived, and removed-unguided
  cases with fake catalog data.

**Blocked by:** 03 Open the selected PR as Diff

**Blocks:** none

**Parallel-eligible:** no

## code-review

Reviewed base 235168a4e011e79d0639a477e1f40326c3624d56 and head
33f985aa318f346003f16ff435e9572eec69ddb5 on 15 Sep 2026.

Standards: 0 major / 1 minor / 1 nit

Spec: 0 missing / 1 partial / 0 scope-creep / 0 incorrect

### Standards

1. minor — Leftover hosted Home cards never compute outdated

   projectHomeCards hardcodes outdated and archived to false.
   projectHomeOverview only sets those flags in catalogCard for review-requests,
   authored-by-me, and closed saved PRs. An active catalog item that is neither
   a review request nor authored is not placed, so a matching saved review
   falls into other-saved with no Outdated badge and no Update Diff.
   reviewOutdatedWarning still joins every catalog item by syncKey, so the
   review banner can warn while Home looks current.

   Derive outdated/archived once from catalog plus review, and reuse that for
   grouping, leftover hosted cards, and the banner.

   Location: src/overview.ts:154 (170), src/overview.ts:259

2. nit — Combined projection test repeats four focused cases

   projection covers current, outdated, archived, and removed-unguided catalog
   cases restates the four tests above it.

   Keep the focused tests or the umbrella, not both.

   Location: src/overview.test.ts:621

### Spec

1. partial — Other saved PRs never show Outdated or Update Diff

   Review-request and authored cards use catalogCard, which sets outdated when
   the catalog source commit differs and supplies openTarget for Update Diff.
   A saved active PR that Refresh appends because it was not a review request
   or authored item is never placed in that loop. It falls through to
   projectHomeCards, which hardcodes outdated false and omits openTarget, so
   Home only offers Open saved.

   That leaves Other saved PRs without the required Outdated plus Update Diff
   main action when the catalog source commit changed.

   If a leftover hosted review's syncKey matches a catalog item, build it with
   catalogCard and put it in Other saved PRs.

   Location: src/overview.ts:257

   Story: Mark a saved PR outdated when the catalog source commit changed.
   PRD: A different source commit is outdated. An outdated PR offers Update
   Diff as the main action and Open saved as a secondary action.

### Second pass — 15 Sep 2026

Reviewed base 235168a4e011e79d0639a477e1f40326c3624d56 and head
34fb4ba2dfeb8b333f7f05c5be55275b907088ab.

Standards: 0 major / 0 minor / 0 nit

Spec: 0 missing / 0 partial / 0 scope-creep / 0 incorrect

#### Standards

ZERO

Leftover hosted reviews whose syncKey matches a catalog item now go through
catalogCard (Outdated plus Update Diff) in Other saved PRs. sourceCommitMoved
is shared with reviewOutdatedWarning.

#### Spec

ZERO
