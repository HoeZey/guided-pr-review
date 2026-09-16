<script lang="ts">
  let { header }: { header?: string } = $props();
</script>

{#if header}
  <div class="hunk-header">{header}</div>
{/if}
