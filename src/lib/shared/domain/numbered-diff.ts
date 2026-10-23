import type { FileChange, Hunk } from "../contracts/guide.ts";
import type { ReviewDiffIntent } from "../contracts/persistence.ts";

export type { ReviewDiffIntent };

export type NumberedDiffLine = {
  number?: number;
  marker: "+" | "-" | " ";
  content: string;
};

export type NumberedDiffHunk = {
  header: string;
  lines: NumberedDiffLine[];
};

export type NumberedDiffFile =
  | { path: string; kind: "binary" }
  | { path: string; kind: "stub"; additions: number; deletions: number }
  | { path: string; kind: "file"; status: string; hunks: NumberedDiffHunk[] };

const NAMED_LOCKFILES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "uv.lock",
  "poetry.lock",
]);

function basename(path: string): string {
  const slash = path.lastIndexOf("/");
  return slash === -1 ? path : path.slice(slash + 1);
}

function countChanges(file: FileChange): { additions: number; deletions: number } {
  if (file.hunks && file.hunks.length > 0) {
    let additions = 0;
    let deletions = 0;
    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        if (line.type === "added") additions += 1;
        if (line.type === "removed") deletions += 1;
      }
    }
    return { additions, deletions };
  }
  return { additions: file.additions ?? 0, deletions: file.deletions ?? 0 };
}

export function isStubPath(path: string): boolean {
  const name = basename(path);
  if (NAMED_LOCKFILES.has(name)) return true;
  if (name.endsWith(".lock")) return true;
  if (name.endsWith(".min.js")) return true;
  if (name.endsWith(".snap")) return true;
  return false;
}

function hunkHeader(hunk: Hunk): string {
  if (hunk.header) return hunk.header;
  const oldStart = hunk.oldStart ?? 0;
  const newStart = hunk.newStart ?? 0;
  return `@@ -${oldStart} +${newStart} @@`;
}

function markerFor(type: "context" | "added" | "removed"): "+" | "-" | " " {
  if (type === "added") return "+";
  if (type === "removed") return "-";
  return " ";
}

export function numberDiff(files: FileChange[]): NumberedDiffFile[] {
  return files.map((file) => {
    if (file.stub && file.reason === "binary") {
      return { path: file.path, kind: "binary" };
    }
    const counts = countChanges(file);
    const changed = counts.additions + counts.deletions;
    if (file.stub || isStubPath(file.path) || changed > 1000) {
      return {
        path: file.path,
        kind: "stub",
        additions: counts.additions,
        deletions: counts.deletions,
      };
    }
    let next = 1;
    const hunks: NumberedDiffHunk[] = (file.hunks ?? []).map((hunk) => ({
      header: hunkHeader(hunk),
      lines: hunk.lines.map((line) => {
        const marker = markerFor(line.type);
        if (line.type === "context") {
          return { marker, content: line.content };
        }
        const number = next;
        next += 1;
        return { number, marker, content: line.content };
      }),
    }));
    return { path: file.path, kind: "file", status: "modified", hunks };
  });
}

function formatLine(line: NumberedDiffLine): string {
  if (line.number === undefined) return ` ${line.marker}${line.content}`;
  return `${line.number} ${line.marker}${line.content}`;
}

function printIntent(intent: ReviewDiffIntent): string[] {
  const lines: string[] = [];
  if (intent.description !== undefined) {
    lines.push(intent.description);
    lines.push("");
  }
  for (const commit of intent.commits) {
    lines.push(commit.subject);
    if (commit.body) {
      for (const bodyLine of commit.body.split("\n")) {
        lines.push(`  ${bodyLine}`);
      }
    }
  }
  if (intent.truncated) {
    if (lines.length > 0 && lines[lines.length - 1] !== "") lines.push("");
    lines.push("[truncated]");
  }
  return lines;
}

export function printNumberedDiff(input: {
  id: string;
  sourceCommit: string;
  title: string;
  intent?: ReviewDiffIntent;
  files: NumberedDiffFile[];
}): string {
  const out: string[] = [
    `id: ${input.id}`,
    `sourceCommit: ${input.sourceCommit}`,
    `title: ${input.title}`,
  ];
  if (input.intent) {
    out.push("");
    out.push(...printIntent(input.intent));
  }
  for (const file of input.files) {
    out.push("");
    if (file.kind === "binary") {
      out.push(`== ${file.path} (binary)`);
      continue;
    }
    if (file.kind === "stub") {
      out.push(`== ${file.path} (stub +${file.additions} -${file.deletions})`);
      continue;
    }
    out.push(`== ${file.path} (${file.status})`);
    for (const hunk of file.hunks) {
      out.push(hunk.header);
      for (const line of hunk.lines) out.push(formatLine(line));
    }
  }
  return out.join("\n");
}
