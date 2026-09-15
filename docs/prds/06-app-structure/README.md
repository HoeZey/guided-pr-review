---
status: signed
---

# PRD: App structure

## Problem

The app is still one Astro process, but its source no longer has clear
boundaries. viewer.ts mixes browser state, HTTP, navigation, Home, Guide,
Diff, Code Review, keyboard behavior, and rendering. store.ts mixes JSON IO,
review commands, catalog reconciliation, actions, and summaries. contracts.ts
contains every schema family and MCP tool declaration. Astro routes and MCP
reach these modules directly.

Adding two git hosts, authenticated API calls, managed git caches, and inline
comments on this shape would grow the same hotspots and make later changes
harder to review. Splitting frontend and backend into separate products would
add deployment cost without fixing dependency direction.

## Goal

Keep one Astro application while separating client presentation, server use
cases, persistence, provider IO, and shared pure logic behind explicit
dependencies. Phase 07 and 08 can add provider and comment capabilities
without moving the app again.

## Non-goals

- New provider, authentication, repository, refresh, diff, or comment behavior
- A separate frontend and backend deployment
- A DI framework, generic BaseRepository, or class for every schema
- Visual redesign
- Changing Guide chaptering or code-review behavior
- SQLite now
- Preserving every private TypeScript or browser HTTP shape

## User stories

- As a maintainer, I want browser rendering separated from server IO so a UI
  change cannot import filesystem, subprocess, or credentials.
- As a maintainer, I want routes to call feature services so HTTP and MCP do
  not duplicate business rules.
- As a maintainer, I want repositories to expose app operations rather than
  JSON details so a later SQLite adapter does not change service callers.
- As a maintainer, I want provider, auth, and git boundaries established before
  direct host APIs land.
- As a maintainer, I want each structural story to leave runnable checks so a
  large file move cannot silently change product behavior.

## Target structure

```text
src/
  pages/                  Astro pages and HTTP route adapters only
  client/
    api/
    home/
    review/
    state/
  server/
    services/
    repositories/
      json/
    providers/
      ado/
      github/
    auth/
    git/
    mcp/
  shared/
    contracts/
    domain/
```

Feature names inside a layer describe app capabilities: reviews, catalog,
actions, outcomes, guides, and later comments. They are not separate
deployments.

## Dependency rules

- shared imports no Astro, client, server, browser, filesystem, subprocess, or
  provider code.
- client imports shared and browser-safe client modules only.
- server services depend on shared contracts and narrow ports. They do not
  know JSON layout or raw provider payloads.
- repositories implement app-shaped persistence operations. Callers do not
  know file names, Store v1 layout, cache strategy, or future SQLite schema.
- provider adapters translate provider payloads behind capability-specific
  ports. There is no god GitHost interface.
- pages parse transport input, call one service, and map one response. Business
  rules do not live in Astro routes.
- MCP calls the same services as HTTP.
- Functions and narrow interfaces are preferred over framework-managed classes.

## Implementation notes

- Move schema families into shared/contracts: guide and file changes,
  pull-request provenance, catalog and actions, outcomes, persistence formats,
  and MCP tool inputs.
- Move pure overview, Guide/Diff, and outcome projections into shared/domain.
  Browser-safe domain logic remains framework-free.
- Define repository ports from use cases such as upsert a review, replace a
  catalog snapshot, claim an action, append an outcome, and set active review.
  Do not expose generic table or JSON mutation methods.
- Keep Store v1 parsing inside the JSON repository adapter. Existing
  reviews.json data must load without manual repair. If the stored shape
  changes, migrate automatically and test old fixtures.
- Add feature services for reviews, catalog, actions, outcomes, and Guide
  handoff. Current agent-owned behavior remains until PRD 07.
- Move GitHostAdapter and ChapteringAdapter into explicit server ports. Add
  credential-source, provider, and git-cache ports needed by 07 without
  implementing direct host behavior.
- Split viewer.ts into browser API, state, navigation/boot, Home, review shell,
  Guide/Diff, and outcome modules. Preserve localStorage keys and visible
  behavior.
- Keep global CSS unless a split clearly follows client module ownership.
- Private TypeScript APIs and browser-only HTTP payloads may change in lockstep.
  Review URLs, persisted user data, MCP tool names/payloads, Guide payloads,
  and visible behavior must work at epic integration.
- Intermediate commits may be incomplete. Every issue ends green before its
  integration commit is accepted.

## Testing / seams

**Seams:** shared contracts and domain functions; feature services with
injected repositories and ports; JSON repository compatibility loader; thin
route and MCP adapters; browser API/state modules.

**Why these seams:** They establish the dependency direction that later
provider and comment work relies on, without coupling tests to Astro internals
or live hosts.

**Good checks:**

- Existing npm test and npm run build pass before and after integration.
- An architecture check fails when shared imports server/client code, client
  imports Node-only code, or pages contain service logic.
- Existing Store v1 fixtures load through the JSON repository; any migration
  is automatic and lossless.
- HTTP and MCP adapters invoke the same service behavior.
- Browser API tests assert route and error mapping without DOM snapshots.
- Manual isolated-port smoke covers Home, saved review navigation, Guide/Diff,
  Code Review history, and Generate Guide handoff.

## Trade-offs (decided)

- One layered monolith, not separate frontend/backend apps.
- Conventional client/server/shared boundaries, not a full repeated
  domain/application/infrastructure tree for each capability.
- Feature-oriented services and app-shaped repositories, not generic CRUD.
- Structural seams now, provider behavior later.
- Stable product behavior at integration gates; flexible private internals.
- Automatic compatibility over silent local-data loss.

## Success criteria

- Source follows the documented target boundaries and import direction.
- viewer.ts, store.ts, and contracts.ts no longer own unrelated client, server,
  and schema responsibilities.
- Astro routes and MCP are thin adapters over shared feature services.
- JSON persistence is hidden behind repository operations shaped around app
  needs.
- Provider, credential, git-cache, and Guide chaptering ports have explicit
  ownership without direct provider implementation.
- Existing reviews.json data loads or migrates automatically with no lost
  guides, catalog entries, actions, or outcomes.
- Home, Guide, Diff, Code Review, and Generate Guide behavior pass automated
  and manual integration checks.
- No phase 07 or 08 product behavior lands in this PRD.

## Out of scope

- ADO/GitHub REST calls and managed git caches ([07 Provider API
  automation](../07-provider-api-automation/))
- Host comments ([08 Inline git-host
  comments](../08-inline-git-host-comments/))
- Webhooks, remote hosting, multi-user auth, analytics, search, votes, or merge

## References

- [01 Guided PR review](../done/01-guided-pr-review/)
- [04 Pull request overview](../done/04-pull-request-overview/)
- Current hotspots: src/viewer.ts, src/store.ts, src/contracts.ts, src/actions.ts
- Wayfinder decisions: layered monolith, service/repository seams, flexible
  private contracts, develop integration, stable main

## integration-review

Pending implementation.
