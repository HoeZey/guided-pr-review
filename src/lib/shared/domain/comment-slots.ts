import type { CommentThread } from "../contracts/comments.ts";
import type { FileChange } from "../contracts/guide.ts";
import {
  isUnchangedGap,
  pairWordDiff,
  splitRows,
  withUnchangedGaps,
  type DiffLayout,
  type DiffLine,
  type Lined,
  type SplitRow,
  type UnchangedGap,
} from "./guide-view.ts";

export type ThreadSurface = "guide" | "diff";
export type CommentSlotSide = "unified" | "left" | "right";

export type ProjectedInlineThreads = {
  header: Map<number, CommentThread[]>;
  after: Map<string, CommentThread[]>;
};

type VisibleHunk =
  | { split: false; items: (Lined | UnchangedGap)[] }
  | { split: true; items: (SplitRow | UnchangedGap)[] };

type LineSlot = { hunkIndex: number; itemIndex: number; side: CommentSlotSide };

function splitRowUnchanged(row: SplitRow): boolean {
  const types = [row.left?.type, row.right?.type].filter((t): t is string => Boolean(t));
  return types.length > 0 && types.every((t) => t === "context");
}

function isCurrentSide(line: DiffLine | null | undefined): line is DiffLine {
  return Boolean(line && (line.type === "added" || line.type === "context") && line.newLine != null);
}

function inRange(line: DiffLine, start: number, end: number): boolean {
  return line.newLine != null && line.newLine >= start && line.newLine <= end;
}

function visibleHunks(file: FileChange, layout: DiffLayout, hideUnchanged: boolean): VisibleHunk[] {
  return (file.hunks ?? []).map((hunk) => {
    const lined = pairWordDiff(hunk.lines ?? []);
    if (layout === "split") {
      return {
        split: true as const,
        items: withUnchangedGaps(splitRows(lined), hideUnchanged, splitRowUnchanged),
      };
    }
    return {
      split: false as const,
      items: withUnchangedGaps(lined, hideUnchanged, (line) => line.type === "context"),
    };
  });
}

function lastCurrentSide(hunk: VisibleHunk, hunkIndex: number): LineSlot | null {
  let last: LineSlot | null = null;
  if (hunk.split) {
    hunk.items.forEach((item, itemIndex) => {
      if (isUnchangedGap(item)) return;
      if (isCurrentSide(item.right)) last = { hunkIndex, itemIndex, side: "right" };
    });
    return last;
  }
  hunk.items.forEach((item, itemIndex) => {
    if (isUnchangedGap(item)) return;
    if (isCurrentSide(item)) last = { hunkIndex, itemIndex, side: "unified" };
  });
  return last;
}

function rangeHits(hunk: VisibleHunk, hunkIndex: number, start: number, end: number): LineSlot[] {
  const hits: LineSlot[] = [];
  if (hunk.split) {
    hunk.items.forEach((item, itemIndex) => {
      if (isUnchangedGap(item)) return;
      if (isCurrentSide(item.right) && inRange(item.right, start, end)) {
        hits.push({ hunkIndex, itemIndex, side: "right" });
      }
    });
    return hits;
  }
  hunk.items.forEach((item, itemIndex) => {
    if (isUnchangedGap(item)) return;
    if (isCurrentSide(item) && inRange(item, start, end)) {
      hits.push({ hunkIndex, itemIndex, side: "unified" });
    }
  });
  return hits;
}

function collectSlots(hunks: VisibleHunk[], start: number, end: number, wholeHunk: boolean): LineSlot[] {
  const slots: LineSlot[] = [];
  hunks.forEach((hunk, hunkIndex) => {
    const hits = rangeHits(hunk, hunkIndex, start, end);
    if (!hits.length) return;
    if (wholeHunk) {
      const endOfHunk = lastCurrentSide(hunk, hunkIndex);
      if (endOfHunk) slots.push(endOfHunk);
      return;
    }
    slots.push(...hits);
  });
  return slots;
}

function firstFileSlot(
  files: FileChange[],
  path: string,
  layout: DiffLayout,
  hideUnchanged: boolean,
  start: number,
  end: number,
  wholeHunk: boolean,
): { fileIndex: number; slot: LineSlot } | null {
  for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
    if (files[fileIndex].path !== path) continue;
    const slots = collectSlots(visibleHunks(files[fileIndex], layout, hideUnchanged), start, end, wholeHunk);
    if (!slots.length) continue;
    return { fileIndex, slot: wholeHunk ? slots[0]! : slots[slots.length - 1]! };
  }
  return null;
}

function append(map: Map<number | string, CommentThread[]>, key: number | string, thread: CommentThread): void {
  const list = map.get(key) ?? [];
  list.push(thread);
  map.set(key, list);
}

export function afterKey(
  fileIndex: number,
  hunkIndex: number,
  itemIndex: number,
  side: CommentSlotSide,
): string {
  return `${fileIndex}:${hunkIndex}:${itemIndex}:${side}`;
}

export function headerThreads(projected: ProjectedInlineThreads, fileIndex: number): CommentThread[] {
  return projected.header.get(fileIndex) ?? [];
}

export function threadsAfter(
  projected: ProjectedInlineThreads,
  fileIndex: number,
  hunkIndex: number,
  itemIndex: number,
  side: CommentSlotSide,
): CommentThread[] {
  return projected.after.get(afterKey(fileIndex, hunkIndex, itemIndex, side)) ?? [];
}

export function projectInlineThreads(
  threads: CommentThread[],
  files: FileChange[],
  opts: { layout: DiffLayout; hideUnchanged: boolean; surface: ThreadSurface },
): ProjectedInlineThreads {
  const header = new Map<number, CommentThread[]>();
  const after = new Map<string, CommentThread[]>();
  const wholeHunk = opts.surface === "guide";
  for (const thread of threads) {
    const { anchor } = thread;
    if (anchor.kind === "pr" || anchor.kind === "stale") continue;
    if (anchor.kind === "file") {
      const fileIndex = files.findIndex((file) => file.path === anchor.path);
      if (fileIndex < 0) continue;
      append(header, fileIndex, thread);
      continue;
    }
    const start = anchor.kind === "line" ? anchor.line : anchor.startLine;
    const end = anchor.kind === "line" ? anchor.line : anchor.endLine;
    const placed = firstFileSlot(files, anchor.path, opts.layout, opts.hideUnchanged, start, end, wholeHunk);
    if (!placed) continue;
    append(after, afterKey(placed.fileIndex, placed.slot.hunkIndex, placed.slot.itemIndex, placed.slot.side), thread);
  }
  return { header, after };
}
