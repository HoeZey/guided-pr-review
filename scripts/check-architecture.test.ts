import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { checkArchitecture } from "./check-architecture.ts";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const fixtureRoot = join(here, "architecture-fixtures");

test("architecture check fails on a shared svelte import and passes the scaffold", () => {
  const forbidden = checkArchitecture(fixtureRoot);
  assert.ok(
    forbidden.some(
      (row) =>
        row.file.replaceAll("\\", "/").includes("lib/shared/forbidden-svelte-import") &&
        row.specifier === "svelte",
    ),
    `expected a shared-layer svelte violation, got ${JSON.stringify(forbidden)}`,
  );

  assert.deepEqual(checkArchitecture(repoRoot), []);
});

test("cutover leaves SvelteKit as the only product runtime", () => {
  const pkg = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8")) as {
    scripts: Record<string, string>;
    dependencies?: Record<string, string>;
  };
  assert.equal(pkg.scripts["dev:svelte"], undefined);
  assert.equal(pkg.scripts["build:svelte"], undefined);
  assert.match(pkg.scripts.dev, /vite dev/);
  assert.match(pkg.scripts.dev, /8765/);
  assert.doesNotMatch(pkg.scripts.dev, /astro/);
  assert.match(pkg.scripts["build:app"], /vite build/);
  assert.doesNotMatch(pkg.scripts["build:app"], /astro/);
  assert.match(pkg.scripts.start, /node build/);
  assert.doesNotMatch(pkg.scripts.start, /astro|dist\/server\/entry/);
  assert.equal(pkg.dependencies?.astro, undefined);
  assert.equal(pkg.dependencies?.["@astrojs/node"], undefined);
  for (const gone of [
    "astro.config.mjs",
    "src/viewer.ts",
    "src/actions.ts",
    "src/store.ts",
    "src/contracts.ts",
    "src/pages/index.astro",
    "src/pages/reviews/[id].astro",
  ]) {
    assert.equal(existsSync(join(repoRoot, gone)), false, gone);
  }
});
