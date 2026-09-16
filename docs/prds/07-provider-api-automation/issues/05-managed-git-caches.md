---
status: done
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

- [x] A repository with no local clone yields a complete parsed Diff from
  exact commits.
- [x] No checkout or user working-tree command runs.
- [x] Concurrent fetches for one cache serialize; different caches remain
  independent.
- [x] Token is absent from process arguments, logs, git config, and disk.
- [x] Corrupt managed cache recovers without changing other caches.
- [x] Unchanged available commits avoid unnecessary network work where safe.
- [x] Tests use local fixture remotes and injected process/filesystem seams.

**Blocked by:** 01 Connect CLI identities

**Blocks:** 07 Open and update Diff

**Parallel-eligible:** yes, with 02 and 03

## code-review

Pass: 16 September 2026

base: 54ccbc054c8faf858bb3fd83361e85c3b08d91e9
head: fcf841e47b7fdf992427d7a76adb1f997106ea2e
branch: feature/07-05-managed-git-caches

Not blocking. Standards has no major. Spec has no missing or incorrect.

Judged implementer notes: additive GitProcessRunner, GitCacheFs, and GitOperationError, plus optional fetchCommits cloneUrl, are the fetch seam and are not findings. In-process lock with a ponytail ceiling is accepted for a single Node process. sha:refs/guided-pr-review/sha fetch and askpass.mjs mode 100755 are the intended credential path. Not wiring Open/Update is 07-07. Unchanged ADO/GitHub REST files are expected on this parallel wave-2 branch.

### Standards

major 0 / minor 3 / nit 2

- severity: minor
  title: Corrupt-fetch retry refetches only the pre-wipe missing list
  location: src/lib/server/git/managed-cache.ts (fetchCommits)
  startLine: 204
  endLine: 215
  reference:
    source: .cursor/rules/ponytail.mdc
    quote: Bug fix = root cause, not symptom. Grep every caller of the function you touch and fix the shared function once.
  explanation: fetchCommits records which SHAs cat-file rejected, then on a corrupt/not-a-git-repository/bad-config fetch it deletes the cache and fetches only that missing list. Commits that passed cat-file before the wipe are gone and never refetched, yet the method still returns. The AC recovery test breaks HEAD so ensureBare recreates first and never enters this retry, so the hole is live production code without a covering check.
  recommendation: After recreateUnlocked, treat every requested SHA as missing (or re-run the cat-file scan) before the second fetch, and assert that path in the corrupt test.

- severity: minor
  title: Git process redaction rewrites stdout that becomes the Diff
  location: src/lib/server/git/process.ts (runGitProcess)
  startLine: 28
  endLine: 36
  reference:
    source: src/lib/server/auth/command-runner.ts
    quote: stderr: redactSecrets(result.stderr)
  explanation: createGitProcessRunner runs redactSecrets on both stdout and stderr before the caller sees them. unifiedThreeDot parses that stdout as FileChange hunks. Lines that look like a GitHub token, a JWT, or an https user:pass URL are replaced with [redacted] inside the Diff, so the parsed hunks are not the git text. The CLI runner only redacts stderr for this reason. unifiedThreeDot does not pass the askpass env, so the extra exact-token split does not apply on that path; the regex redaction still does.
  recommendation: Return raw stdout to parseUnifiedDiff. Redact at the log boundary, or redact stderr only, matching the CLI runner.

- severity: minor
  title: Hunk-less non-binary files fail existing FileChange rules
  location: src/lib/server/git/parse-unified.ts (toFileChange)
  startLine: 123
  endLine: 144
  reference:
    source: src/lib/shared/contracts/guide.ts FileChange.superRefine
    quote: non-stub file needs hunks
  explanation: toFileChange always sets hunks to the collected list. Binary paths become stub reason binary and satisfy the contract. A rename-only or mode-only file from git diff -M has a diff --git header and no hunks and no binary marker, so the parser emits a non-stub FileChange with an empty hunks array. FileChange.parse rejects that object. unifiedThreeDot returns the raw parse without FileChange.parse, so 07-07 GuideV1 validation would fail on an otherwise valid three-dot diff.
  recommendation: Emit a stub (or omit) when a non-binary file has no hunks, or add a placeholder hunk, then FileChange.parse the result before returning.

- severity: nit
  title: Eight-mebibyte git output cap has no ponytail
  location: src/lib/server/git/process.ts
  startLine: 5
  endLine: 6
  reference:
    source: .cursor/rules/ponytail.mdc
    quote: Mark intentional simplifications with a ponytail comment. If the shortcut has a known ceiling, the comment names the ceiling and the upgrade path.
  explanation: GIT_MAX_OUTPUT_BYTES is 8 MiB. A larger unified diff is killed and then mapped to a git error. The in-process lock documents its ceiling; this cap does not.
  recommendation: Add a ponytail on the constant naming the 8 MiB ceiling and streaming or a higher bound as the upgrade.

- severity: nit
  title: Port comments still say implementation lands later
  location: src/lib/server/git/ports.ts
  startLine: 54
  endLine: 64
  explanation: ManagedGitCache and GitDiff comments still say Implementation lands in PRD 07 after this story landed the implementation.
  recommendation: Drop or update those two comments.

### Spec

missing 0 / partial 0 / scope-creep 0 / incorrect 0

findings: []

