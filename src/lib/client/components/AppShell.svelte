<script lang="ts">
  import { onMount } from "svelte";
  import { HOME_PATH, reviewLandingTab } from "$lib/shared/domain/overview";
  import { projectDiscussionThreads } from "$lib/shared/domain/comment-slots";
  import type { HomePageData, ReviewPageData, ReviewTab } from "$lib/shared/page-data";
  import { fetchJson } from "$lib/client/browser/fetch";
  import {
    bindReviewChrome,
    currentDiffLayout,
    resizeRail,
    spyCurrent,
  } from "$lib/client/browser/interaction";
  import { prefs, setDiffMode, setHideUnchanged, setTheme } from "$lib/client/state/preferences.svelte";
  import {
    adoptLegacyTab,
    adoptReviewPage,
    bindReview,
    currentReviewPage,
    session,
    setTab,
  } from "$lib/client/state/review.svelte";
  import {
    loadReviewThreads,
    retryReviewThreads,
    threadSession,
  } from "$lib/client/state/threads.svelte";
  import DiffStats from "./code/DiffStats.svelte";
  import DiffView from "./diff/DiffView.svelte";
  import DiscussionView from "./discussion/DiscussionView.svelte";
  import GuideView from "./guide/GuideView.svelte";
  import HomeActions from "./home/HomeActions.svelte";
  import HomeView from "./home/HomeView.svelte";
  import OutcomeBody from "./outcomes/OutcomeBody.svelte";
  import OutcomeRail from "./outcomes/OutcomeRail.svelte";

  let { data }: { data: HomePageData | ReviewPageData } = $props();

  let displayOpen = $state(false);
  let openedCommentsFor = $state<string | null>(null);

  const view = $derived(data.kind);
  const review = $derived(data.kind === "review" ? currentReviewPage(data) : null);
  const title = $derived(data.kind === "home" ? "Home" : review?.title ?? data.title);
  const landingTab = $derived(review?.guide ? reviewLandingTab(review.guide) : "guide");
  const tab = $derived(
    review && session.reviewId === review.reviewId ? session.tab : (review?.tab ?? landingTab),
  );
  const layout = $derived(currentDiffLayout());
  const nextTheme = $derived(prefs.theme === "dark" ? "light" : "dark");
  const themeLabel = $derived(nextTheme === "dark" ? "Dark" : "Light");
  const host = $derived(review?.guide?.source);
  const hostGithub = $derived(host ? /github/i.test(host.host) : false);
  const hostLabel = $derived(hostGithub ? "Open in GitHub" : "Open in Azure DevOps");

  $effect.pre(() => {
    if (data.kind === "review" && data.status === "ok") {
      bindReview(data.reviewId, data.guide ?? {}, undefined, data.tab);
      adoptReviewPage(data);
    }
  });

  $effect(() => {
    if (typeof window === "undefined") return;
    if (data.kind !== "review" || data.status !== "ok") {
      openedCommentsFor = null;
      return;
    }
    const id = data.reviewId;
    if (openedCommentsFor === id) return;
    openedCommentsFor = id;
    void loadReviewThreads({
      reviewId: id,
      hosted: Boolean(data.guide?.source),
      reason: "open",
    });
  });

  onMount(() => {
    adoptLegacyTab();
    if (data.kind !== "review" || data.status !== "ok") return;
    if (data.activeId != null && data.activeId !== data.reviewId) {
      void fetchJson(`/api/reviews/${data.reviewId}/active`, { method: "POST" }).catch(() => undefined);
    }
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      const page = session.page;
      if (!page || page.kind !== "review") return;
      void loadReviewThreads({
        reviewId: page.reviewId,
        hosted: Boolean(page.guide?.source),
        reason: "focus",
      });
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  });

  function selectTab(next: ReviewTab): void {
    if (!review) return;
    if (session.reviewId !== review.reviewId) {
      bindReview(review.reviewId, review.guide ?? {}, undefined, review.tab);
    }
    setTab(next);
  }

  function pickLayout(next: "unified" | "split"): void {
    displayOpen = true;
    setDiffMode(next, tab);
  }

  function toggleTheme(): void {
    displayOpen = true;
    setTheme(nextTheme);
  }

  const tabs: { id: ReviewTab; label: string }[] = [
    { id: "diff", label: "Diff" },
    { id: "guide", label: "Guide" },
    { id: "discussion", label: "Discussion" },
  ];
  const discussionCount = $derived(projectDiscussionThreads(threadSession.threads).length);
</script>

<div
  id="app"
  data-view={view}
  data-tab={view === "review" ? tab : undefined}
  use:bindReviewChrome={{
    displayOpen: () => displayOpen,
    setDisplayOpen: (open) => {
      displayOpen = open;
    },
  }}
>
  <header>
    <div class="header-bar">
      <div class="header-left">
        <a class="brand-link" href={HOME_PATH} data-home>
          <img class="brand" src="/logo.svg" width="28" height="28" alt="" />
        </a>
        {#if view === "review"}
          <a class="back-link icon-btn" href={HOME_PATH} data-home aria-label="Back to Home" title="Back to Home">
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3 5 8l5 5" /></svg>
          </a>
        {/if}
        <h1>{title}</h1>
        {#if review?.guide}
          <DiffStats additions={review.guide.additions ?? 0} deletions={review.guide.deletions ?? 0} />
        {/if}
      </div>
      <div class="header-actions">
        {#if data.kind === "home" && data.status === "ok"}
          <HomeActions {data} />
          <button
            type="button"
            class="icon-btn square-toggle theme-toggle"
            aria-pressed={prefs.theme === "light" ? "true" : "false"}
            aria-label="Switch to {themeLabel} theme"
            title="Switch to {themeLabel} theme"
            onclick={() => setTheme(nextTheme)}
          >
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>
          </button>
        {:else if view === "review"}
          {#if host?.kind === "pull-request" && host.webUrl}
            <a class="icon-btn host-link" href={host.webUrl} target="_blank" rel="noreferrer" aria-label={hostLabel} title={hostLabel}>
              {#if hostGithub}
                <svg class="gh-mark" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
              {:else}
                <svg class="ado-mark" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="#0078D4" d="M0 8.877L2.247 5.91l8.405-3.416V.022l7.37 5.393L2.966 8.338v8.225L0 15.707zm24-4.45v14.651l-5.753 4.9-9.303-3.057v3.056l-5.978-7.416 15.057 1.798V5.415z"/></svg>
              {/if}
            </a>
          {/if}
          <details class="display-menu" data-display-menu bind:open={displayOpen}>
            <summary class="icon-btn" aria-label="Display">
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
            </summary>
            <div class="display-panel">
              <div class="display-modes" role="radiogroup" aria-label="Diff layout">
                <!-- svelte-ignore a11y_role_supports_aria_props_implicit -->
                <button type="button" class="display-mode" data-diff-mode="unified" aria-selected={layout === "unified" ? "true" : "false"} onclick={() => pickLayout("unified")}>
                  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="2.5" y="2.5" width="11" height="11" rx="1.5" /><path d="M5 6h6M5 8h6M5 10h6" /></svg>
                  Unified
                </button>
                <!-- svelte-ignore a11y_role_supports_aria_props_implicit -->
                <button type="button" class="display-mode" data-diff-mode="split" aria-selected={layout === "split" ? "true" : "false"} onclick={() => pickLayout("split")}>
                  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1.5" y="2.5" width="5.5" height="11" rx="1.5" /><rect x="9" y="2.5" width="5.5" height="11" rx="1.5" /></svg>
                  Split
                </button>
              </div>
              <div class="display-toggles">
                <button
                  type="button"
                  class="ghost"
                  data-hide-unchanged
                  aria-pressed={prefs.hideUnchanged ? "true" : "false"}
                  onclick={() => {
                    displayOpen = true;
                    setHideUnchanged(!prefs.hideUnchanged);
                  }}
                >
                  {prefs.hideUnchanged ? "Show unchanged" : "Hide unchanged"}
                </button>
                <button
                  type="button"
                  class="icon-btn square-toggle theme-toggle"
                  aria-pressed={prefs.theme === "light" ? "true" : "false"}
                  aria-label="Switch to {themeLabel} theme"
                  title="Switch to {themeLabel} theme"
                  onclick={toggleTheme}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>
                </button>
              </div>
            </div>
          </details>
        {/if}
      </div>
    </div>
    {#if view === "review"}
      <div class="view-tabs main-tabs" role="tablist">
        {#each tabs as item}
          <button
            type="button"
            role="tab"
            data-tab={item.id}
            aria-selected={tab === item.id ? "true" : "false"}
            onclick={() => selectTab(item.id)}
          >
            {item.label}{item.id === "discussion" && discussionCount ? ` (${discussionCount})` : ""}
          </button>
        {/each}
        {#if threadSession.loading}
          <p class="tab-loading" role="status">
            <span class="composer-spinner" aria-hidden="true"></span>
            Loading comments
          </p>
        {/if}
      </div>
      {#if review?.outdatedWarning}
        <div class="review-banner" role="status">{review.outdatedWarning}</div>
      {/if}
      {#if threadSession.error}
        <div class="review-banner" role="alert">
          {threadSession.error}
          <button type="button" class="ghost" data-retry-comments onclick={() => void retryReviewThreads()}>Retry</button>
        </div>
      {/if}
    {/if}
  </header>
  {#if data.status === "loading"}
    <p class="boot">Loading…</p>
  {:else if data.status === "error"}
    <p class="err">{data.error}</p>
  {:else if data.kind === "home"}
    <HomeView {data} />
  {:else if review}
    {#if review.guide}
      <GuideView
        guide={review.guide}
        hidden={tab !== "guide"}
      />
      <DiffView guide={review.guide} files={review.diff?.files} visible={tab === "diff"} />
    {/if}
    {#if tab === "review"}
      <nav aria-label="Code Review">
        <button type="button" class="col-handle" data-rail="sidebar" aria-label="Resize file list" use:resizeRail></button>
        <div class="nav-label">Code Review</div>
        {#if review.guide}
          <OutcomeRail base={review.guide.base} head={review.guide.head} outcomes={review.outcomes} />
        {/if}
      </nav>
      <main
        use:spyCurrent={{
          active: true,
          selector: ".outcome-section",
          onHit: (el) => {
            if (el.id) session.selectedOutcomeSection = el.id;
          },
        }}
      >
        <div class="main-inner">
          {#if review.guide}
            <OutcomeBody base={review.guide.base} head={review.guide.head} outcomes={review.outcomes} />
          {/if}
        </div>
      </main>
    {:else if tab === "discussion"}
      <DiscussionView />
    {:else if !review.guide && tab === "guide"}
      <main>
        <div class="main-inner">
          <div data-tab-panel="guide">Fake Guide</div>
        </div>
      </main>
    {:else if !review.guide && tab === "diff"}
      <main>
        <div class="main-inner">
          <div data-tab-panel="diff">Fake Diff</div>
        </div>
      </main>
    {/if}
  {/if}
</div>
