---
status: done
blocked_by:
  - 01-define-comment-service
blocks:
  - 05-create-and-reply
  - 06-edit-and-delete
  - 08-integrate-inline-comments
---

# Implement ADO comment adapter

**Type:** Story

**From PRD:** [08 Inline git-host comments](../)

**Seam(s):** ADO thread/comment REST adapter; ADO normalizer; CommentProvider
contract tests

**What it delivers:** CommentService can list, create, reply, update, and
delete ADO PR comments through direct REST.

**Scope (in):**

- List PR threads/comments with ADO REST 7.1.
- Normalize current-side ranges, file-level, PR-wide, thread status, messages,
  authors, ownership, timestamps, and stale context.
- Create threads with stored iterations and change-tracking ids when required.
- Reply inside existing thread.
- Update/delete one current-user comment.
- Map auth/scope, permission, stale anchor, missing thread/comment, rate,
  timeout, and malformed errors.

**Scope (out):**

- az rest, ADO MCP, PATs
- Resolve/reactivate
- Exact deleted-line placement without valid provider coordinates
- UI

**Touches:** comment REST beside src/lib/server/providers/ado-rest.ts
createAdoRestAdapter (api-version 7.1, CredentialSource); iterations and
changeTrackingId from AzureDevOpsProviderContext on stored PullRequestSource;
ProviderError mapping in src/lib/server/providers/errors.ts; CommentProvider
contract tests; fixtures. Do not call az rest or ADO MCP.

**Acceptance criteria:**

- [x] Every CommentProvider operation uses direct authenticated fetch.
- [x] Provider URL and PR identity come only from service-resolved provenance.
- [x] Line/range creation includes valid iteration/change-tracking context.
- [x] Deleted/unmappable anchors downgrade safely without fabricated line.
- [x] Reply parent and edit/delete comment ids are validated inside one PR.
- [x] ADO current-user identity controls normalized ownership.
- [x] Fixture tests cover every operation and structured failure.

**Blocked by:** 01 Define comment service

**Blocks:** 05, 06, and 08

**Parallel-eligible:** yes, with 03 and 04

## code-review

Pass: 16 September 2026

base: cdfe250b89dcd31ef1e52fcfa6ae2ef5686a140e
head: b70a6c4160716d53fdd9ea2e887070d14c97b9b6
branch: feature/08-02-implement-ado-comments

Not blocking. Standards has no major. Spec has no missing or incorrect.

Judged implementer notes: Default createAppServices still injects fake comment providers and is not a finding. Direct fetch with api-version 7.1, provenance-built URLs, iteration/changeTrackingId on line/range/file create, left-only deleted-line to stale, and 403 denied vs 401 auth match the story. catalogAsSource still stores secondComparingIteration 0 and changes {}. Filling that payload is not this diff; the adapter only reads it.

### Standards

major 0 / minor 1 / nit 1

- severity: minor
  title: Outdated and create assume stored iterations that Open Diff never writes
  location: src/lib/server/providers/ado-comments.ts (createPayload, iterationOutdated)
  startLine: 261
  endLine: 431
  reference:
    source: src/lib/shared/domain/reviews.ts catalogAsSource
    quote: ponytail: catalog has no iteration payload; comment APIs fill changes
  explanation: catalogAsSource is the production PullRequestSource writer. It stores firstComparingIteration 0, secondComparingIteration 0, and changes {}. iterationOutdated treats 0 as a real iteration, so any thread whose iterationContext.secondComparingIteration is a normal ADO value such as 2 becomes outdated. createPayload throws invalid-anchor when changes[path] is missing, so line/range/file create cannot succeed against that stored shape. Fixtures use iteration 2 and populated changeTrackingId, so the tests stay green. The live adapter is not the createAppServices default, so localhost still uses the fake.
  recommendation: Treat stored iteration 0 and empty changes as unknown. Skip the outdated comparison until real iterations exist. Keep the invalid-anchor guard, but do not send iteration 0 to ADO. Filling changes belongs in Open Diff or a comment-time iterations fetch, not in a test-only provenance.

- severity: nit
  title: Non-numeric ids become unknown-thread or unknown-comment
  location: src/lib/server/providers/ado-comments.ts (resourceId)
  startLine: 298
  endLine: 306
  reference:
    source: src/lib/server/providers/fake-comments.ts threadOrThrow
    quote: client operation id cannot target a provider resource
  explanation: resourceId rejects anything that is not a positive decimal integer, including a cop_ client operation id, as unknown-thread or unknown-comment. CommentService rejectOperationAsResource and the fake provider throw operation-id-as-resource first. Direct adapter calls therefore disagree on the code. Reply, update, and delete through the service still fail closed inside one PR.
  recommendation: Keep the numeric guard. Map values that start with cop_ to operation-id-as-resource so the adapter matches the fake and the service.

### Spec

missing 0 / partial 0 / scope-creep 0 / incorrect 0

findings: []
