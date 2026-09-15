---
status: todo
blocked_by:
  - ../../06-app-structure/issues/13-integrate-sveltekit-cutover
blocks:
  - 02-read-ado-pull-requests
  - 03-read-github-pull-requests
  - 05-managed-git-caches
---

# Connect one ADO and one GitHub CLI identity

**Type:** Story

**From PRD:** [07 Provider API automation](../)

**Seam(s):** credential source; command runner; connection-status service

**What it delivers:** Localhost can use one existing az identity and one
existing gh identity without accepting or persisting credentials itself.

**Scope (in):**

- Implement az account get-access-token for Azure DevOps resource
  499b84ac-1321-427f-aa17-267ca6975798.
- Implement gh auth token for github.com.
- Resolve provider identity needed for relationship classification.
- Return connected, command missing, login required, expired, denied scope,
  timeout, and malformed-output states.
- Show exact az login or gh auth login recovery and Retry.
- Bound command time/output and redact stderr.

**Scope (out):**

- az rest, az devops, gh api, pasted PATs
- Native OAuth or multiple accounts per provider
- Repository or PR network calls

**Touches:** lib/server/auth, provider connection service, Svelte connection
state/components, tests

**Acceptance criteria:**

- [ ] One active ADO and one active GitHub identity can be reported
  independently.
- [ ] Token is returned only inside server credential seam.
- [ ] No token reaches browser JSON, logs, command arguments, persisted data,
  Guide JSON, errors, or snapshots.
- [ ] Missing/expired sessions show provider-specific recovery and Retry.
- [ ] Concurrent token requests are bounded and may share safe in-flight work.
- [ ] Tests use fake command runners and redaction fixtures.

**Blocked by:** 06 integration

**Blocks:** 02, 03, and 05

**Parallel-eligible:** no
