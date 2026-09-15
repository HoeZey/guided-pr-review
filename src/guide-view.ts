import type { FileChange, GuideV1, Hunk } from "./contracts.ts";

type GuideFiles = Pick<GuideV1, "chapters" | "omitted">;

function sortHunks(hunks: Hunk[]): Hunk[] {
  return hunks.slice().sort((a, b) => (a.oldStart ?? a.newStart ?? 0) - (b.oldStart ?? b.newStart ?? 0));
}

function mergeFile(prev: FileChange, next: FileChange): FileChange {
  const hunks = sortHunks([...(prev.hunks || []), ...(next.hunks || [])]);
  const stub = Boolean(prev.stub && next.stub) && hunks.length === 0;
  const merged: FileChange = {
    path: prev.path,
    language: prev.language || next.language,
    hunks: hunks.length ? hunks : undefined,
  };
  if (stub) {
    merged.stub = true;
    merged.reason = prev.reason || next.reason;
  }
  return merged;
}

export function filesForDiff(guide: GuideFiles): FileChange[] {
  const map = new Map<string, FileChange>();
  for (const chapter of guide.chapters) {
    for (const file of chapter.files) {
      const prev = map.get(file.path);
      map.set(
        file.path,
        prev ? mergeFile(prev, file) : { ...file, hunks: file.hunks ? sortHunks(file.hunks) : undefined },
      );
    }
  }
  for (const item of guide.omitted || []) {
    if (map.has(item.path)) continue;
    map.set(item.path, { path: item.path, stub: true, reason: item.reason });
  }
  return [...map.values()].sort((a, b) => compareDirPaths(a.path, b.path));
}

export function compareDirPaths(a: string, b: string): number {
  const left = a.split("/");
  const right = b.split("/");
  const n = Math.min(left.length, right.length);
  for (let i = 0; i < n; i++) {
    const leftLast = i === left.length - 1;
    const rightLast = i === right.length - 1;
    if (leftLast !== rightLast) return leftLast ? 1 : -1;
    const cmp = left[i].localeCompare(right[i]);
    if (cmp) return cmp;
  }
  return left.length - right.length;
}

type DirBucket = {
  dirs: Map<string, DirBucket>;
  files: { name: string; path: string }[];
};

export type FileTreeFile = { kind: "file"; name: string; path: string };
export type FileTreeDir = {
  kind: "dir";
  name: string;
  path: string;
  children: FileTreeNode[];
};
export type FileTreeNode = FileTreeFile | FileTreeDir;

function emptyBucket(): DirBucket {
  return { dirs: new Map(), files: [] };
}

function insertPath(bucket: DirBucket, parts: string[], full: string): void {
  if (parts.length === 1) {
    bucket.files.push({ name: parts[0], path: full });
    return;
  }
  const head = parts[0];
  let next = bucket.dirs.get(head);
  if (!next) {
    next = emptyBucket();
    bucket.dirs.set(head, next);
  }
  insertPath(next, parts.slice(1), full);
}

function nodesFrom(bucket: DirBucket, prefix: string): FileTreeNode[] {
  const dirs: FileTreeNode[] = [...bucket.dirs.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, child]) => {
      const path = prefix ? `${prefix}/${name}` : name;
      return { kind: "dir", name, path, children: nodesFrom(child, path) };
    });
  const files: FileTreeNode[] = bucket.files
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((file) => ({ kind: "file", name: file.name, path: file.path }));
  return [...dirs, ...files];
}

function compactNodes(nodes: FileTreeNode[]): FileTreeNode[] {
  return nodes.map((node) => {
    if (node.kind !== "dir") return node;
    let name = node.name;
    let path = node.path;
    let children = compactNodes(node.children);
    while (children.length === 1 && children[0].kind === "dir") {
      const only = children[0];
      name = `${name} / ${only.name}`;
      path = only.path;
      children = only.children;
    }
    return { kind: "dir", name, path, children };
  });
}

export function fileTree(paths: string[]): FileTreeNode[] {
  const root = emptyBucket();
  for (const path of paths) {
    const parts = path.split("/").filter(Boolean);
    if (!parts.length) continue;
    insertPath(root, parts, path);
  }
  return compactNodes(nodesFrom(root, ""));
}

export type GuideStop = { chapterId: string; path: string };

export function guideStops(
  chapters: { id: string; files: { path: string }[] }[],
): GuideStop[] {
  return chapters.flatMap((ch) =>
    (ch.files || [])
      .filter((file) => file.path)
      .map((file) => ({ chapterId: ch.id, path: file.path })),
  );
}

export function stepGuide(
  stops: GuideStop[],
  chapterId: string,
  path: string,
  delta: number,
): GuideStop | null {
  if (!stops.length) return null;
  const i = stops.findIndex((stop) => stop.chapterId === chapterId && stop.path === path);
  const from = i < 0 ? 0 : i;
  const j = Math.min(stops.length - 1, Math.max(0, from + delta));
  return stops[j];
}

export function selectGuidePath(
  files: { path: string }[],
  selected: string | null,
  viewed: ReadonlySet<string>,
): string | null {
  if (selected && files.some((file) => file.path === selected)) return selected;
  return files.find((file) => !viewed.has(file.path))?.path || files[0]?.path || null;
}

export function guideSpyFileIndex(
  files: { top: number; bottom: number }[],
  probe: number,
  atEnd: boolean,
): number {
  if (!files.length) return -1;
  if (atEnd) return files.length - 1;
  let idx = 0;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.top <= probe && file.bottom > probe) return i;
    if (file.top <= probe) idx = i;
  }
  return idx;
}

export function shownDiffCounts(s: { additions: number; deletions: number }): {
  additions?: number;
  deletions?: number;
} {
  const out: { additions?: number; deletions?: number } = {};
  if (s.additions > 0) out.additions = s.additions;
  if (s.deletions > 0) out.deletions = s.deletions;
  return out;
}

export function markViewed(
  viewed: ReadonlySet<string>,
  collapsed: ReadonlySet<string>,
  path: string,
): { viewed: Set<string>; collapsed: Set<string> } {
  return {
    viewed: new Set([...viewed, path]),
    collapsed: new Set(collapsed),
  };
}

export function unmarkViewed(
  viewed: ReadonlySet<string>,
  collapsed: ReadonlySet<string>,
  path: string,
): { viewed: Set<string>; collapsed: Set<string> } {
  const nextViewed = new Set(viewed);
  nextViewed.delete(path);
  const nextCollapsed = new Set(collapsed);
  nextCollapsed.delete(path);
  return { viewed: nextViewed, collapsed: nextCollapsed };
}

export function collapsedOnDiff(
  viewed: ReadonlySet<string>,
  collapsed: ReadonlySet<string>,
): Set<string> {
  return new Set([...viewed, ...collapsed]);
}

export function serializeViewed(viewed: ReadonlySet<string>): string {
  return JSON.stringify([...viewed].sort());
}

export function parseViewed(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return new Set();
    return new Set(data.filter((item): item is string => typeof item === "string"));
  } catch {
    return new Set();
  }
}

export type Seg = { text: string; changed: boolean };

function tokenize(text: string): string[] {
  return text.match(/\s+|\w+|[^\s\w]/g) ?? (text ? [text] : []);
}

function tokenChanged(left: string[], right: string[]): { left: boolean[]; right: boolean[] } {
  const n = left.length;
  const m = right.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] =
        left[i - 1] === right[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  const leftChanged = Array(n).fill(true);
  const rightChanged = Array(m).fill(true);
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (left[i - 1] === right[j - 1]) {
      leftChanged[i - 1] = false;
      rightChanged[j - 1] = false;
      i -= 1;
      j -= 1;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i -= 1;
    } else {
      j -= 1;
    }
  }
  return { left: leftChanged, right: rightChanged };
}

function mergeSegs(tokens: string[], changed: boolean[]): Seg[] {
  const out: Seg[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const last = out[out.length - 1];
    if (last && last.changed === changed[i]) last.text += tokens[i];
    else out.push({ text: tokens[i], changed: changed[i] });
  }
  return out;
}

export function wordSegments(before: string, after: string): { before: Seg[]; after: Seg[] } {
  if (before === after) {
    return {
      before: before ? [{ text: before, changed: false }] : [],
      after: after ? [{ text: after, changed: false }] : [],
    };
  }
  const left = tokenize(before);
  const right = tokenize(after);
  const changed = tokenChanged(left, right);
  return {
    before: mergeSegs(left, changed.left),
    after: mergeSegs(right, changed.right),
  };
}

export type DiffLine = {
  type: string;
  content: string;
  oldLine?: number;
  newLine?: number;
};

export type Lined = DiffLine & { segments?: Seg[] };

export function pairWordDiff(lines: DiffLine[]): Lined[] {
  const out: Lined[] = lines.map((line) => ({ ...line }));
  let i = 0;
  while (i < out.length) {
    if (out[i].type !== "removed") {
      i += 1;
      continue;
    }
    let delEnd = i;
    while (delEnd < out.length && out[delEnd].type === "removed") delEnd += 1;
    let addEnd = delEnd;
    while (addEnd < out.length && out[addEnd].type === "added") addEnd += 1;
    const n = Math.min(delEnd - i, addEnd - delEnd);
    for (let p = 0; p < n; p++) {
      const segs = wordSegments(out[i + p].content, out[delEnd + p].content);
      out[i + p].segments = segs.before;
      out[delEnd + p].segments = segs.after;
    }
    i = addEnd;
  }
  return out;
}

export type SplitRow = { left: Lined | null; right: Lined | null };

export function splitRows(lines: Lined[]): SplitRow[] {
  const rows: SplitRow[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.type === "context") {
      rows.push({ left: line, right: line });
      i += 1;
      continue;
    }
    if (line.type === "removed") {
      let delEnd = i;
      while (delEnd < lines.length && lines[delEnd].type === "removed") delEnd += 1;
      let addEnd = delEnd;
      while (addEnd < lines.length && lines[addEnd].type === "added") addEnd += 1;
      const nDel = delEnd - i;
      const nAdd = addEnd - delEnd;
      const n = Math.max(nDel, nAdd);
      for (let p = 0; p < n; p++) {
        rows.push({
          left: p < nDel ? lines[i + p] : null,
          right: p < nAdd ? lines[delEnd + p] : null,
        });
      }
      i = addEnd;
      continue;
    }
    rows.push({ left: null, right: line });
    i += 1;
  }
  return rows;
}

export type UnchangedGap = { type: "gap"; count: number };

export function isUnchangedGap(item: unknown): item is UnchangedGap {
  return typeof item === "object" && item !== null && (item as UnchangedGap).type === "gap";
}

export function withUnchangedGaps<T>(
  items: T[],
  hide: boolean,
  unchanged: (item: T) => boolean,
): (T | UnchangedGap)[] {
  if (!hide) return items;
  const out: (T | UnchangedGap)[] = [];
  let i = 0;
  while (i < items.length) {
    if (!unchanged(items[i])) {
      out.push(items[i]);
      i += 1;
      continue;
    }
    let j = i;
    while (j < items.length && unchanged(items[j])) j += 1;
    out.push({ type: "gap", count: j - i });
    i = j;
  }
  return out;
}

export type Painted = { content: string; color?: string; changed: boolean };

export function overlaySegments(
  tokens: { content: string; color?: string }[],
  segments: Seg[] | undefined,
): Painted[] {
  if (!segments?.length) {
    return tokens.map((tok) => ({ content: tok.content, color: tok.color, changed: false }));
  }
  const out: Painted[] = [];
  let segI = 0;
  let segOff = 0;
  for (const tok of tokens) {
    let tokOff = 0;
    while (tokOff < tok.content.length && segI < segments.length) {
      const seg = segments[segI];
      const take = Math.min(tok.content.length - tokOff, seg.text.length - segOff);
      if (take <= 0) break;
      out.push({
        content: tok.content.slice(tokOff, tokOff + take),
        color: tok.color,
        changed: seg.changed,
      });
      tokOff += take;
      segOff += take;
      if (segOff >= seg.text.length) {
        segI += 1;
        segOff = 0;
      }
    }
    if (tokOff < tok.content.length) {
      out.push({
        content: tok.content.slice(tokOff),
        color: tok.color,
        changed: false,
      });
    }
  }
  return out;
}

export type DiffLayout = "unified" | "split";

export function parseDiffLayout(raw: string | null, fallback: DiffLayout): DiffLayout {
  return raw === "unified" || raw === "split" ? raw : fallback;
}

export function formatCopy(raw: string): string {
  const escaped = String(raw)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const inline = escaped
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return inline
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, "<br>")}</p>`)
    .join("");
}
