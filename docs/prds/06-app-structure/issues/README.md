# App structure issues

From [06 App structure](../).

## Delivery graph

```text
01 Boundaries and baseline
└── 02 Shared contracts and domain
    ├── 03 Repositories and JSON adapter ── 04 Services and thin adapters
    └── 05 Browser client split ────────────┘
                                             └── 06 Integrate and verify
```

Issues 03 and 05 may run in parallel after 02. Issue 04 starts when repository
operations from 03 are stable; its route reconciliation may overlap with 05
only on the epic integration branch.

## Status

- [01 Lock architecture boundaries and regression baseline](01-lock-architecture-boundaries.md) — todo
- [02 Split shared contracts and pure domain rules](02-split-shared-contracts-and-domain.md) — todo
- [03 Introduce app-shaped repositories and JSON adapter](03-introduce-repositories.md) — todo
- [04 Introduce feature services and thin adapters](04-introduce-services-and-adapters.md) — todo
- [05 Split the browser client by responsibility](05-split-browser-client.md) — todo
- [06 Integrate and verify app structure](06-integrate-app-structure.md) — todo
