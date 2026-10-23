---
name: guided-pr-review
description: >-
  Builds a Linear-style guided PR review from a git diff: change-based
  chapters in reading order, each with a why-this-exists blurb and line
  references, then stores the Guide via HTTP MCP. Use when the user says
  "/guided-pr-review", "guide this PR", "Linear-style review", "review guide",
  or wants a reading-order walkthrough of a branch or PR. Not a findings
  review — that is /code-review.
---

# Guided PR review

Produce a reading-order guide of a git diff. Not a verdict. Do not
run /code-review unless the user asks for findings too.

The app is a renderer plus store. You chapter. You call MCP read_diff and
chapter_review. Home, Named, and Local all end the same way.

Skill root is the directory that contains this SKILL.md (this git repo).

## Choose a path

- Named pull request URL or numeric id against origin → Named.
- Explicit SHA, branch, or git range → Local.
- Neither → Home. Fan out guide updates for grey or yellow reviews
  where the user is a reviewer, from saved diffs. The app chapters nothing.

Do not switch the user's working tree on either review path. Do not git checkout,
git switch, git reset, or git worktree add unless the user asked.

## Home

A bare skill trigger opens Home and updates every grey or yellow saved review
where the user is a reviewer. Authored and other reviews stay as they are
unless the user asks for them in this chat. No checkout. No fetch. A visible
card already has a saved diff. This path does not cap how many guide chapters
one chat starts. The app still chapters nothing by itself.

Guides are written by Grok 4.7 high.

1. Ensure the instance is up (same as Local). Call each tool with the curl in
   Local step 2. Do not start a second process if port 8765 is already taken.
   Run pr-guide stop when the user asks to stop the app.

2. Open Home. http://localhost:8765/. Do not authenticate against provider
   MCP. Do not read origin. Do not checkout.

3. List reviews and join the catalog. tools/call list_reviews. For each
   review that has a syncKey, find the catalog pull request with the same sync
   key (provider:host:repository.id:number). Keep only rows where that catalog
   item has isReviewer true.

4. Pick grey or yellow in that set. Grey means the review is unchaptered.
   Yellow means it is chaptered and guide sourceCommit (review.sourceCommit /
   guide.source.sourceCommit) differs from the saved diff commit
   (review.diffCommit). Green means they match, or the chaptered review has no
   diff yet — skip those. A second run with nothing behind does not rewrite
   guides.

5. Named extras only when asked. If the user names an authored review or
   any other review outside the reviewer set, add that id to the work set for
   this chat. Otherwise leave those alone.

6. Chapter each target from the saved diff. For every id in the work set,
   spawn parallel subagents (no fan-out cap in this skill). Writer model:
   Grok 4.7 high. Each subagent gets this fixed brief:

   Read the Chapter section of the skill. Call read_diff for the id. Call
   chapter_review with that sourceCommit. On a 400, fix only the named ranges
   and retry up to twice. Reply with one line: id, chapter count, ok or error.

7. Stop. Do not wait for browser actions. Do not open every review URL
   unless the user asks. Leave the server running.

## Named

1. Ensure the instance is up (same as Local).

2. Resolve the pull request. Prefer a full Azure DevOps or GitHub pull request
   URL. A bare integer is a PR number against origin: read
   git remote get-url origin and build the provider URL for that host and
   repository. If origin is neither Azure DevOps nor GitHub, stop with a clear
   unsupported git host error.

3. tools/call open_pull_request with that url. It returns
   { id, chaptered, behind }.

4. Skip when chaptered and not behind. tools/call set_active for that id,
   open http://localhost:8765/reviews/{id}, and stop.

5. Otherwise chapter. tools/call read_diff for the id. Follow the Chapter
   section. tools/call chapter_review with the sourceCommit from read_diff and
   the chapters. On a 400, fix only the named ranges and retry up to twice.
   Open http://localhost:8765/reviews/{id}. Leave the server running.

## Local

1. Pin the range (same as /code-review). User-supplied SHA / branch /
   range if they named one. Else three-dot merge-base(default-branch)...HEAD.
   Detect the default branch (git symbolic-ref refs/remotes/origin/HEAD,
   then develop / main / master). Confirm git rev-parse and a
   non-empty git diff --stat BASE...HEAD. Working tree stays out unless
   they asked. Empty diff: stop.

2. Ensure the instance is up on http://localhost:8765

   ```bash
   curl -sS http://localhost:8765/mcp
   ```

   If that fails, run pr-guide start in the background. If pr-guide is not on
   PATH, from the skill root run npm run dev in the background instead. Wait
   until /mcp answers. Do not start a second process if port 8765 is already
   taken. Run pr-guide stop when the user asks to stop the app.

   Every tools/call in this skill is a POST to that same URL. Change the tool
   name and arguments:

   ```bash
   curl -sS -X POST http://localhost:8765/mcp -H 'content-type: application/json' -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"list_reviews","arguments":{}}}'
   ```

3. tools/call add_local_review with repoPath (absolute path to the git work
   tree under review), base, head, and an optional title. It returns { id }.

4. tools/call read_diff for that id. Follow the Chapter section. tools/call
   chapter_review with the sourceCommit from read_diff and the chapters. On a
   400, fix only the named ranges and retry up to twice.

5. tools/call set_active if you need a different id. Open
   http://localhost:8765/reviews/{id}. Guide, Diff, and Code Review tabs.
   Leave the server running.

## Chapter

Order kinds, and skip a kind that has no lines:

1. core — the entrypoint and the new behavior. This is the chapter to read
   if there is only time for one.
2. consequences — types, callers, public contract, schema or API fallout.
3. glue — registration, imports, config, wiring, adapters.
4. tests — tests and fixtures.
5. noise — docs, generated files, lockfiles, formatting-only changes.

Tests and noise stay their own chapters at the end, including when the
behavior change is one thing. Within a kind, split when the why needs "and"
to join two unrelated reasons, or when one part could be reverted alone.

A changed line belongs to one chapter. Split a hunk so core can be read
without a later chapter: the lines core needs from a consequences hunk go in
core, and the rest of that hunk stays in consequences. Unchanged padding may
repeat. The same changed line in two chapters is a duplicated range.

Chapter structure comes from the code only. Do not fetch Jira or other linked
tickets. When code and description disagree, the code wins, without a flag.

Title: what the chapter does, about 60 characters at most. Why: 2 to 4 sentences.
First the behavior change in the present tense, then the reason from the
description or commits (left out without intent), then where to start reading
and which guard or invariant holds it together. No findings, no approval
language.

Format why for the Guide aside (same idea for any other agent-written copy
this skill emits). Blank lines start paragraphs. Wrap identifiers, paths,
routes, flags, and symbols in Markdown code spans. Use Markdown bold only for
a true stress. Those render as mono and strong. No raw HTML. Plain identifiers
with no markup stay body text.

Example why:

```
This is the behavior change. POST .../output-model retargets the
pipeline shell to a different finished OUTPUT model and pins that
model's latest SNAPSHOT on the draft.

Read switch_output_model guards first: under review, building,
same model, not OUTPUT.
```

read_diff returns numbered changed lines and the intent block (description and
commits) when present. chapter_review takes { id, sourceCommit, chapters }
where each chapter is { title, why, refs } and a ref is { path } or
{ path, from, to }. Coverage must be exact across 1..k per file. A 400 names
missing, duplicated, unknownPaths, and partialStubs — fix only those ranges.

## Hard no

- No findings, approve/reject, or Standards/Spec grades.
- No Cursor canvas.
- No PAT in the app, store, or Guide JSON.
- No LLM inside the app.
- Do not implement product code in the repo under review.
- Do not post provider comments from this skill (a later story).
- On Home, do not checkout. Chapter only from saved diffs.
- Do not rewrite green reviews. Do not update authored or other reviews
  unless the user asks for them in that chat.
- The app chapters nothing by itself.

## MCP tools

Call each tool with the curl in Local step 2. No Cursor MCP setup is required.

- list_reviews → { reviews, activeId, repositories, catalog, actions,
  agentConnected }. Review rows include base and head, and may include
  syncKey, sourceCommit, diffCommit, unchaptered, and pullRequest (provider,
  host, repository, number, webUrl). Catalog pull requests include isReviewer.
- open_pull_request { url } → { id, chaptered, behind } — open an Azure
  DevOps or GitHub pull request URL into a saved review with its diff and
  intent.
- add_local_review { repoPath, base, head, title? } → { id } — save an
  unchaptered review from a local git work tree range.
- read_diff { id } → plain text with numbered changed lines and intent when
  present.
- chapter_review { id, sourceCommit, chapters } → { id } — chapter by line
  references; coverage must be exact.
- get_review { id } → { guide, outcomes, diff? }
- set_active { id } → { activeId }
- remove_review { id } → { ok: true }
- replace_catalog { origin, repository, syncedAt?, error?, pullRequests } →
  { ok: true } — catalog snapshot for one repository. Never deletes saved
  reviews.
- publish_review_outcome { reviewId, outcome } → { id }

Bare http://localhost:8765/ is Home. A Home skill run fans out chaptering over
grey or yellow reviewer reviews from saved diffs via read_diff and
chapter_review. An explicit Named or Local path opens
http://localhost:8765/reviews/{id}.
