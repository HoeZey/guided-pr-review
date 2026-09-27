import path from "node:path";
import { fileURLToPath } from "node:url";
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  cacheDir: path.join(root, "node_modules/.vite-svelte"),
  plugins: [sveltekit()],
  server: {
    host: "localhost",
    port: 8765,
    strictPort: true,
    // Nested worktrees rewrite .svelte-kit/tsconfig.json; Vite full-reloads on any tsconfig.json change.
    watch: {
      ignored: ["**/.cursor/worktrees/**"],
    },
  },
  preview: {
    host: "localhost",
    port: 8765,
    strictPort: true,
  },
});
