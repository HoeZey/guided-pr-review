# Grok coordinator kickoff

Copy this message into the implementation chat:

```text
Coordinate overnight implementation of epics 06, 07, and 08 in:

/Users/joselee/ml6/bbh/braid-connection-designer/.cursor/skills/guided-pr-review

Use Grok 4.6 xhigh for implementation and integrator subagents when available.
The root checkout intentionally stays on stable main and may not contain these
documents. Do not switch it. First create a detached read-only coordinator
worktree at .cursor/worktrees/overnight-coordinator from local develop (or
reuse it only when it is clean and exactly at develop). Treat that worktree as
the coordinator path.

From the coordinator worktree, read:

1. docs/README.md
2. docs/EXECUTION.md
3. docs/prds/06-app-structure/README.md
4. docs/prds/06-app-structure/issues/README.md

Then execute docs/EXECUTION.md exactly. Continue through 06, 07, and 08 while
their gates permit. Do not redesign PRDs.

Rules:
- develop is delivery base; main is stable and must stay untouched.
- Never switch the user’s main checkout.
- One repo-local worktree and one implementation subagent per normal story.
  Integration issues run in the epic integration worktree.
- Use issue blocked_by graphs to launch parallel stories.
- Fresh independent code-review per story; one remediation and one fresh
  second review maximum.
- Review subagents report in issue docs only. They must not publish outcomes to
  localhost or call port 8765.
- One dedicated integrator subagent and integration branch per epic.
- Integrate one accepted commit per story, review whole epic, then merge to
  develop.
- Do not promote main, push, create remote PRs, or delete branches/worktrees
  without explicit authorization.
- Do not stop or replace localhost port 8765. Use isolated data and ports
  8766+.
- Do not commit .cursor, .handoff, .ignore, data, graft, or worktrees.
- Use graft first for source discovery.
- Keep coordinator context small; persist status, SHAs, checks, and reviews in
  issue/PRD docs.
- ADO/GitHub CLI sessions may provide tokens only. Product operations use
  direct provider REST.
- No live comment mutation is authorized. Complete fixture/fake-based work and
  mark live checks pending unless I explicitly name authorized test PRs.
- feature/post-ado-comments at 90a7111 is read-only reference. Never rebase,
  merge, or wholesale cherry-pick it.

Start by confirming current develop SHA, checking worktree setup instructions,
and claiming 06-01. Keep moving through every unblocked frontier overnight.
If a hard stop occurs, leave exact base/head SHAs, branch/worktree, checks,
finding, and next action.
```
