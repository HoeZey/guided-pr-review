import { createHighlighter, type Highlighter } from "shiki";
import {
  collapsedOnDiff,
  filesForDiff,
  fileTree,
  isUnchangedGap,
  markViewed,
  overlaySegments,
  pairWordDiff,
  parseViewed,
  serializeViewed,
  splitRows,
  unmarkViewed,
  withUnchangedGaps,
  guideStops,
  stepGuide,
  parseDiffLayout,
  parseReviewsRails,
  serializeReviewsRails,
  formatCopy,
  type Lined,
  type SplitRow,
  type DiffLayout,
  type FileTreeNode,
} from "./guide-view.ts";

const BRAND_MARK = `<img class="brand" src="/logo.svg" width="28" height="28" alt="">`;
const THEME_KEY = "guided-pr-review-theme";
const TAB_KEY = "guided-pr-review-tab";
const DIFF_KEY = "guided-pr-review-diff";
const GUIDE_DIFF_KEY = "guided-pr-review-guide-diff";
const SPLIT_KEY = "guided-pr-review-split";
const HIDE_KEY = "guided-pr-review-hide-unchanged";
const RAILS_KEY = "guided-pr-review-rails";
const VIEWED_PREFIX = "guided-pr-review-viewed:";
const REVIEWS_KEY = "guided-pr-review-reviews";
const LANGS = [
  "python",
  "javascript",
  "typescript",
  "tsx",
  "jsx",
  "json",
  "bash",
  "html",
  "css",
  "yaml",
  "markdown",
  "go",
  "rust",
  "java",
  "toml",
] as const;

type Guide = {
  title: string;
  summary?: string;
  base: string;
  head: string;
  range?: string;
  repo?: string;
  additions?: number;
  deletions?: number;
  chapters: Chapter[];
  omitted?: { path: string; reason: string; note?: string }[];
};

type Chapter = {
  id: string;
  kind: string;
  title: string;
  why: string;
  open?: boolean;
  additions?: number;
  deletions?: number;
  files: FileChange[];
  _omitted?: boolean;
};

type FileChange = {
  path: string;
  language?: string;
  stub?: boolean;
  reason?: string;
  additions?: number;
  deletions?: number;
  hunks?: { header?: string; lines: DiffLine[] }[];
};

type DiffLine = {
  type: string;
  content: string;
  oldLine?: number;
  newLine?: number;
};

type ReviewSummary = {
  id: string;
  title: string;
  range?: string;
  addedAt: string;
};

let highlighter: Highlighter | null = null;
let reviews: ReviewSummary[] = [];
let activeId: string | null = null;
let guide: Guide | null = null;
let selectedChapterId: string | null = null;
let pasteOpen = false;
let observer: IntersectionObserver | null = null;
let lastPayloadKey = "";
let tab: "guide" | "diff" = "guide";
let guideLayout: DiffLayout = "unified";
let diffLayout: DiffLayout = "split";
let splitPct = 0.5;
let hideUnchanged = false;
let reviewsPx = 220;
let sidebarPx = 280;
let viewed = new Set<string>();
let collapsed = new Set<string>();
let collapsedDirs = new Set<string>();
let selectedDiffPath: string | null = null;
let selectedGuidePath: string | null = null;
let guideReviewsCollapsed = true;
let diffReviewsCollapsed = false;
let tocOpen = false;
let displayOpen = false;

function esc(value: unknown): string {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function currentTheme(): "light" | "dark" {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function setTheme(theme: string): void {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch {
    /* private mode */
  }
}

function langFor(file: FileChange): string {
  if (file.language) return file.language;
  const ext = file.path.split(".").pop() || "";
  const map: Record<string, string> = {
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
  return map[ext] || "";
}

async function getHighlighter(): Promise<Highlighter> {
  if (highlighter) return highlighter;
  highlighter = await createHighlighter({
    themes: ["github-light", "github-dark"],
    langs: [...LANGS],
  });
  return highlighter;
}

async function paintCode(): Promise<void> {
  const nodes = document.querySelectorAll<HTMLElement>(".code[data-lang]");
  if (!nodes.length) return;
  const hl = await getHighlighter();
  const theme = currentTheme() === "dark" ? "github-dark" : "github-light";
  for (const el of nodes) {
    const lang = el.dataset.lang || "";
    const text = el.dataset.raw ?? el.textContent ?? "";
    const segs = el.dataset.segments ? (JSON.parse(el.dataset.segments) as Lined["segments"]) : undefined;
    if (!(LANGS as readonly string[]).includes(lang)) {
      if (segs?.length) {
        const wordClass = el.closest(".line.added")
          ? "word-add"
          : el.closest(".line.removed")
            ? "word-del"
            : "";
        el.innerHTML = overlaySegments([{ content: text }], segs)
          .map((tok) => {
            const cls = tok.changed && wordClass ? ` class="${wordClass}"` : "";
            return `<span${cls}>${esc(tok.content)}</span>`;
          })
          .join("");
      }
      continue;
    }
    try {
      const result = hl.codeToTokens(text, { lang: lang as (typeof LANGS)[number], theme });
      const line = result.tokens[0] || [];
      const painted = overlaySegments(
        line.map((tok) => ({ content: tok.content, color: tok.color })),
        segs,
      );
      const wordClass = el.closest(".line.added")
        ? "word-add"
        : el.closest(".line.removed")
          ? "word-del"
          : "";
      el.innerHTML = painted
        .map((tok) => {
          const cls = tok.changed && wordClass ? ` class="${wordClass}"` : "";
          return `<span${cls} style="color:${tok.color || "inherit"}">${esc(tok.content)}</span>`;
        })
        .join("");
    } catch {
      /* leave escaped text */
    }
  }
}

function countLines(lines: DiffLine[] | undefined) {
  let additions = 0;
  let deletions = 0;
  for (const line of lines || []) {
    if (line.type === "added") additions += 1;
    if (line.type === "removed") deletions += 1;
  }
  return { additions, deletions };
}

function fileStats(file: FileChange) {
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

function chapterStats(chapter: Chapter) {
  if (typeof chapter.additions === "number" || typeof chapter.deletions === "number") {
    return { additions: chapter.additions || 0, deletions: chapter.deletions || 0 };
  }
  const totals = { additions: 0, deletions: 0 };
  for (const file of chapter.files || []) {
    const n = fileStats(file);
    totals.additions += n.additions;
    totals.deletions += n.deletions;
  }
  return totals;
}

function guideStats(data: Guide) {
  if (typeof data.additions === "number" || typeof data.deletions === "number") {
    return { additions: data.additions || 0, deletions: data.deletions || 0 };
  }
  const totals = { additions: 0, deletions: 0 };
  for (const chapter of data.chapters || []) {
    const n = chapterStats(chapter);
    totals.additions += n.additions;
    totals.deletions += n.deletions;
  }
  return totals;
}

function statsHtml(s: { additions: number; deletions: number }) {
  return `<span class="stats"><span class="add">+${s.additions}</span> <span class="del">−${s.deletions}</span></span>`;
}

function codeAttrs(line: Lined, lang: string) {
  const langAttr = lang ? ` data-lang="${esc(lang)}" data-raw="${esc(line.content)}"` : "";
  const segAttr = line.segments ? ` data-segments="${esc(JSON.stringify(line.segments))}"` : "";
  return `${langAttr}${segAttr}`;
}

function renderLine(line: Lined, lang: string) {
  const oldN = line.oldLine != null ? esc(line.oldLine) : "";
  const newN = line.newLine != null ? esc(line.newLine) : "";
  const mark = line.type === "added" ? "+" : line.type === "removed" ? "−" : "";
  return `<div class="line ${esc(line.type)}"><span class="gutter">${oldN}</span><span class="gutter">${newN}</span><span class="mark">${mark}</span><span class="code"${codeAttrs(line, lang)}>${esc(line.content)}</span></div>`;
}

function renderSplitCell(side: "left" | "right", line: Lined | null, lang: string) {
  if (!line) {
    return `<div class="line split-cell ${side} empty"></div>`;
  }
  const n =
    side === "left"
      ? line.oldLine != null
        ? esc(line.oldLine)
        : ""
      : line.newLine != null
        ? esc(line.newLine)
        : "";
  const mark = line.type === "added" ? "+" : line.type === "removed" ? "−" : "";
  return `<div class="line split-cell ${side} ${esc(line.type)}"><span class="gutter">${n}</span><span class="mark">${mark}</span><span class="code"${codeAttrs(line, lang)}>${esc(line.content)}</span></div>`;
}

function applySplitPct(pct: number) {
  splitPct = Math.min(0.85, Math.max(0.15, pct));
  document.documentElement.style.setProperty("--split-left", `${splitPct}fr`);
  document.documentElement.style.setProperty("--split-right", `${1 - splitPct}fr`);
}

function currentDiffLayout(): DiffLayout {
  return tab === "guide" ? guideLayout : diffLayout;
}

function reviewsCollapsed(): boolean {
  return tab === "guide" ? guideReviewsCollapsed : diffReviewsCollapsed;
}

function persistReviewsRails() {
  try {
    localStorage.setItem(
      REVIEWS_KEY,
      serializeReviewsRails({
        guide: guideReviewsCollapsed ? "collapsed" : "open",
        diff: diffReviewsCollapsed ? "collapsed" : "open",
      }),
    );
  } catch {
    /* private mode */
  }
}

function persistSplitPct() {
  try {
    localStorage.setItem(SPLIT_KEY, String(splitPct));
  } catch {
    /* private mode */
  }
}

function applyRails() {
  document.documentElement.style.setProperty("--reviews", `${reviewsPx}px`);
  document.documentElement.style.setProperty("--sidebar", `${sidebarPx}px`);
}

function persistRails() {
  try {
    localStorage.setItem(RAILS_KEY, JSON.stringify({ reviews: reviewsPx, sidebar: sidebarPx }));
  } catch {
    /* private mode */
  }
}

function bindRailHandles(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>("[data-rail]").forEach((handle) => {
    handle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      handle.setPointerCapture(event.pointerId);
      const which = handle.dataset.rail;
      const app = document.getElementById("app");
      if (!app) return;
      const move = (ev: PointerEvent) => {
        const left = app.getBoundingClientRect().left;
        if (which === "reviews") {
          reviewsPx = Math.min(420, Math.max(140, ev.clientX - left));
        } else if (which === "sidebar") {
          const reviewsW = reviewsCollapsed() ? 40 : reviewsPx;
          sidebarPx = Math.min(520, Math.max(160, ev.clientX - left - reviewsW));
        }
        applyRails();
      };
      const up = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        persistRails();
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
    });
  });
}

function setHideUnchanged(next: boolean) {
  hideUnchanged = next;
  displayOpen = true;
  try {
    localStorage.setItem(HIDE_KEY, next ? "1" : "0");
  } catch {
    /* private mode */
  }
  render({ restoreScroll: true });
}

function renderGap(count: number) {
  return `<div class="unchanged-gap">··· ${count} unchanged</div>`;
}

function splitRowUnchanged(row: SplitRow): boolean {
  const types = [row.left?.type, row.right?.type].filter((t): t is string => Boolean(t));
  return types.length > 0 && types.every((t) => t === "context");
}

function bindSplitHandles(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>(".split-handle").forEach((handle) => {
    handle.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      const diff = handle.closest(".diff.split");
      if (!diff) return;
      handle.setPointerCapture(event.pointerId);
      const move = (ev: PointerEvent) => {
        const rect = diff.getBoundingClientRect();
        if (rect.width <= 0) return;
        applySplitPct((ev.clientX - rect.left) / rect.width);
      };
      const up = () => {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", up);
        persistSplitPct();
      };
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", up);
    });
  });
}

function pathParts(path: string) {
  const i = path.lastIndexOf("/");
  return i < 0 ? { name: path, dir: "" } : { name: path.slice(i + 1), dir: path.slice(0, i) };
}

function compactDirLabel(name: string): string {
  return name
    .split(" / ")
    .map((part) => esc(part))
    .join('<span class="tree-slash"> / </span>');
}

function renderFile(file: FileChange, id: string, opts?: { stage?: boolean }) {
  const s = fileStats(file);
  const lang = langFor(file);
  const stage = Boolean(opts?.stage);
  const isCollapsed = collapsed.has(file.path);
  const viewedOn = viewed.has(file.path);
  const { name, dir } = pathParts(file.path);
  const title = stage
    ? `<span class="file-title"><span class="path">${esc(name)}</span>${dir ? `<span class="dir">${esc(dir)}</span>` : ""}</span>`
    : `<span class="path">${esc(file.path)}</span>`;
  const action = `<label class="viewed"><input type="checkbox" data-viewed-path="${esc(file.path)}"${viewedOn ? " checked" : ""}> ${stage ? "Reviewed" : "Viewed"}</label>`;
  const chevron = `<button type="button" class="chevron" data-toggle-path="${esc(file.path)}" aria-expanded="${isCollapsed ? "false" : "true"}" aria-label="Toggle file">${isCollapsed ? "▸" : "▾"}</button>`;
  const head = `<div class="file-head">${chevron}${title}${statsHtml(s)}${action}</div>`;
  const cls = stage ? "file stage" : "file";
  if (file.stub) {
    const reason = file.reason ? ` · ${esc(file.reason)}` : "";
    return `<section class="${cls}" id="${esc(id)}" data-path="${esc(file.path)}" data-collapsed="${isCollapsed}">${head}<div class="file-body"><div class="stub">Body omitted${reason}.</div></div></section>`;
  }
  const hunks = (file.hunks || [])
    .map((hunk) => {
      const header = hunk.header
        ? `<div class="hunk-header">${esc(hunk.header)}</div>`
        : "";
      const lined = pairWordDiff(hunk.lines || []);
      if (currentDiffLayout() === "split") {
        const items = withUnchangedGaps(splitRows(lined), hideUnchanged, splitRowUnchanged);
        const left = items
          .map((item) =>
            isUnchangedGap(item) ? renderGap(item.count) : renderSplitCell("left", item.left, lang),
          )
          .join("");
        const right = items
          .map((item) =>
            isUnchangedGap(item) ? renderGap(item.count) : renderSplitCell("right", item.right, lang),
          )
          .join("");
        return `${header}<div class="diff split"><div class="split-pane left">${left}</div><button type="button" class="split-handle" aria-label="Resize diff panes"></button><div class="split-pane right">${right}</div></div>`;
      }
      const items = withUnchangedGaps(lined, hideUnchanged, (line) => line.type === "context");
      const body = items
        .map((item) => (isUnchangedGap(item) ? renderGap(item.count) : renderLine(item, lang)))
        .join("");
      return `${header}<div class="diff">${body}</div>`;
    })
    .join("");
  return `<section class="${cls}" id="${esc(id)}" data-path="${esc(file.path)}" data-collapsed="${isCollapsed}">${head}<div class="file-body">${hunks}</div></section>`;
}

function chaptersForNav(data: Guide): Chapter[] {
  const list = data.chapters.slice();
  if (data.omitted && data.omitted.length) {
    list.push({
      id: "__omitted__",
      kind: "noise",
      title: "Omitted",
      why: "Binary or unreadable paths.",
      files: [],
      _omitted: true,
    });
  }
  return list;
}

function renderOmitted(items: NonNullable<Guide["omitted"]>) {
  const lis = items
    .map(
      (item) =>
        `<li>${esc(item.path)} <span class="meta">${esc(item.reason)}${item.note ? " · " + esc(item.note) : ""}</span></li>`,
    )
    .join("");
  return `<div class="prose"><h2>Omitted</h2><p>Not shown as diffs.</p></div><ul class="omitted-list">${lis}</ul>`;
}

function pasteModal(): string {
  if (!pasteOpen) return `<div class="modal hidden" id="paste-modal"></div>`;
  return `<div class="modal" id="paste-modal"><div class="modal-card"><p>Paste a Guide v1 JSON object.</p><textarea id="paste-json"></textarea><div class="modal-actions"><button type="button" class="ghost" data-paste-cancel>Cancel</button><button type="button" class="ghost" data-paste-save>Add</button></div></div></div>`;
}

function sectionId(chapterId: string) {
  return `section-${chapterId}`;
}

function fileId(chapterId: string, index: number) {
  return `file-${chapterId}-${index}`;
}

function renderFilePill(file: FileChange, id: string, chapterId: string, current: boolean) {
  const { name, dir } = pathParts(file.path);
  const s = fileStats(file);
  const dim = viewed.has(file.path) ? " viewed-link" : "";
  return `<button type="button" class="file-pill${dim}" data-jump="${esc(id)}" data-chapter="${esc(chapterId)}" data-path="${esc(file.path)}" title="${esc(file.path)}" aria-current="${current ? "true" : "false"}"><span class="file-pill-main"><span class="file-pill-name">${esc(name)}</span>${dir ? `<span class="file-pill-dir">${esc(dir)}</span>` : ""}</span>${statsHtml(s)}</button>`;
}

function renderSection(chapter: Chapter, index: number, total: number) {
  const sid = sectionId(chapter.id);
  if (chapter._omitted) {
    return `<section class="guide-section" id="${esc(sid)}" data-chapter="${esc(chapter.id)}"><div class="guide-aside"><h2>Omitted</h2><div class="guide-progress"><button type="button" class="progress-toc" data-toggle-toc>${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")}</button></div><div class="guide-why">${formatCopy("Binary or unreadable paths.")}</div></div><div class="guide-stage">${renderOmitted(guide?.omitted || [])}</div></section>`;
  }
  const files = chapter.files || [];
  const selected =
    (selectedGuidePath && files.some((file) => file.path === selectedGuidePath) && selectedGuidePath) ||
    files.find((file) => !viewed.has(file.path))?.path ||
    files[0]?.path ||
    null;
  const pills = files
    .map((file, i) => renderFilePill(file, fileId(chapter.id, i), chapter.id, file.path === selected))
    .join("");
  const stage = files
    .map((file, i) => renderFile(file, fileId(chapter.id, i), { stage: true }))
    .join("");
  const idx = String(index + 1).padStart(2, "0");
  const tot = String(total).padStart(2, "0");
  const chapterDone = files.length > 0 && files.every((file) => viewed.has(file.path));
  return `<section class="guide-section" id="${esc(sid)}" data-chapter="${esc(chapter.id)}"><aside class="guide-aside"><h2>${esc(chapter.title)}</h2><div class="guide-progress"><button type="button" class="progress-toc" data-toggle-toc>${idx} / ${tot}</button><label class="viewed"><input type="checkbox" data-reviewed-chapter="${esc(chapter.id)}"${chapterDone ? " checked" : ""}> Reviewed</label></div><div class="guide-why">${formatCopy(chapter.why)}</div><div class="file-pills">${pills}</div></aside><div class="guide-stage">${stage}</div></section>`;
}

function persistViewed() {
  if (!activeId) return;
  try {
    localStorage.setItem(VIEWED_PREFIX + activeId, serializeViewed(viewed));
  } catch {
    /* private mode */
  }
}

function hydrateViewed(id: string | null) {
  try {
    viewed = parseViewed(id ? localStorage.getItem(VIEWED_PREFIX + id) : null);
  } catch {
    viewed = new Set();
  }
  collapsed = new Set(viewed);
}

function setDiffMode(next: DiffLayout) {
  if (tab === "guide") {
    guideLayout = next;
    try {
      localStorage.setItem(GUIDE_DIFF_KEY, next);
    } catch {
      /* private mode */
    }
  } else {
    diffLayout = next;
    try {
      localStorage.setItem(DIFF_KEY, next);
    } catch {
      /* private mode */
    }
  }
  render({ restoreScroll: true });
}

function setTab(next: "guide" | "diff") {
  tab = next;
  try {
    localStorage.setItem(TAB_KEY, tab);
  } catch {
    /* private mode */
  }
  if (tab === "diff") collapsed = collapsedOnDiff(viewed, collapsed);
  render();
}

function setReviewsCollapsed(next: boolean) {
  if (tab === "guide") guideReviewsCollapsed = next;
  else diffReviewsCollapsed = next;
  persistReviewsRails();
  const app = document.getElementById("app");
  if (!app) return;
  app.dataset.reviews = next ? "collapsed" : "open";
  const btn = app.querySelector("[data-toggle-reviews]");
  if (!btn) return;
  btn.setAttribute("aria-expanded", next ? "false" : "true");
  btn.setAttribute("aria-label", next ? "Show reviews" : "Hide reviews");
  btn.setAttribute("title", next ? "Show reviews ([)" : "Hide reviews ([)");
  btn.textContent = next ? "›" : "‹";
}

function diffRows() {
  if (!guide) return [];
  return filesForDiff(guide as Parameters<typeof filesForDiff>[0]);
}

function renderFileTree(nodes: FileTreeNode[], depth: number, rows: FileChange[]): string {
  return nodes
    .map((node) => {
      if (node.kind === "dir") {
        const shut = collapsedDirs.has(node.path);
        const kids = shut ? "" : renderFileTree(node.children, depth + 1, rows);
        return `<div class="tree-branch"><button type="button" class="tree-dir" style="--tree-depth:${depth}" data-tree-dir="${esc(node.path)}" aria-expanded="${shut ? "false" : "true"}"><span class="tree-chevron">${shut ? "▸" : "▾"}</span><span class="tree-dir-name">${compactDirLabel(node.name)}</span></button>${kids}</div>`;
      }
      const i = rows.findIndex((row) => row.path === node.path);
      const current = node.path === selectedDiffPath ? "true" : "false";
      const dim = viewed.has(node.path) ? " viewed-link" : "";
      return `<button type="button" class="file-link tree-file${dim}" style="--tree-depth:${depth}" data-jump="${esc(diffFileId(i))}" data-path="${esc(node.path)}" title="${esc(node.path)}" aria-current="${current}"><span class="file-link-name">${esc(node.name)}</span></button>`;
    })
    .join("");
}

function diffFileId(index: number) {
  return `diff-file-${index}`;
}

function markCurrent() {
  if (tab === "guide") {
    document.querySelectorAll(".chapter-btn[data-jump]").forEach((btn) => {
      const jump = btn.getAttribute("data-jump");
      const on = jump === sectionId(selectedChapterId || "");
      btn.setAttribute("aria-current", on ? "true" : "false");
    });
    document.querySelectorAll(".file-pill[data-path]").forEach((btn) => {
      const on = btn.getAttribute("data-path") === selectedGuidePath;
      btn.setAttribute("aria-current", on ? "true" : "false");
    });
    return;
  }
  document.querySelectorAll(".file-link[data-path]").forEach((btn) => {
    const on = btn.getAttribute("data-path") === selectedDiffPath;
    btn.setAttribute("aria-current", on ? "true" : "false");
  });
}

function jumpTo(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const section = el.closest(".guide-section");
  if (section?.id.startsWith("section-")) {
    selectedChapterId = section.id.slice("section-".length);
  }
  const file = el.closest(".file") as HTMLElement | null;
  if (file?.dataset.path) {
    selectedDiffPath = file.dataset.path;
    selectedGuidePath = file.dataset.path;
  }
  markCurrent();
  el.scrollIntoView({ behavior: "auto", block: "start" });
}

function observeMain() {
  observer?.disconnect();
  const main = document.querySelector("main");
  if (!main) return;
  const selector = tab === "guide" ? ".guide-section, .file.stage" : ".file[id]";
  observer = new IntersectionObserver(
    (entries) => {
      const hit = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!hit) return;
      const target = hit.target as HTMLElement;
      if (tab === "guide" && target.id.startsWith("section-")) {
        selectedChapterId = target.id.slice("section-".length);
      }
      if (tab === "guide" && target.classList.contains("stage") && target.dataset.path) {
        selectedGuidePath = target.dataset.path;
      }
      if (tab === "diff" && target.dataset.path) {
        selectedDiffPath = target.dataset.path;
      }
      markCurrent();
    },
    { root: main, rootMargin: "0px 0px -70% 0px", threshold: 0 },
  );
  main.querySelectorAll(selector).forEach((el) => observer?.observe(el));
}

function render(opts?: { restoreScroll?: boolean }) {
  const app = document.getElementById("app");
  if (!app) return;
  const prevMain = document.querySelector("main");
  const top = prevMain?.scrollTop ?? 0;
  if (!guide) {
    app.innerHTML = `<header>${BRAND_MARK}<h1>Guided review</h1></header><p class="boot">No reviews yet. Add one from MCP or paste JSON.</p>${pasteModal()}`;
    bindChrome(app);
    return;
  }
  const chapters = chaptersForNav(guide);
  const selected =
    chapters.find((ch) => ch.id === selectedChapterId) || chapters[0];
  selectedChapterId = selected.id;
  const rows = diffRows();
  if (!selectedDiffPath || !rows.some((row) => row.path === selectedDiffPath)) {
    selectedDiffPath = rows[0]?.path ?? null;
  }
  const gs = guideStats(guide);
  const range = guide.range || `${guide.base.slice(0, 7)}…${guide.head.slice(0, 7)}`;
  const repo = guide.repo ? `${esc(guide.repo)} · ` : "";
  const nextTheme = currentTheme() === "dark" ? "light" : "dark";
  const themeLabel = nextTheme === "dark" ? "Dark" : "Light";

  const reviewNav = reviews
    .map((r) => {
      const current = r.id === activeId ? "true" : "false";
      return `<div class="review-btn" role="button" tabindex="0" data-review-id="${esc(r.id)}" aria-current="${current}" title="${esc(r.title)}"><span><span class="review-title">${esc(r.title)}</span><div class="review-range">${esc(r.range || "")}</div></span><button type="button" class="remove-btn" data-remove-id="${esc(r.id)}" aria-label="Remove">×</button></div>`;
    })
    .join("");

  const chapterNav = chapters
    .map((ch, i) => {
      const current = ch.id === selectedChapterId ? "true" : "false";
      return `<button type="button" class="chapter-btn" data-jump="${esc(sectionId(ch.id))}" data-chapter="${esc(ch.id)}" aria-current="${current}"><span class="idx">${String(i + 1).padStart(2, "0")}</span><span class="ch-title">${esc(ch.title)}</span></button>`;
    })
    .join("");

  const fileNav = renderFileTree(
    fileTree(rows.map((row) => row.path)),
    0,
    rows,
  );

  const guideBody = chapters.map((ch, i) => renderSection(ch, i, chapters.length)).join("");
  const diffBody = rows.map((file, i) => renderFile(file, diffFileId(i))).join("");
  const tocFlyout = tocOpen
    ? `<div class="toc-overlay" data-close-toc><div class="toc-panel" role="dialog" aria-label="Guide sections"><div class="nav-label">Sections</div>${chapterNav}</div></div>`
    : "";
  const mainInner =
    tab === "guide"
      ? `<div class="guide-doc">${guideBody}</div>${tocFlyout}`
      : `${diffBody}<p class="hint">j / k jump files · [ hide reviews · drag rail edges · ⌘B split · viewed stays collapsed on Diff</p>`;
  const layout = currentDiffLayout();
  const railsHidden = reviewsCollapsed();
  const tabs = `<div class="view-tabs main-tabs" role="tablist"><button type="button" role="tab" data-tab="guide" aria-selected="${tab === "guide" ? "true" : "false"}">Guide</button><button type="button" role="tab" data-tab="diff" aria-selected="${tab === "diff" ? "true" : "false"}">Diff</button></div>`;
  const modes = `<div class="view-tabs" role="radiogroup" aria-label="Diff layout"><button type="button" data-diff-mode="unified" aria-selected="${layout === "unified" ? "true" : "false"}">Unified</button><button type="button" data-diff-mode="split" aria-selected="${layout === "split" ? "true" : "false"}">Split</button></div>`;
  const hideBtn = `<button type="button" class="ghost" data-hide-unchanged aria-pressed="${hideUnchanged ? "true" : "false"}">${hideUnchanged ? "Show unchanged" : "Hide unchanged"}</button>`;
  const themeBtn = `<button type="button" class="ghost theme-toggle" data-theme-next="${nextTheme}" aria-label="Switch to ${themeLabel} theme">${themeLabel}</button>`;
  const display = `<details class="display-menu"${displayOpen ? " open" : ""} data-display-menu><summary>Display</summary><div class="display-panel">${modes}${hideBtn}${themeBtn}</div></details>`;
  const reviewsToggle = `<button type="button" class="rail-toggle" data-toggle-reviews aria-expanded="${railsHidden ? "false" : "true"}" aria-label="${railsHidden ? "Show reviews" : "Hide reviews"}" title="Hide reviews ([)">${railsHidden ? "›" : "‹"}</button>`;
  const reviewsHandle = `<button type="button" class="col-handle" data-rail="reviews" aria-label="Resize reviews"></button>`;
  const sideHandle = `<button type="button" class="col-handle" data-rail="sidebar" aria-label="Resize file list"></button>`;

  document.title = `${guide.title} · Guided review`;
  app.dataset.reviews = railsHidden ? "collapsed" : "open";
  app.dataset.tab = tab;
  const filesRail =
    tab === "diff"
      ? `<nav aria-label="Files">${sideHandle}<div class="nav-label">Files</div>${fileNav}</nav>`
      : "";
  app.innerHTML = `<header>${BRAND_MARK}<h1>${esc(guide.title)}</h1>${tabs}<span class="meta">${repo}${esc(range)}</span><div class="header-actions">${statsHtml(gs)}${display}</div></header><nav aria-label="Reviews">${reviewsHandle}${reviewsToggle}<div class="reviews-pane"><div class="nav-label"><span>Reviews</span><button type="button" class="ghost" data-open-paste>Add</button></div><div class="review-list">${reviewNav}</div></div></nav>${filesRail}<main><div class="main-inner${tab === "guide" ? " is-guide" : ""}">${mainInner}</div></main>${pasteModal()}`;
  bindChrome(app);
  observeMain();
  requestAnimationFrame(() => app.classList.add("rails-ready"));
  if (opts?.restoreScroll) {
    document.querySelector("main")?.scrollTo(0, top);
  }
  void paintCode();
}

function bindChrome(app: HTMLElement) {
  app.querySelectorAll("[data-jump]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-jump");
      const path = btn.getAttribute("data-path");
      const chapterId =
        btn.getAttribute("data-chapter") ||
        (id?.startsWith("section-") ? id.slice("section-".length) : null);
      if (chapterId) selectedChapterId = chapterId;
      if (path) {
        selectedGuidePath = path;
        selectedDiffPath = path;
      } else if (chapterId && guide) {
        const ch = chaptersForNav(guide).find((item) => item.id === chapterId);
        selectedGuidePath =
          ch?.files.find((file) => !viewed.has(file.path))?.path || ch?.files[0]?.path || null;
      }
      const wasToc = tocOpen;
      tocOpen = false;
      if (wasToc) render();
      if (id) jumpTo(id);
      markCurrent();
    });
  });
  app.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = btn.getAttribute("data-tab");
      if (next === "guide" || next === "diff") setTab(next);
    });
  });
  app.querySelectorAll("[data-diff-mode]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = btn.getAttribute("data-diff-mode");
      if (next === "unified" || next === "split") {
        displayOpen = true;
        setDiffMode(next);
      }
    });
  });
  bindSplitHandles(app);
  bindRailHandles(app);
  const displayMenu = app.querySelector<HTMLDetailsElement>("[data-display-menu]");
  displayMenu?.addEventListener("toggle", () => {
    displayOpen = displayMenu.open;
  });
  app.querySelector("[data-hide-unchanged]")?.addEventListener("click", () => {
    setHideUnchanged(!hideUnchanged);
  });
  app.querySelectorAll("[data-toggle-toc]").forEach((btn) => {
    btn.addEventListener("click", () => {
      tocOpen = !tocOpen;
      render({ restoreScroll: true });
    });
  });
  app.querySelector("[data-close-toc]")?.addEventListener("click", (event) => {
    if (event.target === event.currentTarget) {
      tocOpen = false;
      render({ restoreScroll: true });
    }
  });
  app.querySelector(".toc-panel")?.addEventListener("click", (event) => event.stopPropagation());
  app.querySelectorAll("[data-reviewed-chapter]").forEach((input) => {
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("change", () => {
      const id = input.getAttribute("data-reviewed-chapter");
      if (!id || !guide) return;
      if ((input as HTMLInputElement).checked) {
        markChapterReviewed(id);
        return;
      }
      const ch = chaptersForNav(guide).find((item) => item.id === id);
      for (const file of ch?.files || []) {
        const next = unmarkViewed(viewed, collapsed, file.path);
        viewed = next.viewed;
        collapsed = next.collapsed;
      }
      persistViewed();
      render({ restoreScroll: true });
    });
  });
  app.querySelector("[data-toggle-reviews]")?.addEventListener("click", () => {
    setReviewsCollapsed(!reviewsCollapsed());
  });
  app.querySelectorAll("[data-tree-dir]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const path = btn.getAttribute("data-tree-dir");
      if (!path) return;
      const next = new Set(collapsedDirs);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      collapsedDirs = next;
      render({ restoreScroll: true });
    });
  });
  app.querySelectorAll("[data-viewed-path]").forEach((input) => {
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("change", () => {
      const path = input.getAttribute("data-viewed-path");
      if (!path) return;
      const on = (input as HTMLInputElement).checked;
      if (on) {
        if (tab === "guide") {
          markReviewed(path);
          return;
        }
        viewed = markViewed(viewed, collapsed, path).viewed;
        collapsed = new Set([...collapsed, path]);
      } else {
        const next = unmarkViewed(viewed, collapsed, path);
        viewed = next.viewed;
        collapsed = next.collapsed;
      }
      persistViewed();
      render({ restoreScroll: true });
    });
  });
  app.querySelectorAll("[data-toggle-path]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const path = btn.getAttribute("data-toggle-path");
      if (!path) return;
      const next = new Set(collapsed);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      collapsed = next;
      render({ restoreScroll: true });
    });
  });
  app.querySelectorAll("[data-review-id]").forEach((el) => {
    el.addEventListener("click", (event) => {
      if ((event.target as HTMLElement).closest("[data-remove-id]")) return;
      const id = el.getAttribute("data-review-id");
      if (id) void activate(id);
    });
  });
  app.querySelectorAll("[data-remove-id]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      const id = btn.getAttribute("data-remove-id");
      if (id) void remove(id);
    });
  });
  const themeBtn = app.querySelector(".theme-toggle");
  if (themeBtn) {
    themeBtn.addEventListener("click", () => {
      displayOpen = true;
      setTheme(themeBtn.getAttribute("data-theme-next") || "dark");
      render({ restoreScroll: true });
    });
  }
  app.querySelector("[data-open-paste]")?.addEventListener("click", () => {
    pasteOpen = true;
    render({ restoreScroll: true });
  });
  app.querySelector("[data-paste-cancel]")?.addEventListener("click", () => {
    pasteOpen = false;
    render({ restoreScroll: true });
  });
  app.querySelector("[data-paste-save]")?.addEventListener("click", () => {
    const text = (app.querySelector("#paste-json") as HTMLTextAreaElement | null)
      ?.value;
    if (text) void pasteGuide(text);
  });
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || res.statusText);
  return body as T;
}

async function loadActive(force = false): Promise<void> {
  const listed = await fetchJson<{ reviews: ReviewSummary[]; activeId: string | null }>(
    "/api/reviews",
  );
  reviews = listed.reviews;
  activeId = listed.activeId;
  if (pasteOpen && !force) return;
  if (!activeId) {
    guide = null;
    lastPayloadKey = "";
    viewed = new Set();
    collapsed = new Set();
    render();
    return;
  }
  const payload = await fetchJson<{ guide: Guide }>(`/api/reviews/${activeId}`);
  const key = JSON.stringify({ listed, guide: payload.guide });
  const switched = !guide || selectedChapterId === null;
  guide = payload.guide;
  if (!force && key === lastPayloadKey) return;
  lastPayloadKey = key;
  if (switched) {
    hydrateViewed(activeId);
    if (tab === "diff") collapsed = collapsedOnDiff(viewed, collapsed);
  }
  if (switched || !guide.chapters.some((ch) => ch.id === selectedChapterId)) {
    const opened = guide.chapters.find((ch) => ch.open);
    selectedChapterId = opened ? opened.id : guide.chapters[0]?.id ?? null;
  }
  render({ restoreScroll: !switched });
}

async function activate(id: string): Promise<void> {
  await fetchJson(`/api/reviews/${id}/active`, { method: "POST" });
  selectedChapterId = null;
  await loadActive();
}

async function remove(id: string): Promise<void> {
  await fetchJson(`/api/reviews/${id}`, { method: "DELETE" });
  selectedChapterId = null;
  await loadActive();
}

async function pasteGuide(text: string): Promise<void> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (err) {
    alert(`invalid JSON: ${err}`);
    return;
  }
  const body = parsed && typeof parsed === "object" && "guide" in parsed ? parsed : { guide: parsed };
  await fetchJson("/api/reviews", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  pasteOpen = false;
  selectedChapterId = null;
  await loadActive();
}

function markReviewed(path: string) {
  viewed = markViewed(viewed, collapsed, path).viewed;
  collapsed = new Set([...collapsed, path]);
  persistViewed();
  if (!guide) {
    render({ restoreScroll: true });
    return;
  }
  const stops = guideStops(chaptersForNav(guide).filter((ch) => !ch._omitted));
  const next = stepGuide(stops, selectedChapterId || "", path, 1);
  if (next && (next.path !== path || next.chapterId !== selectedChapterId)) {
    openStop(next);
    return;
  }
  selectedGuidePath = path;
  render({ restoreScroll: true });
}

function markChapterReviewed(chapterId: string) {
  if (!guide) return;
  const ch = chaptersForNav(guide).find((item) => item.id === chapterId);
  for (const file of ch?.files || []) {
    viewed = markViewed(viewed, collapsed, file.path).viewed;
    collapsed = new Set([...collapsed, file.path]);
  }
  persistViewed();
  const last = ch?.files[(ch.files || []).length - 1];
  const stops = guideStops(chaptersForNav(guide).filter((item) => !item._omitted));
  const next = last ? stepGuide(stops, chapterId, last.path, 1) : null;
  if (next && next.chapterId !== chapterId) {
    openStop(next);
    return;
  }
  render({ restoreScroll: true });
}

function openStop(stop: { chapterId: string; path: string }) {
  selectedChapterId = stop.chapterId;
  selectedGuidePath = stop.path;
  render();
  if (!guide) return;
  const ch = chaptersForNav(guide).find((item) => item.id === stop.chapterId);
  const i = (ch?.files || []).findIndex((file) => file.path === stop.path);
  jumpTo(i >= 0 && ch ? fileId(ch.id, i) : sectionId(stop.chapterId));
}

function move(delta: number) {
  if (!guide) return;
  if (tab === "diff") {
    const rows = diffRows();
    const i = rows.findIndex((row) => row.path === selectedDiffPath);
    const next = rows[i + delta];
    if (!next) return;
    jumpTo(diffFileId(i + delta));
    return;
  }
  const stops = guideStops(chaptersForNav(guide).filter((ch) => !ch._omitted));
  const path = selectedGuidePath || stops[0]?.path;
  const chapterId = selectedChapterId || stops[0]?.chapterId;
  if (!path || !chapterId) return;
  const next = stepGuide(stops, chapterId, path, delta);
  if (next) openStop(next);
}

export function boot(): void {
  const saved = localStorage.getItem(THEME_KEY);
  document.documentElement.dataset.theme = saved === "light" || saved === "dark" ? saved : "dark";
  const savedTab = localStorage.getItem(TAB_KEY);
  if (savedTab === "guide" || savedTab === "diff") tab = savedTab;
  guideLayout = parseDiffLayout(localStorage.getItem(GUIDE_DIFF_KEY), "unified");
  diffLayout = parseDiffLayout(localStorage.getItem(DIFF_KEY), "split");
  const savedSplit = Number(localStorage.getItem(SPLIT_KEY));
  applySplitPct(Number.isFinite(savedSplit) && savedSplit > 0 ? savedSplit : 0.5);
  hideUnchanged = localStorage.getItem(HIDE_KEY) === "1";
  try {
    const rails = JSON.parse(localStorage.getItem(RAILS_KEY) || "null") as {
      reviews?: number;
      sidebar?: number;
    } | null;
    if (rails?.reviews) reviewsPx = rails.reviews;
    if (rails?.sidebar) sidebarPx = rails.sidebar;
  } catch {
    /* ignore */
  }
  applyRails();
  const reviewRails = parseReviewsRails(localStorage.getItem(REVIEWS_KEY));
  guideReviewsCollapsed = reviewRails.guide === "collapsed";
  diffReviewsCollapsed = reviewRails.diff === "collapsed";
  document.addEventListener("keydown", (event) => {
    const tag = (event.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (event.key === "j") {
      event.preventDefault();
      move(1);
    } else if (event.key === "k") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "[") {
      event.preventDefault();
      setReviewsCollapsed(!reviewsCollapsed());
    } else if (event.key === "Escape" && tocOpen) {
      event.preventDefault();
      tocOpen = false;
      render({ restoreScroll: true });
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
      event.preventDefault();
      setDiffMode(currentDiffLayout() === "split" ? "unified" : "split");
    }
  });
  void loadActive();
  setInterval(() => {
    void loadActive();
  }, 2000);
}
