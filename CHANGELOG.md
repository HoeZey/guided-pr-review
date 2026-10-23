# Changelog

## 0.1.1

The global git install keeps the app, its dependencies, and the skill links.
pr-guide stop stops the server. The skill calls the MCP with curl, so Cursor
does not need an MCP setup step. The production bundle command is npm run
build:app, because a script named build makes that install use npm's
temporary clone.

## 0.1.0

First demo release.
