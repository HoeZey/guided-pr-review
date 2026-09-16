<script lang="ts">
  import type { GuideV1 } from "$lib/shared/contracts/guide";
  import type { StoredAction } from "$lib/shared/contracts/catalog";
  import { guidePresentsWalkthrough } from "$lib/shared/domain/overview";
  import {
    guideStops,
    markViewed,
    selectGuidePath,
    stepGuide,
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
    reviewId,
    agentConnected = false,
    hidden = false,
    actions = [],
    onQueue,
  }: {
    guide: GuideV1;
    reviewId: string;
    agentConnected?: boolean;
    hidden?: boolean;
    actions?: StoredAction[];
    onQueue?: (reviewId: string) => void;
  } = $props();

  let tocOpen = $derived(session.tocOpen);
  let mainEl: HTMLElement | undefined;

  const walkthrough = $derived(guidePresentsWalkthrough(guide));
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
    threadSession.hosted && composerSession.target?.kind === "create"
      ? projectComposerAnchor(composerSession.target.anchor, walkFiles, {
          layout: prefs.guideLayout,
          hideUnchanged: prefs.hideUnchanged,
          surface: "guide",
        })
      : null,
  );
  const selectedChapter = $derived(
    chapters.find((chapter) => chapter.id === session.selectedChapterId) || chapters[0],
  );
  const selectedPath = $derived(
    selectedChapter
      ? selectGuidePath(selectedChapter.files || [], session.selectedGuidePath, session.viewed)
      : null,
  );
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

  function openStop(stop: { chapterId: string; path: string }): void {
    session.selectedChapterId = stop.chapterId;
    session.selectedGuidePath = stop.path;
    session.selectedDiffPath = stop.path;
    const chapter = chapters.find((item) => item.id === stop.chapterId);
    const i = (chapter?.files || []).findIndex((file) => file.path === stop.path);
    jumpTo(i >= 0 && chapter ? fileId(chapter.id, i) : sectionId(stop.chapterId));
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
    session.selectedGuidePath = selectGuidePath(chapter?.files || [], null, session.viewed);
    session.tocOpen = false;
    suppressHoverToc();
    jumpTo(sectionId(chapterId));
  }

  function toggleCollapsed(path: string): void {
    const next = new Set(session.collapsed);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    session.collapsed = next;
  }

  function onFileViewed(path: string, on: boolean): void {
    if (on) {
      session.viewed = markViewed(session.viewed, session.collapsed, path).viewed;
      session.collapsed = new Set([...session.collapsed, path]);
      persistViewed();
      const stops = guideStops(chapters.filter((chapter) => !chapter._omitted));
      const next = stepGuide(stops, session.selectedChapterId || "", path, 1);
      if (next && (next.path !== path || next.chapterId !== session.selectedChapterId)) {
        openStop(next);
        return;
      }
      session.selectedGuidePath = path;
      return;
    }
    const next = unmarkViewed(session.viewed, session.collapsed, path);
    session.viewed = next.viewed;
    session.collapsed = next.collapsed;
    persistViewed();
  }

  function onChapterReviewed(chapterId: string, on: boolean): void {
    const chapter = chapters.find((item) => item.id === chapterId);
    if (!chapter) return;
    if (on) {
      for (const file of chapter.files || []) {
        session.viewed = markViewed(session.viewed, session.collapsed, file.path).viewed;
        session.collapsed = new Set([...session.collapsed, file.path]);
      }
      persistViewed();
      const last = chapter.files[(chapter.files || []).length - 1];
      const stops = guideStops(chapters.filter((item) => !item._omitted));
      const next = last ? stepGuide(stops, chapterId, last.path, 1) : null;
      if (next && next.chapterId !== chapterId) {
        openStop(next);
      }
      return;
    }
    for (const file of chapter.files || []) {
      const next = unmarkViewed(session.viewed, session.collapsed, file.path);
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
            onjumpFile={jumpFile}
            ontoggleToc={() => {
              session.tocOpen = !session.tocOpen;
              if (session.tocOpen) requestAnimationFrame(() => revealCurrentToc());
            }}
            onviewed={onFileViewed}
            ontoggle={toggleCollapsed}
            onchapterReviewed={onChapterReviewed}
          />
        {/each}
      </div>
    {:else}
      <GenerateGuideEmpty
        {reviewId}
        {actions}
        {agentConnected}
        {onQueue}
      />
    {/if}
  </div>
</main>
{#if walkthrough}
  <GuideToc
    {chapters}
    selectedChapterId={selectedChapter?.id ?? null}
    {selectedPath}
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
