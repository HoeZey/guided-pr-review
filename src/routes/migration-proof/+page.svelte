<script lang="ts">
  import type { MigrationProof } from "$lib/shared/migration-proof";

  let { data }: { data: MigrationProof } = $props();
  let clicks = $state(0);
</script>

<p data-proof>{data.message}</p>
<button type="button" data-hydrate onclick={() => (clicks += 1)}>{clicks}</button>
