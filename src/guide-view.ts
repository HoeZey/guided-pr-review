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
  return [...map.values()].sort((a, b) => a.path.localeCompare(b.path));
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
