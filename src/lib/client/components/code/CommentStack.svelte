<script lang="ts">
  import type { CommentMessage, CommentThread } from "$lib/shared/contracts/comments";

  let { threads }: { threads: CommentThread[] } = $props();

  function stamp(iso: string): string {
    const ms = Date.parse(iso);
    return Number.isFinite(ms) ? new Date(ms).toLocaleString() : "";
  }

  function edited(message: CommentMessage): boolean {
    return message.updatedAt !== message.createdAt;
  }
</script>

{#if threads.length}
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
            <p class="thread-copy">{root.body}</p>
            {#each thread.messages.slice(1) as message (message.id)}
              <div class="thread-reply">
                <div class="thread-meta">
                  <span>{message.author.login}</span>
                  {#if stamp(message.createdAt)}<span> · {stamp(message.createdAt)}</span>{/if}
                  {#if edited(message)}<span class="thread-flag">Edited</span>{/if}
                  {#if message.deleted}<span class="thread-flag">Deleted</span>{/if}
                </div>
                <p class="thread-copy">{message.body}</p>
              </div>
            {/each}
          </div>
        </article>
      {/if}
    {/each}
  </div>
{/if}
