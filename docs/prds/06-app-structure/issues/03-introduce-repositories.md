---
status: done
blocked_by:
  - 02-split-shared-contracts-and-domain
blocks:
  - 04-introduce-services-and-ports
  - 05-preserve-http-mcp-and-ssr
  - 13-integrate-sveltekit-cutover
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
  atomic mutation into lib/server/repositories/json.
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

- [x] Callers use app operations and never read or mutate Store v1 directly.
- [x] JSON path, cache, and serialization details exist only in JSON adapter.
- [x] Existing review, catalog, action, outcome, and adoption tests pass.
- [x] Old fixture data loads with no loss; any migration is automatic and
  tested.
- [x] Concurrent action claims cannot return the same queued action twice.
- [x] Replacing catalog snapshots never deletes saved reviews.
- [x] Architecture check passes.

**Blocked by:** 02 Split shared contracts and pure domain rules

**Blocks:** 04 services, 05 routes/loaders, and 13 integration

**Parallel-eligible:** yes, with 06 after 02

## code-review

Pass: 16 September 2026

base: 7840b8e96a280715389655e8aa961632049cfb11
head: fef02cf9f16aad6b189ba6ca3f6c4ca0fdc5fe0c
branch: feature/06-03-introduce-repositories

Blocking. Standards has no major. Spec has one incorrect finding.

### Standards

major 0 / minor 1 / nit 0

- severity: minor
  title: Concurrent-claim test never starts from an in-flight claim plus a queued action
  location: src/lib/server/repositories/json/store.test.ts (concurrent claims cannot return the same queued action twice)
  explanation: waitForAction now searches queued rows before claimed rows. The new test queues two distinct Opens from idle and waits twice. Both waiters therefore enter with only queued rows. The production path that changed versus the previous store is a waiter arriving while one action is already claimed and another is still queued. That path is not executed.
  recommendation: Add a case that claims one action, queues a second, then waits again, so the claimed-plus-queued order is covered.

### Spec

missing 0 / partial 0 / scope-creep 0 / incorrect 1

findings:

- severity: major
  classification: incorrect
  title: waitForAction claims the next queued action instead of reconnecting to an in-flight claim
  location: src/lib/server/repositories/json/store.ts (waitForAction)
  reference:
    source: docs/prds/06-app-structure/README.md TypeScript reuse map; docs/prds/06-app-structure/issues/03-introduce-repositories.md Scope (in)
    quote: Move or split; do not rewrite behavior. Preserve action claim and completion concurrency semantics.
  explanation: The previous store returned an already-claimed action before claiming a queued one. The moved waitForAction claims a queued row first and only then returns a claimed row. A reconnecting waiter that arrives while work is in flight and another action is queued now claims the second action and leaves the first claimed. Two claimed actions can exist. The in-process lock still prevents two waiters from transitioning the same queued row, so the uniqueness acceptance criterion holds for two idle queued Opens. That does not preserve the old reconnect order.
  recommendation: Prefer an existing claimed action before claiming the next queued row, and keep the lock. If two waiters must partition a backlog, bind reconnect to the waiter that already holds the claim rather than claiming the next queued item.
Remediation: 6f0fd27a74c0c6d01e41722cb118f161f660ad2b restores claimed-first waitForAction.

### Second review

Pass: 16 September 2026

base: 7840b8e96a280715389655e8aa961632049cfb11
head: 8eda8282682a38e1cd26ff35bba16a348332d2fc
branch: feature/06-03-introduce-repositories

Not blocking. The first-review Spec incorrect waitForAction order is fixed.
Standards has no major. Spec has no missing or incorrect finding.

### Standards

major 0 / minor 0 / nit 0

findings: none

The first-review Standards minor is addressed. The reconnect test claims one
Open, queues a distinct Open, waits again, and asserts the in-flight id,
claimed status, queued backlog, and a single claimed row. That test ran and
passed. The concurrent-claim test now starts from an in-flight claim plus a
queued backlog and races two waiters; both receive the claimed id and the
backlog stays queued. That path ran and passed.

### Spec

missing 0 / partial 0 / scope-creep 0 / incorrect 0

findings: none

waitForAction now returns an existing claimed action before claiming a queued
row, inside mutateStore. A reconnecting waiter with in-flight work and a
queued backlog does not create a second claimed action. That matches the
parent store at 7840b8e96a280715389655e8aa961632049cfb11 and the TypeScript
reuse map: Move or split; do not rewrite behavior. Preserve action claim and
completion concurrency semantics.

Two idle waiters on a two-item queue both receiving the first claim matches
the previous store. Claimed-first order plus the in-process lock means the
second waiter reconnects to the in-flight row and leaves the second Open
queued. That is reconnect to one waiting agent, not a double transition of
one queued row. The uniqueness acceptance criterion still holds. Concurrent
waiters are not required to partition the backlog.
