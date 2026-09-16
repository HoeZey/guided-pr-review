<script lang="ts">
  import { findingCounts, selectReviewOutcome, type OutcomeHistoryEntry } from "$lib/shared/domain/outcomes";
  import type { StoredOutcome } from "$lib/shared/contracts/outcomes";
  import { session } from "$lib/client/state/review.svelte";

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
  const counts = $derived(shown ? findingCounts(shown) : { standards: 0, spec: 0 });
  const section = $derived(
    session.selectedOutcomeSection === "outcome-spec" ? "outcome-spec" : "outcome-standards",
  );

  function outcomeRunLabel(entry: OutcomeHistoryEntry): string {
    // ponytail: UTC YYYY-MM-DD HH:MM from addedAt, not the viewer's locale.
    // Upgrade to Intl.DateTimeFormat if reviewers need local time.
    return `${entry.addedAt.slice(0, 10)} ${entry.addedAt.slice(11, 16)} · ${entry.shortHead}`;
  }

  function onHistoryChange(event: Event): void {
    const el = event.currentTarget;
    if (!(el instanceof HTMLSelectElement)) return;
    session.selectedOutcomeId = el.value;
  }

  function jump(id: string): void {
    session.selectedOutcomeSection = id;
    document.getElementById(id)?.scrollIntoView({ behavior: "auto", block: "start" });
  }
</script>

{#if selection.status === "empty"}
  <p class="nav-empty">No runs</p>
{:else}
  <label class="outcome-history">
    History
    <select
      data-outcome-run
      aria-label="Code-review run history"
      value={selection.record.id}
      onchange={onHistoryChange}
    >
      {#each selection.history as row}
        <option value={row.id}>{outcomeRunLabel(row)}</option>
      {/each}
    </select>
  </label>
  <button
    type="button"
    class="file-link"
    data-jump="outcome-standards"
    aria-current={section === "outcome-standards" ? "true" : "false"}
    onclick={() => jump("outcome-standards")}
  >
    Standards <span class="axis-count">{counts.standards}</span>
  </button>
  <button
    type="button"
    class="file-link"
    data-jump="outcome-spec"
    aria-current={section === "outcome-spec" ? "true" : "false"}
    onclick={() => jump("outcome-spec")}
  >
    Spec <span class="axis-count">{counts.spec}</span>
  </button>
{/if}
