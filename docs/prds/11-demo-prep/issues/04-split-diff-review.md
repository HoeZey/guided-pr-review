---
status: done
blocked_by: []
blocks: []
---

# Review each split of a file on its own

**Type:** Story

**Parent:** 11 Demo prep

**From PRD:** [11 Demo prep](../)

**Seam(s):** guide viewed keys and Guide chapter render

**What it delivers:** Reviewing one slice of a file that appears in two chapters does not review or collapse the other slice. A file that appears once still shares its reviewed state with Diff.

**Scope (in):**

- A path counted in more than one chapter stores an occurrence key: chapter id, a NUL, then the path.
- A path counted in one chapter keeps the bare path, so Guide and Diff stay linked.
- Guide reads only the occurrence key for a split path. A stored bare path does not tick those slices.
- Diff still stores the bare path. Checking a slice does not check Diff. Checking Diff does not check the slices.
- The Diff collapsed set stays a union of viewed and collapsed keys. An occurrence key does not collapse the bare path.

**Scope (out):**

- Stable chapter ids after a later re-chapter. A stored tick can point at a different slice.
- Comment slot indexes
- The bare path Diff writes for a viewed file

**Touches:** guide viewed keys and their tests, Guide view, Guide chapter, Guide contents

**Acceptance criteria:**

- [x] Reviewing one part of a split file does not review or collapse the other part.
- [x] A file that appears once still shares its reviewed state with Diff.
- [x] A stored bare path does not tick the slices of a split file.

**Blocked by:** none

**Blocks:** none

**Parallel-eligible:** yes
