---
status: signed
---

# PRD: Pull request overview

## Problem

The app opens inside one saved guide and uses a narrow Reviews rail as its only
selector. It cannot show pull requests before guide generation, distinguish
review requests from authored work, identify repositories reliably, or show
when a saved guide is behind, merged, or abandoned. Reviewers must already know
which PR to ask the agent for and cannot manage a multi-repository queue from
the review surface.

## Goal

A reviewer can choose one PR from a fresh, grouped overview spanning explicitly
configured repositories and know its repository, lifecycle, and guide freshness
before entering the review screen.

## Non-goals

- Scanning every repository the authenticated user can access
- Running an LLM or Cursor SDK job inside the app
- Giving the app direct git-host credentials
- Refreshing on a timer or while no guided-review skill session is active
- Approving, rejecting, voting on, merging, or abandoning a PR
- Implementing GitHub ingest in this PRD

## User stories

- As a reviewer, I want review requests, my authored PRs, other saved PRs, local
  ranges, and archived guides separated so I can find the next review quickly.
- As a reviewer, I want every PR to show its repository so identical PR numbers
  and similar titles cannot be confused.
- As a reviewer, I want to add an explicit repository to the overview so one
  localhost instance can hold work from several repositories.
- As a reviewer, I want an unguided PR to generate only after I select it so the
  agent does not chapter an entire queue up front.
- As a reviewer, I want an outdated guide to offer the latest diff without
  hiding the saved guide I already read.
- As a reviewer, I want merged and abandoned saved guides retained as archived
  records instead of silently deleted.
- As a reviewer, I want to refresh host state and see when it was last synced so
  lifecycle and freshness are not implied to be live.
- As a reviewer with a named target, I want to enter that review directly
  without stopping on the overview.

## Implementation notes

- Home and review are distinct navigation states. A bare skill trigger opens
  Home. An explicit PR, SHA, branch, or range opens its review directly.
  Home and the brand mark return from a review to the overview.
- Repository configuration is persisted. The current origin repository is
  included automatically. Add repository sends an action to the waiting agent,
  which authenticates, validates, and saves the repository. Removing a
  repository stops future catalog syncs but does not delete saved guides.
- Azure DevOps is the first provider. Repository configuration, catalog
  identity, grouping, guide matching, and action contracts remain
  provider-neutral so another provider can implement the same boundaries.
- A pull-request guide carries structured repository identity: provider, host,
  provider repository id, owner, name, and web URL. The stable PR key combines
  provider, host, repository id, and PR number. PR title remains the guide
  title; owner and repository render as a compact badge in Home and the review
  header.
- The PR catalog is separate from generated Guide records. It stores host
  lifecycle, draft state, source and target refs and commits, author,
  authenticated-user relationship, updated time, and per-repository sync
  status. Catalog replacement never deletes a saved guide.
- Each live item appears once. Precedence is Review requests, Authored by me,
  Other saved PRs, then Local ranges. Review requests contain active,
  non-draft PRs where the user is a reviewer. Authored by me also includes the
  user's active drafts. Saved merged or abandoned PRs move to a collapsed
  Archived group. Closed PRs without a guide disappear after refresh.
- A catalog source commit matching the saved guide is current. A different
  source commit is outdated. A current guide opens immediately. A PR without a
  guide offers Generate review. An outdated PR offers Update and review as the
  main action and Open saved as a secondary action; the latter keeps a
  persistent Outdated warning. Archived guides are read-only.
- Bare skill startup replaces catalog snapshots for configured repositories,
  records isolated per-repository failures, and opens Home. The agent then
  long-polls for browser actions. Generate, Update, Refresh, and Add repository
  move through queued, claimed, succeeded, or failed states. After completing
  one action, the agent waits again. The app shows Waiting, Generating,
  Refreshing, failure, Last synced, and Agent disconnected states.
- The app stores actions but does not execute host or git operations. Existing
  guides stay openable after the agent disconnects. Generation, refresh, and
  repository changes explain that the skill must be running when no agent is
  connected.
- For a repository without a local clone, the agent keeps a managed bare git
  cache under local app data. It fetches exact target and source commits and
  creates the diff without checkout or changes to a user working tree.
- Refresh is automatic once at bare skill startup and manual afterward. There
  is no timer or daemon.

## Testing / seams

**Seam(s):** Typed catalog and action commands after schema parsing, shared by
HTTP and MCP; a pure overview projection that combines catalog entries with
saved reviews; action claim and completion with injected git-host and git-cache
adapters.

**Why this seam:** These boundaries cover persistence, grouping, lifecycle,
freshness, and browser-to-agent coordination without coupling tests to Astro,
live credentials, or a real repository clone.

**What a good test is here:** Register two repositories and replace their
catalog snapshots; combine them with current, outdated, archived, and local
guides; assert every item appears in exactly one group with the right action.
Claim and complete Generate, Update, Refresh, and Add repository actions;
isolate one repository sync failure; detect a disconnected agent; and load old
review data with no catalog. Fake adapters provide host metadata and commits.
CI never contacts live ADO, clones a private repository, or asserts Astro DOM
internals. One manual check covers browser selection through agent completion
and navigation into the resulting guide.

**Prior art:** Store command tests and guide-view helper tests.

## Trade-offs (decided)

| Decision | Chose | Rejected | Why |
|---|---|---|---|
| Repository scope | Explicit configured list | Current repo only; scan every accessible repo | Supports one inbox without hidden breadth or noise |
| Guide generation | Browser selection handled by waiting agent | Generate every guide up front; app-launched agent job | Keeps reasoning in the skill and pays only for selected work |
| Cross-repo git data | Managed bare caches | Require local clones; build diffs only from host APIs | Preserves normal git diffs without touching working trees |
| Refresh | Startup plus manual | Timer; app-owned host polling | Makes freshness explicit and keeps credentials in the agent |
| Closed saved PRs | Archive without auto-delete | Remove on refresh; leave in live groups | Retains review history without polluting active work |
| Data model | Catalog separate from guides | Empty placeholder guides | A host PR can exist before chaptering without weakening Guide |

## Open questions (intentionally deferred)

- GitHub catalog and cache authentication — after the ADO provider proves the
  shared contracts
- Automatic metadata refresh — if startup plus manual refresh leaves the
  overview stale in normal use
- Multiple concurrent waiting agents — if a single local user runs more than
  one overview session at once

## Success criteria

- A bare skill trigger syncs the current origin plus configured repositories,
  opens Home, shows Last synced and isolated failures, and does not generate a
  guide before selection.
- Each catalog or saved item appears once under Review requests, Authored by me,
  Other saved PRs, Local ranges, or Archived according to the defined
  precedence and lifecycle.
- Every host PR shows a compact owner and repository badge in Home and the
  review header, while structured repository identity round-trips through the
  guide and catalog contracts.
- Selecting an unguided PR queues one action; the waiting agent claims it,
  fetches exact commits without checkout, upserts one guide, reports success,
  and the app opens that review. The agent then accepts another selection.
- A changed source commit displays Outdated. Update and review regenerates the
  guide; Open saved preserves the old guide with a persistent warning.
- Refresh moves a saved merged or abandoned PR to Archived, removes a closed
  unguided catalog item, and never deletes a saved guide.
- Disconnecting the agent disables host-backed actions with a clear recovery
  message while current, saved, local, and archived guides remain openable.
- An explicit PR, SHA, branch, or range still produces one guide and opens it
  directly without bulk catalog generation.
- Automated checks cover schemas, repository registration, catalog
  replacement, grouping, lifecycle, freshness, and action coordination through
  the agreed seams without live ADO or clone access.

## Out of scope

- Cross-provider aggregation beyond the provider-neutral contract
- Existing host threads, replies, review votes, and reviewer completion state
- Search, notifications, keyboard triage, or dashboard analytics
- Automatic retention limits for archived guides
- Remote deployment, multi-user access, and shared repository configuration

## References

- Grill-me decisions in the planning chat
- [PRD: Guided PR review](../guided-pr-review/)
- [PRD: Git-host guided reviews](../git-host-guided-reviews/)
- Wayfinder: skipped because the decisions fit one session
