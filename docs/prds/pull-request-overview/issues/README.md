# Pull request overview issues

From [Pull request overview](../).

## Delivery graph

```text
Git-host 01 Open a named ADO PR ───────────────┐
                                              ├── 03 Open selected PR as Diff ── 07 Generate guide on request
01 Open saved reviews from Home ── 02 Browse current-repo PRs ──┘
                                                                  ├── 04 Refresh outdated and closed PRs
                                                                  └── 05 Add another repository ── 06 Open without a local clone
```

Git-host 01 and Overview 01 are parallel-eligible. After Overview 03, issues
04, 05, and 07 can run in parallel.

## Status

- [01 Open saved reviews from Home](01-open-saved-reviews-from-home.md) — done
- [02 Browse current-repository PRs by relationship](02-browse-current-repository-prs.md) — todo
- [03 Open the selected PR as Diff](03-open-selected-pr-as-diff.md) — todo
- [04 Refresh outdated and closed PRs](04-refresh-outdated-and-closed-prs.md) — todo
- [05 Add another repository to the overview](05-add-another-repository.md) — todo
- [06 Open a PR without a local clone](06-generate-without-local-clone.md) — todo
- [07 Generate the reading-order guide on request](07-generate-guide-on-request.md) — todo
