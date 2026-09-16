<script lang="ts">
  import type { StoredAction } from "$lib/shared/contracts/catalog";
  import {
    generateGuideHint,
    inFlightGenerateGuideCopy,
    latestGenerateGuideAction,
  } from "$lib/shared/domain/overview";
  import { session } from "$lib/client/state/review.svelte";

  let {
    reviewId,
    actions,
    agentConnected,
    onQueue,
  }: {
    reviewId: string;
    actions: StoredAction[];
    agentConnected: boolean;
    onQueue?: (reviewId: string) => void;
  } = $props();

  const latest = $derived(latestGenerateGuideAction(reviewId, actions));
  const localPending = $derived(
    session.ops.some(
      (op) => op.kind === "generate-guide" && op.reviewId === reviewId && op.status === "pending",
    ),
  );
  const inflight = $derived(
    (latest && inFlightGenerateGuideCopy(latest.status)) ||
      (localPending ? "Waiting" : undefined),
  );
  const failed = $derived(latest?.status === "failed" ? latest.error?.message : undefined);
  const disconnected = $derived(inflight ? undefined : generateGuideHint(agentConnected));
  const canGenerate = $derived(Boolean(reviewId) && agentConnected && !inflight);
</script>

<div class="outcome-empty">
  <h2>Generate guide</h2>
  <p>This review is a Diff. Generate a reading-order guide when you want one.</p>
  {#if disconnected}
    <p>{disconnected}</p>
  {/if}
  {#if failed}
    <p>{failed}</p>
  {/if}
  <button
    type="button"
    class="ghost"
    data-queue-generate={canGenerate ? reviewId : undefined}
    disabled={!canGenerate}
    onclick={() => canGenerate && onQueue?.(reviewId)}
  >
    {inflight ?? "Generate guide"}
  </button>
</div>
