# Handoff: run efficiency

## Goal

After the epic 09 long-running run is finished, recompute the same efficiency numbers and compare them to the epics 06–08 overnight baseline below.

## Decisions made

- Compare code lines changed per million input and output tokens. Higher is better. Baseline is 1,096.
- Input and output stay separate from cache. Cache read was 408 million of 442 million tokens on the baseline, so an all-in tokens-per-line figure mostly measures how long context stayed hot.
- The diff starts at the commit where the plan was already on disk, not at the commit before the plan. The 06–08 roadmap and reslice were docs, committed before the token window, and were not produced by those usage events.
- Count every usage event on the coordinator chats and their subagents, including events after the done commit. The baseline window ran about six hours past the done commit. Dropping that tail would make the next run look worse for a different reason.
- Local chat bubbles store token counts as zero. Use Cursor account usage events, not the transcript and not bubble tokenCount.

## Baseline (epics 06, 07, and 08)

Left: e58839e61237e1bac403a607abb0b964601e2ff7 (Reslice phase 06 for SvelteKit migration).
Right: f888b911016cde75206b82ee95a614180818181f (Mark 08 implemented after accepted integration-review).
Usage window: 2026-09-15 22:43 UTC through 2026-09-16 21:43 UTC. 258 events after dedupe.

| | |
|---|---:|
| Input tokens | 29,613,876 |
| Output tokens | 3,394,847 |
| Cache read tokens | 407,868,110 |
| Cache write tokens | 1,246,350 |
| Input + output | 33,008,723 |
| All tokens | 442,123,183 |
| Files | 255 |
| Lines added | 31,851 |
| Lines deleted | 8,331 |
| Churn | 40,182 |
| Code churn | 36,182 |
| Docs churn | 3,996 |
| Recorded cost | 33,809.31 cents |

Yield: 1,096 code lines per million input and output tokens.
Input and output tokens per churned line (all files): 821. Lower is better.
Context tax: 12.4 cache-read tokens per input and output token. Lower is better.

Models: cursor-grok-4.6-xhigh 197 events, cursor-grok-4.6-high-fast 39, gpt-5.6-sol-xhigh 19, gpt-5.6-sol-medium 3.

## Current run

Epic 09 demo home polish. Left side, already pinned: 6f918b600d77987cc117843f08d8096f49e7e32a (Add 09 demo home polish PRD and issues). Story branches were created from that commit. Right side: the commit that marks 09 implemented. Fill the same table when that commit exists. Do not include later unrelated commits.

## How to calculate

1. Right SHA is the commit that marks the program implemented. Left SHA for this run is the pinned SHA above. Confirm it is still the parent of the story work. Diff that range only.

2. From git diff --numstat left right, skip a line whose counts are not integers (binary). Docs: path starts with docs/ or ends in .md. Code: everything else under src/, plus files whose extension is .ts, .js, .svelte, .css, .json, .mjs, or .cjs. A docs path is not also code. Churn is additions plus deletions. Code churn uses only the code rows.

3. Coordinator chats are the non-subagent composers for this run. Add every subagentComposerIds value on their composerData. Also match a conversation id with a leading task- prefix removed.

4. Read usage with GetFilteredUsageEvents on https://api2.cursor.sh/aiserver.v1.DashboardService/GetFilteredUsageEvents for the logged-in Cursor account. Page until totalUsageEventsCount is consumed. Keep events whose conversationId is in the id set. Dedupe on timestamp, conversationId, inputTokens, and outputTokens.

5. Sum tokenUsage inputTokens, outputTokens, cacheReadTokens, and cacheWriteTokens. Treat a missing field as zero. Do not add cache into input.

6. Compute:

```text
yield = code_churn / ((input_tokens + output_tokens) / 1000000)
io_per_line = (input_tokens + output_tokens) / churn
context_tax = cache_read_tokens / (input_tokens + output_tokens)
```

7. Report yield, the two companions, and the raw token and diff rows next to the baseline. Say whether yield went up.

## Open questions (intentionally deferred)

- Whether events after the done commit should be split out later. They stay in for now so both runs use one rule.

## Domain language additions

- Yield — code lines changed per million input and output tokens. Higher is better.
- Churn — lines added plus lines deleted.
- Context tax — cache-read tokens divided by input plus output tokens. Lower is better.

## Next skill

None. The next agent fills Current run after epic 09 is marked implemented, using the steps above.

## Watch out

- Do not start the diff at the commit before the plan. That pulls in plan docs the usage events did not write and makes yield look higher.
- Do not headline all tokens divided by lines. On the baseline that was about 11,003 and it is mostly cache.
- Subagent ids on the four baseline coordinator chats did not overlap. Summing every coordinator chat did not double-count an event. Still dedupe.
- The usage call needs the Cursor account session. Do not copy that session into this file, the store, or the chat.
