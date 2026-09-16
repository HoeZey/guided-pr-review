import type { FileChange } from "$lib/shared/contracts/guide";
import {
  pairWordDiff,
  splitRows,
  withUnchangedGaps,
  type DiffLine,
  type Lined,
  type SplitRow,
  type UnchangedGap,
} from "$lib/shared/domain/guide-view";

export type UnifiedItem = Lined | UnchangedGap;
export type SplitItem = SplitRow | UnchangedGap;

const LANG_BY_EXT: Record<string, string> = {
  py: "python",
  ts: "typescript",
  tsx: "tsx",
  js: "javascript",
  jsx: "jsx",
  json: "json",
  sh: "bash",
  bash: "bash",
  md: "markdown",
  rs: "rust",
  go: "go",
  yml: "yaml",
  yaml: "yaml",
  toml: "toml",
  html: "html",
  css: "css",
  java: "java",
};

export function languageFor(file: Pick<FileChange, "language" | "path">): string {
  if (file.language) return file.language;
  const ext = file.path.split(".").pop() || "";
  return LANG_BY_EXT[ext] || "";
}

function countLines(lines: DiffLine[] | undefined): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const line of lines || []) {
    if (line.type === "added") additions += 1;
    if (line.type === "removed") deletions += 1;
  }
  return { additions, deletions };
}

export function fileDiffStats(file: FileChange): { additions: number; deletions: number } {
  if (typeof file.additions === "number" || typeof file.deletions === "number") {
    return { additions: file.additions || 0, deletions: file.deletions || 0 };
  }
  const totals = { additions: 0, deletions: 0 };
  for (const hunk of file.hunks || []) {
    const n = countLines(hunk.lines);
    totals.additions += n.additions;
    totals.deletions += n.deletions;
  }
  return totals;
}

export function pathParts(path: string): { name: string; dir: string } {
  const i = path.lastIndexOf("/");
  return i < 0 ? { name: path, dir: "" } : { name: path.slice(i + 1), dir: path.slice(0, i) };
}

function splitRowUnchanged(row: SplitRow): boolean {
  const types = [row.left?.type, row.right?.type].filter((t): t is string => Boolean(t));
  return types.length > 0 && types.every((t) => t === "context");
}

export function projectHunkLines(
  lines: DiffLine[],
  hideUnchanged: boolean,
): { unified: UnifiedItem[]; split: SplitItem[] } {
  const lined = pairWordDiff(lines);
  return {
    unified: withUnchangedGaps(lined, hideUnchanged, (line) => line.type === "context"),
    split: withUnchangedGaps(splitRows(lined), hideUnchanged, splitRowUnchanged),
  };
}
