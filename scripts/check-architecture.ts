import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

export type Violation = {
  file: string;
  rule: string;
  specifier?: string;
  detail?: string;
};

const CODE_EXT = /\.(?:ts|js|svelte)$/;

const SHARED_FORBIDDEN = [
  /^svelte(?:\/|$)/,
  /^@sveltejs\//,
  /^\$app\//,
  /^\$lib\/client(?:\/|$)/,
  /^\$lib\/server(?:\/|$)/,
  /^(?:node:)?fs(?:\/|$)/,
  /^(?:node:)?child_process$/,
];

const CLIENT_FORBIDDEN = [
  /^(?:node:)?fs(?:\/|$)/,
  /^(?:node:)?child_process$/,
  /^\$lib\/server(?:\/|$)/,
];

const ROUTE_IO_FORBIDDEN = [
  /^(?:node:)?fs(?:\/|$)/,
  /^(?:node:)?child_process$/,
];

const ROUTE_OK_FNS = new Set([
  "load",
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
  "HEAD",
  "OPTIONS",
  "fallback",
  "prerender",
  "ssr",
  "csr",
  "trailingSlash",
  "config",
  "entries",
  "actions",
]);

function walk(dir: string, acc: string[] = []): string[] {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return acc;
    throw err;
  }
  for (const name of names) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, acc);
    else if (CODE_EXT.test(name) && !/\.(?:test|spec)\./.test(name)) acc.push(full);
  }
  return acc;
}

function posixRel(rootDir: string, file: string): string {
  return relative(rootDir, file).split(sep).join("/");
}

function layerOf(rel: string): "shared" | "client" | "server" | "route" | null {
  if (rel.startsWith("src/lib/shared/")) return "shared";
  if (rel.startsWith("src/lib/client/")) return "client";
  if (rel.startsWith("src/lib/server/")) return "server";
  if (rel.startsWith("src/routes/")) return "route";
  return null;
}

function specifiers(source: string): string[] {
  const found = new Set<string>();
  const patterns = [
    /\b(?:import|export)\s+(?:type\s+)?[^;]*?\bfrom\s*['"]([^'"]+)['"]/g,
    /\bimport\s*['"]([^'"]+)['"]/g,
    /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const re of patterns) {
    let match: RegExpExecArray | null;
    while ((match = re.exec(source))) found.add(match[1]);
  }
  return [...found];
}

function functionNames(source: string): string[] {
  const names: string[] = [];
  const reFn = /(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g;
  const reConst =
    /(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/g;
  let match: RegExpExecArray | null;
  while ((match = reFn.exec(source))) names.push(match[1]);
  while ((match = reConst.exec(source))) names.push(match[1]);
  return names;
}

function isServerRoute(rel: string): boolean {
  return (
    /(?:^|\/)\+(?:page|layout)\.server\.(?:ts|js)$/.test(rel) ||
    /(?:^|\/)\+server\.(?:ts|js)$/.test(rel)
  );
}

export function checkArchitecture(rootDir: string): Violation[] {
  const violations: Violation[] = [];
  const files = [
    ...walk(join(rootDir, "src/lib")),
    ...walk(join(rootDir, "src/routes")),
  ];
  for (const file of files) {
    const rel = posixRel(rootDir, file);
    const layer = layerOf(rel);
    if (!layer) continue;
    const source = readFileSync(file, "utf8");
    const specs = specifiers(source);
    const forbidden =
      layer === "shared"
        ? SHARED_FORBIDDEN
        : layer === "client"
          ? CLIENT_FORBIDDEN
          : layer === "route"
            ? ROUTE_IO_FORBIDDEN
            : [];
    for (const specifier of specs) {
      if (forbidden.some((pattern) => pattern.test(specifier))) {
        violations.push({ file: rel, rule: `${layer}-forbidden-import`, specifier });
      }
    }
    if (layer === "route" && rel.endsWith(".svelte")) {
      for (const specifier of specs) {
        if (/^\$lib\/server(?:\/|$)/.test(specifier)) {
          violations.push({
            file: rel,
            rule: "route-forbidden-import",
            specifier,
          });
        }
      }
    }
    if (layer === "route" && isServerRoute(rel)) {
      for (const name of functionNames(source)) {
        if (!ROUTE_OK_FNS.has(name)) {
          violations.push({ file: rel, rule: "route-heavy-logic", detail: name });
        }
      }
    }
  }
  return violations;
}
