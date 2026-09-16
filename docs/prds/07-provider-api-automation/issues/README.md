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

## Reconciled against develop

Pinned 07 base: 01d2314e6f4a050a2064803348f102c476cf94e2 (06 implemented).
PRD behavior unchanged. Issue Touches fields now name HEAD symbols:

- src/lib/server/auth/ports.ts: CredentialSource.getAccessToken,
  CredentialStatus (connected, command-missing, login-required, expired,
  denied-scope, timeout, malformed), CredentialIdentity, CredentialResult.
  CLI runner and connection service do not exist yet; 07-01 adds them.
- src/lib/server/providers/ports.ts: GitProviderKind, ProviderRepositoryReader,
  ProviderPullRequestReader, ProviderRepositoryIdentity,
  ProviderPullRequestMetadata. GitHostAdapter.fetchOpen remains the waiting-agent
  Open/Update path until 07-07/07-08.
- src/lib/server/git/ports.ts: GitCacheIdentity, ManagedGitCache, GitDiff.
  Implementations land in 07-05.
- src/lib/server/repositories/ports.ts: ConfiguredRepositoryPort /
  ConfiguredRepositoryRecord (JSON adapter not implemented), CatalogRepository,
  ReviewRepository, ActionRepository, AppRepositories.
- src/lib/server/services/app.ts createAppServices: reviews, catalog, actions,
  outcomes, guides. runtime.ts wires jsonRepositories.
- Catalog HTTP: src/routes/api/catalog/+server.ts and
  src/lib/server/services/catalog.ts (replace only).
- Home still queues open/update-diff/refresh through queueHomeAction to
  src/routes/api/actions. Generate Guide: queueGenerateGuide in
  src/lib/client/state/review.svelte.ts.
- Home UI: src/lib/client/state/home.svelte.ts,
  src/lib/client/components/home/. Review UI: src/lib/client/state/review.svelte.ts.
- No CommandRunner type, no ADO/GitHub REST adapters, no live comment mutation.

## Status

- [01 Connect one ADO and one GitHub CLI identity](01-connect-cli-identities.md) — done
- [02 Read repositories and pull requests through ADO REST](02-read-ado-pull-requests.md) — done
- [03 Read repositories and pull requests through GitHub REST](03-read-github-pull-requests.md) — done
- [04 Manage explicit configured repositories](04-manage-repositories.md) — done
- [05 Fetch exact commits through managed bare caches](05-managed-git-caches.md) — done
- [06 Refresh configured PR catalogs](06-refresh-catalogs.md) — done
- [07 Open and update Diff without an agent](07-open-and-update-diff.md) — done
- [08 Retire deterministic agent actions](08-retire-agent-actions.md) — done
- [09 Integrate and verify provider automation](09-integrate-provider-automation.md) — todo
