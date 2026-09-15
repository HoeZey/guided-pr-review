---
status: todo
blocked_by: []
blocks:
  - 02-split-shared-contracts-and-domain
---

# Lock architecture boundaries and regression baseline

**Type:** Story

**From PRD:** [06 App structure](../)

**What it delivers:** Maintainers and implementation agents have one exact
move map, dependency policy, and runnable baseline before structural changes
begin.

**Scope (in):**

- Record every current src module under pages, client, server, or shared target
  ownership.
- State allowed imports and forbidden dependencies from the PRD.
- Identify stable product contracts: review URLs, Guide payloads, MCP tool
  names/payloads, persisted user data, and visible behavior at integration.
- Capture npm test and npm run build baseline from pinned develop.
- Add the smallest runnable architecture check that catches forbidden layer
  imports and heavy logic in pages.
- Add isolated-port manual smoke instructions that never touch port 8765 or
  live reviews.json.

**Scope (out):**

- Moving production modules
- Fixing unrelated bugs
- Adding provider or comment behavior
- New architecture-analysis dependencies when a small script or test suffices

**Touches:** architecture documentation, package scripts only if needed,
architecture check, test fixtures

**Acceptance criteria:**

- [ ] Every existing src file has one documented target owner.
- [ ] Allowed import direction is executable as a check.
- [ ] Check fails on one proved forbidden-import fixture and passes on develop.
- [ ] npm test and npm run build results are recorded before moves.
- [ ] Manual smoke uses isolated data and a non-8765 port.
- [ ] No production behavior changes.

**Blocked by:** none

**Blocks:** 02 Split shared contracts and pure domain rules

**Parallel-eligible:** no
