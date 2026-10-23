<script lang="ts">
  import { onMount } from "svelte";
  import "../styles/global.css";
  import { hydratePreferences } from "$lib/client/state/preferences.svelte";

  let { children } = $props();

  onMount(() => {
    hydratePreferences();
  });
</script>

{@render children()}
