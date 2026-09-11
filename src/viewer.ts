import { createHighlighter, type Highlighter } from "shiki";

const KIND_LABEL: Record<string, string> = {
  core: "Core",
  consequences: "Consequences",
  glue: "Glue",
  tests: "Tests",
  noise: "Other",
};

const THEME_KEY = "guided-pr-review-theme";
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
];

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
    langs: LANGS,
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
    if (!lang || !LANGS.includes(lang)) continue;
    try {
      const result = hl.codeToTokens(text, { lang, theme });
      const line = result.tokens[0] || [];
      el.innerHTML = line
        .map(
          (tok) =>
            `<span style="color:${tok.color || "inherit"}">${esc(tok.content)}</span>`,
        )
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

function renderLine(line: DiffLine, lang: string) {
  const oldN = line.oldLine != null ? esc(line.oldLine) : "";
  const newN = line.newLine != null ? esc(line.newLine) : "";
  const mark = line.type === "added" ? "+" : line.type === "removed" ? "−" : "";
  const langAttr = lang ? ` data-lang="${esc(lang)}" data-raw="${esc(line.content)}"` : "";
  return `<div class="line ${esc(line.type)}"><span class="gutter">${oldN}</span><span class="gutter">${newN}</span><span class="mark">${mark}</span><span class="code"${langAttr}>${esc(line.content)}</span></div>`;
}

function renderFile(file: FileChange) {
  const s = fileStats(file);
  const lang = langFor(file);
  if (file.stub) {
    const reason = file.reason ? ` · ${esc(file.reason)}` : "";
    return `<section class="file"><div class="file-head"><span class="path">${esc(file.path)}</span>${statsHtml(s)}</div><div class="stub">Body omitted${reason}.</div></section>`;
  }
  const hunks = (file.hunks || [])
    .map((hunk) => {
      const header = hunk.header
        ? `<div class="hunk-header">${esc(hunk.header)}</div>`
        : "";
      const lines = (hunk.lines || []).map((line) => renderLine(line, lang)).join("");
      return `${header}<div class="diff">${lines}</div>`;
    })
    .join("");
  return `<section class="file"><div class="file-head"><span class="path">${esc(file.path)}</span>${statsHtml(s)}</div>${hunks}</section>`;
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

function render() {
  const app = document.getElementById("app");
  if (!app) return;
  if (!guide) {
    app.innerHTML = `<p class="boot">No reviews yet. Add one from MCP or paste JSON.</p>${pasteModal()}`;
    bindChrome(app);
    return;
  }
  const chapters = chaptersForNav(guide);
  const selected =
    chapters.find((ch) => ch.id === selectedChapterId) || chapters[0];
  selectedChapterId = selected.id;
  const selectedIndex = chapters.findIndex((ch) => ch.id === selectedChapterId);
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
      return `<button type="button" class="chapter-btn" data-chapter-id="${esc(ch.id)}" aria-current="${current}"><span class="idx">${String(i + 1).padStart(2, "0")}</span><span><span class="ch-kind ${esc(ch.kind)}">${esc(KIND_LABEL[ch.kind] || ch.kind)}</span><span class="ch-title">${esc(ch.title)}</span><div class="ch-why">${esc(ch.why)}</div>${ch._omitted ? "" : `<div class="ch-stats">${statsHtml(s)}</div>`}</span></button>`;
    })
    .join("");

  const mainInner = selected._omitted
    ? renderOmitted(guide.omitted || [])
    : `<div class="prose"><p class="meta">Chapter ${selectedIndex + 1} of ${chapters.length}</p><h2>${esc(selected.title)}</h2><p>${esc(selected.why)}</p></div>${(selected.files || []).map(renderFile).join("")}`;

  document.title = `${guide.title} · Guided review`;
  app.innerHTML = `<header><h1>${esc(guide.title)}</h1><span class="meta">${repo}${esc(range)}</span><div class="header-actions">${statsHtml(gs)}<button type="button" class="theme-toggle" data-theme-next="${nextTheme}" aria-label="Switch to ${themeLabel} theme">${themeLabel}</button></div></header><nav aria-label="Reviews"><div class="nav-label">Reviews <button type="button" class="ghost" data-open-paste>Add</button></div>${reviewNav}</nav><nav aria-label="Chapters"><div class="nav-label">Guide</div>${chapterNav}</nav><main>${mainInner}<p class="hint">j / k or arrows to walk chapters · MCP at /mcp</p></main>${pasteModal()}`;
  bindChrome(app);
  void paintCode();
}

function bindChrome(app: HTMLElement) {
  app.querySelectorAll("[data-chapter-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      selectedChapterId = btn.getAttribute("data-chapter-id");
      render();
      app.querySelector("main")?.scrollTo(0, 0);
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
      render();
    });
  }
  app.querySelector("[data-open-paste]")?.addEventListener("click", () => {
    pasteOpen = true;
    render();
  });
  app.querySelector("[data-paste-cancel]")?.addEventListener("click", () => {
    pasteOpen = false;
    render();
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

async function loadActive(): Promise<void> {
  const listed = await fetchJson<{ reviews: ReviewSummary[]; activeId: string | null }>(
    "/api/reviews",
  );
  reviews = listed.reviews;
  activeId = listed.activeId;
  if (!activeId) {
    guide = null;
    render();
    return;
  }
  const payload = await fetchJson<{ guide: Guide }>(`/api/reviews/${activeId}`);
  const same = guide && activeId === listed.activeId && guide.title === payload.guide.title;
  guide = payload.guide;
  if (!same || !selectedChapterId) {
    const opened = guide.chapters.find((ch) => ch.open);
    selectedChapterId = opened ? opened.id : guide.chapters[0]?.id ?? null;
  }
  render();
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
  const chapters = chaptersForNav(guide);
  const i = chapters.findIndex((ch) => ch.id === selectedChapterId);
  const next = chapters[i + delta];
  if (!next) return;
  selectedChapterId = next.id;
  render();
  document.querySelector("main")?.scrollTo(0, 0);
}

export function boot(): void {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) document.documentElement.dataset.theme = saved;
  document.addEventListener("keydown", (event) => {
    const tag = (event.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;
    if (event.key === "j" || event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
    } else if (event.key === "k" || event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
    }
  });
  void loadActive();
  setInterval(() => {
    void loadActive();
  }, 2000);
}
