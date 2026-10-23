import type { FileChange, GuideV1 } from "$lib/shared/contracts/guide";
import { guideSpyFileIndex } from "$lib/shared/domain/guide-view";

export const OMITTED_CHAPTER_ID = "__omitted__";

export type GuideNavChapter = {
  id: string;
  kind: string;
  title: string;
  why: string;
  files: FileChange[];
  _omitted?: boolean;
};

export function sectionId(chapterId: string): string {
  return `section-${chapterId}`;
}

export function fileId(chapterId: string, index: number): string {
  return `file-${chapterId}-${index}`;
}

export function chaptersForNav(data: Pick<GuideV1, "chapters" | "omitted">): GuideNavChapter[] {
  const list: GuideNavChapter[] = data.chapters.map((chapter) => ({
    id: chapter.id,
    kind: chapter.kind ?? "",
    title: chapter.title,
    why: chapter.why,
    files: chapter.files,
  }));
  if (data.omitted?.length) {
    list.push({
      id: OMITTED_CHAPTER_ID,
      kind: "noise",
      title: "Omitted",
      why: "Binary or unreadable paths.",
      files: [],
      _omitted: true,
    });
  }
  return list;
}

export function progressParts(index: number, total: number): { idx: string; tot: string } {
  return {
    idx: String(index + 1).padStart(2, "0"),
    tot: String(total).padStart(2, "0"),
  };
}

export function readGuideSpy(main: HTMLElement): {
  chapterId: string | null;
  path: string | null;
} {
  const mainRect = main.getBoundingClientRect();
  const probe = mainRect.top + Math.min(120, mainRect.height * 0.4);
  const files = [...main.querySelectorAll<HTMLElement>(".file.stage")];
  const atEnd = main.scrollTop + main.clientHeight >= main.scrollHeight - 8;
  const idx = guideSpyFileIndex(
    files.map((el) => {
      const box = el.getBoundingClientRect();
      return { top: box.top, bottom: box.bottom };
    }),
    probe,
    atEnd,
  );
  const file = idx >= 0 ? files[idx] : null;
  if (file) {
    const section = file.closest(".guide-section");
    const chapterId =
      section?.id.startsWith("section-") ? section.id.slice("section-".length) : null;
    return { chapterId, path: file.dataset.path ?? null };
  }
  const sections = main.querySelectorAll<HTMLElement>(".guide-section");
  let section: HTMLElement | null = null;
  for (const el of sections) {
    if (el.getBoundingClientRect().top <= probe) section = el;
  }
  const chapterId =
    section?.id.startsWith("section-") ? section.id.slice("section-".length) : null;
  return { chapterId, path: null };
}
