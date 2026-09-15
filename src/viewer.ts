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
  selectGuidePath,
  guideSpyFileIndex,
  shownDiffCounts,
  formatCopy,
  type Lined,
  type SplitRow,
  type DiffLayout,
  type FileTreeNode,
} from "./guide-view.ts";
import {
  findingCounts,
  selectReviewOutcome,
  type OutcomeHistoryEntry,
} from "./review-outcome.ts";
import type {
  CatalogSnapshot,
  OpenActionTarget,
  ReviewSummary,
  SpecFinding,
  StandardsFinding,
  StoredAction,
  StoredOutcome,
} from "./contracts.ts";
import {
  HOME_PATH,
  generateGuideHint,
  guidePresentsWalkthrough,
  homeCardAction,
  hostActionHint,
  inFlightActionCopy,
  inFlightGenerateGuideCopy,
  inFlightOpenCopy,
  latestAction,
  latestGenerateGuideAction,
  latestOpenAction,
  offersGenerateGuide,
  projectHomeOverview,
  resolveOverviewView,
  reviewLandingTab,
  reviewOutdatedWarning,
  reviewPath,
  type HomeCard,
  type HomeGroup,
  type OverviewView,
} from "./overview.ts";

const BRAND_MARK = `<a class="brand-link" href="${HOME_PATH}" data-home><img class="brand" src="/logo.svg" width="28" height="28" alt=""></a>`;
const BACK_HOME = `<a class="back-link icon-btn" href="${HOME_PATH}" data-home aria-label="Back to Home" title="Back to Home"><svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3 5 8l5 5"/></svg></a>`;
const ADO_MARK = `<svg class="ado-mark" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="#0078D4" d="M0 8.877L2.247 5.91l8.405-3.416V.022l7.37 5.393L2.966 8.338v8.225L0 15.707zm24-4.45v14.651l-5.753 4.9-9.303-3.057v3.056l-5.978-7.416 15.057 1.798V5.415z"/></svg>`;
const GH_MARK = `<svg class="gh-mark" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`;
const ICON_SUN = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>`;
const ICON_GEAR = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`;
const ICON_SPLIT = `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1.5" y="2.5" width="5.5" height="11" rx="1.5"/><rect x="9" y="2.5" width="5.5" height="11" rx="1.5"/></svg>`;
const ICON_UNIFIED = `<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/><path d="M5 6h6M5 8h6M5 10h6"/></svg>`;
const ICON_TOC = `<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M3 4.5h10M3 8h10M3 11.5h6"/></svg>`;
const THEME_KEY = "guided-pr-review-theme";
const TAB_KEY = "guided-pr-review-tab";
const DIFF_KEY = "guided-pr-review-diff";
const GUIDE_DIFF_KEY = "guided-pr-review-guide-diff";
const SPLIT_KEY = "guided-pr-review-split";
const HIDE_KEY = "guided-pr-review-hide-unchanged";
const RAILS_KEY = "guided-pr-review-rails";
const VIEWED_PREFIX = "guided-pr-review-viewed:";
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
  unchaptered?: boolean;
  source?: {
    kind: string;
    provider: string;
    host: string;
    repository: { id: string; owner: string; name: string; webUrl: string };
    number: number;
    webUrl: string;
    sourceRef: string;
    targetRef: string;
    sourceCommit: string;
    targetCommit: string;
  };
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

type Tab = "guide" | "diff" | "review";

let highlighter: Highlighter | null = null;
let reviews: ReviewSummary[] = [];
let catalog: CatalogSnapshot[] = [];
let actions: StoredAction[] = [];
let agentConnected = false;
let pendingActionId: string | null = null;
let view: OverviewView = { kind: "home" };
let activeId: string | null = null;
let guide: Guide | null = null;
let outcomes: StoredOutcome[] = [];
let selectedChapterId: string | null = null;
let pasteOpen = false;
let observer: IntersectionObserver | null = null;
let lastPayloadKey = "";
let tab: Tab = "guide";
let guideLayout: DiffLayout = "unified";
let diffLayout: DiffLayout = "split";
let splitPct = 0.5;
let hideUnchanged = false;
let sidebarPx = 280;
let viewed = new Set<string>();
let collapsed = new Set<string>();
let collapsedDirs = new Set<string>();
let selectedDiffPath: string | null = null;
let selectedGuidePath: string | null = null;
let selectedOutcomeSection: string | null = null;
let selectedOutcomeId: string | null = null;
let tocOpen = false;
let displayOpen = false;
let spyMain: Element | null = null;
let spyRaf = 0;

function applyTocOpen(next: boolean): void {
  tocOpen = next;
  const app = document.getElementById("app");
  if (!app) return;
  if (next) app.dataset.toc = "open";
  else delete app.dataset.toc;
  app.querySelectorAll("[data-toggle-toc]").forEach((btn) => {
    btn.setAttribute("aria-expanded", next ? "true" : "false");
  });
  if (next) requestAnimationFrame(() => revealCurrentToc());
}

function revealCurrentToc(): void {
  const panel = document.querySelector(".toc-panel");
  if (!(panel instanceof HTMLElement)) return;
  const current =
    panel.querySelector(".toc-file[aria-current='true']") ||
    panel.querySelector(".chapter-btn[aria-current='true']");
  if (current instanceof HTMLElement) current.scrollIntoView({ block: "nearest" });
}

function suppressHoverToc(): void {
  const anchor = document.querySelector("[data-toc-anchor]");
  if (!(anchor instanceof HTMLElement)) return;
  anchor.dataset.suppress = "";
  const clear = () => {
    delete anchor.dataset.suppress;
    anchor.removeEventListener("pointerleave", clear);
  };
  anchor.addEventListener("pointerleave", clear);
}

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

function sourceHeader(data: Guide): string {
  const src = data.source;
  if (src?.kind !== "pull-request" || !src.webUrl) return "";
  const github = src.provider === "github" || /github/i.test(src.host);
  const label = github ? "Open in GitHub" : "Open in Azure DevOps";
  return `<a class="icon-btn host-link" href="${esc(src.webUrl)}" target="_blank" rel="noreferrer" aria-label="${label}" title="${label}">${github ? GH_MARK : ADO_MARK}</a>`;
}

function syncHeaderHeight(): void {
  const header = document.querySelector("#app > header");
  if (!(header instanceof HTMLElement)) return;
  document.documentElement.style.setProperty(
    "--header",
    `${Math.round(header.getBoundingClientRect().height)}px`,
  );
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
  const shown = shownDiffCounts(s);
  const parts: string[] = [];
  if (shown.additions != null) parts.push(`<span class="add">+${shown.additions}</span>`);
  if (shown.deletions != null) parts.push(`<span class="del">−${shown.deletions}</span>`);
  return parts.length ? `<span class="stats">${parts.join(" ")}</span>` : "";
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

function persistSplitPct() {
  try {
    localStorage.setItem(SPLIT_KEY, String(splitPct));
  } catch {
    /* private mode */
  }
}

function applyRails() {
  document.documentElement.style.setProperty("--sidebar", `${sidebarPx}px`);
}

function persistRails() {
  try {
    localStorage.setItem(RAILS_KEY, JSON.stringify({ sidebar: sidebarPx }));
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
        if (which === "sidebar") {
          sidebarPx = Math.min(520, Math.max(160, ev.clientX - left));
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

function renderFinding(finding: StandardsFinding | SpecFinding): string {
  const classification =
    "classification" in finding
      ? `<span class="classification">${esc(finding.classification)}</span>`
      : "";
  const rec = finding.recommendation
    ? `<div class="recommendation"><span class="finding-label">Recommendation</span> ${formatCopy(finding.recommendation)}</div>`
    : "";
  let location = "";
  if (finding.location) {
    const end =
      finding.location.endLine != null &&
      finding.location.endLine !== finding.location.startLine
        ? `–${finding.location.endLine}`
        : "";
    location = `<p class="location">${esc(finding.location.path)}:${finding.location.startLine}${end}</p>`;
  }
  const ref = finding.reference
    ? `<p class="reference"><span class="finding-label">${esc(finding.reference.source)}</span>${
        finding.reference.quote ? ` — ${esc(finding.reference.quote)}` : ""
      }</p>`
    : "";
  return `<article class="finding"><div class="finding-meta"><span class="severity severity-${esc(finding.severity)}">${esc(finding.severity)}</span>${classification}</div><h3>${esc(finding.title)}</h3><div class="explanation">${formatCopy(finding.explanation)}</div>${rec}${location}${ref}</article>`;
}

function renderAxis(
  id: string,
  title: string,
  findings: readonly (StandardsFinding | SpecFinding)[],
  emptyLabel: string,
): string {
  const count = findings.length;
  const body = count
    ? findings.map((finding) => renderFinding(finding)).join("")
    : `<p class="axis-empty">${esc(emptyLabel)}</p>`;
  return `<section class="outcome-section" id="${esc(id)}"><div class="guide-section-head"><p class="meta">${count} ${count === 1 ? "finding" : "findings"}</p><h2>${esc(title)}</h2></div>${body}</section>`;
}

function renderOutcome(outcome: StoredOutcome["outcome"]): string {
  return `${renderAxis("outcome-standards", "Standards", outcome.standards.findings, "No Standards findings.")}${renderAxis("outcome-spec", "Spec", outcome.spec.findings, "No Spec findings.")}`;
}

function outcomeRunLabel(entry: OutcomeHistoryEntry): string {
  // ponytail: UTC YYYY-MM-DD HH:MM from addedAt, not the viewer's locale.
  // Upgrade to Intl.DateTimeFormat if reviewers need local time.
  return `${entry.addedAt.slice(0, 10)} ${entry.addedAt.slice(11, 16)} · ${entry.shortHead}`;
}

function renderOutcomeHistory(
  history: readonly OutcomeHistoryEntry[],
  selectedId: string,
): string {
  const options = history
    .map(
      (row) =>
        `<option value="${esc(row.id)}"${row.id === selectedId ? " selected" : ""}>${esc(outcomeRunLabel(row))}</option>`,
    )
    .join("");
  return `<label class="outcome-history">History <select data-outcome-run aria-label="Code-review run history">${options}</select></label>`;
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

function progressToc(index: number, total: number) {
  const idx = String(index + 1).padStart(2, "0");
  const tot = String(total).padStart(2, "0");
  return `<button type="button" class="progress-toc" data-toggle-toc aria-expanded="${tocOpen ? "true" : "false"}" aria-controls="guide-toc" title="Sections" aria-label="Sections ${idx} of ${tot}">${ICON_TOC}<span>${idx} / ${tot}</span></button>`;
}

function renderGuideToc(chapters: Chapter[]): { nav: string; rail: string } {
  const groups: string[] = [];
  const ticks: string[] = [];
  chapters.forEach((ch, i) => {
    const currentCh = ch.id === selectedChapterId;
    const files = ch.files || [];
    const fileBtns = files
      .map((file, fi) => {
        const id = fileId(ch.id, fi);
        const current = currentCh && file.path === selectedGuidePath;
        const reviewed = viewed.has(file.path);
        const { name } = pathParts(file.path);
        ticks.push(
          `<button type="button" class="toc-tick${reviewed ? " is-reviewed" : ""}" data-jump="${esc(id)}" data-chapter="${esc(ch.id)}" data-path="${esc(file.path)}" aria-label="${esc(name)}" aria-current="${current ? "true" : "false"}"></button>`,
        );
        return `<button type="button" class="toc-file${reviewed ? " viewed-link" : ""}" data-jump="${esc(id)}" data-chapter="${esc(ch.id)}" data-path="${esc(file.path)}" title="${esc(file.path)}" aria-current="${current ? "true" : "false"}"><span class="toc-file-name">${esc(name)}</span></button>`;
      })
      .join("");
    groups.push(
      `<div class="toc-group"><button type="button" class="chapter-btn" data-jump="${esc(sectionId(ch.id))}" data-chapter="${esc(ch.id)}" aria-current="${currentCh ? "true" : "false"}"><span class="idx">${String(i + 1).padStart(2, "0")}</span><span class="ch-title">${esc(ch.title)}</span></button>${fileBtns}</div>`,
    );
  });
  return { nav: groups.join(""), rail: ticks.join("") };
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
    return `<section class="guide-section" id="${esc(sid)}" data-chapter="${esc(chapter.id)}"><div class="guide-aside"><h2>Omitted</h2><div class="guide-progress">${progressToc(index, total)}</div><div class="guide-why">${formatCopy("Binary or unreadable paths.")}</div></div><div class="guide-stage">${renderOmitted(guide?.omitted || [])}</div></section>`;
  }
  const files = chapter.files || [];
  const pills = files
    .map((file, i) =>
      renderFilePill(file, fileId(chapter.id, i), chapter.id, file.path === selectedGuidePath),
    )
    .join("");
  const stage = files
    .map((file, i) => renderFile(file, fileId(chapter.id, i), { stage: true }))
    .join("");
  const chapterDone = files.length > 0 && files.every((file) => viewed.has(file.path));
  return `<section class="guide-section" id="${esc(sid)}" data-chapter="${esc(chapter.id)}"><aside class="guide-aside"><h2>${esc(chapter.title)}</h2><div class="guide-progress">${progressToc(index, total)}<label class="viewed"><input type="checkbox" data-reviewed-chapter="${esc(chapter.id)}"${chapterDone ? " checked" : ""}> Reviewed</label></div><div class="guide-why">${formatCopy(chapter.why)}</div><div class="file-pills">${pills}</div></aside><div class="guide-stage">${stage}</div></section>`;
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

function setTab(next: Tab) {
  tab = next;
  try {
    localStorage.setItem(TAB_KEY, tab);
  } catch {
    /* private mode */
  }
  if (tab === "diff") collapsed = collapsedOnDiff(viewed, collapsed);
  render();
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
    document.querySelectorAll(".toc-file[data-path], .toc-tick[data-path]").forEach((btn) => {
      const on =
        btn.getAttribute("data-chapter") === selectedChapterId &&
        btn.getAttribute("data-path") === selectedGuidePath;
      btn.setAttribute("aria-current", on ? "true" : "false");
    });
    return;
  }
  if (tab === "review") {
    document.querySelectorAll(".file-link[data-jump]").forEach((btn) => {
      const on = btn.getAttribute("data-jump") === selectedOutcomeSection;
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
  if (el.classList.contains("outcome-section")) {
    selectedOutcomeSection = el.id;
  }
  const file = el.closest(".file") as HTMLElement | null;
  if (file?.dataset.path) {
    selectedDiffPath = file.dataset.path;
    selectedGuidePath = file.dataset.path;
  }
  markCurrent();
  el.scrollIntoView({ behavior: "auto", block: "start" });
  if (tab === "guide") requestAnimationFrame(() => syncGuideSpy());
}

function stopGuideSpy(): void {
  spyMain?.removeEventListener("scroll", onMainSpyScroll);
  spyMain = null;
  if (spyRaf) {
    cancelAnimationFrame(spyRaf);
    spyRaf = 0;
  }
}

function onMainSpyScroll(): void {
  if (spyRaf) return;
  spyRaf = requestAnimationFrame(() => {
    spyRaf = 0;
    syncGuideSpy();
  });
}

function syncGuideSpy(): void {
  if (tab !== "guide") return;
  const main = document.querySelector("main");
  if (!main) return;
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
    if (section?.id.startsWith("section-")) {
      selectedChapterId = section.id.slice("section-".length);
    }
    if (file.dataset.path) selectedGuidePath = file.dataset.path;
    markCurrent();
    return;
  }
  const sections = main.querySelectorAll<HTMLElement>(".guide-section");
  let section: HTMLElement | null = null;
  for (const el of sections) {
    if (el.getBoundingClientRect().top <= probe) section = el;
  }
  if (section?.id.startsWith("section-")) {
    selectedChapterId = section.id.slice("section-".length);
    markCurrent();
  }
}

function observeMain() {
  observer?.disconnect();
  stopGuideSpy();
  const main = document.querySelector("main");
  if (!main) return;
  if (tab === "guide") {
    spyMain = main;
    main.addEventListener("scroll", onMainSpyScroll, { passive: true });
    syncGuideSpy();
    return;
  }
  const selector = tab === "diff" ? ".file[id]" : ".outcome-section";
  observer = new IntersectionObserver(
    (entries) => {
      const hit = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (!hit) return;
      const target = hit.target as HTMLElement;
      if (tab === "diff" && target.dataset.path) {
        selectedDiffPath = target.dataset.path;
      }
      if (tab === "review" && target.id) {
        selectedOutcomeSection = target.id;
      }
      markCurrent();
    },
    { root: main, rootMargin: "0px 0px -70% 0px", threshold: 0 },
  );
  main.querySelectorAll(selector).forEach((el) => observer?.observe(el));
}

function homeCardHtml(card: HomeCard): string {
  const badge = card.repository
    ? `<span class="repo-badge">${esc(card.repository.owner)} / ${esc(card.repository.name)}</span>`
    : "";
  const range = card.range
    ? `<span class="home-card-range">${esc(card.range)}</span>`
    : "";
  const ado = card.webUrl
    ? `<a class="icon-btn ado-link" href="${esc(card.webUrl)}" target="_blank" rel="noreferrer" aria-label="Open in Azure DevOps" title="Open in Azure DevOps">${ADO_MARK}</a>`
    : "";
  const latestOpen = latestOpenAction(card, actions);
  const latestUpdate = card.openTarget
    ? latestAction(actions, "update-diff", card.openTarget)
    : undefined;
  const inflight =
    (latestOpen ? inFlightOpenCopy(latestOpen.status) : undefined) ||
    (latestUpdate ? inFlightActionCopy("update-diff", latestUpdate.status) : undefined);
  const generateLatest = card.reviewId
    ? latestGenerateGuideAction(card.reviewId, actions)
    : undefined;
  const generateInflight = generateLatest
    ? inFlightGenerateGuideCopy(generateLatest.status)
    : undefined;
  const failed =
    generateLatest?.status === "failed"
      ? generateLatest.error?.message
      : latestOpen?.status === "failed"
        ? latestOpen.error?.message
        : latestUpdate?.status === "failed"
          ? latestUpdate.error?.message
          : undefined;
  const status = generateInflight
    ? `<span class="home-card-status">${esc(generateInflight)}</span>`
    : inflight
      ? `<span class="home-card-status">${esc(inflight)}</span>`
      : failed
        ? `<span class="home-card-status is-failed">${esc(failed)}</span>`
        : card.outdated
          ? `<span class="home-card-status is-outdated">Outdated</span>`
          : card.archived
            ? `<span class="home-card-status">Archived</span>`
            : card.hasGuide
              ? `<span class="home-card-status is-ready">Guide</span>`
              : `<span class="home-card-status">No guide</span>`;
  const body = `<span class="home-card-title">${esc(card.title)}</span>${badge}${range}`;
  const kind = homeCardAction(card, agentConnected);
  const busy = Boolean(inflight);
  const savedLink =
    card.reviewId
      ? `<a class="home-card-secondary" href="${esc(reviewPath(card.reviewId))}" data-open-review="${esc(card.reviewId)}">Open saved</a>`
      : "";
  const updateBtn =
    kind === "queue-update-diff" && card.openTarget && !busy
      ? `<button type="button" class="ghost home-card-update" data-queue-update-diff data-open-target="${esc(JSON.stringify(card.openTarget))}">Update Diff</button>`
      : "";
  let open: string;
  if (card.outdated && card.reviewId && !card.archived) {
    open = `<div class="home-card-open">${body}</div>`;
  } else if (kind === "open-saved" && card.reviewId) {
    open = `<a class="home-card-open" href="${esc(reviewPath(card.reviewId))}" data-open-review="${esc(card.reviewId)}">${body}</a>`;
  } else if (kind === "queue-open" && card.openTarget && !busy) {
    open = `<button type="button" class="home-card-open" data-queue-open data-open-target="${esc(JSON.stringify(card.openTarget))}">${body}</button>`;
  } else {
    open = `<div class="home-card-open">${body}</div>`;
  }
  const offerGuide = offersGenerateGuide(card);
  const generateBusy = Boolean(generateInflight);
  const generateBtn = offerGuide
    ? card.reviewId && agentConnected && !generateBusy
      ? `<button type="button" class="ghost" data-queue-generate="${esc(card.reviewId)}">Generate guide</button>`
      : `<button type="button" class="ghost" disabled>Generate guide</button>`
    : "";
  const pending = kind === "disabled-host" || busy;
  return `<div class="home-card${pending ? " is-pending" : ""}">${open}<div class="home-card-aside">${status}${updateBtn}${generateBtn}${card.outdated && !card.archived ? savedLink : ""}${ado}</div></div>`;
}

function homeGroupHtml(group: HomeGroup): string {
  const cards = `<div class="home-grid">${group.cards.map(homeCardHtml).join("")}</div>`;
  if (group.collapsed) {
    return `<details class="home-group is-archived"><summary><h2>${esc(group.title)}</h2></summary>${cards}</details>`;
  }
  return `<section class="home-group"><h2>${esc(group.title)}</h2>${cards}</section>`;
}

function formatLastSynced(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function renderHome(app: HTMLElement): void {
  observer?.disconnect();
  stopGuideSpy();
  const overview = projectHomeOverview(reviews, catalog);
  const nextTheme = currentTheme() === "dark" ? "light" : "dark";
  const themeLabel = nextTheme === "dark" ? "Dark" : "Light";
  const themeBtn = `<button type="button" class="icon-btn square-toggle theme-toggle" data-theme-next="${nextTheme}" aria-pressed="${currentTheme() === "light" ? "true" : "false"}" aria-label="Switch to ${themeLabel} theme" title="Switch to ${themeLabel} theme">${ICON_SUN}</button>`;
  const synced = overview.lastSynced
    ? `<p class="home-meta">Last synced ${esc(formatLastSynced(overview.lastSynced))}</p>`
    : "";
  const refresh = latestAction(actions, "refresh");
  const refreshCopy = refresh ? inFlightActionCopy("refresh", refresh.status) : undefined;
  const refreshFailed = refresh?.status === "failed" ? refresh.error?.message : undefined;
  const refreshBtn = refreshCopy
    ? `<button type="button" class="ghost" disabled>${esc(refreshCopy)}</button>`
    : `<button type="button" class="ghost" data-queue-refresh${agentConnected ? "" : " disabled"}>Refresh</button>`;
  const disconnected = hostActionHint(agentConnected);
  const disconnectNote = disconnected
    ? `<p class="home-error">${esc(disconnected)}</p>`
    : "";
  const errors = [
    ...overview.catalogErrors.map(
      (entry) =>
        `<p class="home-error">${esc(entry.owner)} / ${esc(entry.name)}: ${esc(entry.message)}</p>`,
    ),
    ...(refreshFailed ? [`<p class="home-error">${esc(refreshFailed)}</p>`] : []),
  ].join("");
  const groups = overview.groups.map(homeGroupHtml).join("");
  const list =
    groups || errors || synced || disconnectNote
      ? `${synced}${disconnectNote}${errors}${groups}`
      : `<p class="boot">No reviews yet. Add one from MCP or paste JSON.</p>`;
  document.title = "Home · Guided review";
  app.dataset.view = "home";
  delete app.dataset.tab;
  delete app.dataset.reviews;
  delete app.dataset.toc;
  app.innerHTML = `<header><div class="header-bar"><div class="header-left">${BRAND_MARK}<h1>Home</h1></div><div class="header-actions">${refreshBtn}<button type="button" class="ghost" data-open-paste>Add</button>${themeBtn}</div></div></header><main class="home-main"><div class="main-inner">${list}</div></main>${pasteModal()}`;
  bindChrome(app);
  syncHeaderHeight();
}

async function navigate(path: string): Promise<void> {
  if (location.pathname !== path) history.pushState({}, "", path);
  await loadActive(true);
}

function render(opts?: { restoreScroll?: boolean }) {
  const app = document.getElementById("app");
  if (!app) return;
  const prevMain = document.querySelector("main");
  const top = prevMain?.scrollTop ?? 0;
  if (view.kind === "home" || !guide) {
    renderHome(app);
    return;
  }
  const chapters = chaptersForNav(guide);
  const selected =
    chapters.find((ch) => ch.id === selectedChapterId) || chapters[0];
  selectedChapterId = selected.id;
  selectedGuidePath = selectGuidePath(selected.files || [], selectedGuidePath, viewed);
  const rows = diffRows();
  if (!selectedDiffPath || !rows.some((row) => row.path === selectedDiffPath)) {
    selectedDiffPath = rows[0]?.path ?? null;
  }
  const gs = guideStats(guide);
  const nextTheme = currentTheme() === "dark" ? "light" : "dark";
  const themeLabel = nextTheme === "dark" ? "Dark" : "Light";

  const toc = renderGuideToc(chapters);

  const fileNav = renderFileTree(
    fileTree(rows.map((row) => row.path)),
    0,
    rows,
  );

  const walkthrough = guidePresentsWalkthrough(guide);
  const generateLatest = latestGenerateGuideAction(activeId ?? "", actions);
  const generateCopy = generateLatest
    ? inFlightGenerateGuideCopy(generateLatest.status)
    : undefined;
  const generateFailed =
    generateLatest?.status === "failed" ? generateLatest.error?.message : undefined;
  const generateDisconnected = generateGuideHint(agentConnected);
  const canGenerate =
    Boolean(guide.unchaptered) && Boolean(activeId) && agentConnected && !generateCopy;
  const generateCta = `<button type="button" class="ghost"${canGenerate ? ` data-queue-generate="${esc(activeId ?? "")}"` : " disabled"}>${esc(generateCopy ?? "Generate guide")}</button>`;
  const generateNotes = [
    generateDisconnected && !generateCopy
      ? `<p>${esc(generateDisconnected)}</p>`
      : "",
    generateFailed ? `<p>${esc(generateFailed)}</p>` : "",
  ].join("");
  const guideBody = walkthrough
    ? chapters.map((ch, i) => renderSection(ch, i, chapters.length)).join("")
    : `<div class="outcome-empty"><h2>Generate guide</h2><p>This review is a Diff. Generate a reading-order guide when you want one.</p>${generateNotes}${generateCta}</div>`;
  const diffBody = rows.map((file, i) => renderFile(file, diffFileId(i))).join("");
  if (
    selectedOutcomeId &&
    !outcomes.some((row) => row.id === selectedOutcomeId)
  ) {
    selectedOutcomeId = null;
  }
  const selection = selectReviewOutcome(
    guide.base,
    guide.head,
    outcomes,
    selectedOutcomeId,
  );
  const shown = selection.status === "empty" ? null : selection.record.outcome;
  const counts = shown ? findingCounts(shown) : { standards: 0, spec: 0 };
  if (
    selectedOutcomeSection !== "outcome-standards" &&
    selectedOutcomeSection !== "outcome-spec"
  ) {
    selectedOutcomeSection = "outcome-standards";
  }
  const staleWarning =
    selection.status === "outdated"
      ? `<aside class="outcome-stale" role="status">Outdated. This run does not match the current guide base and head.</aside>`
      : "";
  const reviewNavSide =
    selection.status === "empty"
      ? `<p class="nav-empty">No runs</p>`
      : `${renderOutcomeHistory(selection.history, selection.record.id)}<button type="button" class="file-link" data-jump="outcome-standards" aria-current="${selectedOutcomeSection === "outcome-standards" ? "true" : "false"}">Standards <span class="axis-count">${counts.standards}</span></button><button type="button" class="file-link" data-jump="outcome-spec" aria-current="${selectedOutcomeSection === "outcome-spec" ? "true" : "false"}">Spec <span class="axis-count">${counts.spec}</span></button>`;
  const reviewBody = shown
    ? `${staleWarning}${renderOutcome(shown)}<p class="hint">j / k jump axes · run /code-review to publish another snapshot</p>`
    : `<div class="outcome-empty"><h2>No code-review outcome</h2><p>Run /code-review on this base and head. After the chat report it attaches here when exactly one saved guide matches.</p></div>`;
  const mainInner =
    tab === "guide"
      ? walkthrough
        ? `<div class="guide-doc">${guideBody}</div>`
        : guideBody
      : tab === "diff"
        ? `${diffBody}<p class="hint">j / k jump files · drag rail edges · ⌘B split · viewed stays collapsed on Diff</p>`
        : reviewBody;
  const layout = currentDiffLayout();
  const tabs = `<div class="view-tabs main-tabs" role="tablist"><button type="button" role="tab" data-tab="diff" aria-selected="${tab === "diff" ? "true" : "false"}">Diff</button><button type="button" role="tab" data-tab="guide" aria-selected="${tab === "guide" ? "true" : "false"}">Guide</button><button type="button" role="tab" data-tab="review" aria-selected="${tab === "review" ? "true" : "false"}">Code Review</button></div>`;
  const summary = reviews.find((row) => row.id === activeId);
  const warning = summary ? reviewOutdatedWarning(summary, catalog) : undefined;
  const banner = warning
    ? `<div class="review-banner" role="status">${esc(warning)}</div>`
    : "";
  const modes = `<div class="display-modes" role="radiogroup" aria-label="Diff layout"><button type="button" class="display-mode" data-diff-mode="unified" aria-selected="${layout === "unified" ? "true" : "false"}">${ICON_UNIFIED} Unified</button><button type="button" class="display-mode" data-diff-mode="split" aria-selected="${layout === "split" ? "true" : "false"}">${ICON_SPLIT} Split</button></div>`;
  const hideBtn = `<button type="button" class="ghost" data-hide-unchanged aria-pressed="${hideUnchanged ? "true" : "false"}">${hideUnchanged ? "Show unchanged" : "Hide unchanged"}</button>`;
  const themeBtn = `<button type="button" class="icon-btn square-toggle theme-toggle" data-theme-next="${nextTheme}" aria-pressed="${currentTheme() === "light" ? "true" : "false"}" aria-label="Switch to ${themeLabel} theme" title="Switch to ${themeLabel} theme">${ICON_SUN}</button>`;
  const display = `<details class="display-menu"${displayOpen ? " open" : ""} data-display-menu><summary class="icon-btn" aria-label="Display">${ICON_GEAR}</summary><div class="display-panel">${modes}<div class="display-toggles">${hideBtn}${themeBtn}</div></div></details>`;
  const sideHandle = `<button type="button" class="col-handle" data-rail="sidebar" aria-label="Resize file list"></button>`;

  document.title = `${guide.title} · Guided review`;
  app.dataset.view = "review";
  delete app.dataset.reviews;
  app.dataset.tab = tab;
  const filesRail =
    tab === "diff"
      ? `<nav aria-label="Files">${sideHandle}<div class="nav-label">Files</div>${fileNav}</nav>`
      : tab === "review"
        ? `<nav aria-label="Code Review">${sideHandle}<div class="nav-label">Code Review</div>${reviewNavSide}</nav>`
        : "";
  const tocAnchor =
    tab === "guide" && walkthrough
      ? `<aside class="toc-anchor"><div class="toc-cluster" data-toc-anchor><div class="toc-hotzone"><div class="toc-rail" aria-label="Guide files">${toc.rail}</div></div><nav class="toc-panel" id="guide-toc" aria-label="Guide sections"><div class="nav-label">Sections</div>${toc.nav}</nav></div></aside>`
      : "";
  app.innerHTML = `<header><div class="header-bar"><div class="header-left">${BRAND_MARK}${BACK_HOME}<h1>${esc(guide.title)}</h1>${statsHtml(gs)}</div><div class="header-actions">${sourceHeader(guide)}${display}</div></div>${tabs}${banner}</header>${filesRail}<main><div class="main-inner${tab === "guide" && walkthrough ? " is-guide" : ""}">${mainInner}</div></main>${tocAnchor}${pasteModal()}`;
  if (tab === "guide" && walkthrough) applyTocOpen(tocOpen);
  else applyTocOpen(false);
  bindChrome(app);
  observeMain();
  syncHeaderHeight();
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
        selectedGuidePath = selectGuidePath(ch?.files || [], null, viewed);
      }
      applyTocOpen(false);
      suppressHoverToc();
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      if (id) jumpTo(id);
      markCurrent();
    });
  });
  app.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = btn.getAttribute("data-tab");
      if (next === "guide" || next === "diff" || next === "review") setTab(next);
    });
  });
  app.querySelector("[data-outcome-run]")?.addEventListener("change", (event) => {
    const el = event.target;
    if (!(el instanceof HTMLSelectElement)) return;
    selectedOutcomeId = el.value;
    render({ restoreScroll: true });
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
      applyTocOpen(!tocOpen);
    });
  });
  const tocAnchorEl = app.querySelector("[data-toc-anchor]");
  tocAnchorEl?.addEventListener("pointerenter", () => {
    applyTocOpen(true);
    revealCurrentToc();
  });
  tocAnchorEl?.addEventListener("pointerleave", () => {
    applyTocOpen(false);
  });
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
  app.querySelectorAll("[data-home]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.preventDefault();
      void navigate(HOME_PATH);
    });
  });
  app.querySelectorAll("[data-open-review]").forEach((el) => {
    el.addEventListener("click", (event) => {
      event.preventDefault();
      const id = el.getAttribute("data-open-review");
      if (id) void navigate(reviewPath(id));
    });
  });
  app.querySelectorAll("[data-queue-open]").forEach((el) => {
    el.addEventListener("click", () => {
      const raw = el.getAttribute("data-open-target");
      if (!raw) return;
      void queueHostAction({ kind: "open", target: JSON.parse(raw) as OpenActionTarget });
    });
  });
  app.querySelectorAll("[data-queue-update-diff]").forEach((el) => {
    el.addEventListener("click", () => {
      const raw = el.getAttribute("data-open-target");
      if (!raw) return;
      void queueHostAction({
        kind: "update-diff",
        target: JSON.parse(raw) as OpenActionTarget,
      });
    });
  });
  app.querySelector("[data-queue-refresh]")?.addEventListener("click", () => {
    void queueHostAction({ kind: "refresh" });
  });
  app.querySelectorAll("[data-queue-generate]").forEach((el) => {
    el.addEventListener("click", () => {
      const id = el.getAttribute("data-queue-generate");
      if (id) void queueGenerateGuide(id);
    });
  });
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error || res.statusText);
  return body as T;
}

async function queueHostAction(
  payload:
    | { kind: "open" | "update-diff"; target: OpenActionTarget }
    | { kind: "refresh" },
): Promise<void> {
  const created = await fetchJson<{ id: string }>("/api/actions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (payload.kind !== "refresh") pendingActionId = created.id;
  await loadActive(true);
}

async function queueGenerateGuide(reviewId: string): Promise<void> {
  await fetchJson<{ id: string }>("/api/actions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ kind: "generate-guide", reviewId }),
  });
  await loadActive(true);
}

async function loadActive(force = false): Promise<void> {
  const pathAtStart = location.pathname;
  const listed = await fetchJson<{
    reviews: ReviewSummary[];
    activeId: string | null;
    catalog?: CatalogSnapshot[];
    actions?: StoredAction[];
    agentConnected?: boolean;
  }>("/api/reviews");
  if (location.pathname !== pathAtStart) return;
  reviews = listed.reviews;
  catalog = listed.catalog ?? [];
  actions = listed.actions ?? [];
  agentConnected = listed.agentConnected === true;
  if (pendingActionId) {
    const pending = actions.find((action) => action.id === pendingActionId);
    if (pending?.status === "succeeded" && pending.reviewId) {
      pendingActionId = null;
      await navigate(reviewPath(pending.reviewId));
      return;
    }
    if (pending?.status === "failed" || pending?.status === "succeeded") pendingActionId = null;
  }
  const nextView = resolveOverviewView(
    location.pathname,
    reviews.map((row) => row.id),
  );
  if (
    nextView.kind === "home" &&
    /^\/reviews\//.test(location.pathname.replace(/\/+$/, "") || "/")
  ) {
    history.replaceState({}, "", HOME_PATH);
  }
  view = nextView;
  if (pasteOpen && !force) return;
  if (view.kind === "home") {
    activeId = listed.activeId;
    guide = null;
    outcomes = [];
    selectedOutcomeId = null;
    const key = JSON.stringify({ view: "home", listed });
    if (!force && key === lastPayloadKey) return;
    lastPayloadKey = key;
    render();
    return;
  }
  const id = view.reviewId;
  if (listed.activeId !== id) {
    await fetchJson(`/api/reviews/${id}/active`, { method: "POST" });
    if (location.pathname !== pathAtStart) return;
  }
  activeId = id;
  const payload = await fetchJson<{ guide: Guide; outcomes?: StoredOutcome[] }>(
    `/api/reviews/${id}`,
  );
  if (location.pathname !== pathAtStart) return;
  const nextOutcomes = payload.outcomes ?? [];
  const key = JSON.stringify({ listed, guide: payload.guide, outcomes: nextOutcomes, id });
  const switched = !guide || selectedChapterId === null;
  guide = payload.guide;
  outcomes = nextOutcomes;
  if (!force && key === lastPayloadKey) return;
  lastPayloadKey = key;
  if (switched) {
    hydrateViewed(id);
    tab = reviewLandingTab(payload.guide);
    if (tab === "diff") collapsed = collapsedOnDiff(viewed, collapsed);
    selectedGuidePath = null;
    selectedOutcomeId = null;
  }
  if (switched || !guide.chapters.some((ch) => ch.id === selectedChapterId)) {
    const opened = guide.chapters.find((ch) => ch.open);
    selectedChapterId = opened ? opened.id : guide.chapters[0]?.id ?? null;
    selectedGuidePath = null;
  }
  render({ restoreScroll: !switched });
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
  const created = await fetchJson<{ id: string }>("/api/reviews", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  pasteOpen = false;
  selectedChapterId = null;
  await navigate(reviewPath(created.id));
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
  if (tab === "review") {
    const ids = ["outcome-standards", "outcome-spec"];
    const i = ids.indexOf(selectedOutcomeSection || "outcome-standards");
    const next = ids[i + delta];
    if (!next) return;
    jumpTo(next);
    return;
  }
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
  if (savedTab === "guide" || savedTab === "diff" || savedTab === "review") tab = savedTab;
  guideLayout = parseDiffLayout(localStorage.getItem(GUIDE_DIFF_KEY), "unified");
  diffLayout = parseDiffLayout(localStorage.getItem(DIFF_KEY), "split");
  const savedSplit = Number(localStorage.getItem(SPLIT_KEY));
  applySplitPct(Number.isFinite(savedSplit) && savedSplit > 0 ? savedSplit : 0.5);
  hideUnchanged = localStorage.getItem(HIDE_KEY) === "1";
  try {
    const rails = JSON.parse(localStorage.getItem(RAILS_KEY) || "null") as {
      sidebar?: number;
    } | null;
    if (rails?.sidebar) sidebarPx = rails.sidebar;
  } catch {
    /* ignore */
  }
  applyRails();
  document.addEventListener(
    "pointerdown",
    (event) => {
      const target = event.target as Node | null;
      if (displayOpen) {
        const menu = document.querySelector("[data-display-menu]");
        if (!menu?.contains(target)) {
          displayOpen = false;
          if (menu instanceof HTMLDetailsElement) menu.open = false;
        }
      }
      if (tocOpen) {
        const el = event.target as HTMLElement | null;
        if (el?.closest("[data-toggle-toc]")) return;
        const anchor = document.querySelector("[data-toc-anchor]");
        if (!anchor?.contains(target)) applyTocOpen(false);
      }
    },
    true,
  );
  document.addEventListener("keydown", (event) => {
    const tag = (event.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (event.key === "j") {
      event.preventDefault();
      move(1);
    } else if (event.key === "k") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Escape" && tocOpen) {
      event.preventDefault();
      applyTocOpen(false);
      suppressHoverToc();
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
      event.preventDefault();
      setDiffMode(currentDiffLayout() === "split" ? "unified" : "split");
    }
  });
  window.addEventListener("popstate", () => {
    void loadActive(true);
  });
  window.addEventListener("resize", () => syncHeaderHeight());
  void loadActive();
  setInterval(() => {
    void loadActive();
  }, 2000);
}
