import {
  overlaySegments,
  type Painted,
  type Seg,
} from "$lib/shared/domain/guide-view";

const SYNTAX_LANGS = [
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

export type SyntaxLang = (typeof SYNTAX_LANGS)[number];

export type HighlighterLike = {
  codeToTokens(
    code: string,
    opts: { lang: SyntaxLang; theme: "github-light" | "github-dark" },
  ): { tokens: { content: string; color?: string }[][] };
};

export type HighlighterLoader = () => Promise<HighlighterLike>;

export type PaintParams = {
  content: string;
  lang: string;
  theme: "light" | "dark";
  lineType: string;
  segments?: Seg[];
};

let loader: HighlighterLoader | null = null;
let highlighter: HighlighterLike | null = null;

export function setHighlighterLoader(next: HighlighterLoader | null): void {
  loader = next;
  highlighter = null;
}

export function resetSyntax(): void {
  loader = null;
  highlighter = null;
  bundled = null;
  loadedLangs.clear();
  loadingLangs.clear();
  paintSlots = 0;
}

function isSyntaxLang(lang: string): lang is SyntaxLang {
  return (SYNTAX_LANGS as readonly string[]).includes(lang);
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wordClassFor(lineType: string): string {
  if (lineType === "added") return "word-add";
  if (lineType === "removed") return "word-del";
  return "";
}

function paintedToHtml(tokens: Painted[], wordClass: string, withColor: boolean): string {
  return tokens
    .map((tok) => {
      const cls = tok.changed && wordClass ? ` class="${wordClass}"` : "";
      const style = withColor ? ` style="color:${tok.color || "inherit"}"` : "";
      return `<span${cls}${style}>${esc(tok.content)}</span>`;
    })
    .join("");
}

const langLoaders = {
  python: () => import("@shikijs/langs/python"),
  javascript: () => import("@shikijs/langs/javascript"),
  typescript: () => import("@shikijs/langs/typescript"),
  tsx: () => import("@shikijs/langs/tsx"),
  jsx: () => import("@shikijs/langs/jsx"),
  json: () => import("@shikijs/langs/json"),
  bash: () => import("@shikijs/langs/bash"),
  html: () => import("@shikijs/langs/html"),
  css: () => import("@shikijs/langs/css"),
  yaml: () => import("@shikijs/langs/yaml"),
  markdown: () => import("@shikijs/langs/markdown"),
  go: () => import("@shikijs/langs/go"),
  rust: () => import("@shikijs/langs/rust"),
  java: () => import("@shikijs/langs/java"),
  toml: () => import("@shikijs/langs/toml"),
};

type LoadableHighlighter = HighlighterLike & {
  loadLanguage: (...langs: SyntaxLang[]) => Promise<void>;
};

let bundled: Promise<LoadableHighlighter> | null = null;
const loadedLangs = new Set<string>();
const loadingLangs = new Map<string, Promise<void>>();
let paintSlots = 0;

function yieldPaintTurn(): Promise<void> {
  paintSlots += 1;
  if (paintSlots % 8 !== 0) return Promise.resolve();
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });
}

async function defaultHighlighter(lang: SyntaxLang): Promise<LoadableHighlighter> {
  if (!bundled) {
    bundled = (async () => {
      const { createBundledHighlighter } = await import("shiki/core");
      const { createJavaScriptRegexEngine } = await import("shiki/engine/javascript");
      const createHighlighter = createBundledHighlighter({
        langs: langLoaders,
        themes: {
          "github-light": () => import("@shikijs/themes/github-light"),
          "github-dark": () => import("@shikijs/themes/github-dark"),
        },
        engine: () => createJavaScriptRegexEngine(),
      });
      return createHighlighter({
        themes: ["github-light", "github-dark"],
        langs: [],
      }) as Promise<LoadableHighlighter>;
    })();
  }
  const hl = await bundled;
  if (!loadedLangs.has(lang)) {
    let pending = loadingLangs.get(lang);
    if (!pending) {
      pending = hl.loadLanguage(lang).then(() => {
        loadedLangs.add(lang);
      });
      loadingLangs.set(lang, pending);
    }
    await pending;
  }
  return hl;
}

async function loadHighlighter(lang: SyntaxLang): Promise<HighlighterLike> {
  if (loader) {
    if (highlighter) return highlighter;
    highlighter = await loader();
    return highlighter;
  }
  return defaultHighlighter(lang);
}

export async function paintLineHtml(params: PaintParams): Promise<string | null> {
  if (!params.lang) return null;
  const wordClass = wordClassFor(params.lineType);
  if (!isSyntaxLang(params.lang)) {
    if (!params.segments?.length) return null;
    return paintedToHtml(
      overlaySegments([{ content: params.content }], params.segments),
      wordClass,
      false,
    );
  }
  try {
    const hl = await loadHighlighter(params.lang);
    await yieldPaintTurn();
    const result = hl.codeToTokens(params.content, {
      lang: params.lang,
      theme: params.theme === "light" ? "github-light" : "github-dark",
    });
    const line = result.tokens[0] || [];
    if (!line.length) return null;
    return paintedToHtml(
      overlaySegments(
        line.map((tok) => ({ content: tok.content, color: tok.color })),
        params.segments,
      ),
      wordClass,
      true,
    );
  } catch {
    return null;
  }
}

function paintKey(params: PaintParams): string {
  return [
    params.lang,
    params.theme,
    params.lineType,
    params.content,
    JSON.stringify(params.segments ?? null),
  ].join("\0");
}

export function syntaxPaint(node: HTMLElement, params: PaintParams) {
  let current = paintKey(params);
  let gen = 0;

  function run(next: PaintParams): void {
    const thisGen = ++gen;
    const kick = () => {
      void paintLineHtml(next).then((html) => {
        if (thisGen !== gen || html == null) return;
        node.innerHTML = html;
      });
    };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(kick);
    else kick();
  }

  run(params);
  return {
    update(next: PaintParams) {
      const key = paintKey(next);
      if (key === current) return;
      current = key;
      run(next);
    },
    destroy() {
      gen += 1;
    },
  };
}
