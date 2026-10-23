---
name: diagnosing-bugs
description: >-
  Phase-gated diagnosis for hard bugs and performance regressions: build a
  loop that goes red on this symptom, minimise, hypothesise, instrument, then
  fix with a regression test. Use when the user says "diagnose", "debug this",
  or qa hands off a bug with no tight repro yet.
---

# Diagnosing Bugs

Hard-bug hunter. Skip a phase only when you can say why.

Not `qa` (that files the ticket). Not `implement` (that builds a decided Story). Not `tdd` (that is the loop once a seam exists). This skill **finds the cause**. After a correct seam exists, it drives `tdd` for the regression.

Read the relevant docs/prds/<feature>/README.md and nearby ADRs first. Do not expect CONTEXT.md.

**Redact secrets** in every command and log you show (`***`). Prefer env vars over pasted credentials.

## Where it sits

```
qa ── clear bug, seam obvious ──► implement / tdd
  └── hard / no red loop yet ──► diagnosing-bugs
user says "debug this" ─────────► diagnosing-bugs
diagnosing-bugs ──► tdd (regression) ──► code-review
```

No red-capable loop → no hypotheses. Staring at code to invent a theory is the failure this skill exists to prevent.

## Phase 1 — Build a feedback loop

**This is the skill.** One command you have **already run**, that goes **red on the user's exact symptom**.

Try, in order: failing test at a seam that reaches the bug → HTTP/CLI script → captured-trace replay → throwaway harness → fuzz/bisect/diff-old-vs-new. Last resort: a structured human-in-the-loop script, not "click around."

Tighten: faster, sharper assert, more deterministic. Flakes: raise the reproduction *rate* until it is debuggable.

Done when the command is red-capable, deterministic (or high-rate), fast (seconds), and you can run it unattended. Show invocation + redacted output. Then Phase 2.

Cannot build a loop: stop. List what you tried. Ask for env access, a redacted artifact, or instrumentation permission. Do **not** hypothesise anyway.

## Phase 2 — Reproduce + minimise

Confirm the loop shows **their** failure, not a nearby one. Shrink the repro one cut at a time; keep only load-bearing pieces. Stop when removing any remaining piece makes it green.

## Phase 3 — Hypothesise

Write **3–5 ranked, falsifiable** hypotheses *before* testing any:

> If \<cause\>, then \<probe\> makes it disappear / worse.

Show the list. Don't block if they are AFK.

## Phase 4 — Instrument

One variable per probe, mapped to a prediction. Debugger/REPL first; tagged logs (`[DEBUG-a4f2]`) second. Never log-everything. Perf: measure a baseline, then bisect — don't printf-time.

## Phase 5 — Fix + regression

If a **correct seam** exists (the real call-site pattern, not a shallow stand-in): failing test first (`tdd` red), then fix, then green, then re-run the **original** Phase 1 loop.

No correct seam: that is the finding. Don't fake a unit test that can't catch the bug. Note it; architecture is blocking lock-down.

## Phase 6 — Cleanup

- Phase 1 loop green on the original scenario
- Regression test green, or missing seam documented
- All `[DEBUG-…]` logs gone
- Throwaway harnesses deleted
- Winning hypothesis in the commit / PR message

No auto-commit unless asked.

## Lineage

Compressed from [Matt Pocock's diagnosing-bugs](https://github.com/mattpocock/skills). Regression uses local Beck `tdd`. No plugin HITL template.
