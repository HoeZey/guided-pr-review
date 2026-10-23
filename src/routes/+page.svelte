<script lang="ts">
  import AppShell from "$lib/client/components/AppShell.svelte";
  import type { HomePageData } from "$lib/shared/page-data";

  let { data }: { data: HomePageData } = $props();
</script>

<svelte:head>
  <title>Home · Guided review</title>
</svelte:head>

<AppShell {data} />
