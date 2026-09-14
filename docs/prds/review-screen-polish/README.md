---
status: in_progress
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
- As a reviewer, I want compact file chips, an opaque TOC drawer, quieter hunk
  headers, and filename-first truncation so the stage matches Linear density.
- As a reviewer, I want the brand mark and existing Inter / IBM Plex Mono type
  to remain; chapter title and why copy should keep editorial scale.

## Implementation notes

- This PRD owns the review screen only: header chrome, Guide aside and stage,
  Diff cards and Files rail, collapse, highlight, and sticky heads. Overview,
  git-host identity, and outcomes stay in their PRDs.
- Keep and verify uncommitted Linear chrome already in the nested working tree:
  per-tab layout prefs, Guide Reviews rail collapsed by default, underline
  Guide/Diff tabs, Display menu, compact Guide aside, TOC overlay, IBM Plex
  Mono, Reviewed/chevron, rail width animation, Diff folder tree, brand mark.
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
  (name and path left, +/- right, current file filled); TOC overlay is an
  opaque drawer with a Sections heading; unified hunk headers are muted
  separators; Diff Files rail ellipsizes directories, not filenames; chapter
  title about 26px / -0.04em; why copy about 15px / 1.55 muted; code 12px /
  20px line-height; gutters faint. Do not auto-collapse a file solely because
  Reviewed was checked; the checkbox still marks viewed and may advance.
- Header title remains the guide title. Structured owner/repo identity is
  git-host / overview work, not this PRD.
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

## Open questions (intentionally deferred)

- A calmer Shiki theme or lower token contrast — if github-dark still feels
  louder than Linear after density work
- Wheel/keyboard extras beyond existing j/k — if file walking still feels
  jumpy after sticky heads land

## Follow-up (after Home and Code Review)

Original success criteria still describe Guide and Diff density. These
slices do not reopen that contract; they extend chrome to surfaces that
landed later. Board: [issues](issues/).

- Align Code Review and Home type with Guide density (finding titles and
  axis heads currently sit on a different scale than chapter / why).
- Persist Reviews rail open/collapsed per Guide, Diff, and Code Review.
  Today Code Review shares Diff's rail bit.

## Success criteria

- Uncommitted Linear chrome listed above is committed and still matches those
  behaviors on Guide and Diff.
- After visiting Diff, a Guide file that was expanded stays expanded; viewed
  Diff files stay collapsed on Diff.
- Collapsed file bodies are not Shiki-painted; expanding them paints once.
- File heads stay visible while scrolling that file on Guide and on Diff.
- File chips, TOC drawer, hunk headers, Files-rail truncation, and type scale
  match the density notes above on a manual pass of the seeded sample guide.
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
- Grill-me decisions in the planning chat (separate PRD, include polish, keep
  landed chrome, confirmed helper seams)
- [PRD: Guided PR review](../guided-pr-review/) (chaptering, store, MCP)
- [PRD: Pull request overview](../pull-request-overview/)
- [PRD: Git-host guided reviews](../git-host-guided-reviews/)
