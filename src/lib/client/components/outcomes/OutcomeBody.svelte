<script lang="ts">
  import { selectReviewOutcome } from "$lib/shared/domain/outcomes";
  import type { StoredOutcome } from "$lib/shared/contracts/outcomes";
  import { session } from "$lib/client/state/review.svelte";
  import Finding from "./Finding.svelte";

  let {
    base,
    head,
    outcomes,
  }: {
    base: string;
    head: string;
    outcomes: StoredOutcome[];
  } = $props();

  const selection = $derived(
    selectReviewOutcome(base, head, outcomes, session.selectedOutcomeId),
  );
  const shown = $derived(selection.status === "empty" ? null : selection.record.outcome);
</script>

{#if shown}
  {#if selection.status === "outdated"}
    <aside class="outcome-stale" role="status">
      Outdated. This run does not match the current guide base and head.
    </aside>
  {/if}
  <section class="outcome-section" id="outcome-standards">
    <div class="guide-section-head">
      <p class="meta">
        {shown.standards.findings.length}
        {shown.standards.findings.length === 1 ? "finding" : "findings"}
      </p>
      <h2>Standards</h2>
    </div>
    {#each shown.standards.findings as finding}
      <Finding {finding} />
    {:else}
      <p class="axis-empty">No Standards findings.</p>
    {/each}
  </section>
  <section class="outcome-section" id="outcome-spec">
    <div class="guide-section-head">
      <p class="meta">
        {shown.spec.findings.length}
        {shown.spec.findings.length === 1 ? "finding" : "findings"}
      </p>
      <h2>Spec</h2>
    </div>
    {#each shown.spec.findings as finding}
      <Finding {finding} />
    {:else}
      <p class="axis-empty">No Spec findings.</p>
    {/each}
  </section>
  <p class="hint">j / k jump axes · run /code-review to publish another snapshot</p>
{:else}
  <div class="outcome-empty">
    <h2>No code-review outcome</h2>
    <p>
      Run /code-review on this base and head. After the chat report it attaches here when exactly one
      saved guide matches.
    </p>
  </div>
{/if}
