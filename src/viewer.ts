import { createHighlighter, type Highlighter } from "shiki";
import {
  collapsedOnDiff,
  filesForDiff,
  markViewed,
  overlaySegments,
  pairWordDiff,
  parseViewed,
  serializeViewed,
  unmarkViewed,
  type Lined,
} from "./guide-view.ts";

const KIND_LABEL: Record<string, string> = {
  core: "Core",
  consequences: "Consequences",
  glue: "Glue",
  tests: "Tests",
  noise: "Other",
};

const THEME_KEY = "guided-pr-review-theme";
const TAB_KEY = "guided-pr-review-tab";
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
let viewed = new Set<string>();
let collapsed = new Set<string>();
let selectedDiffPath: string | null = null;

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

function renderLine(line: Lined, lang: string) {
  const oldN = line.oldLine != null ? esc(line.oldLine) : "";
  const newN = line.newLine != null ? esc(line.newLine) : "";
  const mark = line.type === "added" ? "+" : line.type === "removed" ? "−" : "";
  const langAttr = lang ? ` data-lang="${esc(lang)}" data-raw="${esc(line.content)}"` : "";
  const segAttr = line.segments ? ` data-segments="${esc(JSON.stringify(line.segments))}"` : "";
  return `<div class="line ${esc(line.type)}"><span class="gutter">${oldN}</span><span class="gutter">${newN}</span><span class="mark">${mark}</span><span class="code"${langAttr}${segAttr}>${esc(line.content)}</span></div>`;
}

function renderFile(file: FileChange, id: string) {
  const s = fileStats(file);
  const lang = langFor(file);
  const isCollapsed = collapsed.has(file.path);
  const viewedOn = viewed.has(file.path);
  const head = `<div class="file-head"><button type="button" class="chevron" data-toggle-path="${esc(file.path)}" aria-expanded="${isCollapsed ? "false" : "true"}" aria-label="Toggle file">${isCollapsed ? "▸" : "▾"}</button><span class="path">${esc(file.path)}</span><label class="viewed"><input type="checkbox" data-viewed-path="${esc(file.path)}"${viewedOn ? " checked" : ""}> Viewed</label>${statsHtml(s)}</div>`;
  if (file.stub) {
    const reason = file.reason ? ` · ${esc(file.reason)}` : "";
    return `<section class="file" id="${esc(id)}" data-path="${esc(file.path)}" data-collapsed="${isCollapsed}">${head}<div class="file-body"><div class="stub">Body omitted${reason}.</div></div></section>`;
  }
  const hunks = (file.hunks || [])
    .map((hunk) => {
      const header = hunk.header
        ? `<div class="hunk-header">${esc(hunk.header)}</div>`
        : "";
      const lines = pairWordDiff(hunk.lines || []).map((line) => renderLine(line, lang)).join("");
      return `${header}<div class="diff">${lines}</div>`;
    })
    .join("");
  return `<section class="file" id="${esc(id)}" data-path="${esc(file.path)}" data-collapsed="${isCollapsed}">${head}<div class="file-body">${hunks}</div></section>`;
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

function renderSection(chapter: Chapter, index: number, total: number) {
  const sid = sectionId(chapter.id);
  if (chapter._omitted) {
    return `<section class="guide-section" id="${esc(sid)}">${renderOmitted(guide?.omitted || [])}</section>`;
  }
  const files = (chapter.files || [])
    .map((file, i) => renderFile(file, fileId(chapter.id, i)))
    .join("");
  return `<section class="guide-section" id="${esc(sid)}"><div class="guide-section-head"><p class="meta">Section ${index + 1} of ${total}</p><h2>${esc(chapter.title)}</h2><p>${esc(chapter.why)}</p></div>${files}</section>`;
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
  collapsed = new Set();
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

function diffRows() {
  if (!guide) return [];
  return filesForDiff(guide as Parameters<typeof filesForDiff>[0]);
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
  if (file?.dataset.path) selectedDiffPath = file.dataset.path;
  markCurrent();
  el.scrollIntoView({ behavior: "auto", block: "start" });
}

function observeMain() {
  observer?.disconnect();
  const main = document.querySelector("main");
  if (!main) return;
  const selector = tab === "guide" ? ".guide-section" : ".file[id]";
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
    app.innerHTML = `<p class="boot">No reviews yet. Add one from MCP or paste JSON.</p>${pasteModal()}`;
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
      return `<div class="review-btn" role="button" tabindex="0" data-review-id="${esc(r.id)}" aria-current="${current}"><span><span class="review-title">${esc(r.title)}</span><div class="review-range">${esc(r.range || "")}</div></span><button type="button" class="remove-btn" data-remove-id="${esc(r.id)}" aria-label="Remove">×</button></div>`;
    })
    .join("");

  const chapterNav = chapters
    .map((ch, i) => {
      const s = ch._omitted ? { additions: 0, deletions: 0 } : chapterStats(ch);
      const current = ch.id === selectedChapterId ? "true" : "false";
      const files = ch._omitted
        ? ""
        : (ch.files || [])
            .map(
              (file, fi) =>
                `<button type="button" class="file-link" data-jump="${esc(fileId(ch.id, fi))}">${esc(file.path)}</button>`,
            )
            .join("");
      return `<div class="toc-block"><button type="button" class="chapter-btn" data-jump="${esc(sectionId(ch.id))}" aria-current="${current}"><span class="idx">${String(i + 1).padStart(2, "0")}</span><span><span class="ch-kind ${esc(ch.kind)}">${esc(KIND_LABEL[ch.kind] || ch.kind)}</span><span class="ch-title">${esc(ch.title)}</span>${ch._omitted ? "" : `<div class="ch-stats">${statsHtml(s)}</div>`}</span></button>${files}</div>`;
    })
    .join("");

  const fileNav = rows
    .map((file, i) => {
      const current = file.path === selectedDiffPath ? "true" : "false";
      const dim = viewed.has(file.path) ? " viewed-link" : "";
      return `<button type="button" class="file-link${dim}" data-jump="${esc(diffFileId(i))}" data-path="${esc(file.path)}" aria-current="${current}">${esc(file.path)}</button>`;
    })
    .join("");

  const intro = guide.summary
    ? `<div class="guide-intro prose"><p>${esc(guide.summary)}</p></div>`
    : "";
  const guideBody = chapters.map((ch, i) => renderSection(ch, i, chapters.length)).join("");
  const diffBody = rows.map((file, i) => renderFile(file, diffFileId(i))).join("");
  const sideLabel = tab === "guide" ? "Guide" : "Files";
  const sideNav = tab === "guide" ? chapterNav : fileNav;
  const mainInner =
    tab === "guide"
      ? `${intro}${guideBody}<p class="hint">j / k jump sections · TOC jumps · MCP at /mcp</p>`
      : `${diffBody}<p class="hint">j / k jump files · viewed stays collapsed on Diff · MCP at /mcp</p>`;
  const tabs = `<div class="view-tabs" role="tablist"><button type="button" role="tab" data-tab="guide" aria-selected="${tab === "guide" ? "true" : "false"}">Guide</button><button type="button" role="tab" data-tab="diff" aria-selected="${tab === "diff" ? "true" : "false"}">Diff</button></div>`;

  document.title = `${guide.title} · Guided review`;
  app.innerHTML = `<header><h1>${esc(guide.title)}</h1>${tabs}<span class="meta">${repo}${esc(range)}</span><div class="header-actions">${statsHtml(gs)}<button type="button" class="theme-toggle" data-theme-next="${nextTheme}" aria-label="Switch to ${themeLabel} theme">${themeLabel}</button></div></header><nav aria-label="Reviews"><div class="nav-label">Reviews <button type="button" class="ghost" data-open-paste>Add</button></div>${reviewNav}</nav><nav aria-label="${sideLabel}"><div class="nav-label">${sideLabel}</div>${sideNav}</nav><main>${mainInner}</main>${pasteModal()}`;
  bindChrome(app);
  observeMain();
  if (opts?.restoreScroll) {
    document.querySelector("main")?.scrollTo(0, top);
  }
  void paintCode();
}

function bindChrome(app: HTMLElement) {
  app.querySelectorAll("[data-jump]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-jump");
      if (id) jumpTo(id);
    });
  });
  app.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const next = btn.getAttribute("data-tab");
      if (next === "guide" || next === "diff") setTab(next);
    });
  });
  app.querySelectorAll("[data-viewed-path]").forEach((input) => {
    input.addEventListener("click", (event) => event.stopPropagation());
    input.addEventListener("change", () => {
      const path = input.getAttribute("data-viewed-path");
      if (!path) return;
      const on = (input as HTMLInputElement).checked;
      if (on) {
        viewed = markViewed(viewed, collapsed, path).viewed;
        if (tab === "diff") collapsed = new Set([...collapsed, path]);
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
      setTheme(themeBtn.getAttribute("data-theme-next") || "light");
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
  const chapters = chaptersForNav(guide);
  const i = chapters.findIndex((ch) => ch.id === selectedChapterId);
  const next = chapters[i + delta];
  if (!next) return;
  jumpTo(sectionId(next.id));
}

export function boot(): void {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) document.documentElement.dataset.theme = saved;
  const savedTab = localStorage.getItem(TAB_KEY);
  if (savedTab === "guide" || savedTab === "diff") tab = savedTab;
  document.addEventListener("keydown", (event) => {
    const tag = (event.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (event.key === "j") {
      event.preventDefault();
      move(1);
    } else if (event.key === "k") {
      event.preventDefault();
      move(-1);
    }
  });
  void loadActive();
  setInterval(() => {
    void loadActive();
  }, 2000);
}
