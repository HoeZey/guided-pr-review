<script lang="ts">
  import type { StoredAction } from "$lib/shared/contracts/catalog";
  import { pullRequestSyncKey } from "$lib/shared/contracts/provenance";
  import type { HomeCard } from "$lib/shared/domain/overview";
  import {
    homeCardAction,
    inFlightGenerateGuideCopy,
    latestGenerateGuideAction,
    offersGenerateGuide,
    reviewPath,
  } from "$lib/shared/domain/overview";
  import { homeUi, queueHomeAction } from "$lib/client/state/home.svelte";

  let {
    card,
    actions,
    agentConnected,
  }: {
    card: HomeCard;
    actions: readonly StoredAction[];
    agentConnected: boolean;
  } = $props();

  const diffOp = $derived(
    card.openTarget ? homeUi.diffOps[pullRequestSyncKey(card.openTarget)] : undefined,
  );
  const inflight = $derived(
    diffOp && !diffOp.error ? (diffOp.kind === "update-diff" ? "Updating" : "Opening") : undefined,
  );
  const generateLatest = $derived(
    card.reviewId ? latestGenerateGuideAction(card.reviewId, actions) : undefined,
  );
  const generateInflight = $derived(
    generateLatest ? inFlightGenerateGuideCopy(generateLatest.status) : undefined,
  );
  const failed = $derived(
    diffOp?.error || (generateLatest?.status === "failed" ? generateLatest.error?.message : undefined),
  );
  const kind = $derived(homeCardAction(card, agentConnected));
  const busy = $derived(Boolean(inflight));
  const pending = $derived(kind === "disabled-host" || busy);
  const offerGuide = $derived(offersGenerateGuide(card));
  const generateBusy = $derived(Boolean(generateInflight));

  function queueOpen(): void {
    if (!card.openTarget) return;
    void queueHomeAction({ kind: "open", target: card.openTarget });
  }

  function queueUpdate(): void {
    if (!card.openTarget) return;
    void queueHomeAction({ kind: "update-diff", target: card.openTarget });
  }

  function queueGenerate(): void {
    if (!card.reviewId) return;
    void queueHomeAction({ kind: "generate-guide", reviewId: card.reviewId });
  }
</script>

{#snippet body()}
  <span class="home-card-title">{card.title}</span>
  {#if card.repository}
    <span class="repo-badge">{card.repository.owner} / {card.repository.name}</span>
  {/if}
  {#if card.range}
    <span class="home-card-range">{card.range}</span>
  {/if}
{/snippet}

<div class="home-card" class:is-pending={pending}>
  {#if card.outdated && card.reviewId && !card.archived}
    <div class="home-card-open">{@render body()}</div>
  {:else if kind === "open-saved" && card.reviewId}
    <a class="home-card-open" href={reviewPath(card.reviewId)} data-open-review={card.reviewId}>
      {@render body()}
    </a>
  {:else if kind === "queue-open" && card.openTarget && !busy}
    <button type="button" class="home-card-open" data-queue-open onclick={queueOpen}>
      {@render body()}
    </button>
  {:else}
    <div class="home-card-open">{@render body()}</div>
  {/if}
  <div class="home-card-aside">
    {#if generateInflight}
      <span class="home-card-status">{generateInflight}</span>
    {:else if inflight}
      <span class="home-card-status">{inflight}</span>
    {:else if failed}
      <span class="home-card-status is-failed">{failed}</span>
    {:else if card.outdated}
      <span class="home-card-status is-outdated">Outdated</span>
    {:else if card.archived}
      <span class="home-card-status">Archived</span>
    {:else if card.hasGuide}
      <span class="home-card-status is-ready">Guide</span>
    {:else}
      <span class="home-card-status">No guide</span>
    {/if}
    {#if kind === "queue-update-diff" && card.openTarget && !busy}
      <button type="button" class="ghost home-card-update" data-queue-update-diff onclick={queueUpdate}>
        Update Diff
      </button>
    {/if}
    {#if offerGuide}
      {#if card.reviewId && agentConnected && !generateBusy}
        <button type="button" class="ghost" data-queue-generate={card.reviewId} onclick={queueGenerate}>
          Generate guide
        </button>
      {:else}
        <button type="button" class="ghost" disabled>Generate guide</button>
      {/if}
    {/if}
    {#if card.outdated && !card.archived && card.reviewId}
      <a class="home-card-secondary" href={reviewPath(card.reviewId)} data-open-review={card.reviewId}>
        Open saved
      </a>
    {/if}
    {#if card.webUrl}
      <a
        class="icon-btn ado-link"
        href={card.webUrl}
        target="_blank"
        rel="noreferrer"
        aria-label="Open in Azure DevOps"
        title="Open in Azure DevOps"
      >
        <svg class="ado-mark" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path
            fill="#0078D4"
            d="M0 8.877L2.247 5.91l8.405-3.416V.022l7.37 5.393L2.966 8.338v8.225L0 15.707zm24-4.45v14.651l-5.753 4.9-9.303-3.057v3.056l-5.978-7.416 15.057 1.798V5.415z"
          />
        </svg>
      </a>
    {/if}
  </div>
</div>
