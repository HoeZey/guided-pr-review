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
    ontoggle,
    onviewed,
    children,
  }: {
    path: string;
    stage?: boolean;
    collapsed?: boolean;
    viewed?: boolean;
    stats: { additions: number; deletions: number };
    ontoggle?: () => void;
    onviewed?: (viewed: boolean) => void;
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
