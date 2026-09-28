---
status: todo
blocked_by: []
blocks:
  - 04-chapter-by-reference
---

# Read a saved diff with numbered changed lines

**Type:** Story

**From PRD:** [10 Guide quality](../)

**Seam(s):** MCP tools/call read_diff on the handler

**What it delivers:** An agent reads a saved diff as compact text where
every changed line has a number it can point at, and stub files take one
line.

**Scope (in):**

- One shared domain function numbers a saved diff: per file, changed lines
  (added and removed) are 1..k in diff order across all hunks. Unchanged
  lines have no number. The same function decides stubs. 04 reuses it.
- Stub rule: package-lock.json, pnpm-lock.yaml, yarn.lock, uv.lock,
  poetry.lock, any .lock file, .min.js, .snap, and any file with more than
  1,000 changed lines.
- read_diff { id } returns plain text:
  - header: review id, sourceCommit, title
  - intent block when diff.intent is present: description, then one line
    per commit subject with its body indented, then a truncated note
  - per file: "== path (status)", then each @@ header, then lines with the
    number, a + or - or space marker, and the content
  - stub files: "== path (stub +a -d)" and no lines
  - binary files: "== path (binary)"
- An unknown id is a 404. A review with no saved diff is a 409 that says
  to refresh first.

**Scope (out):**

- Taking refs or writing a guide (04)
- Changing get_review

**Touches:** a numbered-diff function in src/lib/shared/domain; read_diff in
src/lib/server/mcp/handler.ts and the tools contract in
src/lib/shared/contracts/tools.ts. Production path: the handler.

**Acceptance criteria:**

- [ ] A file with two hunks numbers its changed lines 1..k continuously
  across both hunks, and unchanged lines carry no number.
- [ ] A lockfile and a file with 1,001 changed lines each print as one stub
  line with their counts.
- [ ] The intent block prints when present and is absent otherwise.
- [ ] Unknown id and no saved diff return the stated errors.
- [ ] tools/list offers read_diff.

**Blocked by:** none

**Blocks:** 04 Chapter by reference

**Parallel-eligible:** yes

**Checks:** a domain test for numbering and the stub rule; handler.test.ts
for read_diff output and errors.
