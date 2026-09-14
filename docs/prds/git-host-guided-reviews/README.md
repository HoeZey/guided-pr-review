---
status: signed
---

# PRD: Git-host guided reviews

## Problem

A reviewer who lives in Azure DevOps still has to translate a PR into a local git range and leave comments in the ADO UI. The localhost guide cannot resolve a named ADO PR or post a thread back to the host. Building that directly into Guide v1 as ADO-only fields would make later GitHub support require another store and UI rewrite. Discovery and selection of grouped PRs belong to the pull request overview contract.

## Goal

A reviewer can turn one selected or named ADO PR into a guide and post a comment from a hunk, while shared review contracts remain usable by a later GitHub provider without migration.

## Non-goals

- Implementing GitHub ingest or comments in this PRD
- Ingesting PRs from Bitbucket or Linear
- Discovering, configuring, or grouping a multi-repository PR queue
- An LLM inside the app (the agent still chapters)
- A daemon or timer that syncs PRs while no skill session is running
- Multi-user auth, remote deploy, or a public hosted service
- Fetching or rendering existing ADO threads, replies, resolutions, or votes
- Exact line anchors on deleted (left/old) lines
- Casting ADO votes, setting autocomplete, or merging from this UI

## User stories

- As a reviewer, I want a named or overview-selected PR to produce one guide for its exact source and target commits so the reviewed range is deterministic.
- As a reviewer, I want an already-ingested PR to refresh only when its source commit changed so I do not lose my place on an unchanged review.
- As a reviewer, I want a local-range review of the same branch to become that PR once the PR exists so I do not keep a truncated local row beside the real pull request.
- As a reviewer, I want an explicit SHA, branch, or range to still produce one guide so local targets remain deterministic.
- As a reviewer, I want first-run authentication to be Azure CLI / Cursor MCP sign-in, not a PAT pasted into the app.
- As a reviewer, I want Send on a current-side line or range to create an ADO thread immediately so I do not batch comments in a second step.
- As a reviewer, I want a comment on a deleted line to land as a file-level thread so I can still speak to a removal without a fake line number.
- As a maintainer, I want git-host identity and provider-specific comment data separated so adding GitHub does not change the review, store, or comment-composer contracts.

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

- kind, provider, host, repository, number, webUrl, refs, commits, and providerContext are required for pull-request guides. Local-range guides omit source. A future GitHub PR adds a github providerContext variant; common identity, Store v1, upsert, comment API, and UI stay unchanged.
- Reviews get a stable sync key from provider, host, repository id, and PR number. The same key keeps the same review id. Unchanged source commit skips chaptering. Leaving the active list never auto-deletes a review.
- Store gains upsert_review. add_review stays a new snapshot (new id) for local ranges. HTTP and MCP share the store commands. list_reviews exposes enough provenance (sync key, source commit, PR id) for the skill to skip unchanged PRs.
- Comment delivery uses a provider-neutral relay boundary. The ADO implementation lazily starts a pinned official Azure DevOps MCP subprocess with azcli auth and only core plus repositories domains, reuses it, times out calls, and tears it down with the process. The browser posts same-origin JSON: review id, path from the stored guide, content, and an anchor. The server resolves host, repository, and PR identity only from stored provenance, then dispatches by providerContext.kind. Reject foreign Origin, unknown paths, invalid ranges, arbitrary targets, and unsupported providers.
- Right-side (new/current) line or contiguous range: create thread with filePath, rightFileStartLine / rightFileEndLine, iterations, and changeTrackingId. Deleted-only selection: file-level thread (filePath and content, no right-line fields). Click one line; Shift-click extends a contiguous current-side range.
- A failed PR ingest returns a structured error without changing its saved guide. The local-range path remains available.

## Testing / seams

**Seam(s):** Store commands (upsert_review, add_review, list_reviews) after Zod parse of Guide v1 / Store v1 including pull-request provenance. Guide-view helpers: commentAnchorForLines. Provider-neutral comment relay createThread given an injected provider adapter (no live network in unit tests).

**Why this seam:** Upsert identity is shared by HTTP and MCP. Anchor rules (right-side range vs file-level) must not live only in DOM code. Provider dispatch belongs at the relay boundary; injecting the adapter keeps auth and host APIs off the assertion.

**What a good test is here:** Same provider/host/repository/PR upserts to one stable id; a new source commit replaces the guide; an unchanged source commit is detectable from list_reviews; a second PR is a second review; old Store v1 JSON without source still loads; ADO-only data outside providerContext and invalid provenance are rejected. upsert_review adopts exactly one unsourced local-range review on exact source-branch match or unique ticket-key rename; it does not adopt when two locals share the ticket or the stored repo name differs. commentAnchorForLines maps an added/context line or range to right-side coordinates and a removed-only selection to file-level. createThread dispatches the ADO source to the ADO adapter, sends right-line fields for current-side anchors, omits them for file-level, and refuses a path or PR id that is not on the stored guide. An unsupported provider returns a structured error. Do not test Astro internals. Do not post a live PR comment in CI.

**Prior art:** store.test.ts and guide-view.test.ts on the existing store and Diff helpers.

## Trade-offs (decided)

| Decision | Chose | Rejected | Why |
|---|---|---|---|
| Who talks to ADO for ingest | Skill/agent via Cursor ADO MCP | App poll on a timer | Matches chaptering split; no PAT in the Astro process |
| Ingest target | One named or overview-selected PR | Bulk chapter every discovered PR | Keeps generation deterministic and leaves queue scope to the overview |
| Comment send | Localhost relay using azcli | Agent batch after review; keep agent polling | Send is immediate; credentials stay on the machine |
| Deleted-line comments | File-level thread | Exact old-side line; disable commenting | Current ADO write tool is right-side; file thread still lands |
| Identity | Upsert by provider/host/repository/PR | Always new UUID | Unchanged PR keeps viewed state and the same rail row |
| Provider model | Common PR identity plus discriminated providerContext | ADO fields on Guide v1; speculative GitHub fields | GitHub can add a verified adapter without migrating shared contracts |
| GitHub delivery | Prepare the provider seam only | Full ADO/GitHub parity now | GitHub comments add another auth and line-anchor integration |

## Open questions (intentionally deferred)

- Rendering existing ADO threads and replies — when the guide should round-trip a conversation
- Exact deleted-line anchors via lower-level ADO REST — if file-level fallback is too lossy
- Remote Microsoft ADO MCP instead of a local subprocess — if azcli subprocess startup is painful
- SSE after upsert — if a two-second UI lag after ingest is noticeable
- GitHub adapter and auth — next provider PRD after ADO behavior proves the shared seam

## Success criteria

- A named or overview-selected ADO PR authenticates without a PAT in the app, resolves exact source and target commits, and upserts exactly one guide.
- Upserting a PR adopts a matching unsourced local-range review (exact source branch, else unique ticket key) and keeps that id; ambiguous matches do not steal a local row.
- Named SHA, branch, and range inputs still produce exactly one local guide.
- Send on a current-side line creates an ADO thread on that file and line; Shift-click range uses the right-side start and end; a deleted-only line creates a file-level thread.
- Auth failure returns a structured error, keeps the composer text, and succeeds after az login plus Retry. No token appears in the store, logs, or JSON responses.
- upsert_review then list_reviews then a second upsert of the same PR keep one id through the store seam (tests). A live comment post is a manual check, not CI.
- Pull-request provenance round-trips with ADO details contained under providerContext; local-range guides still load; unsupported providers fail without changing shared store or UI contracts.

## Out of scope

- GitHub / Bitbucket / Linear ingest or comments
- Queue discovery, grouping, refresh, archives, and repository configuration ([pull request overview](../pull-request-overview/))
- Switching the user's working tree or creating worktrees to ingest
- Approve / reject / vote / merge from this UI
- Syntax-aware structural highlighting, extra themes, or host blob deep links beyond Open in ADO

## References

- Grill-me decisions in the planning chat (agent-first ADO ingest, current-repo reviewer PRs, azcli relay, right-side comments, deleted-line file fallback, no PAT in the app, provider-neutral preparation for GitHub)
- [PRD: Guided PR review](../guided-pr-review/) (renderer, Guide v1, store, MCP tools)
- [PRD: Pull request overview](../pull-request-overview/) (queue discovery, selection, refresh, and cross-repository caches)
- Wayfinder: skipped (one session, decisions closed)
