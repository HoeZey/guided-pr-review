# Comment rework issues

From [14 Comment rework](../).

## Delivery graph

```text
01 Turn comments back on and show loading
├── 02 Show progress and the new thread when a comment posts
├── 03 Show progress when editing and deleting
├── 04 List every thread in Discussion with a jump to Diff
├── 07 Load new commits on open and offer Refresh while reading
└── 08 Block Guide line comments while the Guide is behind the Diff
05 Post Azure DevOps line comments on reviews saved without change tracking
06 Mark a thread Outdated only when its line changed
01-08 ───────────────────────────────── 09 Integrate and verify on live pull requests
```

01, 05, and 06 have no blockers and can start together. 02, 03, 04, 07, and
08 start after 01 and can run in parallel. 09 waits for all of them.

06 does not depend on the live Azure DevOps read. 09 records the Azure DevOps
changed-line fields on pull request 100. A gap there becomes a follow-up
story, not an epic blocker.

## Checks

npm test, npm run test:svelte, npm run check:architecture, svelte-check, and
a production build run at 09.

## Status

- [x] [01 Turn comments back on and show loading](01-turn-comments-on.md) — done
- [x] [02 Show progress and the new thread when a comment posts](02-show-post-progress.md) — done
- [x] [03 Show progress when editing and deleting](03-show-edit-delete-progress.md) — done
- [x] [04 List every thread in Discussion with a jump to Diff](04-discussion-every-thread.md) — done
- [x] [05 Post Azure DevOps line comments on reviews saved without change tracking](05-ado-missing-tracking.md) — done
- [x] [06 Mark a thread Outdated only when its line changed](06-outdated-when-line-changed.md) — done
- [x] [07 Load new commits on open and offer Refresh while reading](07-load-new-commits.md) — done
- [ ] [08 Block Guide line comments while the Guide is behind the Diff](08-block-guide-behind-diff.md) — todo
- [ ] [09 Integrate and verify comments on live pull requests](09-integrate-and-verify.md) — todo
