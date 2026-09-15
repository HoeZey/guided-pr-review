---
status: todo
blocked_by:
  - 02-split-shared-contracts-and-domain
blocks:
  - 04-introduce-services-and-adapters
  - 06-integrate-app-structure
---

# Introduce app-shaped repositories and JSON adapter

**Type:** Story

**From PRD:** [06 App structure](../)

**Seam(s):** repository ports; JSON compatibility loader; atomic repository
operations

**What it delivers:** Services can persist reviews, catalogs, actions, and
outcomes without knowing reviews.json or Store v1 layout.

**Scope (in):**

- Derive narrow repository operations from current use cases: list/get/add/
  upsert/remove review, set active, replace catalog snapshot, queue/claim/
  complete action, append outcome, and seed when empty.
- Move data-file resolution, cache, read/write, compatibility parsing, and
  atomic mutation into server/repositories/json.
- Keep local-review adoption and catalog merge rules in a pure domain or
  service owner rather than generic JSON code.
- Preserve action claim and completion concurrency semantics.
- Keep Store v1 as JSON adapter format, not a service-facing domain model.
- Add old-store fixtures and automatic migration only if the persisted shape
  must change.

**Scope (out):**

- SQLite
- Generic CRUD/BaseRepository abstractions
- Provider or git-cache persistence
- New retention rules

**Touches:** src/store.ts, src/store.test.ts, src/seed.ts, new repository ports
and JSON adapter modules

**Acceptance criteria:**

- [ ] Callers use app operations and never read or mutate Store v1 directly.
- [ ] JSON path, cache, and serialization details exist only in JSON adapter.
- [ ] Existing review, catalog, action, outcome, and adoption tests pass.
- [ ] Old fixture data loads with no loss; any migration is automatic and
  tested.
- [ ] Concurrent action claims cannot return the same queued action twice.
- [ ] Replacing catalog snapshots never deletes saved reviews.
- [ ] Architecture check passes.

**Blocked by:** 02 Split shared contracts and pure domain rules

**Blocks:** 04 services and 06 integration

**Parallel-eligible:** yes, with 05 after 02
