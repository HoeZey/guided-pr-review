---
status: implemented
---

# PRD: Review screen polish

## Problem

The Guide and Diff review surface already chapters, highlights, and walks a
change, but it still reads as a local tool: collapse state leaks across tabs,
collapsed files still get painted, file heads do not stick, and leftover Linear
density work (chips, TOC, type, truncation) has no signed home. Git-host,
overview, and code-review must not absorb those renderer gaps.

## Goal

A reviewer can read Guide and Diff at Linear density, with collapse, highlight,
and sticky file heads behaving independently, without changing store, MCP, or
chapter contracts.

## Non-goals

- Home, catalog, repository badges, or grouped PR selection
- Code Review tab, comments, votes, or merge actions
- New syntax themes as a product surface, structural highlighting, or git file
  icons
- Rewriting Guide v1, Store v1, or MCP tool names

## User stories

- As a reviewer, I want Guide collapse and Diff viewed to stay independent so
  expanding a file on Guide is not lost after visiting Diff.
- As a reviewer, I want collapsed files not to run Shiki so tab switches stay
  cheap.
- As a reviewer, I want a file header to stick while I scroll that file.
- As a reviewer, I want Guide chrome collapsed by default, Unified on Guide and
  Split on Diff, underline tabs, and layout controls in Display.
- As a reviewer, I want compact file chips, a left-edge file-tick Sections list, quieter hunk
  headers, and filename-first truncation so the stage matches Linear density.
- As a reviewer, I want the brand mark and IBM Plex Sans / IBM Plex Mono type
  to remain; chapter title and why copy should keep editorial scale.
- As a reviewer, I want Guide / Diff / Code Review to read as Linear
  Overview / Files / Commits: a tab row under the identity header, plain
  text, selected accent underline. Not options jammed into the top bar.
- As a reviewer, I want the Diff (and Guide stage file) to sit in a rounded
  card with its own border, not flush to the pane edge.
- As a reviewer, I want UI chrome, header source, and why copy at the same
  13px size, with a larger chapter title.
- As a reviewer, I want to leave a review with brand or a compact back
  control, without a saved-PR column on the review screen.

## Implementation notes

- This PRD owns the review screen only: header chrome, Guide aside and stage,
  Diff cards and Files rail, collapse, highlight, and sticky heads. Overview,
  git-host identity, and outcomes stay in their PRDs.
- Keep and verify uncommitted Linear chrome already in the nested working tree:
  per-tab layout prefs, Guide Reviews rail collapsed by default, underline
  Guide/Diff tabs, Display menu, compact Guide aside, TOC tick rail, IBM Plex
  Sans and Mono, Reviewed/chevron, rail width animation, Diff folder tree, brand mark.
  Commit that behavior on a review-screen branch rather than rewriting it.
- Guide collapse (chevron, not Reviewed) is per file on Guide and must not
  write into the Diff viewed set. Diff viewed may collapse Diff cards after a
  tab switch. Returning to Guide restores that file's Guide expand/collapse,
  not Diff viewed.
- paintCode skips collapsed file bodies. Expanding a file paints it then.
- File heads use position sticky against the main scroller. Overflow on file
  cards must not clip sticky. Stage already prefers overflow visible; keep
  that.
- Remaining density polish from the Linear gap pass: file chips are one-row
  (name and path left, +/- right, current file filled); the Guide Sections
  list shows a file-tick rail, nested chapter files (titles ellipsize), centered over the Guide viewport and scrolls, opens on hover or 01/04;
  unified hunk headers are muted
  separators; Diff Files rail ellipsizes directories, not filenames; chapter
  title about 26px / -0.04em; why copy 13px / 1.55 muted; code 12px /
  20px line-height; gutters faint. Do not auto-collapse a file solely because
  Reviewed was checked; the checkbox still marks viewed and may advance.
- Type: the default size for UI chrome (header tabs, header source,
  Display menu items, buttons, chips, rails, Home meta, Guide why) is the
  Display menu item size (13px). Chapter title stays the editorial 26px
  scale. Why / description uses the same 13px chrome size and the existing
  copy formatter (paragraphs, inline code, bold; no raw HTML).
  Linear-style phrase-to-diff underlines in why copy are not in this PRD.
- Mode tabs: Guide, Diff, and Code Review match Linear Overview / Files /
  Commits. They are a tab row under the identity header (brand, back,
  title, source, actions stay on the first row). Plain muted text,
  selected uses the accent underline, not a filled chip, not a boxed
  segmented control, and not inlined with the title in the top bar.
  Names stay Guide / Diff / Code Review.
- Diff and Guide stage: the screenshot's Files panel is one rounded
  bordered code pane (file head plus body). Per-file rounded cards that
  are inset from the pane match that when several files exist. Do not
  leave the code wall full-bleed.
- The Guide chapter column is a fixed width. It is not user-resizable.
  The Files rail on Diff and Code Review still resizes. The Guide aside
  has no vertical rule between copy and the stage; top padding stays.
- The saved-PR Reviews column is gone from the review screen. Brand and a
  compact back control return to Home. Home is the PR switcher. Files /
  chapters rails stay. This supersedes persisting that Reviews rail per
  tab.
- Header title remains the Guide title in full. A host pull request adds only
  an Azure DevOps or GitHub icon link. Structured owner/repo identity stays
  git-host / overview work, not this bar.
- No new MCP tools. No new npm dependencies.

## Testing / seams

**Seam(s):** Existing guide-view helpers for collapse versus viewed, rail and
layout prefs, and fileTree truncation; extended so Guide collapse does not
write Diff viewed and Diff viewed does not collapse Guide files; paint skip
for collapsed file bodies.

**Why this seam:** Collapse and highlight bugs live in shared state helpers,
not in Astro. Chrome is visual.

**What a good test is here:** Marking viewed on Diff does not collapse the
same path on Guide. Chevron-collapsing a Guide file does not mark it viewed.
collapsedOnDiff still keeps viewed Diff files collapsed after a tab switch.
A collapsed file is excluded from the highlight set; expanding it includes
it. Truncation helper keeps the filename when the directory is long. Do not
assert Astro DOM, sticky position, or pixel type. Sticky heads, TOC opacity,
chip layout, and type scale are one manual browser check on Guide and Diff.

**Prior art:** guide-view.test.ts collapse, layout prefs, and fileTree tests.

## Trade-offs (decided)

| Decision | Chose | Rejected | Why |
|---|---|---|---|
| Contract home | New polish PRD | Fold bugs into git-host, overview, or code-review | Renderer gaps are not those products |
| Landed chrome | Keep and verify uncommitted Linear UI | Rewrite from HEAD | The working tree already has the layout pass |
| Collapse model | Independent Guide collapse and Diff viewed | One shared collapsed set | Shared set is the Guide-expand bug |
| Highlight | Skip collapsed bodies | Always Shiki every file | Collapsed paint is wasted work |
| Extra themes | Keep current Shiki themes | Ship a new token theme in this PRD | Density and bugs first; theme is deferred |
| Type defaults | UI chrome 13px including why and header source; title 26px | Why at 15px; source at 11px mono | Same chrome size across header, tabs, and description |
| Saved-PR rail on review | Remove; Home or back to switch | Keep and persist per Guide/Diff/Code Review | Home is the inbox; the rail duplicates it |
| Diff card | Rounded, own border, inset | Full-bleed pane | Match Linear Files panel |
| Guide aside width | Fixed | User-resizable persisted handle | Guide is editorial; Files rail still resizes |

## Open questions (intentionally deferred)

- A calmer Shiki theme or lower token contrast — if github-dark still feels
  louder than Linear after density work
- Phrase-to-diff underlines inside why copy (Linear red underline on a
  quoted span) — if formatted paragraphs are not enough after this pass

## Follow-up (after Home and Code Review)

Original success criteria still describe Guide and Diff density. These
slices do not reopen that contract; they extend chrome to surfaces that
landed later. Board: [issues](issues/).

- 01 Align chrome type and Linear mode tabs
- 03 Round and border Diff and Guide stage cards
- 04 Resize and persist the Guide chapter column is cancelled (fixed width)
- 05 Remove the saved-PR column and return via back
- 06 Place mode tabs in a Linear tab row (01 put them in the title bar)
- 02 Persist Reviews rail per tab is cancelled.

## Success criteria

- Uncommitted Linear chrome listed above is committed and still matches those
  behaviors on Guide and Diff.
- After visiting Diff, a Guide file that was expanded stays expanded; viewed
  Diff files stay collapsed on Diff.
- Collapsed file bodies are not Shiki-painted; expanding them paints once.
- File heads stay visible while scrolling that file on Guide and on Diff.
- File chips, file-tick Sections list, hunk headers, Files-rail truncation, and type scale
  match the density notes above on a manual pass of the seeded sample guide.
- Guide / Diff / Code Review sit in a tab row under the identity header,
  with an accent underline on the selected tab, matching Linear Overview /
  Files / Commits. They are not options in the title bar.
- Diff and Guide stage files read as rounded bordered cards.
- The Guide chapter column is a fixed width. Diff and Code Review Files
  rails still resize.
- The review screen has no saved-PR column; brand or back returns to Home
  without deleting store state.
- Why copy is 13px chrome size and still renders formatted paragraphs,
  inline code, and bold. Header source uses the same 13px.
- Store, MCP, and Guide v1 contracts are unchanged.
- Helper tests cover collapse isolation, highlight skip, and filename-first
  truncation without Astro DOM assertions.

## Out of scope

- Pull request overview, repository configuration, and archived PRs
- Named ADO ingest, comments, and Code Review outcomes
- Logo redesign (the existing brand mark stays)
- Extra code themes, line wrap, implementation line-count badges, blob deep
  links
- Auto-collapsing a file as the only response to Reviewed

## References

- Linear gap canvas from 14 Sep 2026 (live localhost:8765 versus Linear still
  and recording)
- Linear Files screenshot 14 Sep 2026 (header mode tabs, rounded bordered
  diff card, formatted why, editorial title)
- Grill-me decisions in the planning chat (separate PRD, include polish, keep
  landed chrome, confirmed helper seams)
- [PRD: Guided PR review](../01-guided-pr-review/) (chaptering, store, MCP)
- [PRD: Pull request overview](../04-pull-request-overview/)
- [PRD: Git-host guided reviews](../03-git-host-guided-reviews/)
