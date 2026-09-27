---
status: signed
---

# PRD: Demo home polish

## Problem

Opening a saved review waits on the host. That wait writes an unchaptered diff
over a chaptered guide. Home still offers No guide, Outdated, Update Diff,
Generate guide, and Open saved, clips the empty Guide heading, shows a Code
Review tab, and blocks first paint on a catalog refresh. A remote change and a
guide that is behind the saved diff look like the same problem.

## Goal

Saved reviews open from their snapshot, guide match is a book icon, and new
diffs arrive only when the reviewer clicks refresh.

## Non-goals

- The app generating or updating a guide, calling a model on refresh, or
  opening a Cursor chat from a localhost button
- A Generate guide button or an Update guide button, on the card or on the
  empty Guide tab
- The app spawning guide subagents
- Pull-down refresh
- An interval timer
- Migrating reviews saved before this epic
- Stamping chapter files as the pull request diff
- Removing code-review outcome storage or publish
- A cap on how many guide chapters one skill chat starts
- Updating authored or other reviews unless the user asks for those in that
  chat
- Fetching diffs, adding a card, or changing a book on reload or tab return
- A separate integrate-and-verify issue

## User stories

- As a reviewer, I want the empty Guide message fully visible, with copy that
  tells me to ask my coding agent, and with no Generate button.
- As a reviewer, I want the Code Review tab hidden while outcome storage and
  publish stay, and a stored review tab to open Guide.
- As a reviewer, I want the card title to open the one saved review, or the
  diff when none is saved, and a book icon as the only guide status.
- As a reviewer, I want an archived card to say Merged or Closed, and its book
  never to turn yellow.
- As a reviewer, I want pull-request cards on the left and auth plus repository
  controls on the right, with a refresh icon instead of Add and paste-JSON.
- As a reviewer, I want reload and returning to the tab to stay responsive and
  only dot the refresh icon when there are new changes to pull.
- As a reviewer, I want that click to persist diffs, including new pull
  requests, and opening a saved review to never call the host or git.
- As a reviewer, I want to search repositories my connected gh and az
  identities can list.
- As a reviewer, I want one skill chat to update every grey or yellow review
  where I am a reviewer, from the saved diff, and to leave the rest unless I
  ask.

## Implementation notes

Empty-guide clip, hiding Code Review, the book icon, and the home columns have
no blockers and ship together. Diff persist waits on the book icon, because
yellow means the guide is behind the saved diff, and on the home columns,
because the download hangs off that icon and dot. Repo search waits only on
the column layout, so a broken gh or az list cannot hold up the reorder. Skill
fan-out waits on persisted diffs, so subagents chapter a snapshot that is
already on disk. The long-running integrator, the final two-axis review, and
one smoke cover integration. There is no separate integrate-and-verify issue.

Until repo search lands, the repository URL field may stay. The home-columns
click runs the existing manual catalog refresh. The persist contract below
replaces that click.

The book in the icon story compares the chaptered guide's source commit with
the catalog commit, the existing outdated rule. The persist contract switches
that comparison to the saved diff.

Hover: grey asks the coding agent to generate a guide, yellow asks the coding
agent to update it, green says the guide matches the saved diff. Archived
cards show a status label from the catalog status: Merged in green for
completed, and Closed in red for closed (GitHub) or abandoned (Azure DevOps).
The word carries the meaning, so the color only reinforces it. The book stays
on archived cards and never turns yellow there, because the refresh click
skips archived pull requests.

Server startup stops awaiting the catalog refresh, so first paint never waits
on the host. On Home mount and when the tab becomes visible, a background
catalog check runs after first paint. That check does not fetch diffs.

### Refresh persists diffs

ReviewRecord on the persistence contract is strict and holds only guide and
outcomes. Diff files today come from chapter files through filesForDiff.
syncDiff on the review service replaces that guide with an unchaptered one.
Do not do that to a chaptered guide.

- Add an optional diff on ReviewRecord: sourceCommit, targetCommit, and files
  (FileChange[]). Old rows without it still validate. No migration.
- ReviewSummary gains an optional diffCommit (the saved diff's sourceCommit),
  so list_reviews tells the dot, the book, and the skill what is saved.
  get_review returns guide, outcomes, and optional diff. The tools contract
  matches.
- The Diff tab reads diff.files when diff is present. Otherwise it keeps
  filesForDiff(guide).
- guide.source.sourceCommit stays the commit the guide was chaptered against.
  Refresh of a chaptered review writes diff only. The book's tag is that
  field, which the provenance contract validates as a SHA. guide.head can be
  a ref name and is not used for the book.
- A new pull request has no review yet. The click creates one unchaptered
  guide whose source commit is that commit, and sets diff to the same files.
  The book is grey.
- The book: grey when guide.unchaptered is set. Otherwise yellow when
  guide.source.sourceCommit differs from diff.sourceCommit, and green when
  they match. A chaptered review with no diff is green until the click
  backfills it; it already dots the icon.
- The dot: an active reviewer or authored catalog pull request with no saved
  review, a review with no diff, or a catalog sourceCommit that differs from
  diffCommit. Skip local ranges, archived, and closed.
- projectHomeOverview stops making cards from catalog rows that have no saved
  review. Those rows only feed the dot.
- The light check is the existing catalog refresh (replaceCatalog). No git
  fetch and no diff write.
- The click fetches every active catalog pull request that Home shows in
  Review requests or Authored by me, plus active ones not on Home yet that
  would join those groups, plus saved reviews with no diff. Skip local
  ranges, archived, and closed. One failure keeps the successes and leaves
  the dot. While the click is working, the arrow animates and the page stays
  usable.
- Open of a saved review returns it and calls neither the provider nor git,
  whatever the catalog says. Only the click runs syncDiff. getPullRequest
  today runs before the skip in syncDiff; open must not reach it.
- upsertReview replaces found.guide only, so diff survives a guide push. Keep
  that, and test it.

### Skill fan-out and queue retirement

Change the guided-pr-review skill Home path. One invocation reads
list_reviews, joins isReviewer from the returned catalog by sync key, and
picks every grey or yellow review in that set. It chapters each one from
get_review's diff with parallel subagents and pushes through upsert_review
with guide.source.sourceCommit set to diff.sourceCommit, so the book turns
green. Authored and other reviews stay as they are unless the user asks for
them in that chat. No checkout. No fetch, because a visible card always has
a saved diff. The app grows no outbound call to Cursor. This scope does not
cap how many guide chapters one chat starts.

Retire the Generate guide action queue: queue_action, wait_for_action, and
complete_action on the MCP handler, the generate service, the action copy
helpers left in the overview domain, and the skill's wait path (Home steps
and the tools list). StoreV1 still parses an existing actions array so old
store files validate.

Repository search replaces the URL field with a search over repos the
connected gh and az identities can list, scoped to the org or project those
CLIs already use. A failed list leaves the column layout in place.

## Testing / seams

**Seams:** empty Guide outcomes; shell tabs and stored-tab fallback; home
overview and cards; catalog refresh, including the startup latch; review open
and diff persist through the review service and the store; configured
repository list; skill Home contract and the MCP tool list.

**Why this seam:** each behavior is already observable at one of those
boundaries. Diff persist has to go through the real review service. The JSON
helper alone cannot see open skip the host.

**What a good test is here:** behavior through that interface. A story runs
only its focused checks. The full suite runs once when a wave lands on the
program branch, and once at the end. Reviews read the diff and the check
output. They do not start the app. One browser smoke, on port 8766, happens
at the end, on the program worktree with its own data directory, including
one pre-epic review without a diff. Port 8765 stays untouched.

**Prior art:**

- Empty-guide cases in outcomes.svelte.test.ts
- Tab cases in shell.svelte.test.ts and the stored-tab fallback in
  review.svelte.test.ts
- overview.test.ts and the card cases in home.svelte.test.ts, including one
  archived card per label (Merged, Closed from closed, Closed from abandoned)
- Home layout and dot cases in home.svelte.test.ts, and
  catalog-refresh.test.ts for the startup latch no longer blocking a request
- catalog-refresh.test.ts, reviews-diff.test.ts, and store.test.ts through
  the real review service, including the open path that returns the saved
  review with no provider or git call, and an upsert that keeps diff.
  overview.test.ts for catalog rows without a saved review
- configured-repositories.test.ts with a fake gh and az list. Live CLI smoke
  may fail auth. Record that separately. Do not block the layout story on it
- skill-contract.test.ts for the Home fan-out, handler.test.ts for the tool
  list, and guides.test.ts and agent-actions.test.ts removed or reduced with
  the code they cover. No model call
- Each wave landing, and the final cut: npm test, npm run test:svelte,
  npm run check:architecture

## Trade-offs (decided)

| Decision | Chose | Rejected | Why |
|---|---|---|---|
| When the diff updates | The refresh click fetches and persists it. Open reads the saved snapshot and never calls the host or git, even when the catalog shows newer commits. | Open waits inside syncDiff | That write also replaces a chaptered guide with an unchaptered diff. |
| Guide status | A book icon. Grey means the guide is unchaptered. Yellow means the chaptered guide is behind the saved diff. Green means they match. Hover says what to do. | No guide, Outdated, Update Diff, Generate guide, and Open saved | Two signals, one per action. Grey and yellow tell the reviewer to ask their coding agent. No button can call a model or open a chat. |
| What yellow tracks | The saved diff is ahead of the guide. The coding agent clears it. | Yellow tracks the remote directly | The skill chapters only saved diffs and could not clear a yellow it has no diff for. |
| What the dot tracks | The remote is ahead of the saved diffs. The click clears it. | Pull-down refresh, an interval timer, or a check that fetches diffs | Reload and tab return only badge new changes. First paint never waits on the host. The check does not add a card or change a book. |
| Book commit | guide.source.sourceCommit, a SHA | guide.head | The provenance contract validates sourceCommit as a SHA. head can be a ref name. |
| Who updates guides | One coding-agent chat runs the skill and fans out parallel subagents over grey or yellow reviews where the user is a reviewer. Each subagent reads the saved diff. No checkout. | The app generates the guide, or a button queues an action | Refresh has no model to call, and there is no Cursor API a localhost button can use to open a chat. The app does not spawn them. |
| Action queue | queue_action, wait_for_action, complete_action, and the skill wait path go away. StoreV1 still parses an existing actions array. | Keep the Generate guide queue | With no button, nothing queues an action. |
| New cards | A card appears only after its diff is saved. Catalog rows with no saved review only feed the dot. The click also pulls authored pull requests and ones not on Home yet. | Show a catalog row before its diff exists | Open must never fetch. |
| Pre-epic reviews | They are not migrated. They count toward the dot. The next click backfills their diff from git. Until then open shows them from the guide's chapter files without fetching. | A migration that stamps chapter files as the pull request diff | Those files are the agent's cut. Omitted files become stubs. Books would turn green on data never read from git. |
| Code Review tab | Hide it. A stored review tab falls back to guide. | Remove outcome storage and publish | The feature stays. The demo surface does not show the tab. |
| Repository control | Search repos the connected gh and az identities can list, scoped to the org or project those CLIs already use. | Header Add and the paste-JSON modal as the way to add a repository | A failed list leaves the column layout in place. |
| Archived book | Merged or Closed from catalog status. The book never turns yellow. | Yellow on an archived card when the guide is behind | The refresh click skips archived pull requests. |

## Open questions

None.

## Success criteria

- The empty Guide message is fully visible, tells the reviewer to ask their
  coding agent to generate a reading-order guide, and has no button.
- The Code Review tab is absent. A stored review tab opens Guide. Outcome
  storage and publish still work.
- The card title opens the one saved review, or the diff when none is saved.
  The card does not offer No guide, Outdated, Update Diff, Generate guide, or
  Open saved.
- The book is grey when the guide is unchaptered, yellow when the chaptered
  guide's source commit differs from the saved diff, and green when they
  match. Hover says what to do. After the icon story and before diffs are
  persisted, that comparison is the catalog commit.
- An archived card says Merged for completed, and Closed for closed or
  abandoned. The book on an archived card never turns yellow.
- Pull-request cards sit on the left. Current auth and repository controls
  sit on the right. The header Add button and the paste-JSON modal are gone.
  Refresh is a circular double-arrow. The arrow animates only while the
  user-started click is in progress, and the page stays usable.
- First paint does not wait on the host. A reload or tab return runs a
  background catalog check only. That check does not fetch diffs, add a card,
  or change a book. When the remote has a pull request or a commit the saved
  diffs do not have, the refresh icon shows a dot. Hover says there are new
  changes to pull. There is no pull-down gesture and no interval timer.
- A catalog row with no saved review is not a card. The click adds a new pull
  request only together with its saved diff. After a click with no failures,
  every Home card that comes from the catalog has a saved diff. One failure
  keeps the successes and leaves the dot.
- Opening a saved review returns the snapshot and calls neither the host nor
  git. Chapters survive refresh. The Diff tab shows the saved snapshot when
  a diff is present. The book turns yellow only from that saved diff. An
  upsert of a guide keeps the saved diff.
- A review saved before this epic, with no diff, counts toward the dot, opens
  from chapter files without fetching, and is not migrated.
- The repository control searches repos the connected identities can list. A
  failed list leaves the column layout in place.
- A skill run updates every grey or yellow review where the user is a
  reviewer, from saved diffs, and sets the guide source commit to the diff
  source commit so the book turns green. A named extra review is included
  only when asked. A second run with nothing behind does not rewrite guides.
  The app still chapters nothing by itself. The MCP tool list no longer
  offers the queue tools.
- Focused checks pass per story. npm test, npm run test:svelte, and
  npm run check:architecture pass when a wave lands and at the final cut.
  One smoke on port 8766 includes a pre-epic review without a diff.

## Out of scope

- Code-review findings, history, or publish behavior beyond hiding the tab
- Host comment or pull-request writes
- Push, or promotion to main
- Checkout, fetch, or an outbound Cursor call during a skill run
- Capping skill fan-out
- Any guide update for a review the user authored, or any other review outside
  the reviewer set, unless that chat asks for it

## References

- Discussion scope: demo home polish plan (demo_home_polish_7abb5a95.plan.md)
- [Documentation index](../../README.md)
