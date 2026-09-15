---
status: todo
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

**Touches:** action contracts/repository/services, src/mcp, API routes,
src/overview, client operation copy, SKILL.md, tests

**Acceptance criteria:**

- [ ] Refresh, repository management, Open, and Update expose no agent action.
- [ ] Dead queue/action code has no callers.
- [ ] Generate Guide still chapters in place through explicit agent session.
- [ ] code-review still publishes matching outcomes independently.
- [ ] Browser never claims app can launch an LLM.
- [ ] SKILL.md performs no provider metadata or git work for deterministic
  paths.
- [ ] Full action and skill contract tests pass.

**Blocked by:** 07 Open and update Diff

**Blocks:** 09 integration

**Parallel-eligible:** no
