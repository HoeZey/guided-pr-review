<script lang="ts">
  import type { Lined } from "$lib/shared/domain/guide-view";
  import CodeText from "./CodeText.svelte";

  let {
    side,
    line,
    lang,
    theme = "dark",
    commentable = false,
    selected = false,
    oncomment,
  }: {
    side: "left" | "right";
    line: Lined | null;
    lang: string;
    theme?: "light" | "dark";
    commentable?: boolean;
    selected?: boolean;
    oncomment?: (line: number, extend: boolean) => void;
  } = $props();

  const n = $derived(
    line
      ? side === "left"
        ? line.oldLine != null
          ? line.oldLine
          : ""
        : line.newLine != null
          ? line.newLine
          : ""
      : "",
  );
  const mark = $derived(
    line ? (line.type === "added" ? "+" : line.type === "removed" ? "−" : "") : "",
  );
  const current = $derived(
    Boolean(line && side === "right" && (line.type === "added" || line.type === "context") && line.newLine != null),
  );
</script>

{#if !line}
  <div class="line split-cell {side} empty"></div>
{:else}
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <div
    class="line split-cell {side} {line.type}"
    class:comment-selected={selected}
    data-comment-type={commentable && current ? line.type : undefined}
    data-comment-new={current ? line.newLine : undefined}
    onclick={
      commentable && current
        ? (event) => {
            if (line.newLine == null) return;
            oncomment?.(line.newLine, event.shiftKey);
          }
        : undefined
    }
  >
    <span class="gutter">{n}</span>
    <span class="mark">{mark}</span>
    <CodeText content={line.content} {lang} segments={line.segments} lineType={line.type} {theme} />
  </div>
{/if}
