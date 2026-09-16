---
status: done
blocked_by:
  - ../../07-provider-api-automation/issues/09-integrate-provider-automation
blocks:
  - 02-implement-ado-comments
  - 03-implement-github-comments
  - 04-render-inline-threads
  - 07-deliver-discussion-tab
---

# Define provider-neutral comment services and contracts

**Type:** Story

**From PRD:** [08 Inline git-host comments](../)

**Seam(s):** CommentService; CommentProvider port; normalized thread/message/
anchor contracts; provenance-resolving route boundary

**What it delivers:** ADO, GitHub, Guide, Diff, and Discussion share one
comment vocabulary without leaking provider payloads or browser-selected URLs.

**Scope (in):**

- Define thread, message, author, status, ownership, and anchor variants from
  PRD.
- Define capability-specific provider port for list/create/reply/update/delete.
- Define CommentService that loads stored review provenance, validates request
  identity/path/anchor, dispatches provider, and normalizes errors.
- Define thin same-origin SvelteKit +server.ts routes and typed Svelte client
  interface.
- Define stale/unmappable handling and current-user ownership rules.
- Define opaque client operation id carried through pending create/reply
  reconciliation without persisting it as provider identity.
- Build complete fake provider/thread fixtures for parallel UI stories.

**Scope (out):**

- Provider HTTP implementations
- UI
- Remote thread persistence repository
- Resolve/reactivate

**Touches:** new shared comment contracts beside
src/lib/shared/contracts/provenance.ts (PullRequestSource stays host identity;
comment payloads stay out of it); new CommentProvider port and CommentService
under src/lib/server/; dispatch from stored GuideV1.source via
ReviewRepository.getReview; wire into createAppServices in
src/lib/server/services/app.ts; thin src/routes/api/reviews/[id]/ +server.ts
plus typed client beside src/lib/client/browser/fetch.ts; fake CommentProvider
fixtures. No createAdoRestAdapter or createGithubProvider HTTP in this story.

**Acceptance criteria:**

- [x] ADO and GitHub can implement one port without provider fields in shared
  thread contracts.
- [x] Browser inputs cannot choose arbitrary provider URL/repository/PR.
- [x] Service resolves all host identity from saved review provenance.
- [x] Line/range, file, PR-wide, and stale/unmappable anchors parse strictly.
- [x] Edit/delete require normalized current-user ownership and still defer
  final authorization to provider.
- [x] Client operation id has one strict format and cannot target provider
  resources.
- [x] Same-origin and structured error behavior are tested.
- [x] No production provider call or UI lands.

**Blocked by:** 07 integration

**Blocks:** 02, 03, 04, and 07

**Parallel-eligible:** no

## code-review

Pass: 16 September 2026

base: f5da2f55354ef3a6046636a1433b94f797efb0ab
head: 2e80b17a3fc90b8e3f61b1b7fc63c7bd5ad1fef1
branch: feature/08-01-define-comment-service

Not blocking. Standards has no major. Spec has no missing or incorrect.

Judged implementer notes: Default fake CommentProvider wiring in createAppServices is the 08-04 parallel seam and is not a finding. Mapping ProviderError and GithubProviderError in CommentService matches configured-repositories and is not a finding. svelte.config.js csrf trustedOrigins ["*"] is the known 06 minor; comment routes still reject a mismatched Origin header. Live comment HTTP stays out of createAdoRestAdapter and createGithubProvider.

### Standards

major 0 / minor 1 / nit 1

- severity: minor
  title: Mutation responses skip the strict comment contract parse
  location: src/lib/server/services/comments.ts (createThread, reply, update)
  startLine: 106
  endLine: 162
  reference:
    source: .cursor/rules/ponytail.mdc
    quote: Not lazy about input validation at trust boundaries.
  explanation: list runs CommentThreadList.parse, which is strict, so extra provider keys fail the GET. createThread returns normalizeListedThread, and reply and update return a spread message with ownedByCurrentUser overwritten, with no CommentThread or CommentMessage parse. A later adapter can put pullRequestThreadId or node_id on that object and the JSON response will include it. The shared schemas are strict specifically to keep those fields out of the comment vocabulary.
  recommendation: Parse the create result with CommentThread and reply/update results with CommentMessage after normalize. Map a parse failure to CommentError malformed so list and mutations share one leak boundary.

- severity: nit
  title: Reply and owned edits re-list every thread first
  location: src/lib/server/services/comments.ts (requireOwned, reply)
  startLine: 79
  endLine: 143
  reference:
    source: .cursor/rules/ponytail.mdc
    quote: Mark intentional simplifications with a ponytail comment. If the shortcut has a known ceiling, the comment names the ceiling and the upgrade path.
  explanation: reply and requireOwned call listedThreads, which is a full provider list, before the mutate. That is enough for the fake and for the ownership tests. Against a live host it is an extra list round-trip on every reply, edit, and delete. There is no ponytail comment naming that ceiling or the upgrade (a get-thread call, or treating provider 404/403 as the existence and ownership check).
  recommendation: Keep the full list while CommentProvider has no get-thread. Add a ponytail comment. Do not add a new provider method in 08-01.

### Spec

missing 0 / partial 0 / scope-creep 0 / incorrect 0

findings: []
