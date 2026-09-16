---
status: done
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

- [x] GitHub repository and PR payloads map to the common contracts used by
  Home.
- [x] Requested-reviewer and authored-draft grouping matches existing
  precedence.
- [x] Pagination, rate headers, auth errors, deleted heads, and malformed
  responses are covered.
- [x] Base/head commits are exact and never synthesized.
- [x] Adapter uses direct fetch and never invokes gh api.
- [x] Fixture tests make no live network calls.

**Blocked by:** 01 Connect CLI identities

**Blocks:** 04, 06, and 07

**Parallel-eligible:** yes, with 02 and 05

## code-review

Date: 16 September 2026

base: 54ccbc054c8faf858bb3fd83361e85c3b08d91e9
head: b38f334fac60a41eadf677de8701df53e3ce430d
branch: feature/07-03-read-github-pull-requests

Not blocking. Standards has no major. Spec has no missing or incorrect.

Judged implementer notes: additive github union on catalog and provenance is required for Home contracts and is not a finding; existing azure-devops JSON still matches the widened schemas. PullRequestSource stays azure-devops-only, so GitHub guide upsert remains rejected until 07-07. Overview treats status closed as archived, which matches saved-closed archive behavior. reviews.ts skips GitHub rows in local adoption, with a ponytail comment, until Open Diff owns GitHub PullRequestSource. requested_reviewers only (no teams or submitted reviews) matches this story and the research note to use current requested-reviewer data. createGithubProvider is not wired into AppServices; that belongs to 06. API version 2026-03-10 is the current documented GitHub REST calendar version.

### Standards

major 0 / minor 0 / nit 0

findings: []

### Spec

missing 0 / partial 0 / scope-creep 0 / incorrect 0

findings: []
