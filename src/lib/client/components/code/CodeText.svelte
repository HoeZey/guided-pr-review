<script lang="ts">
  import type { Seg } from "$lib/shared/domain/guide-view";
  import { syntaxPaint, type PaintParams } from "$lib/client/browser/syntax";

  let {
    content,
    lang,
    segments,
    lineType,
    theme = "dark",
  }: {
    content: string;
    lang: string;
    segments?: Seg[];
    lineType: string;
    theme?: "light" | "dark";
  } = $props();

  const params = $derived<PaintParams>({ content, lang, segments, lineType, theme });
</script>

<span
  class="code"
  data-lang={lang || undefined}
  data-raw={lang ? content : undefined}
  data-segments={segments ? JSON.stringify(segments) : undefined}
  use:syntaxPaint={params}>{content}</span
>
