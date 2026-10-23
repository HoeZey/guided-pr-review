<script lang="ts">
  import { shownDiffCounts } from "$lib/shared/domain/guide-view";

  let { additions, deletions }: { additions: number; deletions: number } = $props();

  const shown = $derived(shownDiffCounts({ additions, deletions }));
</script>

{#if shown.additions != null || shown.deletions != null}
  <span class="stats"
    >{#if shown.additions != null}<span class="add">+{shown.additions}</span>{/if}{#if shown.additions != null && shown.deletions != null}{" "}{/if}{#if shown.deletions != null}<span class="del">−{shown.deletions}</span>{/if}</span
  >
{/if}
