# Guide quality issues

From [10 Guide quality](../).

## Delivery graph

```text
01 Capture the baseline ─────────────────────────────┐
02 Save intent with the diff ── 05 App opens diffs ──┼── 06 Rewrite the skill ── 07 Compare guides
03 Numbered read_diff ── 04 Chapter by reference ────┘
```

Wave 1 has no blockers: 01, 02, and 03 run together. 04 waits on 03 for
the shared numbering. 05 waits on 02 for the intent shape. 06 waits on 04
and 05 for the tools it describes, and on 01 so the baseline is captured
with the current skill before the rewrite lands. 07 runs last.

01 is a run against the local instance, not a code change. It must finish
before 06 merges.

## Checks

A story runs only the focused checks named in that issue. The full suite
runs once when a wave lands on the epic branch, and once at the end:
npm test, npm run test:svelte, npm run check:architecture. No test calls a
model.

## Status

- [01 Capture the baseline guides for the five test PRs](01-capture-baseline.md) — todo
- [02 Save the PR description and commit messages with the diff](02-capture-intent.md) — todo
- [03 Read a saved diff with numbered changed lines](03-read-numbered-diff.md) — todo
- [04 Chapter a saved diff by line references](04-chapter-by-reference.md) — todo
- [05 The app opens diffs for named PRs and local ranges](05-app-opens-diffs.md) — todo
- [06 Rewrite the skill around read_diff and chapter_review](06-rewrite-skill.md) — todo
- [07 Compare new guides against the baseline](07-compare-guides.md) — todo
