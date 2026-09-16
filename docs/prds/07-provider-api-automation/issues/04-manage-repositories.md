---
status: done
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

- [x] Supported current origin appears once without manual add.
- [x] Valid ADO and GitHub repositories persist with stable provider identity.
- [x] Duplicate aliases cannot create duplicate configured rows.
- [x] Invalid/inaccessible repositories are not persisted.
- [x] Removing configuration retains saved review data.
- [x] Existing Store v1 fixture with no repository configuration loads with no
  lost reviews, catalog, actions, or outcomes.
- [x] Any persisted-shape migration is automatic, idempotent, and tested.
- [x] Svelte UI calls the thin SvelteKit handler without agent actions.
- [x] Tests use fake provider readers.

**Blocked by:** 02 ADO and 03 GitHub readers

**Blocks:** 06 Refresh catalogs

**Parallel-eligible:** no

## code-review

Date: 16 September 2026

base: 358aa4e0650761bae4daacbc7687afc8d4b54166
head: c79487e6e111100c69cc634d59594a57ffcad97d
branch: feature/07-04-manage-repositories

Blocking. Standards has a major. Spec has incorrect behavior.

Judged implementer notes: GitHub 403 mapping to auth in the GitHub adapter is accepted; denied is covered when a reader throws code denied. Origin comes from git remote get-url origin in the process cwd. Remove matches provider repository id only. Missing managed git cache from 05 is expected on this branch.

### Standards

major 1 / minor 1 / nit 1

- severity: major
  title: Origin list can report duplicate after catalog writes repositories
  location: src/lib/server/services/configured-repositories.ts (list)
  startLine: 111
  endLine: 131
  reference:
    source: src/lib/server/repositories/json/file.ts writeStore and configuredRepositoriesCollectionPresent
    quote: configuredCollectionPresent is set from the repositories key only on a cache-miss read, and markConfiguredRepositoriesCollection runs only from addConfiguredRepository and removeConfiguredRepository.
  explanation: list treats collectionPresent false as permission to validate and persist current origin. replaceCatalog already upserts that origin into store.repositories through applyCatalogReplacement and writeStore will emit the repositories key when the array is non-empty, but the in-memory flag stays false and readStore will not recompute it while cache hits. The next GET then calls persist, hits the provider-plus-host-plus-id duplicate check, and returns the existing row plus a duplicate error. persist success also returns only the new origin row, so any sibling rows already written by catalog replacement would drop out of that response.

  recommendation: Treat a non-empty configured list, or any write that emits the repositories key, as collection present. list should return the stored rows when origin is already configured, and should not surface duplicate on GET.

- severity: minor
  title: Provider rate and availability failures are mapped to auth
  location: src/lib/server/services/configured-repositories.ts (mapProviderError)
  startLine: 190
  endLine: 205
  explanation: ProviderError rate, unavailable, and malformed-response, and GithubProviderError rate-limited, unavailable, and malformed, fall through to fail auth. The original message is kept, but the code and HTTP status become 401. Callers then treat a rate limit or outage as an authentication failure.

  recommendation: Map those provider codes to a non-auth failure, or pass them through, so status and code match the reader.

- severity: nit
  title: Duplicate POST mock in the Home test is unreachable
  location: src/lib/client/components/home/home.svelte.test.ts
  startLine: 238
  endLine: 263
  explanation: The first /api/repositories POST branch always returns success. The later POST branch that returns This repository is already configured cannot run.

  recommendation: Delete the dead branch, or put duplicate coverage in its own test.

### Spec

missing 0 / partial 0 / scope-creep 0 / incorrect 1

- severity: major
  classification: incorrect
  title: Listing origin can show a duplicate error the reviewer did not cause
  location: src/lib/server/services/configured-repositories.ts (list)
  startLine: 111
  endLine: 131
  reference:
    source: docs/prds/07-provider-api-automation/issues/04-manage-repositories.md Scope (in) and Acceptance criteria
    quote: Parse supported current-origin remotes and include that repository automatically. Show duplicate, unsupported host, auth, not-found, and denied errors. Supported current origin appears once without manual add.
  explanation: After a same-process replace_catalog of the origin repository, Home GET /api/repositories still includes that origin, then also returns error duplicate with message This repository is already configured. The reviewer did not add a second row. Duplicate is supposed to reject a second add, not the automatic origin list. The usual skill path writes catalog first and then opens Home on the same localhost process, so the false error is on the intended first paint.

  recommendation: When origin is already the configured row, list it with no error. Keep duplicate for add of an alias that resolves to the same provider, host, and id.

## code-review-2

Date: 16 September 2026

base: 358aa4e0650761bae4daacbc7687afc8d4b54166
head: 5ff08b9507460666bc93a31f6e5bbf654b7b9283
branch: feature/07-04-manage-repositories

Not blocking. First-review Standards major and Spec incorrect are gone at HEAD.

Judged leftover notes:

- Unknown provider errors still map to auth. Named ProviderError and GithubProviderError rate, unavailable, and malformed codes now map to rate, unavailable, and malformed-response. The default still uses auth. That is a catch-all, not the first-review minor. Not reopened.
- GitHub 403 still maps to unauthorized in the GitHub adapter, then to auth here. Denied still appears when a reader throws code denied. Same accepted 03 adapter mapping as the first review. Not reopened.
- A non-empty catalog list skips auto-origin. writeStore now sets collection present when repositories is non-empty, and list returns stored rows when collectionPresent is true or the list is non-empty. Same-process replace_catalog of origin then GET no longer persist-and-duplicate. Auto-origin remains the empty or absent collection bootstrap. Not a remaining major.
- Origin rows written only by replace_catalog may omit cloneUrl, because CatalogReplacementInput has no cloneUrl and list no longer re-persists that origin through the reader. persist still copies cloneUrl when the reader returns it. Optional on ConfiguredRepositoryRecord; later cache work can fetch it. Not a remaining major.

Confirming the blocking path: listing origin after same-process replace_catalog does not report duplicate (service list and HTTP GET). persist duplicate during origin bootstrap returns stored rows with no error.

### Standards

major 0 / minor 0 / nit 0

findings: []

### Spec

missing 0 / partial 0 / scope-creep 0 / incorrect 0

findings: []
