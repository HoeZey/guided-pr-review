import path from "node:path";
import { fileURLToPath } from "node:url";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  cacheDir: path.join(root, "node_modules/.vite-vitest-client"),
  plugins: [svelte()],
  resolve: {
    alias: {
      $lib: path.join(root, "src/lib"),
      "$app/navigation": path.join(root, "src/lib/client/browser/app-navigation.ts"),
    },
    conditions: ["browser"],
  },
  test: {
    environment: "jsdom",
    include: ["src/**/*.svelte.test.ts"],
  },
});
