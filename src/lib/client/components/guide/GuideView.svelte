<script lang="ts">
  import { flushSync } from "svelte";
  import type { GuideV1 } from "$lib/shared/contracts/guide";
  import { guidePresentsWalkthrough } from "$lib/shared/domain/overview";
  import {
    guideFileKey,
    markViewed,
    selectGuidePath,
    splitPaths,
    unmarkViewed,
  } from "$lib/shared/domain/guide-view";
  import { projectComposerAnchor, projectInlineThreads } from "$lib/shared/domain/comment-slots";
  import { composerSession } from "$lib/client/state/composer.svelte";
  import { prefs } from "$lib/client/state/preferences.svelte";
  import { persistViewed, session } from "$lib/client/state/review.svelte";
  import { threadSession } from "$lib/client/state/threads.svelte";
  import { revealCurrentToc, suppressHoverToc } from "$lib/client/browser/interaction";
  import GenerateGuideEmpty from "../outcomes/GenerateGuideEmpty.svelte";
  import GuideChapter from "./GuideChapter.svelte";
  import GuideToc from "./GuideToc.svelte";
  import { chaptersForNav, fileId, readGuideSpy, sectionId } from "./project";

  let {
    guide,
    diffCommit,
    hidden = false,
  }: {
    guide: GuideV1;
    diffCommit?: string;
    hidden?: boolean;
  } = $props();

  let tocOpen = $derived(session.tocOpen);
  let mainEl: HTMLElement | undefined;

  const walkthrough = $derived(guidePresentsWalkthrough(guide));
  const behindDiff = $derived.by(() => {
    if (!diffCommit) return false;
    const guideCommit = guide.source?.sourceCommit ?? guide.head;
    return guideCommit.toLowerCase() !== diffCommit.toLowerCase();
  });
  const chapters = $derived(chaptersForNav(guide));
  const walkFiles = $derived(chapters.flatMap((chapter) => (chapter._omitted ? [] : chapter.files)));
  const chapterOffsets = $derived.by(() => {
    const out: number[] = [];
    let n = 0;
    for (const chapter of chapters) {
      out.push(n);
      if (!chapter._omitted) n += chapter.files.length;
    }
    return out;
  });
  const slots = $derived(
    projectInlineThreads(threadSession.threads, walkFiles, {
      layout: prefs.guideLayout,
      hideUnchanged: prefs.hideUnchanged,
      surface: "guide",
    }),
  );
  const composerSlot = $derived(
    threadSession.hosted && !behindDiff && composerSession.target?.kind === "create"
      ? projectComposerAnchor(composerSession.target.anchor, walkFiles, {
          layout: prefs.guideLayout,
          hideUnchanged: prefs.hideUnchanged,
          surface: "guide",
        })
      : null,
  );
  const split = $derived(splitPaths(chapters));
  const selectedChapter = $derived(
    chapters.find((chapter) => chapter.id === session.selectedChapterId) || chapters[0],
  );
  const selectedPath = $derived(
    selectedChapter
      ? selectGuidePath(
          selectedChapter.files || [],
          session.selectedGuidePath,
          session.viewed,
          selectedChapter.id,
          split,
        )
      : null,
  );

  function fileKey(chapterId: string, path: string): string {
    return guideFileKey(path, split.has(path) ? chapterId : undefined);
  }

  $effect(() => {
    if (!walkthrough || !selectedChapter) return;
    if (session.selectedChapterId !== selectedChapter.id) {
      session.selectedChapterId = selectedChapter.id;
    }
    if (session.selectedGuidePath !== selectedPath) {
      session.selectedGuidePath = selectedPath;
    }
  });

  $effect(() => {
    const app = document.getElementById("app");
    if (!(app instanceof HTMLElement)) return;
    if (tocOpen && !hidden) app.dataset.toc = "open";
    else delete app.dataset.toc;
    return () => {
      delete app.dataset.toc;
    };
  });

  function jumpTo(id: string): void {
    const el = document.getElementById(id);
    if (el instanceof HTMLElement && mainEl?.contains(el)) {
      el.scrollIntoView?.({ behavior: "auto", block: "start" });
    }
  }

  function jumpFile(chapterId: string, path: string, id: string): void {
    session.selectedChapterId = chapterId;
    session.selectedGuidePath = path;
    session.selectedDiffPath = path;
    session.tocOpen = false;
    suppressHoverToc();
    jumpTo(id);
  }

  function jumpChapter(chapterId: string): void {
    session.selectedChapterId = chapterId;
    const chapter = chapters.find((item) => item.id === chapterId);
    session.selectedGuidePath = selectGuidePath(
      chapter?.files || [],
      null,
      session.viewed,
      chapterId,
      split,
    );
    session.tocOpen = false;
    suppressHoverToc();
    jumpTo(sectionId(chapterId));
  }

  function fileHead(chapterId: string, path: string): HTMLElement | null {
    const chapter = chapters.find((item) => item.id === chapterId);
    const index = (chapter?.files || []).findIndex((file) => file.path === path);
    if (index < 0) return null;
    const head = document.getElementById(fileId(chapterId, index))?.querySelector(".file-head");
    return head instanceof HTMLElement ? head : null;
  }

  function headerLayoutTop(scroller: HTMLElement, anchor: HTMLElement): number | null {
    let top = 0;
    let node: HTMLElement | null = anchor;
    while (node && node !== scroller) {
      top += node.offsetTop;
      const parent: Element | null = node.offsetParent;
      if (!(parent instanceof HTMLElement)) return null;
      node = parent;
    }
    return node === scroller ? top : null;
  }

  function collapseInPlace(anchor: HTMLElement | null, change: () => void): void {
    const scroller = mainEl;
    const layoutTop = scroller && anchor ? headerLayoutTop(scroller, anchor) : null;
    const fromLower = layoutTop != null && !!scroller && scroller.scrollTop > layoutTop + 8;
    const before = anchor?.getBoundingClientRect().top ?? null;
    change();
    if (!scroller || !anchor || before == null) return;
    flushSync();
    if (fromLower) {
      (anchor.closest(".file") ?? anchor).scrollIntoView({ behavior: "auto", block: "start" });
      return;
    }
    const delta = anchor.getBoundingClientRect().top - before;
    if (delta) scroller.scrollTop += delta;
  }

  function toggleCollapsed(chapterId: string, path: string): void {
    const key = fileKey(chapterId, path);
    const next = new Set(session.collapsed);
    const collapsing = !next.has(key);
    if (collapsing) next.add(key);
    else next.delete(key);
    if (!collapsing) {
      session.collapsed = next;
      return;
    }
    collapseInPlace(fileHead(chapterId, path), () => {
      session.collapsed = next;
    });
  }

  function onFileViewed(chapterId: string, path: string, on: boolean): void {
    const key = fileKey(chapterId, path);
    if (on) {
      collapseInPlace(fileHead(chapterId, path), () => {
        session.viewed = markViewed(session.viewed, session.collapsed, key).viewed;
        session.collapsed = new Set([...session.collapsed, key]);
      });
      persistViewed();
      session.selectedChapterId = chapterId;
      session.selectedGuidePath = path;
      return;
    }
    const next = unmarkViewed(session.viewed, session.collapsed, key);
    session.viewed = next.viewed;
    session.collapsed = next.collapsed;
    persistViewed();
  }

  function onChapterReviewed(chapterId: string, on: boolean): void {
    const chapter = chapters.find((item) => item.id === chapterId);
    if (!chapter) return;
    if (on) {
      const paths = (chapter.files || []).map((file) => file.path);
      const anchorPath =
        session.selectedGuidePath && paths.includes(session.selectedGuidePath)
          ? session.selectedGuidePath
          : paths[0];
      collapseInPlace(anchorPath ? fileHead(chapterId, anchorPath) : null, () => {
        for (const file of chapter.files || []) {
          const key = fileKey(chapterId, file.path);
          session.viewed = markViewed(session.viewed, session.collapsed, key).viewed;
          session.collapsed = new Set([...session.collapsed, key]);
        }
      });
      persistViewed();
      return;
    }
    for (const file of chapter.files || []) {
      const next = unmarkViewed(session.viewed, session.collapsed, fileKey(chapterId, file.path));
      session.viewed = next.viewed;
      session.collapsed = next.collapsed;
    }
    persistViewed();
  }

  function spyScroll(node: HTMLElement, isHidden: boolean) {
    mainEl = node;
    let hidden = isHidden;
    const onScroll = () => {
      if (hidden) return;
      const next = readGuideSpy(node);
      if (next.chapterId) session.selectedChapterId = next.chapterId;
      if (next.path) session.selectedGuidePath = next.path;
    };
    node.addEventListener("scroll", onScroll, { passive: true });
    return {
      update(nextHidden: boolean) {
        hidden = nextHidden;
      },
      destroy() {
        node.removeEventListener("scroll", onScroll);
        if (mainEl === node) mainEl = undefined;
      },
    };
  }
</script>

<main hidden={hidden} use:spyScroll={hidden}>
  <div class="main-inner is-guide">
    {#if behindDiff}
      <p class="review-banner" role="status">
        The Guide is from an older commit; comment on Diff or generate the Guide again.
      </p>
    {/if}
    {#if walkthrough}
      <div class="guide-doc">
        {#each chapters as chapter, i (chapter.id)}
          <GuideChapter
            {chapter}
            index={i}
            total={chapters.length}
            {selectedPath}
            omitted={guide.omitted || []}
            layout={prefs.guideLayout}
            hideUnchanged={prefs.hideUnchanged}
            theme={prefs.theme}
            {tocOpen}
            fileOffset={chapterOffsets[i] ?? 0}
            {slots}
            {composerSlot}
            commentable={threadSession.hosted && !behindDiff}
            onjumpFile={jumpFile}
            ontoggleToc={() => {
              session.tocOpen = !session.tocOpen;
              if (session.tocOpen) requestAnimationFrame(() => revealCurrentToc());
            }}
            {fileKey}
            onviewed={onFileViewed}
            ontoggle={toggleCollapsed}
            onchapterReviewed={onChapterReviewed}
          />
        {/each}
      </div>
    {:else}
      <GenerateGuideEmpty />
    {/if}
  </div>
</main>
{#if walkthrough}
  <GuideToc
    {chapters}
    selectedChapterId={selectedChapter?.id ?? null}
    {selectedPath}
    {fileKey}
    {hidden}
    onjumpFile={jumpFile}
    onjumpChapter={jumpChapter}
    onenter={() => {
      session.tocOpen = true;
      revealCurrentToc();
    }}
    onleave={() => {
      session.tocOpen = false;
    }}
  />
{/if}
