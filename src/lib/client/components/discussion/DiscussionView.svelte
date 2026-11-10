<script lang="ts">
  import { composerSession, openCreateComposer } from "$lib/client/state/composer.svelte";
  import { threadSession, visibleDiscussionThreads } from "$lib/client/state/threads.svelte";
  import CommentStack from "../code/CommentStack.svelte";

  const threads = $derived(visibleDiscussionThreads());
  const showComposer = $derived(
    Boolean(
      threadSession.hosted &&
        composerSession.target?.kind === "create" &&
        composerSession.target.anchor.kind === "pr",
    ),
  );

  function startCreate(): void {
    if (!threadSession.reviewId) return;
    openCreateComposer(threadSession.reviewId, { kind: "pr" });
  }
</script>

<main data-tab-panel="discussion">
  <div class="main-inner discussion-list">
    <CommentStack {threads} {showComposer} discussion />
    {#if !threads.length && !showComposer}
      <p class="hint">No pull-request discussion yet.</p>
    {/if}
    {#if threadSession.hosted && threadSession.reviewId && !showComposer}
      <div class="composer-actions">
        <button type="button" class="ghost" data-discussion-new onclick={startCreate}>New comment</button>
      </div>
    {/if}
  </div>
</main>
