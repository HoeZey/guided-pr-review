<script lang="ts">
  import type { Snippet } from "svelte";
  import DiffStats from "./DiffStats.svelte";
  import { pathParts } from "./project";

  let {
    path,
    stage = false,
    collapsed = false,
    viewed = false,
    stats,
    commentable = false,
    ontoggle,
    onviewed,
    onfilecomment,
    children,
  }: {
    path: string;
    stage?: boolean;
    collapsed?: boolean;
    viewed?: boolean;
    stats: { additions: number; deletions: number };
    commentable?: boolean;
    ontoggle?: () => void;
    onviewed?: (viewed: boolean) => void;
    onfilecomment?: () => void;
    children?: Snippet;
  } = $props();

  const parts = $derived(pathParts(path));
</script>

<div class="file-head">
  <button
    type="button"
    class="chevron"
    data-toggle-path={path}
    aria-expanded={collapsed ? "false" : "true"}
    aria-label="Toggle file"
    onclick={() => ontoggle?.()}
  >
    {collapsed ? "▸" : "▾"}
  </button>
  {#if stage}
    <span class="file-title">
      <span class="path">{parts.name}</span>
      {#if parts.dir}<span class="dir">{parts.dir}</span>{/if}
    </span>
  {:else}
    <span class="path">{path}</span>
  {/if}
  <DiffStats additions={stats.additions} deletions={stats.deletions} />
  {#if commentable}
    <button type="button" class="ghost" data-comment-file={path} onclick={() => onfilecomment?.()}>
      Comment
    </button>
  {/if}
  <label class="viewed">
    <input
      type="checkbox"
      data-viewed-path={path}
      checked={viewed}
      onchange={(event) => onviewed?.(event.currentTarget.checked)}
    />
    {stage ? "Reviewed" : "Viewed"}
  </label>
</div>
{@render children?.()}
