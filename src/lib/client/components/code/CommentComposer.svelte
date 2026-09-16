<script lang="ts">
  import {
    cancelComposer,
    composerSession,
    submitComposer,
    typeComposer,
  } from "$lib/client/state/composer.svelte";

  const sending = $derived(composerSession.delivery.state === "sending");
  const failed = $derived(composerSession.delivery.state === "failed");
  const content = $derived(composerSession.delivery.content);
  const error = $derived(
    composerSession.delivery.state === "failed" ? composerSession.delivery.error : null,
  );
  const sendLabel = $derived(sending ? "Sending" : failed ? "Retry" : "Send");
</script>

<div class="comment-composer" class:is-sending={sending} class:is-failed={failed} data-comment-composer>
  <textarea
    data-comment-draft
    placeholder="Comment"
    readonly={sending}
    value={content}
    oninput={(event) => typeComposer(event.currentTarget.value)}
  ></textarea>
  {#if sending}
    <p class="composer-status" role="status" aria-live="polite">
      <span class="composer-spinner" aria-hidden="true"></span>
      Sending
    </p>
  {/if}
  {#if error}<p class="composer-error">{error}</p>{/if}
  <div class="composer-actions">
    <button type="button" class="ghost" data-comment-cancel onclick={() => cancelComposer()}>Cancel</button>
    <button
      type="button"
      class="ghost"
      data-comment-send
      disabled={sending}
      onclick={() => void submitComposer()}
    >
      {sendLabel}
    </button>
  </div>
</div>
