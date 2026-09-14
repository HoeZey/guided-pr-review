---
status: signed
---

# PRD: Code-review outcomes

## Problem

Guided review explains a change in reading order, while /code-review reports
Standards and Spec findings in chat. Reviewers must leave the diff surface to
read that report, and the localhost review has no structured record of finding
titles, severity, explanations, evidence, or snapshot freshness.

## Goal

Each saved guide can show independently produced Standards and Spec outcomes,
including prior runs and clear freshness against the guide's current base and
head.

## Non-goals

- Running /code-review as part of /guided-pr-review
- Combining Standards and Spec into one score or verdict
- Fixing findings, approving, rejecting, voting, or merging
- Reviewing uncommitted changes
- Multi-user history, remote hosting, or sharing outcome data

## User stories

- As a reviewer, I want a Code Review tab beside Guide and Diff so the map,
  change, and findings share one surface.
- As a reviewer, I want Standards and Spec kept separate so one axis does not
  hide or rerank the other.
- As a reviewer, I want zero findings shown explicitly so absence of cards is
  not mistaken for a missing review.
- As a reviewer, I want each outcome tied to its base and head commits so I know
  whether it still describes the displayed change.
- As a reviewer, I want older runs available by date and head commit so review
  history survives later commits.
- As a reviewer, I want an old result marked prominently when no run matches the
  current guide so stale findings cannot look current.

## Implementation notes

- /code-review remains a fresh, independent, report-only session. After
  reporting in chat, it publishes the same structured result to a matching
  localhost guide. Failure to publish does not invalidate the chat report.
- CodeReviewOutcome v1 is the source contract. Counts are derived from findings
  and never stored separately.

```json
{
  "version": 1,
  "base": "40-character commit SHA",
  "head": "40-character commit SHA",
  "branch": "feature/example",
  "standards": {
    "findings": [
      {
        "severity": "major",
        "title": "Guide expansion is lost after visiting Diff",
        "explanation": "Diff state is written back into Guide collapse state.",
        "recommendation": "Keep viewed-derived Diff collapse separate from Guide state.",
        "location": {
          "path": "src/viewer.ts",
          "startLine": 598,
          "endLine": 600
        },
        "reference": {
          "source": "ponytail.mdc",
          "quote": "Bug fix = root cause, not symptom."
        }
      }
    ]
  },
  "spec": {
    "findings": [
      {
        "severity": "minor",
        "classification": "partial",
        "title": "Diff file headers do not stick",
        "explanation": "Overflow containment prevents sticky positioning.",
        "recommendation": "Remove the containing overflow on Diff cards.",
        "location": {
          "path": "src/styles/global.css",
          "startLine": 1
        },
        "reference": {
          "source": "docs/prds/guided-pr-review/",
          "quote": "File heads stick while scrolling that file."
        }
      }
    ]
  }
}
```

- severity is major, minor, or nit. Standards summaries group by severity.
- classification exists only on Spec findings and is missing, partial,
  scope-creep, or incorrect. Spec summaries group by classification while
  retaining severity on each card.
- title, explanation, and severity are required. recommendation, location, and
  reference are optional. location requires path and startLine; endLine is
  optional. reference requires source; quote is optional.
- base and head are full commit SHAs. branch is optional display metadata.
  Standards and Spec always exist; an empty findings array means zero findings.
  Unknown fields are rejected at the boundary.
- Review records contain an append-only outcome history. The store generates
  outcome ids and addedAt timestamps around the CodeReviewOutcome v1 payload.
  Publishing another run never overwrites an older run, including another run
  at the same head.
- publish_review_outcome accepts a review id and a parsed CodeReviewOutcome v1
  payload. list_reviews exposes guide base and head so /code-review can find an
  exact snapshot. If no guide matches its fixed base and head, /code-review
  keeps the normal chat report and says no localhost outcome was attached.
- The Code Review tab always exists. With no outcomes, it shows an empty state
  that asks the user to run /code-review. Otherwise it opens the newest outcome
  whose base and head match the guide. If none match, it opens the newest run
  behind a prominent outdated warning. A history selector lists every run by
  date and short head SHA.
- Standards and Spec render as separate sections with derived counts and
  finding cards. A card shows severity, classification when present, title,
  explanation, recommendation, location, and reference. Source locations and
  references are display evidence, not navigation in this version.
- Existing Store v1 files without outcome history remain valid. Removing a
  review removes its outcome history. No retention cap is needed for the local
  JSON store.
- Store polling picks up a newly published outcome without reloading the app.

## Testing / seams

**Seam(s):** Store command publish_review_outcome after Zod parsing, and pure
selectReviewOutcome given the current base, current head, and outcome history.

**Why this seam:** The store command is shared by HTTP and MCP; freshness and
history selection must not live only in DOM rendering.

**What a good test is here:** Publishing appends an immutable run to the
requested review; repeat runs at one head remain distinct; Standards and Spec
counts remain independent; an unknown review id or invalid outcome is rejected;
old Store v1 JSON loads with empty history. selectReviewOutcome chooses the
newest exact base/head run, falls back to the newest stale run with outdated
status, and returns empty when no outcomes exist. Do not test Astro internals.

**Prior art:** Store command tests and pure Guide-view helper tests.

## Trade-offs (decided)

| Decision | Chose | Rejected | Why |
|---|---|---|---|
| Producer | Independent /code-review session | Auto-review during guide creation; manual paste | Preserves fresh-session review and removes duplicate entry |
| Axes | Standards and Spec stay separate | One merged grade | The axes answer different questions |
| Freshness | Append-only history; newest exact match, else stale warning | Clear old outcomes; show only latest | Keeps useful history without presenting it as current |
| Durable product contract | PRDs in the guided-pr-review GitHub repo | TCD Jira and Braid context | This is a personal tool, not a TCD product issue |
| Local outcome history | App JSON store | Git-tracked review results | Outcomes are machine-local and can contain repo-specific findings |
| Matching | Immutable base and head | Branch name | Branch heads move |

## Open questions (intentionally deferred)

- Click a finding to jump to its exact Diff line — when display-only locations
  prove too slow
- Compare two outcome runs — when reruns are common enough to need a delta
- Import old chat-only reviews — when historical backfill matters
- Retention limits or SQLite — when local JSON size becomes measurable

## Success criteria

- A matching /code-review run appears automatically in the review's Code Review
  tab without changing Guide or Diff.
- Standards and Spec show independent counts, including zero, and never produce
  an aggregate verdict.
- Multiple runs remain selectable by date and short head SHA.
- A current base/head match opens without warning. If the guide has moved, the
  newest prior run remains visible with an outdated warning.
- Invalid outcomes and unknown review ids are rejected at the store boundary;
  old stores load with no migration command.
- /code-review remains report-only and still returns the chat report when the
  localhost app is unavailable.

## Out of scope

- Running code review from the browser
- Applying or dismissing findings from the browser
- ADO thread creation, replies, votes, or merge actions (covered separately by
  the Git-host guided-reviews PRD)
- Outcome deep links into source lines
- Outcomes for dirty working-tree diffs

## References

- [PRD: Guided PR review](../guided-pr-review/)
- [PRD: Git-host guided reviews](../git-host-guided-reviews/)
- Grill decisions in the planning chat (independent producer, personal tool
  GitHub repo as product source, append-only history, stale warning, explicit
  finding contract, store plus pure selection test seam)
