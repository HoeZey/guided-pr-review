---
name: guided-pr-review
description: >-
  Builds a Linear-style guided PR review from a local git diff: semantic
  chapters in reasoning order (core, consequences, glue, tests, noise), each
  with a why-this-exists blurb and inlined hunks, then pushes the Guide v1
  JSON to a localhost instance via HTTP MCP. Use when the user says
  "/guided-pr-review", "guide this PR", "Linear-style review", "review guide",
  or wants a reading-order walkthrough of a branch or PR. Not a findings
  review — that is /code-review.
---

# Guided PR review

Produce a **reading-order guide** of a local git diff. Not a verdict. Do not
run /code-review unless the user asks for findings too.

The app is a renderer plus store. You chapter. You call MCP add_review.

Skill root is the directory that contains this SKILL.md (this git repo).

## Process

1. **Pin the range** (same as /code-review). User-supplied SHA / branch /
   range if they named one. Else three-dot merge-base(default-branch)...HEAD.
   Detect the default branch (git symbolic-ref refs/remotes/origin/HEAD,
   then develop / main / master). Confirm git rev-parse and a
   non-empty git diff --stat BASE...HEAD. Working tree stays out unless
   they asked. Local git only — no GitHub/Bitbucket fetch. Empty diff: stop.
2. **Collect hunks.** git diff --name-status -M BASE...HEAD and
   git diff -U3 -M BASE...HEAD. Binary / unreadable files go in
   omitted[] (path + reason), not as fake hunks.
3. **Chapter.** Assign each git hunk (@@ block) to **exactly one** chapter.
   A file may appear in more than one chapter. Do not drop hunks. Do not split
   one @@ hunk across chapters. Order kinds, skip empty:

   1. core — entrypoint and the new behavior. If the reviewer reads one
      chapter, this is it. First core chapter is open: true (scroll lands there).
   2. consequences — types, callers, public contract, schema/API fallout.
   3. glue — registration, imports, config, wiring, adapters.
   4. tests — tests and fixtures.
   5. noise — docs, generated, lockfiles, formatting-only, snapshots.
      Stub bodies for lockfiles / generated / huge files (stub: true plus
      addition/deletion counts). Do not inline thousands of lockfile lines.

   Title: short and specific ("Pin pipeline revisions to SNAPSHOT"), not
   "Core changes". why: 2–5 sentences on why this part exists and what to
   look at — not a review finding.
4. **Build a Guide v1 object** matching the Zod GuideV1 contract (see
   src/contracts.ts and docs/prds/guided-pr-review.md). Line content has no
   leading + / - / space. Chapter ids unique kebab-case.
5. **Ensure the instance is up** on http://localhost:8765

   ```bash
   curl -sS http://localhost:8765/mcp
   ```

   If that fails, from the skill root:

   ```bash
   npm install
   npm run dev
   ```

   Start npm run dev in the background. Wait until /mcp answers. Do not start
   a second process if port 8765 is already taken.
6. **Push via MCP** POST JSON-RPC to http://localhost:8765/mcp

   - tools/call name add_review arguments { "guide": <Guide v1> }
   - tools/call name set_active if you need a different id (add_review already
     sets active)

   Open http://localhost:8765/ for the reviewer. Guide and Diff tabs. Leave
   the server running.

## Hard no

- No findings, approve/reject, or Standards/Spec grades.
- No Cursor canvas.
- No git-host API.
- No LLM inside the app.
- Do not implement product code in the repo under review.

## MCP tools

- list_reviews → { reviews, activeId }
- add_review { guide } → { id }
- remove_review { id } → { ok: true }
- get_review { id } → { guide }
- set_active { id } → { activeId }
