import type { FileChange, Hunk } from "../../shared/contracts/guide.ts";

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

export function parseUnifiedDiff(text: string): FileChange[] {
  const files: FileChange[] = [];
  let current: DraftFile | undefined;
  let hunk: DraftHunk | undefined;

  const flushHunk = () => {
    if (!current || !hunk) return;
    current.hunks.push({
      header: hunk.header,
      oldStart: hunk.oldStart,
      newStart: hunk.newStart,
      lines: hunk.lines,
    });
    hunk = undefined;
  };

  const flushFile = () => {
    flushHunk();
    if (!current) return;
    files.push(toFileChange(current));
    current = undefined;
  };

  for (const raw of text.split(/\r?\n/)) {
    const gitHeader = raw.match(/^diff --git a\/(.+) b\/(.+)$/);
    if (gitHeader) {
      flushFile();
      current = { path: gitHeader[2], hunks: [], binary: false };
      continue;
    }
    if (!current) continue;
    if (/^Binary files /.test(raw) || /^GIT binary patch$/.test(raw)) {
      current.binary = true;
      continue;
    }
    const plusPath = raw.match(/^\+\+\+ (?:b\/(.+)|\/dev\/null)$/);
    if (plusPath) {
      if (plusPath[1]) current.path = plusPath[1];
      continue;
    }
    if (/^(?:--- |index |old mode|new mode|new file|deleted file|similarity|rename |copy |dissimilarity)/.test(raw)) {
      continue;
    }
    const hunkHeader = raw.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkHeader) {
      flushHunk();
      hunk = {
        header: raw,
        oldStart: Number(hunkHeader[1]),
        newStart: Number(hunkHeader[2]),
        oldLine: Number(hunkHeader[1]),
        newLine: Number(hunkHeader[2]),
        lines: [],
      };
      continue;
    }
    if (!hunk) continue;
    if (raw.startsWith("\\")) continue;
    if (raw.startsWith("+")) {
      hunk.lines.push({ type: "added", content: raw.slice(1), newLine: hunk.newLine });
      hunk.newLine += 1;
      continue;
    }
    if (raw.startsWith("-")) {
      hunk.lines.push({ type: "removed", content: raw.slice(1), oldLine: hunk.oldLine });
      hunk.oldLine += 1;
      continue;
    }
    if (raw.startsWith(" ")) {
      hunk.lines.push({
        type: "context",
        content: raw.slice(1),
        oldLine: hunk.oldLine,
        newLine: hunk.newLine,
      });
      hunk.oldLine += 1;
      hunk.newLine += 1;
    }
  }
  flushFile();
  return files;
}

type Line = Hunk["lines"][number];

type DraftFile = {
  path: string;
  hunks: Hunk[];
  binary: boolean;
};

type DraftHunk = {
  header: string;
  oldStart: number;
  newStart: number;
  oldLine: number;
  newLine: number;
  lines: Line[];
};

function toFileChange(draft: DraftFile): FileChange {
  if (draft.binary) {
    return { path: draft.path, stub: true, reason: "binary" };
  }
  let additions = 0;
  let deletions = 0;
  for (const hunk of draft.hunks) {
    for (const line of hunk.lines) {
      if (line.type === "added") additions += 1;
      if (line.type === "removed") deletions += 1;
    }
  }
  const file: FileChange = {
    path: draft.path,
    hunks: draft.hunks,
    additions,
    deletions,
  };
  const language = languageForPath(draft.path);
  if (language) file.language = language;
  return file;
}

function languageForPath(path: string): string | undefined {
  const ext = path.split(".").pop() || "";
  return LANG_BY_EXT[ext];
}
