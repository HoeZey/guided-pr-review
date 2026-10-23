import type { FileChange, Hunk } from "../contracts/guide.ts";
import { numberDiff } from "./numbered-diff.ts";

export type ChapterLineRef = { path: string; from?: number; to?: number };

export type ChapterRefInput = {
  title: string;
  why: string;
  refs: ChapterLineRef[];
};

export type CoverageError = {
  missing: Record<string, [number, number][]>;
  duplicated: Record<string, [number, number][]>;
  unknownPaths: string[];
  partialStubs: string[];
};

export type ResolvedChapter = {
  title: string;
  why: string;
  open?: true;
  additions: number;
  deletions: number;
  files: FileChange[];
};

type FilePlan =
  | { kind: "binary" }
  | { kind: "stub"; additions: number; deletions: number }
  | { kind: "file"; total: number };

const PAD = 3;

function sectionText(header: string | undefined): string {
  if (!header) return "";
  const at = header.indexOf("@@", 2);
  if (at === -1) return "";
  return header.slice(at + 2);
}

function toRanges(nums: Iterable<number>): [number, number][] {
  const sorted = [...nums].sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  const ranges: [number, number][] = [];
  let start = sorted[0]!;
  let prev = sorted[0]!;
  for (let i = 1; i < sorted.length; i += 1) {
    const n = sorted[i]!;
    if (n === prev + 1) {
      prev = n;
      continue;
    }
    ranges.push([start, prev]);
    start = n;
    prev = n;
  }
  ranges.push([start, prev]);
  return ranges;
}

function planFiles(files: FileChange[]): Map<string, FilePlan> {
  const plan = new Map<string, FilePlan>();
  for (const numbered of numberDiff(files)) {
    if (numbered.kind === "binary") {
      plan.set(numbered.path, { kind: "binary" });
      continue;
    }
    if (numbered.kind === "stub") {
      plan.set(numbered.path, {
        kind: "stub",
        additions: numbered.additions,
        deletions: numbered.deletions,
      });
      continue;
    }
    let total = 0;
    for (const hunk of numbered.hunks) {
      for (const line of hunk.lines) {
        if (line.number !== undefined) total += 1;
      }
    }
    plan.set(numbered.path, { kind: "file", total });
  }
  return plan;
}

function isRangeRef(ref: ChapterLineRef): ref is { path: string; from: number; to: number } {
  return ref.from !== undefined || ref.to !== undefined;
}

function recordHit(
  hits: Map<string, number[]>,
  path: string,
  from: number,
  to: number,
): void {
  const list = hits.get(path) ?? [];
  for (let n = from; n <= to; n += 1) list.push(n);
  hits.set(path, list);
}

export function chapterCoverageError(
  files: FileChange[],
  chapters: ChapterRefInput[],
): CoverageError | null {
  const plan = planFiles(files);
  const unknownPaths: string[] = [];
  const partialStubs: string[] = [];
  const hits = new Map<string, number[]>();
  const seenUnknown = new Set<string>();
  const seenPartial = new Set<string>();

  for (const chapter of chapters) {
    for (const ref of chapter.refs) {
      const entry = plan.get(ref.path);
      if (!entry || entry.kind === "binary") {
        if (!seenUnknown.has(ref.path)) {
          seenUnknown.add(ref.path);
          unknownPaths.push(ref.path);
        }
        continue;
      }
      if (entry.kind === "stub") {
        if (isRangeRef(ref)) {
          if (!seenPartial.has(ref.path)) {
            seenPartial.add(ref.path);
            partialStubs.push(ref.path);
          }
          continue;
        }
        recordHit(hits, ref.path, 1, 1);
        continue;
      }
      if (isRangeRef(ref)) {
        const from = ref.from ?? ref.to!;
        const to = ref.to ?? ref.from!;
        if (from <= to) {
          recordHit(
            hits,
            ref.path,
            Math.max(1, from),
            Math.min(entry.total, to),
          );
        }
        continue;
      }
      recordHit(hits, ref.path, 1, entry.total);
    }
  }

  const missing: Record<string, [number, number][]> = {};
  const duplicated: Record<string, [number, number][]> = {};

  for (const [path, entry] of plan) {
    if (entry.kind === "binary") continue;
    const total = entry.kind === "stub" ? 1 : entry.total;
    if (total === 0) continue;
    const counts = new Map<number, number>();
    for (const n of hits.get(path) ?? []) {
      counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    const miss: number[] = [];
    const dup: number[] = [];
    for (let n = 1; n <= total; n += 1) {
      const c = counts.get(n) ?? 0;
      if (c === 0) miss.push(n);
      else if (c > 1) dup.push(n);
    }
    if (miss.length) missing[path] = toRanges(miss);
    if (dup.length) duplicated[path] = toRanges(dup);
  }

  if (
    Object.keys(missing).length === 0 &&
    Object.keys(duplicated).length === 0 &&
    unknownPaths.length === 0 &&
    partialStubs.length === 0
  ) {
    return null;
  }
  return { missing, duplicated, unknownPaths, partialStubs };
}

function countLines(lines: Hunk["lines"]): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const line of lines) {
    if (line.type === "added") additions += 1;
    if (line.type === "removed") deletions += 1;
  }
  return { additions, deletions };
}

type Labeled = {
  line: Hunk["lines"][number];
  number?: number;
  oldCursor: number;
  newCursor: number;
};

function labelHunk(hunk: Hunk, nextNumber: { value: number }): Labeled[] {
  let oldCursor = hunk.oldStart ?? 0;
  let newCursor = hunk.newStart ?? 0;
  return hunk.lines.map((line) => {
    const labeled: Labeled = { line, oldCursor, newCursor };
    if (line.type === "context") {
      oldCursor += 1;
      newCursor += 1;
      return labeled;
    }
    labeled.number = nextNumber.value;
    nextNumber.value += 1;
    if (line.type === "removed") oldCursor += 1;
    else newCursor += 1;
    return labeled;
  });
}

function padSlice(labeled: Labeled[], coreStart: number, coreEnd: number): Labeled[] {
  let start = coreStart;
  let end = coreEnd;
  let left = 0;
  while (start > 0 && left < PAD && labeled[start - 1]!.line.type === "context") {
    start -= 1;
    left += 1;
  }
  let right = 0;
  while (end + 1 < labeled.length && right < PAD && labeled[end + 1]!.line.type === "context") {
    end += 1;
    right += 1;
  }
  return labeled.slice(start, end + 1);
}

function hunkFromLabeled(original: Hunk, slice: Labeled[]): Hunk {
  const first = slice[0]!;
  const oldStart = first.oldCursor;
  const newStart = first.newCursor;
  const lines = slice.map((row) => ({ ...row.line }));
  const { additions, deletions } = countLines(lines);
  const oldCount = lines.length - additions;
  const newCount = lines.length - deletions;
  const section = sectionText(original.header);
  return {
    header: `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@${section}`,
    oldStart,
    newStart,
    lines,
  };
}

function resolveFileRef(
  file: FileChange,
  from: number,
  to: number,
  numberBase: { value: number },
): Hunk[] {
  const hunks: Hunk[] = [];
  for (const hunk of file.hunks ?? []) {
    const labeled = labelHunk(hunk, numberBase);
    const selectedIdx: number[] = [];
    for (let i = 0; i < labeled.length; i += 1) {
      const n = labeled[i]!.number;
      if (n !== undefined && n >= from && n <= to) selectedIdx.push(i);
    }
    if (selectedIdx.length === 0) continue;
    const coreStart = selectedIdx[0]!;
    const coreEnd = selectedIdx[selectedIdx.length - 1]!;
    const slice = padSlice(labeled, coreStart, coreEnd);
    hunks.push(hunkFromLabeled(hunk, slice));
  }
  return hunks;
}

function fileByPath(files: FileChange[], path: string): FileChange | undefined {
  return files.find((file) => file.path === path);
}

function resolveRefToFiles(
  files: FileChange[],
  plan: Map<string, FilePlan>,
  ref: ChapterLineRef,
): FileChange | null {
  const entry = plan.get(ref.path);
  if (!entry || entry.kind === "binary") return null;
  if (entry.kind === "stub") {
    return {
      path: ref.path,
      stub: true,
      additions: entry.additions,
      deletions: entry.deletions,
    };
  }
  const source = fileByPath(files, ref.path);
  if (!source) return null;
  let from = 1;
  let to = entry.total;
  if (isRangeRef(ref)) {
    from = ref.from ?? ref.to!;
    to = ref.to ?? ref.from!;
  }
  const base = { value: 1 };
  const hunks = resolveFileRef(source, from, to, base);
  if (hunks.length === 0) return null;
  const counts = { additions: 0, deletions: 0 };
  for (const hunk of hunks) {
    const c = countLines(hunk.lines);
    counts.additions += c.additions;
    counts.deletions += c.deletions;
  }
  return {
    path: ref.path,
    ...(source.language ? { language: source.language } : {}),
    hunks,
    additions: counts.additions,
    deletions: counts.deletions,
  };
}

function mergeFilesInOrder(parts: FileChange[]): FileChange[] {
  const order: string[] = [];
  const byPath = new Map<string, FileChange>();
  for (const part of parts) {
    const existing = byPath.get(part.path);
    if (!existing) {
      order.push(part.path);
      byPath.set(
        part.path,
        part.hunks
          ? { ...part, hunks: [...part.hunks] }
          : { ...part },
      );
      continue;
    }
    if (part.stub || existing.stub) {
      byPath.set(part.path, part);
      continue;
    }
    existing.hunks = [...(existing.hunks ?? []), ...(part.hunks ?? [])];
    existing.additions = (existing.additions ?? 0) + (part.additions ?? 0);
    existing.deletions = (existing.deletions ?? 0) + (part.deletions ?? 0);
  }
  return order.map((path) => byPath.get(path)!);
}

export function resolveChapterRefs(
  files: FileChange[],
  chapters: ChapterRefInput[],
): { ok: true; chapters: ResolvedChapter[] } | { ok: false; error: CoverageError } {
  const error = chapterCoverageError(files, chapters);
  if (error) return { ok: false, error };
  const plan = planFiles(files);
  const resolved: ResolvedChapter[] = chapters.map((chapter, index) => {
    const parts: FileChange[] = [];
    for (const ref of chapter.refs) {
      const part = resolveRefToFiles(files, plan, ref);
      if (part) parts.push(part);
    }
    const merged = mergeFilesInOrder(parts);
    let additions = 0;
    let deletions = 0;
    for (const file of merged) {
      additions += file.additions ?? 0;
      deletions += file.deletions ?? 0;
    }
    return {
      title: chapter.title,
      why: chapter.why,
      ...(index === 0 ? { open: true as const } : {}),
      additions,
      deletions,
      files: merged,
    };
  });
  return { ok: true, chapters: resolved };
}
