<script lang="ts">
  import type { GuideV1 } from "$lib/shared/contracts/guide";
  import CodeFile from "../code/CodeFile.svelte";
  import DiffStats from "../code/DiffStats.svelte";
  import { fileDiffStats, pathParts } from "../code/project";
  import { formatCopy, type DiffLayout } from "$lib/shared/domain/guide-view";
  import {
    headerThreads,
    threadsAfter,
    type ComposerSlot,
    type ProjectedInlineThreads,
  } from "$lib/shared/domain/comment-slots";
  import { session } from "$lib/client/state/review.svelte";
  import { fileId, progressParts, sectionId, type GuideNavChapter } from "./project";

  let {
    chapter,
    index,
    total,
    selectedPath,
    omitted = [],
    layout,
    hideUnchanged,
    theme,
    tocOpen,
    fileOffset = 0,
    slots,
    composerSlot = null,
    commentable = false,
    onjumpFile,
    ontoggleToc,
    fileKey,
    onviewed,
    ontoggle,
    onchapterReviewed,
  }: {
    chapter: GuideNavChapter;
    index: number;
    total: number;
    selectedPath: string | null;
    omitted?: NonNullable<GuideV1["omitted"]>;
    layout: DiffLayout;
    hideUnchanged: boolean;
    theme: "light" | "dark";
    tocOpen: boolean;
    fileOffset?: number;
    slots?: ProjectedInlineThreads;
    composerSlot?: ComposerSlot | null;
    commentable?: boolean;
    onjumpFile: (chapterId: string, path: string, id: string) => void;
    ontoggleToc: () => void;
    fileKey: (chapterId: string, path: string) => string;
    onviewed: (chapterId: string, path: string, viewed: boolean) => void;
    ontoggle: (chapterId: string, path: string) => void;
    onchapterReviewed: (chapterId: string, viewed: boolean) => void;
  } = $props();

  const sid = $derived(sectionId(chapter.id));
  const progress = $derived(progressParts(index, total));
  const chapterDone = $derived(
    chapter.files.length > 0 &&
      chapter.files.every((file) => session.viewed.has(fileKey(chapter.id, file.path))),
  );
</script>

{#snippet tocToggle()}
  <button
    type="button"
    class="progress-toc"
    data-toggle-toc
    aria-expanded={tocOpen ? "true" : "false"}
    aria-controls="guide-toc"
    title="Sections"
    aria-label="Sections {progress.idx} of {progress.tot}"
    onclick={ontoggleToc}
  >
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 4.5h10M3 8h10M3 11.5h6" /></svg>
    <span>{progress.idx} / {progress.tot}</span>
  </button>
{/snippet}

<section class="guide-section" id={sid} data-chapter={chapter.id}>
  {#if chapter._omitted}
    <div class="guide-aside">
      <h2>Omitted</h2>
      <div class="guide-progress">{@render tocToggle()}</div>
      <div class="guide-why">{@html formatCopy("Binary or unreadable paths.")}</div>
    </div>
    <div class="guide-stage">
      <div class="prose">
        <h2>Omitted</h2>
        <p>Not shown as diffs.</p>
      </div>
      <ul class="omitted-list">
        {#each omitted as item (item.path)}
          <li>{item.path} <span class="meta">{item.reason}{item.note ? ` · ${item.note}` : ""}</span></li>
        {/each}
      </ul>
    </div>
  {:else}
    <aside class="guide-aside">
      <h2>{chapter.title}</h2>
      <div class="guide-progress">
        {@render tocToggle()}
        <label class="viewed">
          <input
            type="checkbox"
            data-reviewed-chapter={chapter.id}
            checked={chapterDone}
            onclick={(event) => event.stopPropagation()}
            onchange={(event) => onchapterReviewed(chapter.id, event.currentTarget.checked)}
          />
          Reviewed
        </label>
      </div>
      <div class="guide-why">{@html formatCopy(chapter.why)}</div>
      <div class="file-pills">
        {#each chapter.files as file, i (file.path)}
          {@const parts = pathParts(file.path)}
          {@const stats = fileDiffStats(file)}
          {@const id = fileId(chapter.id, i)}
          <button
            type="button"
            class={session.viewed.has(fileKey(chapter.id, file.path))
              ? "file-pill viewed-link"
              : "file-pill"}
            data-jump={id}
            data-chapter={chapter.id}
            data-path={file.path}
            title={file.path}
            aria-current={file.path === selectedPath ? "true" : "false"}
            onclick={() => onjumpFile(chapter.id, file.path, id)}
          >
            <span class="file-pill-main">
              <span class="file-pill-name">{parts.name}</span>
              {#if parts.dir}<span class="file-pill-dir">{parts.dir}</span>{/if}
            </span>
            <DiffStats additions={stats.additions} deletions={stats.deletions} />
          </button>
        {/each}
      </div>
    </aside>
    <div class="guide-stage">
      {#each chapter.files as file, i (file.path)}
        <CodeFile
          {file}
          id={fileId(chapter.id, i)}
          {layout}
          {hideUnchanged}
          collapsed={session.collapsed.has(fileKey(chapter.id, file.path))}
          viewed={session.viewed.has(fileKey(chapter.id, file.path))}
          stage
          {theme}
          headerThreads={slots ? headerThreads(slots, fileOffset + i) : []}
          afterThreads={(hunkIndex, itemIndex, side) =>
            slots ? threadsAfter(slots, fileOffset + i, hunkIndex, itemIndex, side) : []}
          {commentable}
          headerComposer={composerSlot?.kind === "header" && composerSlot.fileIndex === fileOffset + i}
          afterComposer={(hunkIndex, itemIndex, side) =>
            Boolean(
              composerSlot?.kind === "after" &&
                composerSlot.fileIndex === fileOffset + i &&
                composerSlot.hunkIndex === hunkIndex &&
                composerSlot.itemIndex === itemIndex &&
                composerSlot.side === side,
            )}
          ontoggle={(path) => ontoggle(chapter.id, path)}
          onviewed={(path, on) => onviewed(chapter.id, path, on)}
        />
      {/each}
    </div>
  {/if}
</section>
