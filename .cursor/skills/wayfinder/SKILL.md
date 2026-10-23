---
name: wayfinder
description: >-
  Chart a large, foggy effort as a map of decision tickets under
  docs/prds/<feature>/, then resolve them one at a time until the route is
  clear. Use when the user says wayfinder, the work will not fit one grilling
  session, or a feature's path is still foggy. Plans; does not implement.
disable-model-invocation: true
---

# Wayfinder

Multi-session planning. Name the destination, chart the questions that block
the way, settle them one at a time. **Plan, don't do.**

Session count, not project size: if one grill-me sitting can settle it,
skip this skill.

This repo has no Jira. The map is markdown. Do not call Atlassian MCP.

## Hard rules

1. **One feature folder = one map.** Not "V1". A sprawling destination goes
   stale. Folder: docs/prds/<feature>/.
2. **Decision tickets are questions**, never "build the X". If a ticket
   reads as a sprint story, it belongs in to-issues after the map clears.
3. **Do not mix issue types.** Map = MAP.md. Children = files under
   decisions/. Delivery Stories live in issues/ only after write-a-prd.
   Never dump the map into the delivery board.
4. **One ticket per session** (research may run in parallel). Charting does
   not resolve tickets.
5. **No production code.** task unblocks a decision (access, sample data).
   It is not a slice of the build.
6. **No files until the quiz is approved.** Draft in .handoff/<feature>-map.md
   → quiz → then write MAP.md and decisions/.
7. When the map is clear, **hand off to write-a-prd**. Do not skip the spec.
   Do not call to-issues on the map itself. Do not call tdd.

## Ticket types

Every child is HITL (needs the user) or AFK (agent alone).

| Type | Mode | When | Resolve with |
|---|---|---|---|
| grilling | HITL | Default. Talking can settle it. | grill-me or grill-me-with-docs |
| research | AFK | A fact outside the repo blocks a decision. | research |
| prototype | HITL | Ungrillable: how it should look / feel / behave. | prototype |
| task | either | Manual unblock only (credentials, fixture data). | Checklist or agent; **not** product code |

## Map body

Write docs/prds/<feature>/MAP.md:

```markdown
# Map: <feature>

## Destination
<one or two lines — what "done planning" looks like, usually a spec colleagues can review>

## Notes
<domain; skills every session should consult; standing preferences>

## Decisions so far
- [<closed ticket title>](decisions/<slug>.md): <one-line gist>

## Not yet specified
<fog — questions you can tell are coming but cannot phrase sharply yet>

## Out of scope
<ruled out of this feature; never graduates>
```

The map is an **index**, not a store. The answer lives on the ticket. The
map gists and links.

## Decision ticket body

Write docs/prds/<feature>/decisions/<slug>.md:

```markdown
## Question
<the decision this ticket resolves — one session>

## Type
grilling | research | prototype | task

## Blocked by
<none | other decision titles>

## Answer
*(empty until resolved)*
```

**Fog vs ticket:** ticket when the question is already sharp (even if
blocked). Fog when you cannot phrase it yet. Do not pre-slice fog into fake
tickets.

## Modes

### Chart the map (once)

1. Grill the **destination** first (grill-me-with-docs; ground in
   docs/README.md and signed PRDs). Scope is the destination.
2. Breadth-first grill: fan out across the space. If this surfaces **no
   fog** and the whole path fits one session, stop — you don't need a map.
3. Draft the map + only the tickets you can specify now. Leave the rest in
   **Not yet specified**.
4. Quiz: destination, ticket list (title / type / blocked-by), fog vs
   out-of-scope. Iterate until approved.
5. Publish markdown: MAP.md plus decisions/*.md with blocked-by named in
   each body. Research tickets may start in the background after publish.
6. Stop. Do not resolve a grilling ticket in the charting session.

### Work through the map

1. Load the map at low resolution (not every ticket body).
2. Take the first **frontier** ticket (open, unblocked, unclaimed), or the
   one the user named.
3. Resolve with the matching skill. One question per grill turn (see
   grill-me).
4. Record the answer on the ticket, mark it resolved, append one gist line
   to **Decisions so far**.
5. Graduate fog that is now a sharp question into new tickets (quiz, then
   write). If a ticket sits past the destination, close it into **Out of
   scope**.
6. Stop. Next session takes the next frontier ticket.

When no tickets remain and fog is empty: tell the user the map is clear and
the next skill is write-a-prd.

## Failure modes

- Agent writes product code because a task looked like a build slice →
  stop, retitle as a question or move it to to-issues later.
- Agent answers its own grilling questions → HITL is broken; wait for the
  user.
- Destination is "the whole product" → shrink to one feature before
  charting.

## Lineage

Compressed from [Matt Pocock's wayfinder](https://github.com/mattpocock/skills).
Markdown under docs/prds/ instead of a plugin tracker. One-question grilling
(BONDage), not frontier rounds.
