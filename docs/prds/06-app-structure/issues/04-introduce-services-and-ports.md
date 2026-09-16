---
status: done
blocked_by:
  - 02-split-shared-contracts-and-domain
  - 03-introduce-repositories
blocks:
  - 05-preserve-http-mcp-and-ssr
  - 13-integrate-sveltekit-cutover
---

# Introduce feature services and provider ports

**Type:** Story

**From PRD:** [06 App structure](../)

**Seam(s):** review, catalog, action, outcome, and Guide-handoff services;
provider/auth/git/chaptering ports

**What it delivers:** SvelteKit loaders, HTTP, and MCP can delegate to one
transport-neutral service layer, while later provider work has explicit ports
instead of reaching routes or storage.

**Scope (in):**

- Add feature services for review commands, catalog replacement, action
  lifecycle, outcome publication, and Guide handoff.
- Move GitHostAdapter and ChapteringAdapter into explicit server ports.
- Define capability-specific repository, credential-source, provider metadata,
  and git-diff/cache ports required by PRD 07.
- Move action/MCP dispatch orchestration and seed ownership under lib/server.
- Expose service inputs/results that SvelteKit route adapters can map without
  importing Store v1 or provider payloads.
- Preserve current waiting-agent behavior for Open, Refresh, Update Diff, and
  Generate Guide until PRD 07.

**Scope (out):**

- Direct host API implementations
- Managed cache implementation
- SvelteKit page/load/HTTP route implementation, owned by issue 05
- New HTTP product behavior
- Comment ports or routes
- One broad GitHost interface containing future capabilities

**Touches:** src/actions.ts, src/actions.test.ts, src/mcp.ts, src/seed.ts,
lib/server/services, lib/server provider/auth/git/chaptering ports

**Acceptance criteria:**

- [x] Review, catalog, action, outcome, and Guide handoff each have one
  service owner.
- [x] Services depend on repository/host ports and shared contracts only.
- [x] Provider, credential, git, and chaptering ports are capability-specific.
- [x] Existing action and MCP tests pass through injected fakes.
- [x] Current agent action lifecycle remains usable.
- [x] No ADO/GitHub network or subprocess implementation lands.

**Blocked by:** 02 shared modules and 03 repositories

**Blocks:** 05 SvelteKit routes/loaders and 13 integration

**Parallel-eligible:** no

## code-review

Pass: 16 September 2026

base: 2c3c8484076b27db76a117137cf82a4338fc2bdd
head: cf6a95c30474c361b49090a998768a1f999fff9e
branch: feature/06-04-introduce-services-and-ports

Not blocking. Standards has no major. Spec has no missing or incorrect.

### Standards

major 0 / minor 0 / nit 0

findings: []

### Spec

missing 0 / partial 0 / scope-creep 1 / incorrect 0

findings:

- severity: minor
  classification: scope-creep
  title: Reserved src/actions.ts path is deleted before issue 13
  location: src/actions.ts (deleted)
  reference:
    source: docs/prds/06-app-structure/issues/01-lock-sveltekit-migration.md Target owners; docs/prds/06-app-structure/README.md Implementation notes
    quote: the src/actions.ts filename goes away only at issue 13 after Astro is removed. Remove Astro, its Node adapter/configuration, duplicate page shells, and reserved src/actions.ts collision only after SvelteKit routes pass parity.
  explanation: Issue 04 owns moving action orchestration into lib/server/services. Issue 13 owns removing the reserved Astro Actions filename. This diff does both. Astro loads virtual:astro:actions/entrypoint when src/actions.ts exists. Deleting that file likely ends the production-build failure 06-01 recorded (server is not exported by src/actions.ts) before SvelteKit routes land in issue 05. Waiting-agent Open, Refresh, Update Diff, and Generate Guide still run through the new services. Claimed-first waitForAction is unchanged in the JSON store. Astro /api still calls jsonRepositories. 07 ports stay types. ConfiguredRepositoryPort is not on AppRepositories.
  recommendation: Keep a reserved src/actions.ts until issue 13. Leave orchestration in lib/server/services. A module that still does not export server preserves the 06-01 Astro entrypoint failure.
