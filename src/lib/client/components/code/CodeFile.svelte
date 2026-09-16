<script lang="ts">
  import type { CommentThread } from "$lib/shared/contracts/comments";
  import type { FileChange } from "$lib/shared/contracts/guide";
  import { isUnchangedGap, type DiffLayout } from "$lib/shared/domain/guide-view";
  import type { CommentSlotSide } from "$lib/shared/domain/comment-slots";
  import FileHeader from "./FileHeader.svelte";
  import HunkHeader from "./HunkHeader.svelte";
  import SplitRow from "./SplitRow.svelte";
  import UnchangedGap from "./UnchangedGap.svelte";
  import UnifiedRow from "./UnifiedRow.svelte";
  import CommentStack from "./CommentStack.svelte";
  import { fileDiffStats, languageFor, projectHunkLines } from "./project";
  import { resizeSplit, syncSplitCommentSpacers } from "$lib/client/browser/interaction";

  let {
    file,
    id,
    layout,
    hideUnchanged = false,
    collapsed = false,
    viewed = false,
    stage = false,
    theme = "dark",
    headerThreads = [],
    afterThreads = () => [],
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
    headerThreads?: CommentThread[];
    afterThreads?: (hunkIndex: number, itemIndex: number, side: CommentSlotSide) => CommentThread[];
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
  >
    <CommentStack threads={headerThreads} />
  </FileHeader>
  <div class="file-body">
    {#if file.stub}
      <div class="stub">Body omitted{file.reason ? ` · ${file.reason}` : ""}.</div>
    {:else}
      {#each file.hunks || [] as hunk, hi (hunk.header ?? hi)}
        {@const projected = projectHunkLines(hunk.lines || [], hideUnchanged)}
        <HunkHeader header={hunk.header} />
        {#if layout === "split"}
          <div class="diff split" use:syncSplitCommentSpacers={afterThreads}>
            <div class="split-pane left">
              {#each projected.split as item, i (`l${i}`)}
                {@const own = afterThreads(hi, i, "left")}
                {@const other = afterThreads(hi, i, "right")}
                <SplitRow {item} side="left" {lang} {theme}>
                  {#if own.length}
                    <CommentStack threads={own} />
                  {:else if other.length}
                    <div class="comment-stack-spacer" aria-hidden="true"></div>
                  {/if}
                </SplitRow>
              {/each}
            </div>
            <button type="button" class="split-handle" aria-label="Resize diff panes" use:resizeSplit></button>
            <div class="split-pane right">
              {#each projected.split as item, i (`r${i}`)}
                {@const own = afterThreads(hi, i, "right")}
                {@const other = afterThreads(hi, i, "left")}
                <SplitRow {item} side="right" {lang} {theme}>
                  {#if own.length}
                    <CommentStack threads={own} />
                  {:else if other.length}
                    <div class="comment-stack-spacer" aria-hidden="true"></div>
                  {/if}
                </SplitRow>
              {/each}
            </div>
          </div>
        {:else}
          <div class="diff">
            {#each projected.unified as item, i (`u${i}`)}
              {#if isUnchangedGap(item)}
                <UnchangedGap count={item.count} />
                <CommentStack threads={afterThreads(hi, i, "unified")} />
              {:else}
                <UnifiedRow line={item} {lang} {theme}>
                  <CommentStack threads={afterThreads(hi, i, "unified")} />
                </UnifiedRow>
              {/if}
            {/each}
          </div>
        {/if}
      {/each}
    {/if}
  </div>
</section>
