---
status: todo
blocked_by: []
blocks:
  - 02-browse-current-repository-prs
---

# Open saved reviews from Home

**Type:** Story

**From PRD:** [Pull request overview](../)

**Seam(s):** list_reviews; pure overview projection

**What it delivers:** A reviewer who opens the app without an explicit target
lands on Home, sees every saved guide, and can enter or leave a review without
using the narrow Reviews rail as the primary selector.

**Scope (in):**

- Add distinct Home and review navigation states.
- List saved local ranges and source-backed PR guides from the review store.
- Show title, saved range, and structured repository badge when available.
- Open a saved guide from its Home card.
- Return to Home from the review header and brand mark.
- Open an explicit PR, SHA, branch, or range directly in its review.
- Preserve direct review navigation across a browser reload.

**Scope (out):**

- Live host catalog entries
- Relationship grouping
- Host refresh and lifecycle state
- Generating a guide from a Home card

**Touches:** review summaries, navigation, Home UI, review header, skill launch,
pure projection helper, tests

**Acceptance criteria:**

- [ ] A bare app or skill launch opens Home rather than an arbitrary saved
  review.
- [ ] Every saved local or host-backed guide appears once on Home.
- [ ] A host-backed card shows owner and repository when structured source
  identity exists; a local guide still loads without it.
- [ ] Selecting a card opens that guide's Guide and Diff tabs.
- [ ] Home and the brand mark return from a review without losing saved state.
- [ ] An explicit target bypasses Home and opens its generated guide directly.
- [ ] Reloading a Home or review URL preserves the selected navigation state.
- [ ] Projection tests do not assert Astro DOM internals.

**Blocked by:** none

**Blocks:** 02 Browse current-repository PRs by relationship

**Parallel-eligible:** yes
