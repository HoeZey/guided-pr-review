# Pull request overview issues

From [Pull request overview](../).

## Delivery graph

```text
Git-host 01 Open a named ADO PR ───────────────┐
                                              ├── 03 Open selected PR as Diff ── 07 Generate guide on request
01 Open saved reviews from Home ── 02 Browse current-repo PRs ──┘
01 also ── 08 Show Home range as target into source (parallel with 02)
                                                                  └── 04 Refresh outdated and closed PRs
```

Git-host 01 and Overview 01 were parallel-eligible. After Overview 03, issues
04 and 07 ran in parallel. Overview 08 only needed 01 and ran beside 02.
Issues 05 and 06 moved to [07 Provider API
automation](../../../07-provider-api-automation/).

## Status

- [01 Open saved reviews from Home](01-open-saved-reviews-from-home.md) — done
- [02 Browse current-repository PRs by relationship](02-browse-current-repository-prs.md) — done
- [03 Open the selected PR as Diff](03-open-selected-pr-as-diff.md) — done
- [04 Refresh outdated and closed PRs](04-refresh-outdated-and-closed-prs.md) — done
- [05 Add another repository to the overview](05-add-another-repository.md) — cancelled; superseded by 07
- [06 Open a PR without a local clone](06-generate-without-local-clone.md) — cancelled; superseded by 07
- [07 Generate the reading-order guide on request](07-generate-guide-on-request.md) — done
- [08 Show Home range as target into source](08-show-home-range-as-target-into-source.md) — done
