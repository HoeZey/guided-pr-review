<script lang="ts">
  import { HOME_PATH, reviewLandingTab } from "$lib/shared/domain/overview";
  import type { HomePageData, ReviewPageData, ReviewTab } from "$lib/shared/page-data";
  import { prefs, setTheme } from "$lib/client/state/preferences.svelte";
  import { bindReview, session, setTab } from "$lib/client/state/review.svelte";
  import GuideView from "./guide/GuideView.svelte";
  import HomeActions from "./home/HomeActions.svelte";
  import HomeView from "./home/HomeView.svelte";

  let { data }: { data: HomePageData | ReviewPageData } = $props();

  const view = $derived(data.kind);
  const title = $derived(data.kind === "home" ? "Home" : data.title);
  const landingTab = $derived(
    data.kind === "review" && data.guide ? reviewLandingTab(data.guide) : "guide",
  );
  const tab = $derived(
    data.kind === "review" && session.reviewId === data.reviewId ? session.tab : landingTab,
  );
  const nextTheme = $derived(prefs.theme === "dark" ? "light" : "dark");
  const themeLabel = $derived(nextTheme === "dark" ? "Dark" : "Light");

  $effect(() => {
    if (data.kind === "review" && data.status === "ok") {
      bindReview(data.reviewId, data.guide ?? {});
    }
  });

  function selectTab(next: ReviewTab): void {
    if (data.kind !== "review") return;
    if (session.reviewId !== data.reviewId) bindReview(data.reviewId, data.guide ?? {});
    setTab(next);
  }

  const tabs: { id: ReviewTab; label: string }[] = [
    { id: "diff", label: "Diff" },
    { id: "guide", label: "Guide" },
    { id: "review", label: "Code Review" },
  ];
</script>

<div
  id="app"
  data-view={view}
  data-tab={view === "review" ? tab : undefined}
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
      </div>
      <div class="header-actions">
        {#if data.kind === "home" && data.status === "ok"}
          <HomeActions {data} />
        {/if}
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
            {item.label}
          </button>
        {/each}
      </div>
    {/if}
  </header>
  {#if data.status === "loading"}
    <p class="boot">Loading…</p>
  {:else if data.status === "error"}
    <p class="err">{data.error}</p>
  {:else if data.kind === "home"}
    <HomeView {data} />
  {:else}
    {#if data.guide}
      <GuideView
        guide={data.guide}
        reviewId={data.reviewId}
        agentConnected={data.agentConnected}
        hidden={tab !== "guide"}
      />
    {/if}
    {#if tab !== "guide"}
      <main>
        <div class="main-inner">
          <div data-tab-panel={tab}>Fake {tab === "review" ? "Code Review" : "Diff"}</div>
        </div>
      </main>
    {:else if !data.guide}
      <main>
        <div class="main-inner">
          <div data-tab-panel="guide">Fake Guide</div>
        </div>
      </main>
    {/if}
  {/if}
</div>
