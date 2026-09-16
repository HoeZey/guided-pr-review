<script lang="ts">
  import {
    isUnchangedGap,
    type SplitRow as SplitPair,
    type UnchangedGap as Gap,
  } from "$lib/shared/domain/guide-view";
  import SplitCell from "./SplitCell.svelte";
  import UnchangedGap from "./UnchangedGap.svelte";

  let {
    item,
    side,
    lang,
    theme = "dark",
  }: {
    item: SplitPair | Gap;
    side: "left" | "right";
    lang: string;
    theme?: "light" | "dark";
  } = $props();
</script>

{#if isUnchangedGap(item)}
  <UnchangedGap count={item.count} />
{:else}
  <SplitCell {side} line={side === "left" ? item.left : item.right} {lang} {theme} />
{/if}
