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

Produce a **reading-order guide** of a git diff. Not a verdict. Do not
run /code-review unless the user asks for findings too.

The app is a renderer plus store. You chapter. You call MCP add_review or
upsert_review.

Skill root is the directory that contains this SKILL.md (this git repo).

## Choose a path

- Named Azure DevOps PR URL or numeric id → **Named ADO PR** (upsert_review).
- Explicit SHA, branch, or git range → **Local range** (add_review).
- Neither → Local range on merge-base(default-branch)...HEAD.

Do not switch the user's working tree on either path. Do not git checkout,
git switch, git reset, or git worktree add unless the user asked.

## Named ADO PR

1. **Read origin.** git remote get-url origin.

   Azure DevOps hosts: dev.azure.com, ssh.dev.azure.com (treat as
   dev.azure.com), or a *.visualstudio.com host. Anything else (github.com,
   bitbucket.org, …): stop with a clear unsupported git host error. Do not
   call add_review or upsert_review.

   Parse organization, project, and repository name. HTTPS looks like
   https://dev.azure.com/{org}/{project}/_git/{repo}. SSH looks like
   git@ssh.dev.azure.com:v3/{org}/{project}/{repo}. Owner in Guide v1 is
   {org}/{project}. Provenance host is dev.azure.com or the visualstudio.com
   host, never ssh.dev.azure.com.

2. **Parse the PR.** A URL such as
   .../pullrequest/1027, or a bare integer id. If the URL names a different
   repository than origin, stop. The PR must belong to the current origin
   repo.

3. **Authenticate.** Use the configured Cursor Azure DevOps MCP (azcli).
   First-run: native MCP auth or one az login. If the MCP returns an auth
   error, tell the user to az login and retry. Never paste a PAT into the
   app, the store, logs, or the Guide JSON.

4. **Resolve identity without checkout.**

   - repo_repository action get, project, repositoryNameOrId from origin.
   - repo_pull_request action get with repositoryId, pullRequestId, project,
     includeChangedFiles true.

   Read title, sourceRefName, targetRefName, repository.id, web URL, and the
   exact SHAs lastMergeSourceCommit.commitId (source) and
   lastMergeTargetCommit.commitId (target). If those SHAs are missing, stop.

5. **Fetch commits, leave HEAD alone.**

   ```bash
   git fetch --no-tags origin TARGET_SHA SOURCE_SHA
   git rev-parse --verify TARGET_SHA
   git rev-parse --verify SOURCE_SHA
   git diff --stat TARGET_SHA...SOURCE_SHA
   ```

   Empty diff: stop. If fetch by SHA fails, fetch the PR refs still without
   checkout. Confirm the current branch is unchanged.

6. **Skip chaptering when the source commit is unchanged.** Ensure the
   instance is up (same as Local range step 5). tools/call list_reviews.
   Sync key is azure-devops:{host}:{repository.id}:{number}. If a listed
   review has that syncKey and the same sourceCommit, tools/call set_active
   for that id, open http://localhost:8765/, and stop. Do not upsert.
   A listed review with no syncKey is not a skip: continue so upsert can
   attach this PR to a matching local-range row.

7. **Iterations and change tracking.** Needed on the stored guide for later
   comment posting. Prefer az rest with the Azure CLI session:

   ```bash
   az rest --method get --uri "https://dev.azure.com/ORG/PROJECT/_apis/git/repositories/REPO_ID/pullRequests/PR_ID/iterations?api-version=7.1"
   az rest --method get --uri "https://dev.azure.com/ORG/PROJECT/_apis/git/repositories/REPO_ID/pullRequests/PR_ID/iterations/ITERATION/changes?api-version=7.1"
   ```

   firstComparingIteration is 0 (whole PR versus target).
   secondComparingIteration is the latest iteration id. changes maps each
   item.path (no leading slash) to { changeTrackingId }. If this call fails,
   still upsert with changes as an empty object rather than inventing ids.

8. **Chapter** the diff TARGET_SHA...SOURCE_SHA using Local range steps 2–4.
   Guide.base is the target SHA. Guide.head is the source SHA. Guide.title
   is the PR title.

9. **Set source** on Guide v1 (required fields; ADO-only data lives only in
   providerContext):

   ```json
   {
     "kind": "pull-request",
     "provider": "azure-devops",
     "host": "dev.azure.com",
     "repository": {
       "id": "provider repository id",
       "owner": "org/project",
       "name": "repo",
       "webUrl": "https://dev.azure.com/org/project/_git/repo"
     },
     "number": 1027,
     "webUrl": "https://dev.azure.com/org/project/_git/repo/pullrequest/1027",
     "sourceRef": "refs/heads/feature/example",
     "targetRef": "refs/heads/develop",
     "sourceCommit": "40-character source SHA",
     "targetCommit": "40-character target SHA",
     "providerContext": {
       "kind": "azure-devops",
       "project": "PROJECT",
       "firstComparingIteration": 0,
       "secondComparingIteration": 1,
       "changes": {
         "src/example.ts": { "changeTrackingId": 1 }
       }
     }
   }
   ```

10. **Push via upsert_review**, not add_review.

    tools/call name upsert_review arguments { "guide": <Guide v1> }

    Same id is kept for the same provider + host + repository id + PR
    number. A new source commit replaces the stored guide. Upsert also
    adopts exactly one unsourced local-range review when the range head
    matches the PR source branch, or when that branch was renamed but
    exactly one local range shares the ticket key (TCD-n). Ambiguous
    ticket matches create a new row. Open http://localhost:8765/. Leave
    the server running.

## Local range

1. **Pin the range** (same as /code-review). User-supplied SHA / branch /
   range if they named one. Else three-dot merge-base(default-branch)...HEAD.
   Detect the default branch (git symbolic-ref refs/remotes/origin/HEAD,
   then develop / main / master). Confirm git rev-parse and a
   non-empty git diff --stat BASE...HEAD. Working tree stays out unless
   they asked. Do not attach source. Empty diff: stop.
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
   look at — not a review finding. Blank lines start paragraphs. Markdown
   bold and code spans render in the Guide aside.
4. **Build a Guide v1 object** matching the Zod GuideV1 contract (see
   src/contracts.ts and docs/prds/guided-pr-review/). Line content has no
   leading + / - / space. Chapter ids unique kebab-case. Omit source.
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

   Open http://localhost:8765/ for the reviewer. Guide, Diff, and Code Review
   tabs. Leave the server running.

## Hard no

- No findings, approve/reject, or Standards/Spec grades.
- No Cursor canvas.
- No GitHub or Bitbucket ingest. Named PRs are Azure DevOps only.
- No PAT in the app, store, or Guide JSON.
- No LLM inside the app.
- Do not implement product code in the repo under review.
- Do not post ADO comments from this skill (a later story).
- Do not invent overview Home, catalog, or multi-repo grouping.

## MCP tools

- list_reviews → { reviews, activeId }. Review rows include base and head,
  and may include syncKey, sourceCommit, and pullRequest (provider, host,
  repository, number, webUrl).
- add_review { guide } → { id } — new snapshot (local ranges).
- upsert_review { guide } → { id } — stable id for a named ADO PR.
- publish_review_outcome { reviewId, outcome } → { id }
- remove_review { id } → { ok: true }
- get_review { id } → { guide, outcomes }
- set_active { id } → { activeId }
