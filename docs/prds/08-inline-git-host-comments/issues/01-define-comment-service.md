---
status: todo
blocked_by:
  - ../../07-provider-api-automation/issues/09-integrate-provider-automation
blocks:
  - 02-implement-ado-comments
  - 03-implement-github-comments
  - 04-render-inline-threads
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
- Define thin same-origin HTTP routes and client interface.
- Define stale/unmappable handling and current-user ownership rules.
- Define opaque client operation id carried through pending create/reply
  reconciliation without persisting it as provider identity.
- Build complete fake provider/thread fixtures for parallel UI stories.

**Scope (out):**

- Provider HTTP implementations
- UI
- Remote thread persistence repository
- Resolve/reactivate

**Touches:** shared comment contracts/domain, server comment service/port,
routes, client API types, fakes/tests

**Acceptance criteria:**

- [ ] ADO and GitHub can implement one port without provider fields in shared
  thread contracts.
- [ ] Browser inputs cannot choose arbitrary provider URL/repository/PR.
- [ ] Service resolves all host identity from saved review provenance.
- [ ] Line/range, file, PR-wide, and stale/unmappable anchors parse strictly.
- [ ] Edit/delete require normalized current-user ownership and still defer
  final authorization to provider.
- [ ] Client operation id has one strict format and cannot target provider
  resources.
- [ ] Same-origin and structured error behavior are tested.
- [ ] No production provider call or UI lands.

**Blocked by:** 07 integration

**Blocks:** 02, 03, and 04

**Parallel-eligible:** no
