# App structure issues

From [06 App structure](../).

## Delivery graph

```text
01 SvelteKit migration baseline
└── 02 Shared contracts and domain
    ├── 03 Repositories ── 04 Services and ports ── 05 SvelteKit HTTP/MCP/SSR
    └── 06 Svelte review shell/state ───────────────┘
                         05 + 06
                            ├── 07 SSR Home
                            ├── 08 Code-view primitives ─┬── 09 Guide components
                            │                           └── 10 Diff components
                            └── 11 Code Review and Guide handoff
                                 07 + 09 + 10 + 11
                                          └── 12 Cross-view interaction parity
                                                └── 13 Integrate/remove Astro
```

Issues 03 and 06 may run in parallel after 02. Issue 04 follows repository
operations while the Svelte shell continues independently. Issues 07, 08, and
11 may run in parallel from the same accepted 05+06 integration head. Issues
09 and 10 run in parallel after shared code-view primitives. Issue 12
reconciles browser-wide behavior only after those views exist.

## Status

- [01 Lock the SvelteKit migration and regression baseline](01-lock-sveltekit-migration.md) — done
- [02 Split shared contracts and pure domain rules](02-split-shared-contracts-and-domain.md) — done
- [03 Introduce app-shaped repositories and JSON adapter](03-introduce-repositories.md) — done
- [04 Introduce feature services and provider ports](04-introduce-services-and-ports.md) — done
- [05 Preserve HTTP, MCP, and SSR data in SvelteKit](05-preserve-http-mcp-and-ssr.md) — done
- [06 Build the Svelte review shell and shared state](06-build-svelte-review-shell.md) — done
- [07 Render Home through SvelteKit SSR](07-render-ssr-home.md) — done
- [08 Build shared Svelte code-view primitives](08-build-code-view-primitives.md) — done
- [09 Port Guide to Svelte components](09-port-guide-view.md) — todo
- [10 Port Diff to Svelte components](10-port-diff-view.md) — todo
- [11 Port Code Review and Guide handoff](11-port-outcomes-and-guide-handoff.md) — todo
- [12 Restore cross-view interaction parity](12-restore-interaction-parity.md) — todo
- [13 Integrate the SvelteKit cutover and remove Astro](13-integrate-sveltekit-cutover.md) — todo
