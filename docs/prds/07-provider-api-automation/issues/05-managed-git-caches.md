---
status: todo
blocked_by:
  - 01-connect-cli-identities
blocks:
  - 07-open-and-update-diff
  - 09-integrate-provider-automation
---

# Fetch exact commits through managed bare caches

**Type:** Story

**From PRD:** [07 Provider API automation](../)

**Seam(s):** cache path/lock; git process runner; authenticated fetch;
unified-diff parser

**What it delivers:** Any configured repository can provide a complete Diff
without a local clone or checkout.

**Scope (in):**

- Derive one cache identity/path from provider, host, and repository id.
- Initialize and validate a bare repository under local app data.
- Fetch exact source and target commits using credential source without token
  in arguments, config files, logs, or cache.
- Serialize mutation per cache while allowing independent repository work.
- Compute the current three-dot unified diff with existing file/hunk semantics.
- Detect empty diff, missing commit, fetch failure, and corruption.
- Recreate only a corrupt managed cache; never touch user repositories.

**Scope (out):**

- Checkout, worktree changes, submodule materialization, or LFS hydration
- Provider patch APIs as primary diff
- Automatic cache retention/eviction
- Private network in CI

**Touches:** src/lib/server/git/ports.ts (GitCacheIdentity, ManagedGitCache,
GitDiff); new git process/filesystem adapter under src/lib/server/git/;
CredentialSource from src/lib/server/auth/ports.ts; local app-data under
GUIDED_PR_REVIEW_DATA; process/filesystem fakes; Diff fixtures; tests

**Acceptance criteria:**

- [ ] A repository with no local clone yields a complete parsed Diff from
  exact commits.
- [ ] No checkout or user working-tree command runs.
- [ ] Concurrent fetches for one cache serialize; different caches remain
  independent.
- [ ] Token is absent from process arguments, logs, git config, and disk.
- [ ] Corrupt managed cache recovers without changing other caches.
- [ ] Unchanged available commits avoid unnecessary network work where safe.
- [ ] Tests use local fixture remotes and injected process/filesystem seams.

**Blocked by:** 01 Connect CLI identities

**Blocks:** 07 Open and update Diff

**Parallel-eligible:** yes, with 02 and 03
