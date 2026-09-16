<script lang="ts">
  import type { Snippet } from "svelte";
  import type { Lined } from "$lib/shared/domain/guide-view";
  import CodeText from "./CodeText.svelte";

  let {
    line,
    lang,
    theme = "dark",
    children,
  }: {
    line: Lined;
    lang: string;
    theme?: "light" | "dark";
    children?: Snippet;
  } = $props();

  const mark = $derived(line.type === "added" ? "+" : line.type === "removed" ? "−" : "");
</script>

<div class="line {line.type}">
  <span class="gutter">{line.oldLine != null ? line.oldLine : ""}</span>
  <span class="gutter">{line.newLine != null ? line.newLine : ""}</span>
  <span class="mark">{mark}</span>
  <CodeText content={line.content} {lang} segments={line.segments} lineType={line.type} {theme} />
</div>
{@render children?.()}
