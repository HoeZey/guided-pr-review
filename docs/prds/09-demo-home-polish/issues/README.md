# Demo home polish issues

From [09 Demo home polish](../).

## Delivery graph

```text
01 Fix the empty Guide tab
02 Hide the Code Review tab
03 One open state and a book icon ────── 05 Persist diffs on refresh ── 07 Skill fan-out
04 Home columns and a refresh dot ──┬─── 05
                                    └─── 06 Searchable repo dropdown
```

Wave 1 has no blockers: 01, 02, 03, and 04 run together. 05 is blocked by 03
and 04. 06 is blocked by 04 only, so a broken gh or az list cannot hold up
the reorder or the diff persist. 05 and 06 may run in parallel once their
blockers have landed. 07 is blocked by 05, so subagents chapter a snapshot
already on disk.

There is no integrate-and-verify issue. The long-running integrator, the
final two-axis review, and one smoke cover integration.

## Checks

A story runs only the focused checks named in that issue. The full suite
runs once when a wave lands on the program branch, and once at the end:
npm test, npm run test:svelte, npm run check:architecture. Reviews read the
diff and the check output. They do not start the app.

One browser smoke at the end, on the program worktree, port 8766, with its
own data directory, including one pre-epic review without a diff. Port 8765
stays untouched.

## Status

- [01 Fix the empty Guide tab](01-fix-empty-guide.md) — todo
- [02 Hide the Code Review tab](02-hide-code-review.md) — todo
- [03 One open state and a book icon](03-book-icon.md) — todo
- [04 Home columns and a refresh icon with a new-changes dot](04-home-columns.md) — todo
- [05 Pull list and diffs together on refresh](05-persist-diffs.md) — todo
- [06 Search repositories the connected identities can list](06-repo-search.md) — todo
- [07 Fan out guide updates and retire the action queue](07-skill-fanout.md) — todo
