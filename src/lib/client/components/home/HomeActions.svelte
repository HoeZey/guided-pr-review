<script lang="ts">
  import type { HomePageData } from "$lib/shared/page-data";
  import { homeUi, refreshCatalog } from "$lib/client/state/home.svelte";

  let { data }: { data: HomePageData } = $props();
</script>

{#if homeUi.refreshing}
  <button type="button" class="ghost" disabled>Refreshing</button>
{:else}
  <button
    type="button"
    class="ghost"
    data-queue-refresh
    onclick={() => void refreshCatalog("manual")}
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
