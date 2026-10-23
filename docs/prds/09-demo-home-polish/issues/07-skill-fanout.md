---
status: done
blocked_by:
  - 05-persist-diffs
blocks: []
---

# Fan out guide updates and retire the action queue

**Type:** Story

**From PRD:** [09 Demo home polish](../)

**Seam(s):** skill Home contract and the MCP tool list

**What it delivers:** One skill chat updates every grey or yellow review
where the user is a reviewer, from the saved diff, and leaves the rest
unless asked. The Generate guide action queue is gone. The app still
chapters nothing by itself.

**Scope (in):**

- Change the guided-pr-review skill Home path. One invocation reads
  list_reviews, joins isReviewer from the returned catalog by sync key, and
  picks every grey or yellow review in that set.
- It chapters each one from get_review's diff with parallel subagents and
  pushes through upsert_review with guide.source.sourceCommit set to
  diff.sourceCommit, so the book turns green.
- Authored and other reviews stay as they are unless the user asks for them
  in that chat.
- No checkout. No fetch, because a visible card always has a saved diff.
  The app grows no outbound call to Cursor. This scope does not cap how
  many guide chapters one chat starts.
- Retire the Generate guide action queue: queue_action, wait_for_action,
  and complete_action, the generate service, the action copy helpers left
  in the overview domain, and the skill's wait path (Home steps and the
  tools list).
- StoreV1 still parses an existing actions array so old store files
  validate.

**Scope (out):**

- The app spawning subagents or calling a model
- Checkout, fetch, or an outbound Cursor call
- A cap on fan-out
- Updating a review the user authored, or any review outside the reviewer
  set, unless that chat asks for it
- Migrating old store files off the actions array

**Touches:** SKILL.md at the repo root, Home path and tools list;
queue_action, wait_for_action, and complete_action in
src/lib/server/mcp/handler.ts; the generate service in
src/lib/server/services/guides.ts; action copy helpers left in
src/lib/shared/domain/overview.ts. StoreV1 still parses an existing actions
array. Production path: the tool list in src/lib/server/mcp/handler.ts.

**Acceptance criteria:**

- [ ] A skill run updates every grey or yellow review where the user is a
  reviewer, from saved diffs, and sets the guide source commit to the diff
  source commit so the book turns green.
- [ ] A named extra review is included only when asked.
- [ ] A second run with nothing behind does not rewrite guides.
- [ ] The app still chapters nothing by itself.
- [ ] The MCP tool list no longer offers queue_action, wait_for_action, or
  complete_action.
- [ ] StoreV1 still parses an existing actions array.
- [ ] The skill run does no checkout and no fetch.

**Blocked by:** 05 Persist diffs on refresh

**Blocks:** none

**Parallel-eligible:** no

**Checks:** skill-contract.test.ts for the Home fan-out, handler.test.ts
for the tool list, and guides.test.ts and agent-actions.test.ts removed or
reduced with the code they cover. No model call.
