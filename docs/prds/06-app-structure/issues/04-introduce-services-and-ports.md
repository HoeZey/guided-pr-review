---
status: todo
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

- [ ] Review, catalog, action, outcome, and Guide handoff each have one
  service owner.
- [ ] Services depend on repository/host ports and shared contracts only.
- [ ] Provider, credential, git, and chaptering ports are capability-specific.
- [ ] Existing action and MCP tests pass through injected fakes.
- [ ] Current agent action lifecycle remains usable.
- [ ] No ADO/GitHub network or subprocess implementation lands.

**Blocked by:** 02 shared modules and 03 repositories

**Blocks:** 05 SvelteKit routes/loaders and 13 integration

**Parallel-eligible:** no
