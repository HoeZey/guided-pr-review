<script lang="ts">
  import type { FileChange } from "$lib/shared/contracts/guide";
  import { isUnchangedGap, type DiffLayout } from "$lib/shared/domain/guide-view";
  import FileHeader from "./FileHeader.svelte";
  import HunkHeader from "./HunkHeader.svelte";
  import SplitRow from "./SplitRow.svelte";
  import UnchangedGap from "./UnchangedGap.svelte";
  import UnifiedRow from "./UnifiedRow.svelte";
  import { fileDiffStats, languageFor, projectHunkLines } from "./project";

  let {
    file,
    id,
    layout,
    hideUnchanged = false,
    collapsed = false,
    viewed = false,
    stage = false,
    theme = "dark",
    ontoggle,
    onviewed,
  }: {
    file: FileChange;
    id: string;
    layout: DiffLayout;
    hideUnchanged?: boolean;
    collapsed?: boolean;
    viewed?: boolean;
    stage?: boolean;
    theme?: "light" | "dark";
    ontoggle?: (path: string) => void;
    onviewed?: (path: string, viewed: boolean) => void;
  } = $props();

  const lang = $derived(languageFor(file));
  const stats = $derived(fileDiffStats(file));
</script>

<section
  class={stage ? "file stage" : "file"}
  {id}
  data-path={file.path}
  data-collapsed={collapsed ? "true" : "false"}
>
  <FileHeader
    path={file.path}
    {stage}
    {collapsed}
    {viewed}
    {stats}
    ontoggle={() => ontoggle?.(file.path)}
    onviewed={(next) => onviewed?.(file.path, next)}
  />
  <div class="file-body">
    {#if file.stub}
      <div class="stub">Body omitted{file.reason ? ` · ${file.reason}` : ""}.</div>
    {:else}
      {#each file.hunks || [] as hunk, hi (hunk.header ?? hi)}
        {@const projected = projectHunkLines(hunk.lines || [], hideUnchanged)}
        <HunkHeader header={hunk.header} />
        {#if layout === "split"}
          <div class="diff split">
            <div class="split-pane left">
              {#each projected.split as item, i (`l${i}`)}
                <SplitRow {item} side="left" {lang} {theme} />
              {/each}
            </div>
            <button type="button" class="split-handle" aria-label="Resize diff panes"></button>
            <div class="split-pane right">
              {#each projected.split as item, i (`r${i}`)}
                <SplitRow {item} side="right" {lang} {theme} />
              {/each}
            </div>
          </div>
        {:else}
          <div class="diff">
            {#each projected.unified as item, i (`u${i}`)}
              {#if isUnchangedGap(item)}
                <UnchangedGap count={item.count} />
              {:else}
                <UnifiedRow line={item} {lang} {theme} />
              {/if}
            {/each}
          </div>
        {/if}
      {/each}
    {/if}
  </div>
</section>
