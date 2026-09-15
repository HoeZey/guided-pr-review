---
status: todo
blocked_by:
  - 02-split-shared-contracts-and-domain
  - 03-introduce-repositories
blocks:
  - 06-integrate-app-structure
---

# Introduce feature services and thin adapters

**Type:** Story

**From PRD:** [06 App structure](../)

**Seam(s):** review, catalog, action, outcome, and Guide-handoff services;
HTTP/MCP transport adapters; provider/auth/git ports

**What it delivers:** HTTP and MCP delegate to one service layer, while later
provider work has explicit ports instead of reaching routes or storage.

**Scope (in):**

- Add feature services for review commands, catalog replacement, action
  lifecycle, outcome publication, and Guide handoff.
- Move GitHostAdapter and ChapteringAdapter into explicit server ports.
- Define capability-specific repository, credential-source, provider metadata,
  and git-diff/cache ports required by PRD 07.
- Make Astro API routes parse input, call one service, and map structured
  errors only.
- Make MCP tool dispatch call the same services.
- Move seed and MCP runtime ownership under server.
- Preserve current waiting-agent behavior for Open, Refresh, Update Diff, and
  Generate Guide until PRD 07.

**Scope (out):**

- Direct host API implementations
- Managed cache implementation
- New HTTP product behavior
- Comment ports or routes
- One broad GitHost interface containing future capabilities

**Touches:** src/actions.ts, src/actions.test.ts, src/mcp.ts, src/seed.ts,
src/pages/api, src/pages/mcp.ts, new server services and ports

**Acceptance criteria:**

- [ ] HTTP and MCP paths exercise the same service methods.
- [ ] Routes contain no store mutation, adoption, or action business rules.
- [ ] Services depend on repository/host ports and shared contracts only.
- [ ] Provider, credential, git, and chaptering ports are capability-specific.
- [ ] Existing action and MCP tests pass through injected fakes.
- [ ] Current agent action lifecycle remains usable.
- [ ] No ADO/GitHub network or subprocess implementation lands.

**Blocked by:** 02 shared modules and 03 repositories

**Blocks:** 06 integration

**Parallel-eligible:** no
