<script lang="ts">
  import { session } from "$lib/client/state/review.svelte";
  import { pathParts } from "../code/project";
  import { fileId, sectionId, type GuideNavChapter } from "./project";

  let {
    chapters,
    selectedChapterId,
    selectedPath,
    fileKey,
    hidden = false,
    onjumpFile,
    onjumpChapter,
    onenter,
    onleave,
  }: {
    chapters: GuideNavChapter[];
    selectedChapterId: string | null;
    selectedPath: string | null;
    fileKey: (chapterId: string, path: string) => string;
    hidden?: boolean;
    onjumpFile: (chapterId: string, path: string, id: string) => void;
    onjumpChapter: (chapterId: string) => void;
    onenter: () => void;
    onleave: () => void;
  } = $props();
</script>

<aside class="toc-anchor" {hidden}>
  <div
    class="toc-cluster"
    data-toc-anchor
    role="group"
    onpointerenter={onenter}
    onpointerleave={onleave}
  >
    <div class="toc-hotzone">
      <div class="toc-rail" aria-label="Guide files">
        {#each chapters as ch}
          {#each ch.files as file, fi (file.path)}
            {@const id = fileId(ch.id, fi)}
            {@const current = ch.id === selectedChapterId && file.path === selectedPath}
            <button
              type="button"
              class={session.viewed.has(fileKey(ch.id, file.path)) ? "toc-tick is-reviewed" : "toc-tick"}
              data-jump={id}
              data-chapter={ch.id}
              data-path={file.path}
              aria-label={pathParts(file.path).name}
              aria-current={current ? "true" : "false"}
              onclick={() => onjumpFile(ch.id, file.path, id)}
            ></button>
          {/each}
        {/each}
      </div>
    </div>
    <nav class="toc-panel" id="guide-toc" aria-label="Guide sections">
      <div class="nav-label">Sections</div>
      {#each chapters as ch, i}
        <div class="toc-group">
          <button
            type="button"
            class="chapter-btn"
            data-jump={sectionId(ch.id)}
            data-chapter={ch.id}
            aria-current={ch.id === selectedChapterId ? "true" : "false"}
            onclick={() => onjumpChapter(ch.id)}
          >
            <span class="idx">{String(i + 1).padStart(2, "0")}</span>
            <span class="ch-title">{ch.title}</span>
          </button>
          {#each ch.files as file, fi (file.path)}
            {@const id = fileId(ch.id, fi)}
            {@const current = ch.id === selectedChapterId && file.path === selectedPath}
            <button
              type="button"
              class={session.viewed.has(fileKey(ch.id, file.path)) ? "toc-file viewed-link" : "toc-file"}
              data-jump={id}
              data-chapter={ch.id}
              data-path={file.path}
              title={file.path}
              aria-current={current ? "true" : "false"}
              onclick={() => onjumpFile(ch.id, file.path, id)}
            >
              <span class="toc-file-name">{pathParts(file.path).name}</span>
            </button>
          {/each}
        </div>
      {/each}
    </nav>
  </div>
</aside>
