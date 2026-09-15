// Separate Node config so svelte/server render does not share the jsdom client bundle.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  cacheDir: path.join(root, "node_modules/.vite-vitest-ssr"),
  plugins: [svelte()],
  resolve: {
    alias: { $lib: path.join(root, "src/lib") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.ssr.test.ts"],
  },
});
