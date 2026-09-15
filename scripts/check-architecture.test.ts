import assert from "node:assert/strict";
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
