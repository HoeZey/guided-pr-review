---
status: done
blocked_by: []
blocks: []
---

# Remove the saved-PR column and return via back

**Type:** Story

**From PRD:** [Review screen polish](../)

**Seam(s):** Overview navigation (Home vs review URL); review header chrome.
Existing resolveOverviewView / reviewPath / HOME_PATH. Manual check that
the Reviews column is gone. Do not persist a Reviews rail per tab.

**What it delivers:** A reviewer inside a PR sees no saved-PR list. Brand
and a compact back control return to Home without deleting store state.
Home is the PR switcher. Files and chapter rails stay.

**Scope (in):**

- Drop the saved-PR Reviews column from Guide, Diff, and Code Review.
- Brand still returns to Home.
- A compact back control also returns to Home.
- Reload of a review URL still opens that review.
- Dead Reviews-rail collapse prefs can be removed or ignored; do not add
  a Code Review rail bit.

**Scope (out):**

- Home catalog grouping
- Diff card rounding, type scale, chapter-column resize
- Deleting saved reviews (no × in a gone column)

**Touches:** navigation, UI, tests if rail helpers are deleted

**Acceptance criteria:**

- [x] Guide, Diff, and Code Review have no saved-PR column on a manual pass.
- [x] Brand and the back control return to Home without losing saved
  reviews.
- [x] Reloading a review URL still opens that review.
- [x] Helper tests still cover Home vs review URLs. No Astro DOM
  assertions.

**Blocked by:** none

**Blocks:** none

**Parallel-eligible:** yes
