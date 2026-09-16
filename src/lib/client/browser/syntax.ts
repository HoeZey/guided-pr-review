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

async function defaultLoader(): Promise<HighlighterLike> {
  const { createHighlighter } = await import("shiki");
  return createHighlighter({
    themes: ["github-light", "github-dark"],
    langs: [...SYNTAX_LANGS],
  });
}

async function loadHighlighter(): Promise<HighlighterLike> {
  if (highlighter) return highlighter;
  const load = loader ?? defaultLoader;
  highlighter = await load();
  return highlighter;
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
    const hl = await loadHighlighter();
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
    void paintLineHtml(next).then((html) => {
      if (thisGen !== gen || html == null) return;
      node.innerHTML = html;
    });
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
