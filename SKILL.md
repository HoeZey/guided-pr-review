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
- Neither → **Home**. Sync current-origin PR metadata, then open
  http://localhost:8765/. Do not chapter a guide. Then wait for Open,
  Update Diff, Refresh, and Generate guide actions. Do not call add_review
  until an Open or Update Diff action is claimed.

Do not switch the user's working tree on either review path. Do not git checkout,
git switch, git reset, or git worktree add unless the user asked.

## Home

A bare skill trigger syncs current-origin PR metadata and opens Home. No guide
is generated until the reviewer selects a named PR, SHA, branch, or range.

1. **Ensure the instance is up** (same as Local range step 5). Do not start a
   second process if port 8765 is already taken.

2. **Read origin** (same host rules as Named ADO PR step 1). Parse organization,
   project, repository name, owner, host, and repo web URL.

   If origin is not Azure DevOps: open http://localhost:8765/. Tell the user
   catalog sync needs an Azure DevOps origin. Do not call replace_catalog,
   add_review, or upsert_review.

3. **Authenticate** (same as Named ADO PR step 3).

4. **Resolve the origin repository.** repo_repository action get, project and
   repositoryNameOrId from origin. Read repository.id and webUrl. Owner is
   org/project. Host is never ssh.dev.azure.com.

5. **List relationship metadata** with repo_pull_request action list,
   repositoryId, project, status Active, top 100:

   - created_by_me true
   - i_am_reviewer true

   Union by pullRequestId. A PR in the authored list is isAuthor. A PR in the
   reviewer list is isReviewer. Keep an item when it is an active non-draft
   review request or the user is the author (including the user's active
   drafts). Drop reviewer-only drafts; they are not review requests.

6. **Fill refs and commits.** The list payload is trimmed. For each kept PR,
   repo_pull_request action get with repositoryId, pullRequestId, project
   (includeChangedFiles false). Read title, isDraft, status, createdBy display
   name, sourceRefName, targetRefName, url, lastMergeSourceCommit.commitId,
   lastMergeTargetCommit.commitId, and a timestamp (closedDate or
   creationDate). If a SHA is missing, skip that PR rather than inventing one.
   If one get fails, skip that PR and continue.

7. **Push the snapshot.** tools/call name replace_catalog. origin true.
   repository is provider azure-devops plus host, id, owner, name, webUrl.
   syncedAt is the current UTC ISO timestamp. pullRequests use status
   active / completed / abandoned, boolean isDraft / isReviewer / isAuthor,
   and the 40-character source and target commits. HTTP equivalent: PUT
   http://localhost:8765/api/catalog with the same JSON body.

   If repository get or both list calls fail: still call replace_catalog with
   origin true, the repository identity you have, error as a short message, and
   no pullRequests. That records an isolated catalog failure and keeps saved
   guides.

8. **Open Home.** http://localhost:8765/. Do not call add_review. Do not
   chapter. Do not open a review URL.

9. **Wait for actions.** Keep the instance running. Loop until the user stops
   the skill:

   - tools/call name wait_for_action with timeoutMs 25000 (HTTP: POST
     http://localhost:8765/api/actions/wait). That heartbeats the agent.
     Idle returns { "action": null }; loop immediately.
   - If action.kind is open: handle **Open as Diff** below, then loop.
   - If action.kind is update-diff: handle **Update Diff** below, then loop.
   - If action.kind is refresh: handle **Refresh** below, then loop.
   - If action.kind is generate-guide: handle **Generate guide** below, then
     loop.
   - Any other kind: tools/call complete_action with status failed and
     error { "code": "unsupported-action", "message": "this session handles
     Open, Update Diff, Refresh, and Generate guide" }. Then loop.

   Do not Add repository from this loop.

## Open as Diff

Claimed Open means the reviewer picked a catalog PR with no saved review.
Fetch exact commits without checkout. Do not chapter.

1. **Authenticate** if the session dropped (Named ADO PR step 3).
2. **Resolve identity without checkout** using action.target (host,
   repository.id, repository.name, repository.owner, number) and Named ADO
   PR steps 4, 5, and 7. Guide.base is the target SHA. Guide.head is the
   source SHA. Guide.title is the PR title. Collect hunks with Local range
   step 2. Empty diff: complete_action failed, error
   { "code": "empty-diff", "message": "no changes to open" }, then return
   to the wait loop. Do not upsert.
3. **Build an unchaptered Guide v1.** One placeholder chapter holds every
   file (kind core, id unchaptered). Set unchaptered to true. Set source as
   in Named ADO PR step 9. Do not assign reading-order chapters. Do not run
   Local range step 3.
4. **Push via upsert_review**, then complete_action status succeeded with
   the returned reviewId. HTTP: PUT http://localhost:8765/api/reviews then
   POST http://localhost:8765/api/actions/{id}/complete. On any host or git
   failure: complete_action status failed with
   { "code": "open-failed", "message": "<short reason>" }. Do not change
   other reviews. Then return to the wait loop.

The app opens Diff. Do not open a review URL from the skill; the viewer
navigates when the action succeeds.

## Update Diff

Claimed Update Diff means the reviewer wants a fresh snapshot of a saved PR
whose catalog source commit moved. Same fetch as Open as Diff. Do not chapter.

1. Follow Open as Diff steps 1–4 (authenticate, fetch exact commits without
   checkout, build an unchaptered Guide v1, upsert_review, complete_action
   succeeded with reviewId). Empty diff: complete_action failed, error
   { "code": "empty-diff", "message": "no changes to open" }, then return to
   the wait loop. Host or git failure: complete_action failed with
   { "code": "update-failed", "message": "<short reason>" }. Then loop.
2. upsert_review keeps the same id and replaces the stored snapshot. Do not
   require chaptering. Then return to the wait loop.

The app opens Diff. Do not open a review URL from the skill.

## Refresh

Claimed Refresh means the reviewer asked to replace catalog snapshots. Do not
upsert. Do not delete saved reviews. Do not chapter.

1. Repeat Home steps 2–7 (origin, authenticate, resolve repository, list
   relationship metadata, fill refs and commits, replace_catalog).
2. Also include saved pull requests that are no longer Active. tools/call
   list_reviews. For each listed review with pullRequest whose number is
   missing from the snapshot, repo_pull_request action get (includeChangedFiles
   false) and append that PR with its host status (active, completed, or
   abandoned). Skip a get that fails rather than dropping the rest.
3. Push the combined snapshot with replace_catalog as in Home step 7. The store
   adopts matching unsourced local-range reviews (exact source branch, else
   unique ticket key). Do not call upsert_review for Refresh.
4. complete_action status succeeded. Do not send reviewId. On host failure:
   complete_action failed with { "code": "refresh-failed", "message": "<short
   reason>" }. Then return to the wait loop.

There is no timer. Refresh runs at bare skill startup (Home steps 1–8) and
when the reviewer queues this action.

## Generate guide

Claimed Generate guide means the reviewer asked for reading order on an
already-open unchaptered review. Chapter in place. Keep the same review id.
Do not checkout.

1. **Load the saved review.** tools/call get_review with action.reviewId.
   If the guide is not unchaptered, complete_action failed, error
   { "code": "generate-guide-failed", "message": "review already has a guide" },
   then return to the wait loop. Do not upsert.
2. **Chapter without checkout.** Use the stored base and head and the files
   already on the guide. Assign hunks with Local range steps 3–4. Do not
   fetch again unless the stored files are empty. Empty files: complete_action
   failed, error { "code": "empty-diff", "message": "no changes to chapter" },
   then return to the wait loop. Do not upsert.
3. **Build a chaptered Guide v1.** Keep title, base, head, range, repo, and
   source from the saved review. Omit unchaptered. Real chapter ids, not
   unchaptered. Do not drop paths that were on the Diff.
4. **Push via upsert_review**, then complete_action status succeeded with
   the same reviewId. HTTP: PUT http://localhost:8765/api/reviews then
   POST http://localhost:8765/api/actions/{id}/complete. On any chaptering
   failure: complete_action status failed with
   { "code": "generate-guide-failed", "message": "<short reason>" }. Leave
   the unchaptered Diff in place. Then return to the wait loop.

The app fills the Guide tab. Diff still lists each path. Do not open a
review URL from the skill.

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
   for that id, open http://localhost:8765/reviews/{id}, and stop. Do not upsert.
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
    ticket matches create a new row. Open http://localhost:8765/reviews/{id}
    using the id returned by upsert_review. Leave the server running.

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
   look at — not a review finding.

   Format why for the Guide aside (same idea for any other agent-written
   copy this skill emits). Blank lines start paragraphs. Wrap identifiers,
   paths, routes, flags, and symbols in Markdown code spans. Use Markdown
   bold only for a true stress. Those render as mono and strong. No raw
   HTML. Plain identifiers with no markup stay body text.

   Example why:

   ```
   This is the behavior change. `POST .../output-model` retargets the
   pipeline shell to a different finished OUTPUT model and pins that
   model's latest `SNAPSHOT` on the draft.

   Read `switch_output_model` guards first: under review, building,
   same model, not OUTPUT.
   ```
4. **Build a Guide v1 object** matching the Zod GuideV1 contract (see
   src/contracts.ts and docs/prds/done/guided-pr-review/). Line content has no
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

   Open http://localhost:8765/reviews/{id} using the id returned by add_review.
   Guide, Diff, and Code Review tabs. Leave the server running.

## Hard no

- No findings, approve/reject, or Standards/Spec grades.
- No Cursor canvas.
- No GitHub or Bitbucket ingest. Named PRs are Azure DevOps only.
- No PAT in the app, store, or Guide JSON.
- No LLM inside the app.
- Do not implement product code in the repo under review.
- Do not post ADO comments from this skill (a later story).
- Do not chapter or upsert from a bare Home trigger. Catalog sync is
  replace_catalog only.
- Do not add a second repository from this path (later overview stories).
  After Home catalog sync, wait for Open, Update Diff, Refresh, and
  Generate guide.

## MCP tools

- list_reviews → { reviews, activeId, repositories, catalog, actions,
  agentConnected }. Review rows include base and head, and may include
  syncKey, sourceCommit, unchaptered, and pullRequest (provider, host,
  repository, number, webUrl).
- replace_catalog { origin, repository, syncedAt?, error?, pullRequests } →
  { ok: true } — catalog snapshot for one repository. Never deletes saved
  reviews. Adopts matching unsourced local-range reviews onto catalog PRs.
- queue_action { kind: "open" | "update-diff" | "refresh" |
  "generate-guide", target?, reviewId? } → { id } — target required for Open
  and Update Diff. reviewId required for Generate guide. Dedupes an in-flight
  action of the same kind and target, or an in-flight Generate guide for the
  same review.
- wait_for_action { timeoutMs? } → { action } — claims the next queued
  action and heartbeats the agent. Null when idle.
- complete_action { id, status, reviewId?, error? } → { ok: true } —
  reviewId required when Open, Update Diff, or Generate guide succeeds.
  Refresh success does not send reviewId.
- add_review { guide } → { id } — new snapshot (local ranges).
- upsert_review { guide } → { id } — stable id for a named ADO PR.
- publish_review_outcome { reviewId, outcome } → { id }
- remove_review { id } → { ok: true }
- get_review { id } → { guide, outcomes }
- set_active { id } → { activeId }

Bare http://localhost:8765/ is Home after catalog sync. The waiting agent
then long-polls wait_for_action. An explicit add or upsert opens
http://localhost:8765/reviews/{id}. Open and Update Diff upsert an unchaptered
review and the app lands on Diff. Refresh replaces catalog snapshots and
updates Last synced. Generate guide chapters that review in place; Guide
becomes the walkthrough.
