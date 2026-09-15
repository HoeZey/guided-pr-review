---
status: todo
blocked_by:
  - 01-connect-cli-identities
blocks:
  - 04-manage-repositories
  - 06-refresh-catalogs
  - 07-open-and-update-diff
  - 09-integrate-provider-automation
---

# Read repositories and pull requests through ADO REST

**Type:** Story

**From PRD:** [07 Provider API automation](../)

**Seam(s):** ADO HTTP transport; ADO normalizer; provider repository and PR
reader ports

**What it delivers:** Services can validate ADO repositories and read complete
PR metadata through direct REST without Cursor/ADO MCP or az host commands.

**Scope (in):**

- Call Azure DevOps REST 7.1 with a credential-source Bearer token.
- Validate repository identity and return id, organization/project owner,
  name, clone/web URLs, and default branch where needed.
- List and get PRs with pagination and lifecycle filters.
- Normalize title, number, web URL, draft/status, refs, source/target commits,
  author, reviewer relationship, timestamps, and provider context needed for
  exact ingest.
- Normalize auth, rate, unavailable, malformed-response, and not-found errors.

**Scope (out):**

- ADO comments
- Raw ADO payloads outside adapter
- Creating/updating PRs or votes
- Live network in CI

**Touches:** lib/server/providers/ado, lib/shared provider contracts, provider
fixtures and tests

**Acceptance criteria:**

- [ ] Repository validation rejects wrong host/project/repository identity.
- [ ] Pagination returns every eligible configured-repository PR.
- [ ] Active review requests and authored drafts normalize correctly.
- [ ] Saved completed/abandoned PR details can be fetched for archive refresh.
- [ ] Missing commit ids or malformed payloads fail one PR/repository without
  inventing values.
- [ ] Adapter uses direct fetch and never invokes az rest or MCP.
- [ ] Fixture tests cover success, pagination, lifecycle, auth, rate, and
  malformed responses.

**Blocked by:** 01 Connect CLI identities

**Blocks:** 04, 06, and 07

**Parallel-eligible:** yes, with 03 and 05
