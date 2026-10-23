<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import { projectHomeOverview } from "$lib/shared/domain/overview";
  import type { HomePageData } from "$lib/shared/page-data";
  import {
    formatLastSynced,
    filteredSearchableRepositories,
    homeListed,
    homeRepositories,
    homeUi,
    leaveHome,
    loadRepositories,
    loadSearchableRepositories,
    addRepository,
    removeRepository,
    refreshCatalog,
    stopHomeWatch,
    syncHomeWatch,
  } from "$lib/client/state/home.svelte";
  import { connectionUi, loadConnections } from "$lib/client/state/connection.svelte";
  import {
    HOME_GROUPS_KEY,
    browserLocalStorage,
    parseHomeGroups,
    writePref,
  } from "$lib/client/browser/preferences";
  import type { HomeGroup } from "$lib/shared/domain/overview";
  import HomeCard from "./HomeCard.svelte";

  let { data }: { data: HomePageData } = $props();

  const listed = $derived(homeListed(data));
  const configured = $derived(homeRepositories(data));
  const overview = $derived(projectHomeOverview(listed.reviews, listed.catalog));
  const searchable = $derived(filteredSearchableRepositories());
  let openMenu = $state<"github" | "azure-devops" | null>(null);
  let confirmRemove = $state<string | null>(null);
  let sectionOpenState = $state<Record<string, boolean>>({});

  function sectionOpen(group: HomeGroup): boolean {
    if (group.id in sectionOpenState) return sectionOpenState[group.id];
    return !group.collapsed;
  }

  function rememberSection(id: string, open: boolean): void {
    if (sectionOpenState[id] === open) return;
    sectionOpenState = { ...sectionOpenState, [id]: open };
    writePref(browserLocalStorage(), HOME_GROUPS_KEY, JSON.stringify(sectionOpenState));
  }

  function onSectionToggle(id: string, event: Event): void {
    const details = event.currentTarget;
    if (!(details instanceof HTMLDetailsElement)) return;
    rememberSection(id, details.open);
  }

  function repoCatalogError(repo: { provider: string; owner: string; name: string }) {
    return overview.catalogErrors.find(
      (entry) =>
        entry.provider === repo.provider && entry.owner === repo.owner && entry.name === repo.name,
    );
  }

  function looseCatalogErrors(provider: "github" | "azure-devops") {
    return overview.catalogErrors.filter(
      (entry) =>
        entry.provider === provider &&
        !configured.some(
          (repo) =>
            repo.provider === provider && repo.owner === entry.owner && repo.name === entry.name,
        ),
    );
  }

  function repoLabel(row: { provider: string; owner: string; name: string }): string {
    if (row.provider === "azure-devops") return row.name;
    return `${row.owner} / ${row.name}`;
  }

  function menuCandidates(provider: "github" | "azure-devops") {
    const added = new Set(
      configured
        .filter((repo) => repo.provider === provider)
        .map((repo) => `${repo.host}:${repo.owner}/${repo.name}`),
    );
    return searchable.filter(
      (row) => row.provider === provider && !added.has(`${row.host}:${row.owner}/${row.name}`),
    );
  }
  const hasContent = $derived(
    overview.groups.length > 0 ||
      overview.catalogErrors.length > 0 ||
      Boolean(overview.lastSynced) ||
      Boolean(homeUi.pasteError) ||
      Boolean(homeUi.refreshError) ||
      Boolean(homeUi.repositoryError) ||
      Boolean(homeUi.refreshing) ||
      configured.length > 0 ||
      searchable.length > 0 ||
      Boolean(homeUi.searchable) ||
      connectionUi.busy ||
      connectionUi.connections.length > 0 ||
      Boolean(connectionUi.error),
  );

  $effect(() => {
    syncHomeWatch(listed.actions);
    return () => stopHomeWatch();
  });

  $effect(() => {
    if (!openMenu && !confirmRemove) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (openMenu && !target.closest(".repo-add")) openMenu = null;
      if (confirmRemove && !target.closest(".repo-row")) confirmRemove = null;
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  });

  onMount(() => {
    sectionOpenState = parseHomeGroups(browserLocalStorage()?.getItem(HOME_GROUPS_KEY) ?? null);
    void loadConnections();
    void loadRepositories();
    void loadSearchableRepositories();
    void refreshCatalog("focus");
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void refreshCatalog("focus");
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  });

  onDestroy(() => {
    leaveHome();
  });
</script>

<main class="home-main">
  <div class="main-inner home-columns">
    <div class="home-column home-column-cards" data-home-cards>
      {#if hasContent}
        {#if homeUi.pasteError}
          <p class="home-error">{homeUi.pasteError}</p>
        {/if}
        {#if homeUi.refreshError}
          <p class="home-error" data-refresh-error>{homeUi.refreshError}</p>
        {/if}
        {#each overview.groups as group (group.id)}
          <details
            class="home-group"
            class:is-archived={group.collapsed}
            open={sectionOpen(group)}
            ontoggle={(event) => onSectionToggle(group.id, event)}
          >
            <summary><h2>{group.title}</h2></summary>
            <div class="home-grid">
              {#each group.cards as card (card.id)}
                <HomeCard {card} actions={listed.actions} agentConnected={listed.agentConnected} />
              {/each}
            </div>
          </details>
        {/each}
      {:else}
        <p class="boot">No reviews yet. Add one from MCP.</p>
      {/if}
    </div>
    <aside class="home-column home-column-controls" data-home-controls>
      {#if overview.lastSynced}
        <p class="home-meta">Last synced {formatLastSynced(overview.lastSynced)}</p>
      {/if}
      {#snippet hostSection(provider: "github" | "azure-devops", label: string)}
        {@const account = connectionUi.connections.find((row) => row.provider === provider)}
        <section class="host-section" data-host={provider}>
          <h2 class="host-heading">
            {#if provider === "github"}
              <svg viewBox="0 0 16 16" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"
                />
              </svg>
            {:else}
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#0078D4"
                  d="M0 8.877L2.247 5.91l8.405-3.416V.022l7.37 5.393L2.966 8.338v8.225L0 15.707zm24-4.45v14.651l-5.753 4.9-9.303-3.057v3.056l-5.978-7.416 15.057 1.798V5.415z"
                />
              </svg>
            {/if}
            <span class="host-name">{label}</span>
            {#if account?.status === "connected" && account.login}
              <span class="host-account" data-connection={provider} title={account.login}>
                {account.login}
              </span>
            {/if}
          </h2>
          {#each looseCatalogErrors(provider) as entry (`${entry.owner}/${entry.name}`)}
            <p class="home-error" data-catalog-error={`${entry.provider}:${entry.owner}/${entry.name}`}>
              {entry.name}: {entry.message}
            </p>
          {/each}
          {#if account && account.status !== "connected"}
            <p class="home-error" data-connection={provider}>
              {account.recovery}
              <button
                type="button"
                class="ghost"
                data-retry-connection={provider}
                disabled={connectionUi.busy}
                onclick={() => void loadConnections("POST")}
              >
                Retry
              </button>
            </p>
          {/if}
          {#if provider === "azure-devops"}
            <div class="home-ado-fields">
              <label>
                Organization
                <input
                  data-ado-organization
                  bind:value={homeUi.adoOrganization}
                  onchange={() => void loadSearchableRepositories()}
                />
              </label>
              <label>
                Project
                <input
                  data-ado-project
                  bind:value={homeUi.adoProject}
                  onchange={() => void loadSearchableRepositories()}
                />
              </label>
            </div>
          {/if}
          <div class="repo-list">
          {#each configured.filter((repo) => repo.provider === provider) as repo (repo.provider + repo.host + repo.id)}
            {@const catalogError = repoCatalogError(repo)}
            <p class="home-meta repo-row" data-configured-repository={repo.id}>
              <span class="repo-text">
                <span class="repo-name" title={repoLabel(repo)}>
                  {repoLabel(repo)}{repo.origin ? " · origin" : ""}
                </span>
                {#if catalogError}
                  <span class="repo-error" data-catalog-error={repo.id}>{catalogError.message}</span>
                {/if}
              </span>
              <button
                type="button"
                class="repo-remove"
                data-remove-repository={repo.id}
                aria-label={`Remove ${repoLabel(repo)}`}
                disabled={homeUi.repositoryBusy}
                onclick={() => {
                  confirmRemove = repo.id;
                }}
              >
                ×
              </button>
              {#if confirmRemove === repo.id}
                <span class="repo-confirm">
                  Remove {repoLabel(repo)}?
                  <button
                    type="button"
                    data-confirm-remove={repo.id}
                    disabled={homeUi.repositoryBusy}
                    onclick={() => {
                      confirmRemove = null;
                      void removeRepository(repo.id);
                    }}
                  >
                    Remove
                  </button>
                  <button type="button" onclick={() => (confirmRemove = null)}>Cancel</button>
                </span>
              {/if}
            </p>
          {/each}
          </div>
          <div class="repo-add">
            <button
              type="button"
              class="repo-add-toggle"
              data-open-repo-menu={provider}
              aria-label={`Add ${label} repository`}
              aria-expanded={openMenu === provider}
              onclick={() => {
                openMenu = openMenu === provider ? null : provider;
              }}
            >
              +
            </button>
            {#if openMenu === provider}
              <div class="repo-menu">
                <input
                  data-repository-search
                  bind:value={homeUi.repositoryInput}
                  placeholder="Filter"
                  aria-label="Search repositories"
                />
                {#each menuCandidates(provider) as candidate (`${candidate.host}:${candidate.owner}/${candidate.name}`)}
                  <button
                    type="button"
                    data-add-repository={`${candidate.owner}/${candidate.name}`}
                    disabled={homeUi.repositoryBusy}
                    onclick={() => void addRepository(candidate)}
                  >
                    {repoLabel(candidate)}
                  </button>
                {:else}
                  <p class="home-meta">No repositories</p>
                {/each}
              </div>
            {/if}
          </div>
        </section>
      {/snippet}
      {@render hostSection("github", "GitHub")}
      {@render hostSection("azure-devops", "Azure DevOps")}
      {#if homeUi.repositoryError}
        <p class="home-error" data-repository-error>{homeUi.repositoryError}</p>
      {/if}
      {#if connectionUi.busy && connectionUi.connections.length === 0}
        <p class="home-meta">Connecting</p>
      {/if}
      {#if connectionUi.error}
        <p class="home-error">{connectionUi.error}</p>
      {/if}
    </aside>
  </div>
</main>
