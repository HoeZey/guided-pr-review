# QA Issue Template

Copy the block below into a new file under docs/prds/<feature>/issues/ when
filing a durable issue from a QA session. Use domain language from that
feature's PRD and docs/README.md.

---

```markdown
---
status: todo
blocked_by: []
blocks: []
---

# <user-observable, present-tense — readable on its own>

**Type:** Story

**From PRD:** [<feature>](../)

**What's happening:**
<one paragraph in domain language — describe what the user sees, not what you guess is broken>

**What should happen:**
<one paragraph — the expected behavior. Reference PRD / spec section if relevant.>

**Repro:**
1. <step>
2. <step>
3. <step>

**Evidence:**
- <screenshot / log line / file:line>
- <traceback excerpt if any>

**Suspected area:** <path> *(optional — only if confident; don't guess)*

**Failing test sketch:**
<one-liner: what the test would assert, using the public interface>

**Domain terms used:**
- <term from the feature PRD>
- <term from the feature PRD>

**Severity:** blocker / high / medium / low
```

---

## Field guidance

**Title.** Must be understandable without reading the body. "Pipeline page"
is bad. "Pipeline page crashes when revision has no location" is good.

**What's happening vs What should happen.** Two paragraphs. Resist the urge
to merge them — the split forces clarity on the gap.

**Repro.** Exact, copy-pasteable steps. If you can't repro, the issue isn't
durable — go back to QA and clarify.

**Evidence.** A repro without evidence is hearsay. A log line or screenshot
anchors it in reality.

**Suspected area.** Optional and *only* if you traced it. Bad suspicions
waste the next person's time more than no suspicion at all.

**Failing test sketch.** This is the bridge to tdd. Even a one-line
pseudo-assertion makes the next step obvious: the test that would catch
this → write it → red → fix → green.

**Domain terms.** If a term isn't in the PRD or docs/README.md, either add
it to the PRD (one-line definition) or use a term that is. Drifting
vocabulary is how issues stop being durable. Do not create CONTEXT.md.

**Severity heuristic.**
- **blocker** — production down, data loss, or fully blocks a critical user
  journey.
- **high** — degrades a critical journey but workaround exists; or a
  non-critical journey is fully broken.
- **medium** — visible bug, workaround easy, no journey blocked.
- **low** — cosmetic, edge case, or quality-of-life.
