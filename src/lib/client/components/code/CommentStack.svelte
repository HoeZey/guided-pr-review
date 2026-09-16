<script lang="ts">
  import type { CommentMessage, CommentThread } from "$lib/shared/contracts/comments";
  import { composerSession, openReplyComposer } from "$lib/client/state/composer.svelte";
  import {
    deleteOwnedComment,
    threadSession,
    updateOwnedComment,
  } from "$lib/client/state/threads.svelte";
  import CommentComposer from "./CommentComposer.svelte";

  let {
    threads,
    showComposer = false,
  }: {
    threads: CommentThread[];
    showComposer?: boolean;
  } = $props();

  let editingId: string | null = $state(null);
  let confirmingId: string | null = $state(null);
  let draft = $state("");
  let busy = $state(false);
  let errorId: string | null = $state(null);
  let error = $state<string | null>(null);

  function stamp(iso: string): string {
    const ms = Date.parse(iso);
    return Number.isFinite(ms) ? new Date(ms).toLocaleString() : "";
  }

  function edited(message: CommentMessage): boolean {
    return message.updatedAt !== message.createdAt;
  }

  function replyOpen(threadId: string): boolean {
    return composerSession.target?.kind === "reply" && composerSession.target.threadId === threadId;
  }

  function startReply(threadId: string): void {
    if (!threadSession.reviewId) return;
    openReplyComposer(threadSession.reviewId, threadId);
  }

  function canMutate(message: CommentMessage): boolean {
    return Boolean(
      threadSession.hosted && threadSession.reviewId && message.ownedByCurrentUser && !message.deleted,
    );
  }

  function threadIdOf(commentId: string): string | undefined {
    return threads.find((thread) => thread.messages.some((row) => row.id === commentId))?.id;
  }

  function startEdit(message: CommentMessage): void {
    confirmingId = null;
    editingId = message.id;
    draft = message.body;
    errorId = null;
    error = null;
  }

  function cancelEdit(): void {
    editingId = null;
    draft = "";
    errorId = null;
    error = null;
  }

  function startDelete(message: CommentMessage): void {
    editingId = null;
    draft = "";
    confirmingId = message.id;
    errorId = null;
    error = null;
  }

  function cancelDelete(): void {
    confirmingId = null;
    errorId = null;
    error = null;
  }

  async function save(): Promise<void> {
    const commentId = editingId;
    const threadId = commentId ? threadIdOf(commentId) : undefined;
    if (!commentId || !threadId || busy || !draft.trim()) return;
    busy = true;
    errorId = null;
    error = null;
    try {
      await updateOwnedComment(threadId, commentId, draft);
      editingId = null;
      draft = "";
    } catch (err) {
      editingId = null;
      draft = "";
      errorId = commentId;
      error = err instanceof Error ? err.message : String(err);
    } finally {
      busy = false;
    }
  }

  async function confirmDelete(): Promise<void> {
    const commentId = confirmingId;
    const threadId = commentId ? threadIdOf(commentId) : undefined;
    if (!commentId || !threadId || busy) return;
    busy = true;
    errorId = null;
    error = null;
    try {
      await deleteOwnedComment(threadId, commentId);
      confirmingId = null;
    } catch (err) {
      confirmingId = null;
      errorId = commentId;
      error = err instanceof Error ? err.message : String(err);
    } finally {
      busy = false;
    }
  }
</script>

{#if threads.length || showComposer}
  <div class="comment-stack">
    {#each threads as thread (thread.id)}
      {@const root = thread.messages[0]}
      {#if root}
        <article class="comment-thread" data-thread={thread.id} data-status={thread.status}>
          <div class="thread-meta">
            <span>{root.author.login}</span>
            {#if stamp(root.createdAt)}<span> · {stamp(root.createdAt)}</span>{/if}
            {#if edited(root)}<span class="thread-flag">Edited</span>{/if}
            {#if root.deleted}<span class="thread-flag">Deleted</span>{/if}
            {#if thread.status !== "active"}
              <span class="thread-flag" class:is-resolved={thread.status === "closed"}>{thread.status}</span>
            {/if}
            {#if thread.outdated}<span class="thread-flag is-outdated">Outdated</span>{/if}
          </div>
          <div class="thread-body">
            {@render messageBody(root)}
            {#each thread.messages.slice(1) as message (message.id)}
              <div class="thread-reply">
                <div class="thread-meta">
                  <span>{message.author.login}</span>
                  {#if stamp(message.createdAt)}<span> · {stamp(message.createdAt)}</span>{/if}
                  {#if edited(message)}<span class="thread-flag">Edited</span>{/if}
                  {#if message.deleted}<span class="thread-flag">Deleted</span>{/if}
                </div>
                {@render messageBody(message)}
              </div>
            {/each}
            {#if threadSession.hosted && threadSession.reviewId}
              {#if replyOpen(thread.id)}
                <CommentComposer />
              {:else}
                <div class="composer-actions">
                  <button
                    type="button"
                    class="ghost"
                    data-comment-reply={thread.id}
                    onclick={() => startReply(thread.id)}
                  >
                    Reply
                  </button>
                </div>
              {/if}
            {/if}
          </div>
        </article>
      {/if}
    {/each}
    {#if showComposer}
      <CommentComposer />
    {/if}
  </div>
{/if}

{#snippet messageBody(message: CommentMessage)}
  {#if editingId === message.id}
    <div class="comment-composer">
      <textarea
        data-comment-edit-draft
        readonly={busy}
        value={draft}
        oninput={(event) => (draft = event.currentTarget.value)}
      ></textarea>
      <div class="composer-actions">
        <button type="button" class="ghost" data-comment-edit-cancel onclick={() => cancelEdit()}>Cancel</button>
        <button type="button" class="ghost" data-comment-save disabled={busy} onclick={() => void save()}>
          Save
        </button>
      </div>
    </div>
  {:else}
    <p class="thread-copy">{message.body}</p>
    {#if error && errorId === message.id}<p class="composer-error">{error}</p>{/if}
    {#if canMutate(message)}
      <div class="composer-actions">
        {#if confirmingId === message.id}
          <button type="button" class="ghost" data-comment-delete-cancel onclick={() => cancelDelete()}>
            Cancel
          </button>
          <button
            type="button"
            class="ghost"
            data-comment-delete-confirm
            disabled={busy}
            onclick={() => void confirmDelete()}
          >
            Delete
          </button>
        {:else}
          <button type="button" class="ghost" data-comment-edit={message.id} onclick={() => startEdit(message)}>
            Edit
          </button>
          <button type="button" class="ghost" data-comment-delete={message.id} onclick={() => startDelete(message)}>
            Delete
          </button>
        {/if}
      </div>
    {/if}
  {/if}
{/snippet}
