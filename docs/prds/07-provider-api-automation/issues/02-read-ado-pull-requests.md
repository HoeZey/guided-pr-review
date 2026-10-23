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

**Touches:** src/lib/server/providers/ports.ts (ProviderRepositoryReader,
ProviderPullRequestReader, ProviderRepositoryIdentity,
ProviderPullRequestMetadata); new ADO REST adapter under
src/lib/server/providers/; shared catalog/provenance contracts under
src/lib/shared/contracts/; CredentialSource from src/lib/server/auth/ports.ts;
provider fixtures and tests. Do not use GitHostAdapter.fetchOpen here.

**Acceptance criteria:**

- [x] Repository validation rejects wrong host/project/repository identity.
- [x] Pagination returns every eligible configured-repository PR.
- [x] Active review requests and authored drafts normalize correctly.
- [x] Saved completed/abandoned PR details can be fetched for archive refresh.
- [x] Missing commit ids or malformed payloads fail one PR/repository without
  inventing values.
- [x] Adapter uses direct fetch and never invokes az rest or MCP.
- [x] Fixture tests cover success, pagination, lifecycle, auth, rate, and
  malformed responses.

**Blocked by:** 01 Connect CLI identities

**Blocks:** 04, 06, and 07

**Parallel-eligible:** yes, with 03 and 05

## code-review

Pass: 16 September 2026

base: 54ccbc054c8faf858bb3fd83361e85c3b08d91e9
head: 98f6f373a191da2731eab838b1371cbb8b8c6459
branch: feature/07-02-read-ado-pull-requests

Not blocking. Standards has no major. Spec has no missing or incorrect.

Judged implementer notes: optional defaultBranch on ProviderRepositoryIdentity is compatible overlap with 03 and is not a finding. listPullRequests active-only with completed or abandoned via getPullRequest matches lifecycle filters. Reviewer match is uniqueName versus credential login; group membership is not expanded and is not a finding. Iteration and changeTrackingId stay out of this adapter; exact ingest is lastMergeSourceCommit and lastMergeTargetCommit, and empty providerContext is not a finding. createAppServices is unwired on purpose for 04 and 06. Page cap MAX_PAGES of 100 with a ponytail ceiling is not a finding. GitHostAdapter.fetchOpen is unused.

### Standards

major 0 / minor 1 / nit 0

- severity: minor
  title: Shared provider errors always speak as Azure DevOps
  location: src/lib/server/providers/errors.ts (messageFor)
  startLine: 31
  endLine: 43
  reference:
    source: docs/prds/07-provider-api-automation/issues/README.md Reconciled against develop
    quote: src/lib/server/providers/ports.ts ProviderRepositoryReader, ProviderPullRequestReader, ProviderRepositoryIdentity, ProviderPullRequestMetadata.
  explanation: ProviderError stores provider but messageFor always returns Azure DevOps authentication failed, Azure DevOps rate limit exceeded, and the other Azure DevOps sentences. createAdoRestAdapter only throws provider azure-devops, so this story is behaviorally fine. The class lives on the shared providers seam that 03 is specified to use. A github throw would still surface Azure DevOps copy, and the provider field would disagree with Error.message.

  recommendation: Pick the product name from input.provider when formatting the message so the shared type stays host-neutral.

### Spec

missing 0 / partial 0 / scope-creep 0 / incorrect 0

findings: []
