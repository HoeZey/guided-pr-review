---
status: done
blocked_by: []
blocks: []
---

# Collapse every Home section

**Type:** Story

**Parent:** 11 Demo prep

**From PRD:** [11 Demo prep](../)

**Seam(s):** Home server render

**What it delivers:** Each Home section is a disclosure. Archived starts closed. The others start open.

**Scope (in):**

- Every Home group uses a native disclosure.
- Archived starts closed. Other groups start open.
- A reviewer's open or closed choice is stored in the browser and restored on reload.
- A group with no stored choice keeps the default.
- Each group is keyed by its id.

**Scope (out):**

- Changing which cards belong in a group

**Touches:** Home view, Home styles, Home server-render test

**Acceptance criteria:**

- [x] Every Home group renders as a disclosure.
- [x] A non-archived group starts open.
- [x] Archived starts closed.
- [x] Reload restores a section the reviewer has opened or closed.

**Blocked by:** none

**Blocks:** none

**Parallel-eligible:** yes
