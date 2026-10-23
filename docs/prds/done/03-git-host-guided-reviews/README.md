---
status: implemented
---

# PRD: Git-host guided reviews

## Problem

A reviewer who lives in Azure DevOps still has to translate a PR into a local
git range before creating a guide. The localhost guide cannot resolve a named
ADO PR. Building ADO-only identity directly into Guide v1 would make later
GitHub support require a store and UI rewrite.

## Goal

A reviewer can turn one selected or named ADO PR into a guide for exact source
and target commits, while shared review contracts remain usable by later
providers without migration.

## Non-goals

- Implementing GitHub ingest
- Ingesting PRs from Bitbucket or Linear
- Discovering, configuring, or grouping a multi-repository PR queue
- An LLM inside the app (the agent still chapters)
- A daemon or timer that syncs PRs while no skill session is running
- Multi-user auth, remote deploy, or a public hosted service
- Reading, creating, or rendering host comments
- Casting votes, setting autocomplete, or merging from this UI

## User stories

- As a reviewer, I want a named or overview-selected PR to produce one guide for its exact source and target commits so the reviewed range is deterministic.
- As a reviewer, I want an already-ingested PR to refresh only when its source commit changed so I do not lose my place on an unchanged review.
- As a reviewer, I want a local-range review of the same branch to become that PR once the PR exists so I do not keep a truncated local row beside the real pull request.
- As a reviewer, I want an explicit SHA, branch, or range to still produce one guide so local targets remain deterministic.
- As a reviewer, I want first-run authentication to use Azure CLI / Cursor MCP
  sign-in, not a PAT pasted into the app.
- As a maintainer, I want git-host identity separated from the common review
  contract so adding GitHub does not migrate saved reviews.

## Implementation notes

- Agent owns provider resolution, git fetch, and chaptering. The app stores and renders. The ADO adapter handles the first provider. A named PR or a validated PR identity from the overview resolves source and target SHAs plus iteration and per-path change-tracking ids, fetches those commits without checkout, diffs target...source, and upserts one guide. Explicit SHA, branch, and range inputs keep the local single-review path. The pull request overview owns repository configuration, queue discovery, cross-repository cache materialization, and bare-trigger selection.
- upsert_review adopts an unsourced local-range review instead of inserting a second row when the match is unique. Exact match: the range head equals the PR source branch after stripping refs/heads/ (case-insensitive), and the stored repo name is absent or equals the PR repository name. Rename match: the local range head and the PR sourceRef share a ticket key such as TCD-3343, and exactly one unsourced local review in that repository has that ticket. Two locals with the same ticket, or two range heads equal to the PR branch, stay unsourced and the PR gets a new id. A later upsert of the same provider/host/repository/PR still wins by sync key. Catalog refresh in the pull request overview uses the same adoption rule so Open and Refresh do not leave a Local ranges leftover.
- Auth lives in Azure CLI and Cursor's ADO MCP. The review process never stores a PAT. Browser payloads never include tokens. First-run: native MCP auth or one az login. Expiry: structured auth error, keep the draft, Retry after login.
- Guide v1 grows optional pull-request provenance with common identity and a discriminated providerContext. ADO data stays inside the ADO variant:

```json
{
  "source": {
    "kind": "pull-request",
    "provider": "azure-devops",
    "host": "dev.azure.com",
    "repository": {
      "id": "provider repository id",
      "owner": "braidteam/BRAID",
      "name": "braid-connection-designer",
      "webUrl": "https://dev.azure.com/..."
    },
    "number": 1027,
    "webUrl": "https://dev.azure.com/.../pullrequest/1027",
    "sourceRef": "refs/heads/feature/example",
    "targetRef": "refs/heads/develop",
    "sourceCommit": "40-character commit SHA",
    "targetCommit": "40-character commit SHA",
    "providerContext": {
      "kind": "azure-devops",
      "project": "BRAID",
      "firstComparingIteration": 0,
      "secondComparingIteration": 1,
      "changes": {
        "src/example.ts": {
          "changeTrackingId": 1
        }
      }
    }
  }
}
```

- kind, provider, host, repository, number, webUrl, refs, commits, and
  providerContext are required for pull-request guides. Local-range guides omit
  source. A future GitHub provider adds its own providerContext variant while
  common identity, Store v1, and upsert stay unchanged.
- Reviews get a stable sync key from provider, host, repository id, and PR number. The same key keeps the same review id. Unchanged source commit skips chaptering. Leaving the active list never auto-deletes a review.
- Store gains upsert_review. add_review stays a new snapshot (new id) for local ranges. HTTP and MCP share the store commands. list_reviews exposes enough provenance (sync key, source commit, PR id) for the skill to skip unchanged PRs.
- A failed PR ingest returns a structured error without changing its saved guide. The local-range path remains available.

## Testing / seams

**Seam(s):** Store commands (upsert_review, add_review, list_reviews) after
Zod parse of Guide v1 / Store v1 including pull-request provenance.

**Why this seam:** Upsert identity is shared by HTTP and MCP.

**What a good test is here:** Same provider/host/repository/PR upserts to one
stable id; a new source commit replaces the guide; an unchanged source commit
is detectable from list_reviews; a second PR is a second review; old Store v1
JSON without source still loads; ADO-only data outside providerContext and
invalid provenance are rejected. upsert_review adopts exactly one unsourced
local-range review on exact source-branch match or unique ticket-key rename;
it does not adopt when two locals share the ticket or the stored repo name
differs. Do not test Astro internals or contact live ADO in CI.

**Prior art:** store.test.ts and guide-view.test.ts on the existing store and Diff helpers.

## Trade-offs (decided)

| Decision | Chose | Rejected | Why |
|---|---|---|---|
| Who talks to ADO for ingest | Skill/agent via Cursor ADO MCP | App poll on a timer | Matches chaptering split; no PAT in the Astro process |
| Ingest target | One named or overview-selected PR | Bulk chapter every discovered PR | Keeps generation deterministic and leaves queue scope to the overview |
| Identity | Upsert by provider/host/repository/PR | Always new UUID | Unchanged PR keeps viewed state and the same rail row |
| Provider model | Common PR identity plus discriminated providerContext | ADO fields on Guide v1; speculative GitHub fields | GitHub can add a verified adapter without migrating shared contracts |

## Superseded work

Issue 02, Post Azure DevOps comments from reviewed lines, is cancelled. Building
it on the agent/MCP transport would be discarded by the direct provider API
architecture. [Provider API automation](../../07-provider-api-automation/)
owns authenticated ADO/GitHub foundations. [Inline git-host
comments](../../08-inline-git-host-comments/) owns thread APIs and UI.

## Success criteria

- A named or overview-selected ADO PR authenticates without a PAT in the app, resolves exact source and target commits, and upserts exactly one guide.
- Upserting a PR adopts a matching unsourced local-range review (exact source branch, else unique ticket key) and keeps that id; ambiguous matches do not steal a local row.
- Named SHA, branch, and range inputs still produce exactly one local guide.
- Auth failure returns a structured error and succeeds after az login plus
  Retry. No token appears in the store, logs, or JSON responses.
- upsert_review then list_reviews then a second upsert of the same PR keep one
  id through the store seam.
- Pull-request provenance round-trips with ADO details contained under providerContext; local-range guides still load; unsupported providers fail without changing shared store or UI contracts.

## Out of scope

- GitHub / Bitbucket / Linear ingest
- Host comments
- Queue discovery, grouping, refresh, archives, and repository configuration
  ([pull request overview](../04-pull-request-overview/))
- Switching the user's working tree or creating worktrees to ingest
- Approve / reject / vote / merge from this UI
- Syntax-aware structural highlighting, extra themes, or host blob deep links beyond Open in ADO

## References

- Grill-me decisions in the planning chat (agent-first ADO ingest,
  current-repo reviewer PRs, no PAT in the app, provider-neutral identity)
- [PRD: Guided PR review](../01-guided-pr-review/)
- [PRD: Pull request overview](../04-pull-request-overview/)
- Later comment and provider work is specified by PRDs 07 and 08.
