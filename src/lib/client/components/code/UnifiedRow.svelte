<script lang="ts">
  import type { Snippet } from "svelte";
  import type { Lined } from "$lib/shared/domain/guide-view";
  import CodeText from "./CodeText.svelte";

  let {
    line,
    lang,
    theme = "dark",
    commentable = false,
    selected = false,
    oncomment,
    onfilecomment,
    children,
  }: {
    line: Lined;
    lang: string;
    theme?: "light" | "dark";
    commentable?: boolean;
    selected?: boolean;
    oncomment?: (line: number, extend: boolean) => void;
    onfilecomment?: () => void;
    children?: Snippet;
  } = $props();

  const mark = $derived(line.type === "added" ? "+" : line.type === "removed" ? "−" : "");
  const current = $derived((line.type === "added" || line.type === "context") && line.newLine != null);
  const deletedOnly = $derived(line.type === "removed" && line.newLine == null);
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="line {line.type}"
  class:comment-selected={selected}
  data-comment-type={commentable && current ? line.type : undefined}
  data-comment-new={current ? line.newLine : undefined}
  data-comment-deleted={commentable && deletedOnly ? "true" : undefined}
  onclick={
    commentable && current
      ? (event) => {
          if (line.newLine == null) return;
          oncomment?.(line.newLine, event.shiftKey);
        }
      : commentable && deletedOnly
        ? () => onfilecomment?.()
        : undefined
  }
>
  <span class="gutter">{line.oldLine != null ? line.oldLine : ""}</span>
  <span class="gutter">{line.newLine != null ? line.newLine : ""}</span>
  <span class="mark">{mark}</span>
  <CodeText content={line.content} {lang} segments={line.segments} lineType={line.type} {theme} />
</div>
{@render children?.()}
