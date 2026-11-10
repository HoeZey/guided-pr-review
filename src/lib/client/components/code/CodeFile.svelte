<script lang="ts">
  import type { CommentThread } from "$lib/shared/contracts/comments";
  import type { FileChange } from "$lib/shared/contracts/guide";
  import { isUnchangedGap, type DiffLayout } from "$lib/shared/domain/guide-view";
  import type { CommentSlotSide } from "$lib/shared/domain/comment-slots";
  import { openCreateComposer, openLineComposer, composerSession } from "$lib/client/state/composer.svelte";
  import { threadSession } from "$lib/client/state/threads.svelte";
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
    commentable = false,
    headerComposer = false,
    afterComposer = () => false,
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
    commentable?: boolean;
    headerComposer?: boolean;
    afterComposer?: (hunkIndex: number, itemIndex: number, side: CommentSlotSide) => boolean;
    ontoggle?: (path: string) => void;
    onviewed?: (path: string, viewed: boolean) => void;
  } = $props();

  const lang = $derived(languageFor(file));
  const stats = $derived(fileDiffStats(file));
  const selectedLines = $derived.by(() => {
    const lines = new Set<number>();
    const target = composerSession.target;
    if (target?.kind !== "create") return lines;
    const anchor = target.anchor;
    if (anchor.kind === "line" && anchor.path === file.path) lines.add(anchor.line);
    if (anchor.kind === "range" && anchor.path === file.path) {
      for (let n = anchor.startLine; n <= anchor.endLine; n += 1) lines.add(n);
    }
    return lines;
  });

  function commentOnLine(line: number, extend: boolean): void {
    if (!threadSession.reviewId) return;
    openLineComposer(threadSession.reviewId, file.path, line, extend);
  }

  function commentOnFile(): void {
    if (!threadSession.reviewId) return;
    openCreateComposer(threadSession.reviewId, { kind: "file", path: file.path });
  }

  function rowSelected(newLine: number | undefined): boolean {
    return newLine != null && selectedLines.has(newLine);
  }
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
    {commentable}
    ontoggle={() => ontoggle?.(file.path)}
    onviewed={(next) => onviewed?.(file.path, next)}
    onfilecomment={commentOnFile}
  >
    <CommentStack threads={headerThreads} showComposer={headerComposer} />
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
                {@const ownComposer = afterComposer(hi, i, "left")}
                {@const otherComposer = afterComposer(hi, i, "right")}
                <SplitRow
                  {item}
                  side="left"
                  {lang}
                  {theme}
                  {commentable}
                  selected={false}
                  onfilecomment={commentOnFile}
                >
                  {#if own.length || ownComposer}
                    <CommentStack threads={own} showComposer={ownComposer} />
                  {:else if other.length || otherComposer}
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
                {@const ownComposer = afterComposer(hi, i, "right")}
                {@const otherComposer = afterComposer(hi, i, "left")}
                <SplitRow
                  {item}
                  side="right"
                  {lang}
                  {theme}
                  {commentable}
                  selected={!isUnchangedGap(item) && rowSelected(item.right?.newLine)}
                  oncomment={commentOnLine}
                  onfilecomment={commentOnFile}
                >
                  {#if own.length || ownComposer}
                    <CommentStack threads={own} showComposer={ownComposer} />
                  {:else if other.length || otherComposer}
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
                <CommentStack
                  threads={afterThreads(hi, i, "unified")}
                  showComposer={afterComposer(hi, i, "unified")}
                />
              {:else}
                <UnifiedRow
                  line={item}
                  {lang}
                  {theme}
                  {commentable}
                  selected={rowSelected(item.newLine)}
                  oncomment={commentOnLine}
                  onfilecomment={commentOnFile}
                >
                  <CommentStack
                    threads={afterThreads(hi, i, "unified")}
                    showComposer={afterComposer(hi, i, "unified")}
                  />
                </UnifiedRow>
              {/if}
            {/each}
          </div>
        {/if}
      {/each}
    {/if}
  </div>
</section>
