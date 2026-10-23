# Guided PR review

Localhost Linear-style reading-order review. Semantic chapters, inlined hunks,
several PRs in one process, HTTP MCP for the agent.

Private repo. Not a findings review.

## Install

You need git access to the private repo, Node.js, and npm. This installs the
main branch.

```bash
npm install -g --include=dev git+ssh://git@github.com/HoeZey/guided-pr-review.git
```

npm installs the app and links that install as the Cursor skill. Run the same
command again to update.

Start the app, which also serves the MCP:

```bash
pr-guide start
```

Stop it when you are done:

```bash
pr-guide stop
```

If port 8765 is already open, start exits. The UI is http://localhost:8765/.
The skill calls the MCP with curl and runs pr-guide start when the port is
closed.

## Contracts

Zod in src/lib/shared/contracts is the source of truth (Guide v1 + Store v1 +
tool I/O). Persistence: data/reviews.json (gitignored).

Docs: [docs/](docs/)
