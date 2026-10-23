---
status: done
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

**Touches:** src/lib/server/auth/ports.ts (CredentialSource,
CredentialStatus, CredentialIdentity, CredentialResult); new CLI
CredentialSource and command runner under src/lib/server/auth/; connection
status through src/lib/server/services/app.ts and src/lib/server/runtime.ts;
Svelte connection state beside src/lib/client/state/home.svelte.ts and
src/lib/client/components/home/; thin SvelteKit +server.ts; fake
command-runner tests

**Acceptance criteria:**

- [x] One active ADO and one active GitHub identity can be reported
  independently.
- [x] Token is returned only inside server credential seam.
- [x] No token reaches browser JSON, logs, command arguments, persisted data,
  Guide JSON, errors, or snapshots.
- [x] Missing/expired sessions show provider-specific recovery and Retry.
- [x] Concurrent token requests are bounded and may share safe in-flight work.
- [x] Tests use fake command runners and redaction fixtures.

**Blocked by:** 06 integration

**Blocks:** 02, 03, and 05

**Parallel-eligible:** no

## code-review

Pass: 16 September 2026

base: d91823f38e05712585183825e1f647f275681ceb
head: 03624c0a12d08629f01f2fa1d5ffdc9b74c9b651
branch: feature/07-01-connect-cli-identities

Not blocking. Standards has no major. Spec has no missing or incorrect.

Judged implementer notes: Home connection load on onMount (not SSR) is the Connecting path and is not a finding. Token in CredentialSuccess and command stdout is the server seam and is not a finding. Unverified ADO JWT claims and gh auth status text parse are Standards only.

### Standards

major 0 / minor 1 / nit 1

- severity: minor
  title: GitHub identity uses English gh auth status text on the live CLI
  location: src/lib/server/auth/cli-credentials.ts (readGithub, githubLogin)
  startLine: 67
  endLine: 210
  reference:
    source: docs/prds/07-provider-api-automation/issues/01-connect-cli-identities.md Scope (in)
    quote: Resolve provider identity needed for relationship classification.
  explanation: readGithub runs gh auth token then gh auth status --hostname with no JSON flag. githubLogin first parses JSON hosts, login, and active_account fields, then falls back to the regex Logged in to host account-or-as login. Default gh auth status prints English text, so the JSON branch never runs against the real CLI. Tests feed the English fixture, so they stay green if gh wording changes. A valid token then becomes malformed and later relationship classification loses login.
  recommendation: Pass --json on the status command so the JSON parser already in githubLogin is the live contract, and keep the text regex only as a fallback for older gh.

- severity: nit
  title: ADO login is decoded from an unverified JWT payload
  location: src/lib/server/auth/cli-credentials.ts (jwtIdentity)
  startLine: 154
  endLine: 172
  reference:
    source: .cursor/rules/ponytail.mdc
    quote: Mark intentional simplifications with a ponytail comment. If the shortcut has a known ceiling, the comment names the ceiling and the upgrade path.
  explanation: jwtIdentity base64-decodes the access-token payload and takes unique_name, upn, preferred_username, or email with no signature, alg, or aud check. The token comes from a local az account get-access-token process the app spawned, so this is not a network trust-boundary hole. There is no ponytail comment naming the ceiling (spoofed login if stdout is not a real ADO token) or the upgrade (verify aud, or read identity from a non-token az command).
  recommendation: Keep the decode while az remains the trust source. Add a ponytail comment. Do not treat the displayed login as proof of control.

### Spec

missing 0 / partial 0 / scope-creep 0 / incorrect 0

findings: []
