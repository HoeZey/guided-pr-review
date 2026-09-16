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

# Read repositories and pull requests through GitHub REST

**Type:** Story

**From PRD:** [07 Provider API automation](../)

**Seam(s):** GitHub HTTP transport; GitHub normalizer; provider repository and
PR reader ports

**What it delivers:** Services receive the same provider-neutral repository
and PR records from GitHub as from ADO.

**Scope (in):**

- Call version-pinned GitHub REST with gh credential-source token.
- Validate configured owner/repository identity.
- List active PRs with pagination and fetch saved closed PR details.
- Classify current user as author and requested reviewer from normalized
  provider identity and requested-reviewer data.
- Normalize draft/status, base/head refs and commits, timestamps, URLs, and
  repository identity.
- Preserve GitHub base/head and three-dot PR meaning.

**Scope (out):**

- GitHub comments/reviews
- GraphQL
- Account-wide repository discovery
- GitHub Enterprise unless separately proved compatible

**Touches:** src/lib/server/providers/ports.ts (same reader ports as 02); new
GitHub REST adapter under src/lib/server/providers/; shared catalog/provenance
contracts under src/lib/shared/contracts/; CredentialSource from
src/lib/server/auth/ports.ts; provider fixtures and tests. Do not use
GitHostAdapter.fetchOpen here.

**Acceptance criteria:**

- [ ] GitHub repository and PR payloads map to the common contracts used by
  Home.
- [ ] Requested-reviewer and authored-draft grouping matches existing
  precedence.
- [ ] Pagination, rate headers, auth errors, deleted heads, and malformed
  responses are covered.
- [ ] Base/head commits are exact and never synthesized.
- [ ] Adapter uses direct fetch and never invokes gh api.
- [ ] Fixture tests make no live network calls.

**Blocked by:** 01 Connect CLI identities

**Blocks:** 04, 06, and 07

**Parallel-eligible:** yes, with 02 and 05
