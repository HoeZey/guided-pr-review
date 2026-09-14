---
status: todo
blocked_by: []
blocks:
  - 02-browse-outcome-history
---

# Show the latest code-review outcome beside Guide and Diff

**Type:** Story

**From PRD:** [Code-review outcomes](../)

**Seam(s):** publish_review_outcome; selectReviewOutcome

**What it delivers:** A reviewer can run an independent /code-review and read
its structured Standards and Spec findings in a third tab on the matching
localhost guide.

**Scope (in):**

- Parse the signed CodeReviewOutcome v1 contract.
- Append a published outcome to a matching review.
- Expose publishing through HTTP and MCP.
- Let /code-review find a guide by exact base and head and publish after its
  normal chat report.
- Always show a Code Review tab.
- Render the newest exact-base/head run with separate Standards and Spec
  counts and cards.
- Render severity, Spec classification, title, explanation, and optional
  recommendation, location, and reference.
- Show an explicit zero-finding state and a no-outcome state.
- Keep the chat report successful when the localhost app is unavailable.

**Scope (out):**

- Choosing older runs
- Displaying stale outcomes after the guide moves
- Applying or dismissing findings
- Running code review from the browser
- Deep links into Diff lines

**Touches:** contracts, store, HTTP and MCP, code-review integration, tab UI,
tests

**Acceptance criteria:**

- [ ] A valid outcome publishes only to the requested existing review.
- [ ] An independent /code-review run automatically publishes when one guide
  matches its fixed base and head.
- [ ] The Code Review tab displays Standards and Spec independently without an
  aggregate verdict.
- [ ] Counts are derived from finding arrays, including zero.
- [ ] Every required finding field renders; optional fields render only when
  present.
- [ ] Invalid payloads, unknown fields, and unknown review ids are rejected.
- [ ] Existing Store v1 JSON loads with empty outcome history.
- [ ] No matching guide or unavailable localhost app leaves the normal chat
  report intact and explains that nothing was attached.

**Blocked by:** none

**Blocks:** 02 Browse prior review runs and spot stale findings

**Parallel-eligible:** yes
