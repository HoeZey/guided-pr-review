<script lang="ts">
  import type { FileTreeNode } from "$lib/shared/domain/guide-view";
  import FileTree from "./FileTree.svelte";

  let {
    nodes,
    depth = 0,
    selected,
    viewed,
    collapsedDirs,
    ids,
    onjump,
    ontoggleDir,
  }: {
    nodes: FileTreeNode[];
    depth?: number;
    selected: string | null;
    viewed: ReadonlySet<string>;
    collapsedDirs: ReadonlySet<string>;
    ids: Record<string, string>;
    onjump: (path: string, id: string) => void;
    ontoggleDir: (path: string) => void;
  } = $props();
</script>

{#each nodes as node (node.path)}
  {#if node.kind === "dir"}
    {@const shut = collapsedDirs.has(node.path)}
    <div class="tree-branch">
      <button
        type="button"
        class="tree-dir"
        style="--tree-depth: {depth}"
        data-tree-dir={node.path}
        aria-expanded={shut ? "false" : "true"}
        onclick={() => ontoggleDir(node.path)}
      >
        <span class="tree-chevron">{shut ? "▸" : "▾"}</span>
        <span class="tree-dir-name"
          >{#each node.name.split(" / ") as part, i}{#if i > 0}<span class="tree-slash">{" / "}</span>{/if}{part}{/each}</span
        >
      </button>
      {#if !shut}
        <FileTree
          nodes={node.children}
          depth={depth + 1}
          {selected}
          {viewed}
          {collapsedDirs}
          {ids}
          {onjump}
          {ontoggleDir}
        />
      {/if}
    </div>
  {:else}
    {@const id = ids[node.path]}
    {@const current = node.path === selected}
    <button
      type="button"
      class={viewed.has(node.path) ? "file-link tree-file viewed-link" : "file-link tree-file"}
      style="--tree-depth: {depth}"
      data-jump={id}
      data-path={node.path}
      title={node.path}
      aria-current={current ? "true" : "false"}
      onclick={() => id && onjump(node.path, id)}
    >
      <span class="file-link-name">{node.name}</span>
    </button>
  {/if}
{/each}
