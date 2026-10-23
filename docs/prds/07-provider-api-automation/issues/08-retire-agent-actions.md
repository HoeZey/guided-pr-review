---
status: done
blocked_by:
  - 07-open-and-update-diff
blocks:
  - 09-integrate-provider-automation
---

# Retire deterministic agent actions

**Type:** Story

**From PRD:** [07 Provider API automation](../)

**Seam(s):** action contracts/repository; guided-pr-review skill; connection
and operation UI

**What it delivers:** Agent sessions perform only Guide chaptering and
code-review publication, not host or git work.

**Scope (in):**

- Remove Open, Update Diff, Refresh, and Add repository from agent claim/wait/
  complete ownership.
- Remove obsolete action schema, status, heartbeat, copy, routes, MCP tools,
  and tests only after direct services cover every caller.
- Keep Generate Guide queue/claim/complete for explicit guided-pr-review.
- Keep code-review as a separate session that publishes outcomes.
- Rewrite SKILL.md Home path to open/sync through app and wait only when
  Generate Guide is requested.
- Replace Agent disconnected copy for deterministic actions with provider
  connection/recovery state.
- Run CLI-auth UX acceptance and record OAuth follow-up only if needed.

**Scope (out):**

- Launching agents from browser
- Moving chaptering into app
- OAuth implementation
- Comment actions

**Touches:** ActionRepository and src/lib/server/services/actions.ts;
src/routes/api/actions and src/lib/server/mcp/handler.ts;
src/lib/shared/contracts/catalog.ts action kinds; src/lib/shared/domain/overview.ts;
queueHomeAction in src/lib/client/state/home.svelte.ts; queueGenerateGuide in
src/lib/client/state/review.svelte.ts; SKILL.md; tests. Keep generate-guide
queue/claim/complete.

**Acceptance criteria:**

- [x] Refresh, repository management, Open, and Update expose no agent action.
- [x] Dead queue/action code has no callers.
- [x] Generate Guide still chapters in place through explicit agent session.
- [x] code-review still publishes matching outcomes independently.
- [x] Browser never claims app can launch an LLM.
- [x] SKILL.md performs no provider metadata or git work for deterministic
  paths.
- [x] Full action and skill contract tests pass.

**Blocked by:** 07 Open and update Diff

**Blocks:** 09 integration

**Parallel-eligible:** no

## CLI-auth UX

16 September 2026. Existing az and gh CLI sessions are usable (az account
show returned BBH Dev Pilot; gh auth status logged in to github.com).
Terminal login is not a material friction for this slice. Native OAuth stays
deferred. No PAT. No live comment mutation. No isolated 8771 server started.

## code-review

Date: 16 September 2026

base: 6e0e52716fcfd281a209eae7032df44e6ea01bb0
head: 2104a03800d8ee3adc230d912ef00df1427b600a
branch: feature/07-08-retire-agent-actions

Not blocking. Standards has no majors. Spec has no missing or incorrect findings.

Judged leftover notes, not findings: Home queueHomeAction still types open, update-diff, and refresh, then POST to app APIs (/api/reviews/open, /api/reviews/update-diff, catalog refresh). Generate Guide still POST /api/actions. GitHostAdapter.fetchOpen, completeOpen, completeUpdateDiff, and MCP queue_action kinds open, update-diff, and refresh have no production callers. Historical issue docs still name GitHostAdapter.fetchOpen. homeCardAction still takes unused agentConnected; Open, Update, and Refresh no longer read it. Generate Guide still gates on agentConnected.

### Standards

major 0 / minor 0 / nit 0

findings: []

### Spec

missing 0 / partial 0 / scope-creep 0 / incorrect 0

findings: []
