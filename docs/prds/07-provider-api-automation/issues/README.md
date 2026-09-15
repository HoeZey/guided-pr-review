# Provider API automation issues

From [07 Provider API automation](../).

## Delivery graph

```text
06 App structure integration
└── 01 Connect CLI identities
    ├── 02 Read ADO repositories and PRs ─┐
    ├── 03 Read GitHub repositories/PRs ─┼── 04 Manage repositories ── 06 Refresh catalogs
    └── 05 Managed bare git caches ──────┘                         └── 07 Open/update Diff
                                                                          └── 08 Retire agent actions
02,03,04,05,06,07,08 ───────────────────────────────────────────────────────── 09 Integrate
```

Issues 02, 03, and 05 may run in parallel after 01. Issue 04 needs provider
repository validation from 02 and 03. Issue 06 needs configured repositories.
Issue 07 needs provider metadata plus managed caches.

Before any 07 implementation branch starts, the coordinator reconciles target
paths and port names against the actual 06 develop head. That may update
technical references only, not product behavior. Issue 09 verifies this
happened.

## Status

- [01 Connect one ADO and one GitHub CLI identity](01-connect-cli-identities.md) — todo
- [02 Read repositories and pull requests through ADO REST](02-read-ado-pull-requests.md) — todo
- [03 Read repositories and pull requests through GitHub REST](03-read-github-pull-requests.md) — todo
- [04 Manage explicit configured repositories](04-manage-repositories.md) — todo
- [05 Fetch exact commits through managed bare caches](05-managed-git-caches.md) — todo
- [06 Refresh configured PR catalogs](06-refresh-catalogs.md) — todo
- [07 Open and update Diff without an agent](07-open-and-update-diff.md) — todo
- [08 Retire deterministic agent actions](08-retire-agent-actions.md) — todo
- [09 Integrate and verify provider automation](09-integrate-provider-automation.md) — todo
