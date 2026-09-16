<script lang="ts">
  import { inFlightActionCopy, latestAction } from "$lib/shared/domain/overview";
  import type { HomePageData } from "$lib/shared/page-data";
  import { homeListed, homeUi, queueHomeAction } from "$lib/client/state/home.svelte";

  let { data }: { data: HomePageData } = $props();

  const listed = $derived(homeListed(data));
  const refresh = $derived(latestAction(listed.actions, "refresh"));
  const refreshCopy = $derived(
    refresh ? inFlightActionCopy("refresh", refresh.status) : undefined,
  );
</script>

{#if refreshCopy}
  <button type="button" class="ghost" disabled>{refreshCopy}</button>
{:else}
  <button
    type="button"
    class="ghost"
    data-queue-refresh
    disabled={!listed.agentConnected}
    onclick={() => void queueHomeAction({ kind: "refresh" })}
  >
    Refresh
  </button>
{/if}
<button
  type="button"
  class="ghost"
  data-open-paste
  onclick={() => {
    homeUi.pasteOpen = true;
  }}
>
  Add
</button>
