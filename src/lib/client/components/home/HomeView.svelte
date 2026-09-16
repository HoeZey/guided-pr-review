<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { hostActionHint, inFlightActionCopy, latestAction, projectHomeOverview } from "$lib/shared/domain/overview";
  import type { HomePageData } from "$lib/shared/page-data";
  import {
    formatLastSynced,
    homeListed,
    homeUi,
    leaveHome,
    pasteGuide,
    stopHomeWatch,
    syncHomeWatch,
  } from "$lib/client/state/home.svelte";
  import { connectionUi, loadConnections } from "$lib/client/state/connection.svelte";
  import HomeCard from "./HomeCard.svelte";

  let { data }: { data: HomePageData } = $props();

  const listed = $derived(homeListed(data));
  const overview = $derived(projectHomeOverview(listed.reviews, listed.catalog));
  const refresh = $derived(latestAction(listed.actions, "refresh"));
  const refreshFailed = $derived(
    refresh?.status === "failed" ? refresh.error?.message : undefined,
  );
  const disconnected = $derived(hostActionHint(listed.agentConnected));
  const hasContent = $derived(
    overview.groups.length > 0 ||
      overview.catalogErrors.length > 0 ||
      Boolean(overview.lastSynced) ||
      Boolean(disconnected) ||
      Boolean(refreshFailed) ||
      Boolean(homeUi.pasteError) ||
      connectionUi.busy ||
      connectionUi.connections.length > 0 ||
      Boolean(connectionUi.error),
  );

  $effect(() => {
    syncHomeWatch(listed.actions);
    return () => stopHomeWatch();
  });

  onMount(() => {
    void loadConnections();
  });

  onDestroy(() => {
    leaveHome();
  });

  function savePaste(): void {
    const text = (document.querySelector("#paste-json") as HTMLTextAreaElement | null)?.value;
    if (text) void pasteGuide(text);
  }
</script>

<main class="home-main">
  <div class="main-inner">
    {#if hasContent}
      {#if connectionUi.busy && connectionUi.connections.length === 0}
        <p class="home-meta">Connecting</p>
      {/if}
      {#if connectionUi.error}
        <p class="home-error">{connectionUi.error}</p>
      {/if}
      {#each connectionUi.connections as row}
        {#if row.status === "connected"}
          <p class="home-meta" data-connection={row.provider}>
            {row.provider === "github" ? "GitHub" : "Azure DevOps"}: {row.login}
          </p>
        {:else}
          <p class="home-error" data-connection={row.provider}>
            {row.provider === "github" ? "GitHub" : "Azure DevOps"}: {row.recovery}
            <button
              type="button"
              class="ghost"
              data-retry-connection={row.provider}
              disabled={connectionUi.busy}
              onclick={() => void loadConnections("POST")}
            >
              Retry
            </button>
          </p>
        {/if}
      {/each}
      {#if overview.lastSynced}
        <p class="home-meta">Last synced {formatLastSynced(overview.lastSynced)}</p>
      {/if}
      {#if disconnected}
        <p class="home-error">{disconnected}</p>
      {/if}
      {#if homeUi.pasteError}
        <p class="home-error">{homeUi.pasteError}</p>
      {/if}
      {#each overview.catalogErrors as entry}
        <p class="home-error">{entry.owner} / {entry.name}: {entry.message}</p>
      {/each}
      {#if refreshFailed}
        <p class="home-error">{refreshFailed}</p>
      {/if}
      {#each overview.groups as group}
        {#if group.collapsed}
          <details class="home-group is-archived">
            <summary><h2>{group.title}</h2></summary>
            <div class="home-grid">
              {#each group.cards as card (card.id)}
                <HomeCard {card} actions={listed.actions} agentConnected={listed.agentConnected} />
              {/each}
            </div>
          </details>
        {:else}
          <section class="home-group">
            <h2>{group.title}</h2>
            <div class="home-grid">
              {#each group.cards as card (card.id)}
                <HomeCard {card} actions={listed.actions} agentConnected={listed.agentConnected} />
              {/each}
            </div>
          </section>
        {/if}
      {/each}
    {:else}
      <p class="boot">No reviews yet. Add one from MCP or paste JSON.</p>
    {/if}
  </div>
</main>
{#if homeUi.pasteOpen}
  <div class="modal" id="paste-modal">
    <div class="modal-card">
      <p>Paste a Guide v1 JSON object.</p>
      <textarea id="paste-json"></textarea>
      <div class="modal-actions">
        <button type="button" class="ghost" data-paste-cancel onclick={() => (homeUi.pasteOpen = false)}>
          Cancel
        </button>
        <button type="button" class="ghost" data-paste-save onclick={savePaste}>Add</button>
      </div>
    </div>
  </div>
{:else}
  <div class="modal hidden" id="paste-modal"></div>
{/if}
