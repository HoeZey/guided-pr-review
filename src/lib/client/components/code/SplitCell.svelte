<script lang="ts">
  import type { Lined } from "$lib/shared/domain/guide-view";
  import CodeText from "./CodeText.svelte";

  let {
    side,
    line,
    lang,
    theme = "dark",
  }: {
    side: "left" | "right";
    line: Lined | null;
    lang: string;
    theme?: "light" | "dark";
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
</script>

{#if !line}
  <div class="line split-cell {side} empty"></div>
{:else}
  <div class="line split-cell {side} {line.type}">
    <span class="gutter">{n}</span>
    <span class="mark">{mark}</span>
    <CodeText content={line.content} {lang} segments={line.segments} lineType={line.type} {theme} />
  </div>
{/if}
