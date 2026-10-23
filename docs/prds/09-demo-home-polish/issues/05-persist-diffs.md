---
status: done
blocked_by:
  - 03-book-icon
  - 04-home-columns
blocks:
  - 07-skill-fanout
---

# Pull list and diffs together on refresh

**Type:** Story

**From PRD:** [09 Demo home polish](../)

**Seam(s):** catalog refresh; review open and diff persist through the review
service and the store; home overview for catalog rows without a saved review

**What it delivers:** The refresh click persists diffs, including new pull
requests. Opening a saved review reads the snapshot and never calls the host
or git. Chapters survive. The book turns yellow only when the saved diff is
ahead of the guide.

**Scope (in):**

- Add an optional diff on ReviewRecord: sourceCommit, targetCommit, and
  files (FileChange[]). Old rows without it still validate. No migration.
- ReviewSummary gains an optional diffCommit (the saved diff's
  sourceCommit), so list_reviews tells the dot, the book, and the skill
  what is saved. get_review returns guide, outcomes, and optional diff. The
  tools contract matches.
- The Diff tab reads diff.files when diff is present. Otherwise it keeps
  filesForDiff(guide).
- guide.source.sourceCommit stays the commit the guide was chaptered
  against. Refresh of a chaptered review writes diff only. Do not replace a
  chaptered guide with an unchaptered one. The book's tag is that field,
  which the provenance contract validates as a SHA. guide.head can be a ref
  name and is not used for the book.
- A new pull request has no review yet. The click creates one unchaptered
  guide whose source commit is that commit, and sets diff to the same
  files. The book is grey.
- The book: grey when guide.unchaptered is set. Otherwise yellow when
  guide.source.sourceCommit differs from diff.sourceCommit, and green when
  they match. A chaptered review with no diff is green until the click
  backfills it; it already dots the icon.
- The dot: an active reviewer or authored catalog pull request with no
  saved review, a review with no diff, or a catalog sourceCommit that
  differs from diffCommit. Skip local ranges, archived, and closed.
- projectHomeOverview stops making cards from catalog rows that have no
  saved review. Those rows only feed the dot.
- The light check is the existing catalog refresh (replaceCatalog). No git
  fetch and no diff write. A reload or tab return stays responsive and only
  dots the icon.
- The click fetches every active catalog pull request that Home shows in
  Review requests or Authored by me, plus active ones not on Home yet that
  would join those groups, plus saved reviews with no diff. Skip local
  ranges, archived, and closed. One failure keeps the successes and leaves
  the dot. While the click is working, the arrow animates and the page
  stays usable.
- Open of a saved review returns it and calls neither the provider nor git,
  whatever the catalog says. Only the click runs syncDiff. getPullRequest
  today runs before the skip in syncDiff; open must not reach it.
- upsertReview replaces found.guide only, so diff survives a guide push.
  Keep that, and test it.
- Reviews saved before this epic have no saved diff. They are not migrated.
  They count toward the dot. The next click backfills their diff from git.
  Until then open shows them from the guide's chapter files without
  fetching.

**Scope (out):**

- Stamping chapter files as the pull request diff
- Repository search (06)
- Skill fan-out and retiring the action queue (07)
- The app generating or updating a guide

**Touches:** optional diff on ReviewRecord in
src/lib/shared/contracts/persistence.ts; tools contract in
src/lib/shared/contracts/tools.ts; Diff tab; syncDiff and open in
src/lib/server/services/reviews.ts; upsertReview in
src/lib/server/repositories/json/store.ts; projectHomeOverview in
src/lib/shared/domain/overview.ts. Production path: syncDiff and open in
src/lib/server/services/reviews.ts plus upsertReview in
src/lib/server/repositories/json/store.ts.

**Acceptance criteria:**

- [ ] A reload or tab return stays responsive and only dots the icon.
- [ ] A catalog row with no saved review is not a card.
- [ ] The click adds a new pull request only together with its saved diff.
- [ ] After a click with no failures, every Home card that comes from the
  catalog has a saved diff.
- [ ] One failure keeps the successes and leaves the dot.
- [ ] Opening a saved review never calls the host or git.
- [ ] Chapters survive. Refresh of a chaptered review writes diff only.
- [ ] The Diff tab shows the saved snapshot when a diff is present.
- [ ] The book turns yellow only from that saved diff.
- [ ] An upsert of a guide keeps the saved diff.
- [ ] Old rows without a diff still validate. No migration. A pre-epic
  review opens from chapter files without fetching and counts toward the
  dot.

**Blocked by:** 03 One open state and a book icon, and 04 Home columns and
a refresh icon

**Blocks:** 07 Skill fan-out

**Parallel-eligible:** no. After 03 and 04 land, yes with 06

**Checks:** catalog-refresh.test.ts, reviews-diff.test.ts, and
store.test.ts through the real review service, including the open path
that returns the saved review with no provider or git call, and an upsert
that keeps diff. overview.test.ts for catalog rows without a saved review.
Not only the JSON helper.
