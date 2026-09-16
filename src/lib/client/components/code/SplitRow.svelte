<script lang="ts">
  import type { Snippet } from "svelte";
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
    commentable = false,
    selected = false,
    oncomment,
    children,
  }: {
    item: SplitPair | Gap;
    side: "left" | "right";
    lang: string;
    theme?: "light" | "dark";
    commentable?: boolean;
    selected?: boolean;
    oncomment?: (line: number, extend: boolean) => void;
    children?: Snippet;
  } = $props();
</script>

{#if isUnchangedGap(item)}
  <UnchangedGap count={item.count} />
{:else}
  <SplitCell
    {side}
    line={side === "left" ? item.left : item.right}
    {lang}
    {theme}
    {commentable}
    {selected}
    {oncomment}
  />
{/if}
{@render children?.()}
