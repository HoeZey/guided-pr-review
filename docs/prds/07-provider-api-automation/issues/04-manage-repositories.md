---
status: todo
blocked_by:
  - 02-read-ado-pull-requests
  - 03-read-github-pull-requests
blocks:
  - 06-refresh-catalogs
  - 09-integrate-provider-automation
---

# Manage explicit configured repositories

**Type:** Story

**From PRD:** [07 Provider API automation](../)

**Seam(s):** configured-repository repository; provider validation service;
Home repository management

**What it delivers:** A reviewer can keep an explicit ADO/GitHub repository
list, including current origin, without a waiting agent or hidden account scan.

**Scope (in):**

- Parse supported current-origin remotes and include that repository
  automatically.
- Add a repository by supported URL or normalized provider identity.
- Validate through ADO/GitHub provider reader before persistence.
- Persist provider, host, provider repository id, owner, name, web URL, and
  clone URL needed by later cache work.
- Compatibility-load existing stores with no configured repository collection
  by deriving current origin at runtime; migrate persisted shape automatically
  only when required.
- Remove configuration from future refreshes without deleting saved reviews,
  outcomes, or prior catalog/review history.
- Show duplicate, unsupported host, auth, not-found, and denied errors.

**Scope (out):**

- Discovering every accessible repository
- Deleting provider repositories
- Selecting multiple identities
- Opening Diff in this story

**Touches:** ConfiguredRepositoryPort and ConfiguredRepositoryRecord in
src/lib/server/repositories/ports.ts; JSON adapter
src/lib/server/repositories/json/store.ts; provider readers from
src/lib/server/providers/ports.ts; Home src/lib/client/state/home.svelte.ts
and src/lib/client/components/home/; SvelteKit +server.ts; tests with fake
provider readers

**Acceptance criteria:**

- [ ] Supported current origin appears once without manual add.
- [ ] Valid ADO and GitHub repositories persist with stable provider identity.
- [ ] Duplicate aliases cannot create duplicate configured rows.
- [ ] Invalid/inaccessible repositories are not persisted.
- [ ] Removing configuration retains saved review data.
- [ ] Existing Store v1 fixture with no repository configuration loads with no
  lost reviews, catalog, actions, or outcomes.
- [ ] Any persisted-shape migration is automatic, idempotent, and tested.
- [ ] Svelte UI calls the thin SvelteKit handler without agent actions.
- [ ] Tests use fake provider readers.

**Blocked by:** 02 ADO and 03 GitHub readers

**Blocks:** 06 Refresh catalogs

**Parallel-eligible:** no
