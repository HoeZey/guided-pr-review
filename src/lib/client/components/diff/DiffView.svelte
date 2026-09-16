<script lang="ts">
  import type { GuideV1 } from "$lib/shared/contracts/guide";
  import { filesForDiff, fileTree } from "$lib/shared/domain/guide-view";
  import { headerThreads, projectComposerAnchor, projectInlineThreads, threadsAfter } from "$lib/shared/domain/comment-slots";
  import { composerSession } from "$lib/client/state/composer.svelte";
  import CodeFile from "../code/CodeFile.svelte";
  import { prefs } from "$lib/client/state/preferences.svelte";
  import { resizeRail } from "$lib/client/browser/interaction";
  import {
    selectDiffPath,
    session,
    setPathViewed,
    toggleCollapsed,
    toggleCollapsedDir,
  } from "$lib/client/state/review.svelte";
  import { threadSession } from "$lib/client/state/threads.svelte";
  import FileTree from "./FileTree.svelte";

  let { guide, visible = true }: { guide: GuideV1; visible?: boolean } = $props();

  const rows = $derived(filesForDiff(guide));
  const tree = $derived(fileTree(rows.map((row) => row.path)));
  const ids = $derived(
    Object.fromEntries(rows.map((row, index) => [row.path, `diff-file-${index}`])),
  );
  const selected = $derived(
    session.selectedDiffPath && rows.some((row) => row.path === session.selectedDiffPath)
      ? session.selectedDiffPath
      : (rows[0]?.path ?? null),
  );
  const viewed = $derived(session.viewed);
  const collapsed = $derived(session.collapsed);
  const collapsedDirs = $derived(session.collapsedDirs);
  const slots = $derived(
    projectInlineThreads(threadSession.threads, rows, {
      layout: prefs.diffLayout,
      hideUnchanged: prefs.hideUnchanged,
      surface: "diff",
    }),
  );
  const composerSlot = $derived(
    threadSession.hosted && composerSession.target?.kind === "create"
      ? projectComposerAnchor(composerSession.target.anchor, rows, {
          layout: prefs.diffLayout,
          hideUnchanged: prefs.hideUnchanged,
          surface: "diff",
        })
      : null,
  );

  function jump(path: string, id: string, root: HTMLElement | null): void {
    selectDiffPath(path);
    (root?.querySelector(`[id="${id}"]`) as HTMLElement | null)?.scrollIntoView?.({
      behavior: "auto",
      block: "start",
    });
  }

  function spyFiles(node: HTMLElement, active: boolean) {
    if (typeof IntersectionObserver === "undefined") return {};
    let observer: IntersectionObserver | null = null;
    function bind(on: boolean) {
      observer?.disconnect();
      observer = null;
      if (!on) return;
      observer = new IntersectionObserver(
        (entries) => {
          const hit = entries
            .filter((entry) => entry.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
          const path = (hit?.target as HTMLElement | undefined)?.dataset.path;
          if (path) selectDiffPath(path);
        },
        { root: node, rootMargin: "0px 0px -70% 0px", threshold: 0 },
      );
      node.querySelectorAll(".file[id]").forEach((el) => observer?.observe(el));
    }
    bind(active);
    return {
      update(on: boolean) {
        bind(on);
      },
      destroy() {
        observer?.disconnect();
      },
    };
  }

  let mainEl: HTMLElement | null = $state(null);
</script>

<nav aria-label="Files" hidden={!visible}>
  <button type="button" class="col-handle" data-rail="sidebar" aria-label="Resize file list" use:resizeRail></button>
  <div class="nav-label">Files</div>
  <FileTree
    nodes={tree}
    {selected}
    {viewed}
    {collapsedDirs}
    {ids}
    onjump={(path, id) => jump(path, id, mainEl)}
    ontoggleDir={toggleCollapsedDir}
  />
</nav>
<main bind:this={mainEl} hidden={!visible} use:spyFiles={visible}>
  <div class="main-inner">
    {#each rows as file, i (file.path)}
      <CodeFile
        {file}
        id={ids[file.path] ?? `diff-file-${i}`}
        layout={prefs.diffLayout}
        hideUnchanged={prefs.hideUnchanged}
        collapsed={collapsed.has(file.path)}
        viewed={viewed.has(file.path)}
        theme={prefs.theme}
        headerThreads={headerThreads(slots, i)}
        afterThreads={(hunkIndex, itemIndex, side) => threadsAfter(slots, i, hunkIndex, itemIndex, side)}
        commentable={threadSession.hosted}
        headerComposer={composerSlot?.kind === "header" && composerSlot.fileIndex === i}
        afterComposer={(hunkIndex, itemIndex, side) =>
          composerSlot?.kind === "after" &&
          composerSlot.fileIndex === i &&
          composerSlot.hunkIndex === hunkIndex &&
          composerSlot.itemIndex === itemIndex &&
          composerSlot.side === side}
        ontoggle={toggleCollapsed}
        onviewed={setPathViewed}
      />
    {/each}
    <p class="hint">j / k jump files · drag rail edges · ⌘B split · viewed stays collapsed on Diff</p>
  </div>
</main>
