<script lang="ts">
  import RefreshCw from "@lucide/svelte/icons/refresh-cw";
  import type { HomePageData } from "$lib/shared/page-data";
  import { homeUi, refreshCatalog } from "$lib/client/state/home.svelte";

  let { data }: { data: HomePageData } = $props();
  const label = $derived(homeUi.hasNewChanges ? "New changes to pull" : "Refresh");
</script>

<button
  type="button"
  class="icon-btn refresh-btn"
  class:is-spinning={homeUi.refreshing}
  data-queue-refresh
  data-has-new-changes={homeUi.hasNewChanges ? "true" : undefined}
  aria-label={label}
  title={label}
  aria-busy={homeUi.refreshing ? "true" : undefined}
  disabled={homeUi.refreshing}
  onclick={() => void refreshCatalog("manual")}
>
  <RefreshCw class="refresh-icon" size={16} aria-hidden="true" />
  {#if homeUi.hasNewChanges}
    <span class="refresh-dot" data-refresh-dot aria-hidden="true"></span>
  {/if}
</button>
