<script lang="ts">
  import AppShell from "$lib/client/components/AppShell.svelte";
  import type { ReviewPageData } from "$lib/shared/page-data";

  let { data }: { data: ReviewPageData } = $props();
</script>

<svelte:head>
  <title>{data.title} · Guided review</title>
</svelte:head>

<AppShell {data} />
