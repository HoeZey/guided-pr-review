# Guided PR review

Localhost Linear-style reading-order review. Semantic chapters, inlined hunks,
several PRs in one process, HTTP MCP for the agent.

Private repo. Not a findings review.

## Run

```bash
npm install
npm test
npm run dev
```

UI: http://localhost:8765/

MCP: POST JSON-RPC to http://localhost:8765/mcp

Point Cursor at that MCP URL (Streamable HTTP / URL server — see current
Cursor mcp.json docs). The skill starts `npm run dev` if nothing is listening.

## Contracts

Zod in src/lib/shared/contracts is the source of truth (Guide v1 + Store v1 +
tool I/O). Persistence: data/reviews.json (gitignored).

Docs: [docs/](docs/)
