---
status: implemented
---

# PRD: Pull request overview

## Problem

The app opens inside one saved guide and uses a narrow Reviews rail as its only
selector. It cannot show pull requests before any git fetch, distinguish review
requests from authored work, identify repositories reliably, or show when a
saved diff or guide is behind, merged, or abandoned. Reviewers must already
know which PR to ask the agent to chapter and cannot read a raw Diff until that
chaptering finishes.

## Goal

A reviewer can pick a PR from a fresh, grouped overview for the current origin
repository, read its Diff immediately, and request a reading-order Guide only
when they want one.

## Non-goals

- Scanning every repository the authenticated user can access
- Adding repositories beyond the current origin
- Opening a repository that has no local clone
- Running an LLM or Cursor SDK job inside the app
- Giving the app direct git-host credentials
- Refreshing on a timer or while no guided-review skill session is active
- Approving, rejecting, voting on, merging, or abandoning a PR
- Implementing GitHub ingest in this PRD

## User stories

- As a reviewer, I want review requests, my authored PRs, other saved PRs, local
  ranges, and archived items separated so I can find the next review quickly.
- As a reviewer, I want every PR to show its repository so identical PR numbers
  and similar titles cannot be confused.
- As a reviewer, I want to open a PR into Diff without waiting for chaptering so
  I can start reading as soon as the commits are fetched.
- As a reviewer, I want to request a Guide for an already-open Diff so the LLM
  runs only when I want reading order.
- As a reviewer, I want an outdated snapshot to offer the latest Diff without
  hiding the saved review I already read.
- As a reviewer, I want merged and abandoned saved reviews retained as archived
  records instead of silently deleted.
- As a reviewer, I want to refresh host state and see when it was last synced so
  lifecycle and freshness are not implied to be live.
- As a reviewer with a named target, I want to enter that review directly
  without stopping on the overview.
- As a reviewer, I want a local-range review to become that pull request once
  a PR is open for the same branch so Home does not keep a Local ranges leftover
  beside the real PR.
- As a reviewer, I want each Home card to show target ← source (what we merge
  into, then what is being merged) so a saved range is not an unlabeled
  three-dot string.

## Implementation notes

- Home and review are distinct navigation states. A bare skill trigger opens
  Home. An explicit PR, SHA, branch, or range opens its review directly.
  Brand and a compact back control return from a review to Home. The review
  screen has no saved-PR column; switching PRs is Home. Chrome details live
  in the polish PRD.
- Home cards show merge direction as target ← source (base / into on the
  left, feature / from on the right). Prefer structured targetRef and
  sourceRef with refs/heads/ stripped. Local ranges fall back to the saved
  three-dot range parsed as base...head. Do not lead with a merge-base SHA.
  GitHub compare puts base on the left and compare/head on the right; GitHub
  PRs are a three-dot diff (merge-base of the branches vs head). Azure DevOps
  create-PR dropdowns put source on the left; this product follows the GitHub
  compare widget plus the requested merge_base ← feature reading order.
  Until Open as Diff, catalog cards without a saved review are not openable.
  A temporary Guide / No guide text label marks that. Do not spend time on a
  prettier cue until Open works.
- Opening a host PR is Diff-first. The waiting agent fetches exact source and
  target commits without checkout, upserts an unchaptered review, and the app
  lands on the Diff tab. No LLM chaptering runs for Open.
- An unchaptered review reuses the Guide file and hunk shape so Diff needs no
  second payload. It may store a single placeholder chapter for that shape.
  The Guide tab does not present that placeholder as a walkthrough. It shows
  Generate guide until chaptering replaces it with real chapters.
- Generate guide is a separate action on an already-open unchaptered review.
  The waiting agent chapters in place (same stable PR id), then Guide becomes
  the walkthrough. Default tab stays Diff until the user opens Guide.
- The overview reads the current origin repository. Multi-repository
  configuration moves to PRD 07 so it lands on direct provider APIs instead of
  a waiting-agent action.
- Azure DevOps is the first provider. Repository configuration, catalog
  identity, grouping, review matching, and action contracts remain
  provider-neutral so another provider can implement the same boundaries.
- A pull-request review carries structured repository identity: provider, host,
  provider repository id, owner, name, and web URL. The stable PR key combines
  provider, host, repository id, and PR number. PR title remains the title;
  owner and repository render as a compact badge in Home and the review
  header.
- The PR catalog is separate from saved reviews. It stores host lifecycle,
  draft state, source and target refs and commits, author, authenticated-user
  relationship, updated time, and per-repository sync status. Catalog
  replacement never deletes a saved review.
- Each live item appears once. Precedence is Review requests, Authored by me,
  Other saved PRs, then Local ranges. Review requests contain active,
  non-draft PRs where the user is a reviewer. Authored by me also includes the
  user's active drafts. Saved merged or abandoned PRs move to a collapsed
  Archived group. Closed PRs without a saved review disappear after refresh.
- Refresh and Open adopt unsourced local-range reviews using the git-host
  upsert rule (exact source branch, else unique ticket key; ambiguous matches
  stay local). After adoption the item leaves Local ranges and follows PR
  grouping. Adoption attaches provenance and keeps the review id; it does not
  by itself re-chapter. Outdated still applies when the attached source commit
  differs from the catalog.
- A catalog source commit matching the saved review is current. A different
  source commit is outdated. A current review opens immediately on Diff. A PR
  without a saved review offers Open. An outdated PR offers Update Diff as the
  main action and Open saved as a secondary action; the latter keeps a
  persistent Outdated warning. Generate guide remains available on a current
  unchaptered review. Archived reviews are read-only.
- Bare skill startup replaces the current-origin catalog snapshot, records a
  sync failure without deleting saved reviews, and opens Home. The agent then
  long-polls for browser actions. Open, Generate guide, Update Diff, Refresh,
  move through queued, claimed, succeeded, or failed states. After completing
  one action, the agent waits again. The app shows
  Waiting, Opening, Generating guide, Refreshing, failure, Last synced, and
  Agent disconnected states.
- The app stores actions but does not execute host or git operations. Saved
  Diffs and Guides stay openable after the agent disconnects. Open, Generate
  guide and refresh explain that the skill must be
  running when no agent is connected.
- Refresh is automatic once at bare skill startup and manual afterward. There
  is no timer or daemon.
- An explicit named PR from the skill still bypasses Home. It opens Diff-first
  unless a current chaptered Guide already exists for that PR and source
  commit.

## Testing / seams

**Seam(s):** Typed catalog and action commands after schema parsing, shared by
HTTP and MCP; a pure overview projection that combines catalog entries with
saved reviews; action claim and completion with injected git-host and git-cache
adapters.

**Why this seam:** These boundaries cover persistence, grouping, lifecycle,
freshness, Diff-first open, and optional chaptering without coupling tests to
Astro, live credentials, or a real repository clone.

**What a good test is here:** Replace the current-origin catalog snapshot;
combine it with current, outdated, archived, unchaptered, chaptered, and local
reviews; assert every item appears in exactly one group with the right action.
Claim and complete Open, Generate guide, Update Diff, and Refresh; preserve an
isolated sync failure; detect a disconnected agent; and load old review data
with no catalog. Open does not invoke a chaptering adapter. Generate guide
does. Fake adapters provide host metadata, commits, and optional chaptered
payloads. CI never contacts live ADO or asserts Astro DOM internals. One
manual check covers Open landing on Diff, then Generate guide filling Guide.

**Prior art:** Store command tests and guide-view helper tests.

## Trade-offs (decided)

| Decision | Chose | Rejected | Why |
|---|---|---|---|
| Repository scope | Current origin | Configured list; scan every accessible repo | Ships one useful inbox before direct provider automation |
| First open | Diff-first, no LLM | Chapter before the reviewer can read | Git fetch is enough for Diff; chaptering is optional and slower |
| Guide generation | Explicit Generate guide on an open Diff | Chapter on every Open; generate every PR up front | Pays for reading-order work only when asked |
| Refresh | Startup plus manual | Timer; app-owned host polling | Makes freshness explicit and keeps credentials in the agent |
| Closed saved PRs | Archive without auto-delete | Remove on refresh; leave in live groups | Retains review history without polluting active work |
| Data model | Catalog separate from reviews; unchaptered Diff reuses hunk shape | Empty placeholder Guides shown as walkthroughs | A host PR can be readable before chaptering without faking Guide copy |
| Home range order | target ← source (base left) | source → target (ADO create-PR dropdowns); unlabeled A...B | GitHub compare and three-dot PR diffs put the into-branch first; names beat SHAs |

## Superseded work

- Issues 05 and 06 are cancelled. [Provider API
  automation](../../07-provider-api-automation/) owns configured repositories,
  GitHub parity, managed bare caches, and app-owned refresh.
- Home card Guide presence — replace the temporary Guide / No guide text with
  a non-text cue (left color bar or equivalent). Do not invent a new status
  vocabulary; the bar only means a saved Guide exists vs catalog-only. Not
  before Open as Diff.

## Success criteria

- A bare skill trigger syncs the current origin, opens Home, shows Last synced
  and an isolated failure, and does not chapter a Guide before the reviewer
  asks.
- Each catalog or saved item appears once under Review requests, Authored by me,
  Other saved PRs, Local ranges, or Archived according to the defined
  precedence and lifecycle.
- Every host PR shows a compact owner and repository badge in Home and the
  review header, while structured repository identity round-trips through the
  review and catalog contracts.
- A Home card range line reads target ← source (into-branch left, incoming
  branch right), using structured refs when present.
- Selecting an unopened PR queues one Open action; the waiting agent fetches
  exact commits without checkout, upserts an unchaptered review, and the app
  opens Diff. The Guide tab shows Generate guide, not a walkthrough.
- Generate guide on that review chapters in place, keeps the same id, and
  fills the Guide tab. The agent then accepts another action.
- A changed source commit displays Outdated. Update Diff refreshes the
  snapshot; Open saved preserves the old review with a persistent warning.
- Refresh moves a saved merged or abandoned PR to Archived, removes a closed
  catalog item with no saved review, and never deletes a saved review.
- Disconnecting the agent disables host-backed actions with a clear recovery
  message while current, saved, local, and archived reviews remain openable.
- An explicit PR, SHA, branch, or range still produces exactly one review and
  opens it directly without bulk catalog chaptering. A named PR without a
  current Guide opens Diff-first.
- Refresh or Open of a PR whose source branch matches an unsourced local-range
  review adopts that row (unique ticket-key rename included) so it is not listed
  twice.
- Automated checks cover schemas, current-origin catalog replacement,
  grouping, lifecycle, freshness, Open versus Generate guide, and action
  coordination through the agreed seams without live ADO.

## Out of scope

- Configured repositories beyond current origin, managed bare caches, and
  cross-provider aggregation (PRD 07)
- Existing host threads, replies, review votes, and reviewer completion state
- Search, notifications, keyboard triage, or dashboard analytics
- Automatic retention limits for archived reviews
- Remote deployment, multi-user access, and shared repository configuration

## References

- Grill-me decisions in the planning chat
- [PRD: Guided PR review](../01-guided-pr-review/)
- [PRD: Git-host guided reviews](../03-git-host-guided-reviews/)
- [PRD: Review screen polish](../02-review-screen-polish/) (review chrome; no
  saved-PR column on the review screen)
- Linear Files screenshot 14 Sep 2026
- GitHub: Comparing commits; About comparing branches in pull requests
  (base left, compare right; three-dot diff)
- Azure DevOps: Create a pull request (source left / target right on the
  create form — not used for Home range order)
- Wayfinder: skipped because the decisions fit one session

## integration-review

Reviewed 15 Sep 2026. This reviews the 04/07 overlap commit
59176cb386c6c3959726f8aa86d90c790044e951 on top of squashed 03+04.

Base 5823a1fe5bfb4da814add6111613bb56496f8df0
Head 59176cb386c6c3959726f8aa86d90c790044e951

Standards: 0 major / 0 minor / 0 nit

Spec: 0 missing / 0 partial / 0 scope-creep / 0 incorrect

### Standards

ZERO

### Spec

ZERO

03 Open as Diff holds: unopened catalog cards still queue one Open; Open
upserts an unchaptered review and does not run a chaptering adapter.

04 Refresh holds: leftover Other saved PRs whose syncKey matches catalog
still go through catalogCard / sourceCommitMoved, so Outdated still offers
Update Diff plus Open saved.

07 Generate guide holds: generate-guide still queues only for an unchaptered
saved review; completeGenerateGuideAction plus ChapteringAdapter still
chapter in place on the same id.
