---
status: todo
blocked_by: []
blocks: []
---

# Show Home range as target into source

**Type:** Story

**From PRD:** [Pull request overview](../)

**Seam(s):** list_reviews summary plus the pure overview projection
(projectHomeCards). Projection tests, not Astro DOM.

**What it delivers:** A Home card shows merge direction as target ← source
(into-branch left, incoming branch right) so the base and the feature are
obvious.

**Scope (in):**

- Host-backed cards use structured targetRef and sourceRef (strip
  refs/heads/).
- Local-range cards parse the saved three-dot range as base...head.
- Display is target ← source, not an unlabeled A...B string and not a
  merge-base SHA.
- ADO link and repository badge stay.

**Scope (out):**

- Catalog grouping, Open as Diff, refresh
- Changing how the stored git diff is computed (still three-dot)

**Touches:** review summaries, overview projection, Home UI, tests

**Acceptance criteria:**

- [ ] A host-backed card with target develop and source feature/foo
  projects develop ← feature/foo.
- [ ] A local card whose saved range is main...feature/one projects
  main ← feature/one.
- [ ] A card without refs or a parseable range omits the range line.
- [ ] Projection tests do not assert Astro DOM internals.

**Blocked by:** none

**Blocks:** none

**Parallel-eligible:** yes
