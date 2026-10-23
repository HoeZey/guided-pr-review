---
status: done
blocked_by:
  - 04-home-columns
blocks: []
---

# Search repositories the connected identities can list

**Type:** Story

**From PRD:** [09 Demo home polish](../)

**Seam(s):** configured repository list

**What it delivers:** The repository control searches repos the connected gh
and az identities can list. A failed list leaves the column layout in place.

**Scope (in):**

- Replace the repository URL field with a search over repos the connected gh
  and az identities can list, scoped to the org or project those CLIs
  already use.
- A failed list leaves the column layout from 04 in place.

**Scope (out):**

- Live CLI auth. A live smoke may fail auth and is recorded separately. It
  does not block 04.
- Header Add and the paste-JSON modal (removed in 04)
- Diff persist

**Touches:** the repository control 04 places on the right, replacing the
URL field. Production path: createConfiguredRepositoryService.

**Acceptance criteria:**

- [ ] The repository control searches repos the connected gh and az
  identities can list, scoped to the org or project those CLIs already use.
- [ ] A failed list leaves the column layout from 04 in place.
- [ ] The URL field is gone.

**Blocked by:** 04 Home columns and a refresh icon

**Blocks:** none

**Parallel-eligible:** no. After 04 lands, yes with 05

**Checks:** configured-repositories.test.ts with a fake gh and az list.
Live CLI smoke may fail auth. Record that separately. Do not block the
layout story on it.
