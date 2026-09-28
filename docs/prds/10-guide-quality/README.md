---
status: signed
---

# PRD: Guide quality

## Problem

The agent retypes every diff line into the Guide JSON. Output grows with the
diff, a line can come back wrong, and nothing checks that every hunk made it
into a chapter. A git hunk groups lines by distance, not meaning, and cannot
be split, so an import bump and a logic change that sit close together share
a chapter. The why is written from code alone: the PR description and commit
messages never reach the agent. Chapter kinds (core, consequences, glue,
tests, noise) sort by file role, which pulls tests away from the change they
check, and nothing in the UI reads kind. Home subagents get a one-line
pointer instead of the chaptering rules. There is no way to tell whether a
skill change made guides better.

## Goal

Every guide covers each changed line exactly once, checked by the app. The
agent writes only titles, whys, and line references. A five-PR comparison
shows whether the new skill beats the current one.

## Non-goals

- The app calling a model or writing chapter prose
- Fetching Jira or other linked tickets for the agent
- Per-file or per-hunk notes in the Guide
- Storing references instead of lines
- Re-chaptering reviews that have no saved diff
- A UI change for chapter kind or a skim chapter
- A size target for chapters

## User stories

- As a reviewer, I want every changed line in exactly one chapter so that
  nothing slips past the Guide.
- As a reviewer, I want a chapter to be one self-contained change with its
  tests so that I read a change and its proof together.
- As a reviewer, I want the why to state the author's reason when the PR or
  commits give one, and only the behavior when they do not.
- As an agent, I want a numbered diff and a tool that takes line ranges so
  that I never retype code.
- As an agent, I want one chaptering path for Home, a named PR, and a local
  range.
- As the maintainer, I want a scored comparison against a baseline before a
  skill change counts as better.

## Implementation notes

### Chapter by reference

- read_diff { id } returns plain text for a review with a saved diff:
  a header (id, sourceCommit, title), the intent block, then each file as a
  "== path (status)" line followed by its @@ headers and lines.
- Only changed lines carry a number: 1..k per file, in diff order, across
  all hunks. Unchanged lines print without a number. The numbering lives in
  one shared domain function used by read_diff and chapter_review.
- Stub files print as one line, "== path (stub +a -d)", and only accept a
  whole-file ref. Stub rule: package-lock.json, pnpm-lock.yaml, yarn.lock,
  uv.lock, poetry.lock, any .lock file, .min.js, .snap, and any file with
  more than 1,000 changed lines. Binary files are listed and need no ref.
  The Diff tab still shows every real line.
- chapter_review { id, sourceCommit, chapters: [{ title, why, refs }] }.
  A ref is { path } or { path, from, to }.
- The app rejects the call when the review has no saved diff, or when
  sourceCommit does not match diff.sourceCommit (case-insensitive). That
  error names the current commit.
- Coverage: for each file, the refs across all chapters cover 1..k exactly.
  A failure returns 400 with missing and duplicated (path to number ranges),
  unknownPaths, and partialStubs, so one retry can fix it.
- Resolve at write. The app slices each range into hunks, pads up to 3
  unchanged lines on each side without crossing the original hunk edge,
  recomputes oldStart, newStart, and the @@ header from the stored line
  numbers, and keeps the original hunk's section text. The stored guide is a
  Guide v1 snapshot, so the renderer is unchanged and a yellow book still
  shows what the agent read.
- The app fills everything but chapters: title, base, head, repo, and source
  come from the saved review; guide.source.sourceCommit (or guide.head for a
  local range) becomes diff.sourceCommit; unchaptered clears; the first
  chapter gets open: true; the review id and the active id stay.
- Refs inside a chapter display in the order sent. A file may appear in
  several chapters.
- Chapter kind becomes optional on GuideV1 so stored guides still parse.
  chapter_review does not take it. summary leaves GuideV1; no stored guide
  uses it.
- Padding can repeat an unchanged line in two chapters. A line comment on
  Guide renders only in the first chapter that shows that line.

### Intent inputs

- ProviderPullRequestMetadata gains description. The Azure DevOps reader
  maps description; the GitHub reader maps body.
- syncDiff and add_local_review run git log target..source and store
  ReviewDiff.intent: { description?, commits: [{ sha, subject, body }],
  truncated? }. Commits are oldest first. Caps: 8,000 characters of
  description, 100 commits; truncated is set when either cap hits.
- Intent is captured with the same commit pair as the diff. A changed
  description alone does not move the book.
- read_diff prints intent above the files when present.

### Paths and tools

- open_pull_request { url } parses an Azure DevOps (dev.azure.com or
  visualstudio.com) or GitHub pull request URL, resolves the repository
  through the existing repository reader, runs syncDiff, and returns
  { id, chaptered, behind }. behind means the guide's source commit differs
  from the saved diff's.
- add_local_review { repoPath, base, head, title? } runs git rev-parse,
  git diff -U3 -M base...head, and git log in that repository through the
  existing git process runner, parses with the existing unified-diff parser,
  and saves an unchaptered review with that diff. It rejects a path that is
  not a git work tree, an unknown commit, and an empty diff. Title defaults
  to the head commit subject.
- add_review and upsert_review leave the MCP tool list. The store functions
  stay for syncDiff, the seeded sample, local adoption, and tests.
- Tool list after this epic: list_reviews, open_pull_request,
  add_local_review, read_diff, chapter_review, get_review, set_active,
  remove_review, replace_catalog, publish_review_outcome.

### Skill

- Every path ends with read_diff then chapter_review. Home: list_reviews,
  pick grey or yellow reviewer reviews, one subagent per id. Named:
  open_pull_request, and skip chaptering when chaptered and not behind.
  Local: add_local_review. The Azure DevOps MCP ingest, the local clone
  fetch, the az rest iteration calls, and the handwritten source JSON leave
  the skill.
- A chapter is one self-contained change with its contract, callers,
  wiring, and tests. Split when the why needs "and" to join two unrelated
  reasons, when one part could be reverted alone and the rest would still
  make sense, or when lines are read differently (mechanical fallout or
  noise, placed after their cause). One chapter only when the PR does one
  thing. Order so each chapter reads with only the earlier ones; skim
  chapters last. Preparation, change, fallout, and skim guide the split and
  order and are not a field.
- Title: what the chapter does, about 60 characters at most. Why: 2 to 4
  sentences. First the behavior change in the present tense, then the reason
  from the description or commits (left out without intent), then where to
  start reading and which guard or invariant holds it together. No findings,
  no approval language. When code and description disagree, the code wins,
  without a flag. Existing formatting rules (paragraphs, code spans, bold
  only for true stress) stay.
- No Jira fetch. Chapter structure comes from the code only.
- The fixed Home subagent brief: read the Chapter section of the skill, call
  read_diff for the id, call chapter_review with that sourceCommit, on a 400
  fix only the named ranges and retry up to twice, reply with one line (id,
  chapter count, ok or error). Guides are written by Grok 4.7 high.

### Comparison

- Test set: the five active PRs with saved diffs, #782, #1140, #1145, #1150,
  #1155. data/eval/guide-testset.json holds identity, description, saved
  diff, and each run's guide and subagent conversation id. data/ is
  gitignored because it holds TCD code.
- Baseline: the current skill, three runs per PR, captured before the skill
  rewrite lands. The new side: three runs per PR after it lands. Same writer
  model on both sides.
- Judge: Opus 5.5. Each of the 15 matched pairs (baseline run n against new
  run n) goes to a fresh subagent with the saved diff, the description, and
  both guides labelled A and B in random order. It scores coverage, reading
  order, why matches intent, and no findings, 1 to 5 each, and quotes a
  chapter id or file and line for every score. The A/B key sits in a
  separate file. The maintainer reviews the scores afterwards.
- A committed eval script reads data/eval and computes per guide: uncovered
  or duplicated changed lines against the saved diff, chapter count, and
  guide JSON size. Tokens come from Cursor usage events per writer subagent,
  the same method as the run-efficiency handoff. It writes
  data/eval/report.md with each side's median and spread, every judgment,
  and its evidence.

## Testing / seams

**Seams:** MCP tools/call on the handler (read_diff, chapter_review,
open_pull_request, add_local_review, tool list); the review service syncDiff
with fake provider readers and a fake git runner; the skill contract test on
SKILL.md; the eval script on a fixture test set.

**Why this seam:** the agent only ever sees MCP tools, and every new
guarantee (coverage, commit match, padding, intent) is observable in what a
tool call returns or stores.

**What a good test is here:** a numbered read_diff for a two-hunk file; a
chapter_review that splits one hunk across two chapters and reads back a
Guide v1 with correct line numbers and padding; a gap and an overlap each
rejected with the exact ranges; a stale sourceCommit rejected; syncDiff
storing description and commits with caps; add_local_review on a temporary
git repository; the tool list without add_review and upsert_review; the
skill naming read_diff and chapter_review on every path. No model call.

**Prior art:** handler.test.ts for the tool list and tools/call,
reviews-diff.test.ts for syncDiff through the real review service,
store.test.ts, skill-contract.test.ts, managed-cache.test.ts for a real git
runner.

## Trade-offs (decided)

| Decision | Chose | Rejected | Why |
|---|---|---|---|
| Who writes lines | The app resolves refs into lines | The agent retypes hunks | Output tokens scale with chapters, not the diff, and lines cannot drift |
| When refs resolve | At write, stored as Guide v1 | Store refs, resolve on read | Refresh replaces the saved diff while a yellow guide stays on its commit |
| Numbering | Changed lines only, 1..k per file | Every diff line | Coverage is an interval check with no special case for context |
| Split unit | Any changed-line range | Whole git hunk | A hunk groups by distance, not meaning |
| Chapter kind | Dropped; order carries meaning | Keep the five kinds | Nothing reads it, and file-role kinds split a change from its tests |
| Local diff | App runs git in the repository | Agent pipes git output over HTTP | One call, no diff text through the model or the shell |
| Named PR diff | open_pull_request runs syncDiff | Agent-driven Azure DevOps ingest | The same code Home refresh trusts, and GitHub works too |
| Intent | Saved with the diff at refresh | Fetched live by read_diff | Home never calls the host, and intent matches the diff's commits |
| Tickets | No Jira fetch | Read linked tickets | Acceptance criteria bias chapter structure toward the ticket |
| Judge | Opus 5.5 first pass, maintainer after | Maintainer only; same-family judge | Cheap first pass with evidence, less self-preference than Grok judging Grok |

## Open questions (intentionally deferred)

- Per-file or per-hunk notes — after the comparison shows where guides still
  fall short
- Dropping lines stored twice (guide and diff) — if the store file size hurts

## Success criteria

- chapter_review stores a guide only when each changed line of the saved
  diff appears in exactly one ref; a gap or overlap returns the ranges.
- One git hunk can be split across two chapters and renders with correct
  line numbers and up to 3 lines of padding.
- A chapter_review against a moved diff is rejected and names the current
  commit.
- get_review and read_diff show the PR description and commit messages saved
  at refresh, within the caps.
- open_pull_request and add_local_review each produce a review that
  read_diff and chapter_review can chapter, with no diff text in the agent's
  output.
- The MCP tool list no longer offers add_review or upsert_review.
- SKILL.md sends Home, Named, and Local through read_diff and chapter_review,
  states the chapter rules, the why shape, and the subagent brief, and no
  longer mentions chapter kind or summary.
- data/eval/report.md compares baseline and new guides for all five PRs with
  15 judged pairs, medians, spreads, coverage, and tokens.

## Out of scope

- Changing how the Diff tab renders
- Comment display fixes beyond the one-chapter rule for repeated lines
- A cap on Home fan-out
- Posting guides or scores to a git host

## References

- Grilling in the guide-quality planning chat (decisions 1 to 24)
- [PRD: Guided PR review](../done/01-guided-pr-review/)
- [PRD: Demo home polish](../09-demo-home-polish/) (saved diffs, book, skill fan-out)
- Run-efficiency handoff (token method)
