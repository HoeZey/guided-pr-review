import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

function appRoot(start) {
  let dir = start;
  for (;;) {
    try {
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
      if (pkg.name === "guided-pr-review") return dir;
    } catch (err) {
      if (!err || err.code !== "ENOENT") throw err;
    }
    const parent = dirname(dir);
    if (parent === dir) throw new Error("guided-pr-review package not found");
    dir = parent;
  }
}

// A root lifecycle script makes npm install -g symlink this package at
// pacote's temporary git clone, which pacote then deletes. This hook is a
// dependency so that prepare step never runs, and the real install still links.
const root = appRoot(dirname(fileURLToPath(import.meta.url)));
if (process.env.npm_config_global === "true") {
  const { linkSkill } = await import(pathToFileURL(join(root, "scripts/link-skill.js")).href);
  linkSkill(root, homedir());
  console.log(`Guided PR review is installed at ${root}`);
}
