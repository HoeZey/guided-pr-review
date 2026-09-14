---
status: implemented
---

# PRD: Guided PR review

## Problem

Large diffs are reviewed in filesystem order. Formatting, glue, and tests sit in the same stream as the behavior change. Reviewers run out of attention before they understand why the change should exist. Host-specific review UIs (Linear Guides, GitHub file lists) are not available from a local git range, and an agent that only dumps a markdown walkthrough cannot keep several PRs on one long-lived surface.

## Goal

A reviewer can walk a local git diff in reasoning order (core, then consequences, glue, tests, noise), with hunks on the page, and keep several of those guides in one localhost instance that an agent can add to and remove from.

## Non-goals

- Verdicts, approve/reject, or Standards/Spec findings (that is /code-review)
- Cursor canvas as the review surface
- Fetching diffs from GitHub, Bitbucket, or Linear
- An LLM inside the app (the agent chapters; the app stores and renders)
- Multi-user auth, remote deploy, or a public hosted service
- A named installable CLI or stdio MCP shim (deferred)

## User stories

- As a reviewer, I want chapters in reasoning order with the relevant hunks so I can read a large PR in one sitting.
- As a reviewer, I want several guides in one instance so I do not relaunch the app per PR.
- As a reviewer, I want to add, remove, and switch the active guide so the list matches what I am actually reviewing.
- As an agent, I want typed MCP tools (add/list/get/remove/set-active) so I can push a chaptered guide without copying files onto a new static server.
- As a reviewer, I want syntax-highlighted diffs and a light/dark toggle so the page is readable.
- As a reviewer, I want a Diff tab next to Guide so I can read the same change in filesystem order, one card per path.
- As a reviewer, I want files I mark viewed in Guide to stay collapsed when I return to Diff.
- As a reviewer, I want word-level highlight on paired removed/added lines so a rename is visible inside the line.
- As a reviewer, I want a Split (side-by-side) layout next to Unified. Guide defaults to Unified; Diff defaults to Split. Ctrl/⌘+B toggles the active tab.
- As a reviewer, I want to hide unchanged lines so I can read only the delta.
- As a reviewer, I want the Diff Files rail to be a compact folder tree (single-child directories joined with " / ", files nested underneath) so I can scan the change the way the repo is laid out.
- As a reviewer, I want the Reviews rail to animate open and closed so hiding it does not jump the layout.
- As a reviewer, I want to drag the Reviews and file-list rails so the layout matches how I read.
- As a reviewer, I want one chapter on screen at a time (sticky aside + every file in that chapter stacked in the stage). File pills scroll to a file. Reviewed is a checkbox on the chapter and on each file. Checking it marks viewed, collapses that file, and advances. Unchecking unmarks and expands. Guide files also have a chevron so a diff can collapse without marking Reviewed. Diff still uses Viewed. The first Guide pixel under the header is the chapter title.

## Implementation notes

- One long-lived localhost process serves the UI, the HTTP API, and HTTP MCP. Browser and agent share one store.
- Zod schemas are the data-model source of truth. TypeScript types are inferred. HTTP and MCP parse at the boundary. Do not dual-maintain handwritten JSON Schema and types.
- Guide v1 is the chapter payload: version, title, base, head, chapters (kind core | consequences | glue | tests | noise), files, hunks, optional stubs and omitted binaries. One git hunk belongs to exactly one chapter; a file may appear in more than one chapter.
- Store v1 wraps many guides: activeId plus reviews[] of { id, addedAt, guide }. Ids are random UUIDs. Duplicate ranges are allowed (two snapshots). Persistence is a JSON file; a lite DB is a later swap that must keep the same MCP tool names.
- MCP tools: list_reviews, add_review, remove_review, get_review, set_active. Same shapes as the HTTP API.
- If MCP is down, the Cursor skill starts the dev server, waits until MCP answers, then add_review. Do not spawn a second listener when the port is taken.
- UI: Linear Guide plus Diff. Guide is a vertical scroll of chapters; each chapter is two columns (sticky aside with title, clickable 01/09, why, file pills; stage with every file in that chapter stacked so the page scrolls through them). why is HTML-escaped then lightly formatted (paragraphs, inline code, bold). The review header shows the Guide title in full on the left with plus-minus counts; a host pull request adds only an Azure DevOps or GitHub icon link, not owner/repo/PR text. A file-tick rail on the left edge of Guide marks a floating Sections list (not a persistent third column). One tick per Guide file: muted unread, accent reviewed, larger when current. Hover the rail, or 01/04, opens numbered chapters with indented files, centered over the Guide viewport. Outside click, picking a row, or Escape closes it. The list scrolls internally. Chapter titles ellipsize. Chapter kind (core / consequences / glue / tests / noise) is agent chaptering only — not shown in the UI. Reviewed is a checkbox on the chapter row and on each Guide file header. Checking a file marks it viewed, collapses its hunks, and scrolls to the next stop; unchecking unmarks and expands. Checking the chapter marks every file in it, collapses them, and advances. A chevron on each Guide and Diff file toggles collapse independently of Reviewed/Viewed. File pills only scroll to that file. Diff stacks one card per path in tree order (directories before files at each level), hunks merged across chapters. The Diff Files rail is a compact folder tree: single-child directories join as ".cursor / rules / personal"; files sit under the folder; a chevron collapses that folder in the rail only. Guide and Diff are underline tabs in the header. Unified, Split, hide unchanged, and theme live in a Display menu; Ctrl/⌘+B still toggles layout. Guide defaults to Unified; Diff defaults to Split; each tab stores its own choice in localStorage. Split zips a remove/add run onto one row (leftover deletes left-only, leftover adds right-only). Each split pane scrolls as a unit (not per line). The divider is draggable; the ratio lives in localStorage. Hide unchanged collapses context runs into a gap row. j/k jumps files on Guide and on Diff. Review list is a collapsible left rail ([ or the chevron). The chevron stays visible when the rail is collapsed. Opening and closing the rail animates width (grid column) and fades the list; prefer reduced-motion skips the animation. Toggle does not rebuild the page. Guide defaults the rail collapsed; Diff keeps its own saved rail state. Reviews and Diff Files rails are resizable. Poll the store about every two seconds after an agent add. Shiki colors tokens; paired removed/added lines also get word-level changed spans. Viewed is a per-review checkbox on Diff file headers; Guide uses Reviewed. Viewed paths stay collapsed on Diff after a tab switch. Viewed set lives in localStorage, not the MCP store. File heads stick while scrolling that file. Dark is the fresh-session default; a stored light/dark choice still wins. Guide.summary is stored but not rendered as a banner.
- Astro + TypeScript. Streamlit was considered and rejected. If the Node adapter cannot mount MCP cleanly, one Hono (or equivalent) process still exposes the same contracts.
- Chaptering stays in the agent: pin merge-base(default)...HEAD unless the user named a range; local git only; no dirty tree unless asked.

## Testing / seams

**Seam(s):** Store commands (add_review, remove_review, list_reviews, get_review, set_active) after Zod parse of Guide v1 / Store v1. Guide view helpers: filesForDiff, markViewed / collapsedOnDiff, wordSegments / pairWordDiff, splitRows, withUnchangedGaps, compareDirPaths / fileTree, guideStops / stepGuide, parseDiffLayout / parseReviewsRails, formatCopy.

**Why this seam:** Store mutations are shared by HTTP and MCP. Diff-tab merge, viewed collapse, word-level pairing, split-row zip, hide-unchanged gaps, and the Files-rail folder tree are the Linear UI contract and must not live only in DOM code.

**What a good test is here:** Reject an invalid guide; add two guides; set_active; list shows both and the active id; remove drops one; get returns the payload. filesForDiff is directory-tree-sorted, one row per path, hunks concatenated then ordered by oldStart. markViewed puts a Guide-viewed path into the Diff collapsed set. wordSegments marks the renamed token on a worked example; pairWordDiff pairs a deleted line with the following added line. splitRows puts a replace on one row, leftover adds on the right, leftover removes on the left. withUnchangedGaps collapses a context run. fileTree compact-folds single-child directories and lists files under the folder. stepGuide walks to the next file then the next chapter. parseDiffLayout keeps a saved Diff mode. parseReviewsRails migrates a legacy collapsed/open string and defaults Guide collapsed. formatCopy turns paragraphs, inline code, and bold into escaped HTML. Do not test Astro internals.

**Prior art:** Python check.py on a sample guide (replaced by Zod + these commands).

## Trade-offs (decided)

| Decision | Chose | Rejected | Why |
|---|---|---|---|
| Review surface | Localhost app | Cursor canvas | Provider-independent; canvas is Cursor-only |
| Job | Reading-order guide | Findings / merge with /code-review | A map and a verdict pollute each other |
| Chapter unit | Git hunk, exclusive | Whole file | Filesystem order is the problem |
| Stack | Astro + TypeScript | Streamlit; static HTML forever | Need Linear-like diffs plus a real server |
| MCP transport | HTTP on the instance | stdio as the primary | Instance already running; stdio dies with the session |
| Persistence | JSON file | SQLite now | Enough for local; swap later without renaming tools |
| Contract source | Zod, types inferred | Handwritten types + JSON Schema | One model, parse at every door |

## Open questions (intentionally deferred)

- Named CLI (guided-pr-review up) — when install from the repo is annoying
- stdio MCP shim — if Cursor cannot comfortably point mcp.json at the HTTP URL
- SQLite — if the JSON file gets painful
- SSE instead of poll — if a two-second UI lag after add_review is noticeable
- Exact Cursor mcp.json HTTP field names — look up against current Cursor docs at implement time
- Linear density, sticky file heads, collapse isolation, and skip-painting collapsed files — [review screen polish](../review-screen-polish/)

## Success criteria

- Sample guide loads as a seeded review; Guide walks in order; Diff lists each path once in tree order; the Files rail compact-folds single-child directories; hunks show; Guide defaults to Unified and Diff defaults to Split; Unified still works on both; hide unchanged collapses context; theme toggle works and a fresh session is dark; Shiki colors a Python hunk; a paired replace shows word-level spans. The saved-PR Reviews rail in this bullet is superseded: polish 05 removed that column; Home is the switcher.
- add_review then list_reviews then set_active then remove_review succeed through the store seam (tests) and through HTTP.
- A second guide can be added without restarting the process; the UI can switch and remove it.
- MCP tools accept the same payloads as HTTP and reject invalid Guide v1.
- Skill starts the server when MCP is down and does not bind a second process if localhost:8765 is already up.

## Out of scope

- Publishing to skills.sh or making the GitHub repo public
- Tracking this app inside braid-connection-designer as product code
- Commenting back to GitHub, Bitbucket, or Linear ([git-host comments](../../git-host-guided-reviews/))
- Remaining Linear chrome, sticky heads, and collapse/highlight bugs ([review screen polish](../review-screen-polish/))
- Syntax-aware structural highlighting (Linear's tree-sitter mode). Word-level token LCS is in scope; parse-tree moves are not.
- Extra code themes, line wrap, implementation [*] line counts, GitHub/Linear deep links into blobs
- Inline review comments posted back to GitHub, Bitbucket, or Linear ([git-host comments](../../git-host-guided-reviews/))

## References

- Grill-me decisions in the planning chat (reading-order guide, hunk partition, Linear chapter order, private HoeZey repo, HTTP MCP, Zod, JSON store, Astro, skill boots the instance)
- [PRD: Git-host guided reviews](../../git-host-guided-reviews/)
- [PRD: Review screen polish](../review-screen-polish/)
- Wayfinder: skipped (no remaining fog, not a TCD epic)
