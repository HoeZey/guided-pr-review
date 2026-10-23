import { lstatSync, mkdirSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export function linkSkill(root, home) {
  for (const dest of [
    join(home, ".cursor", "skills", "guided-pr-review"),
    join(home, ".agents", "skills", "guided-pr-review"),
  ]) {
    linkOne(root, dest);
  }
}

function linkOne(root, dest) {
  mkdirSync(dirname(dest), { recursive: true });
  try {
    const info = lstatSync(dest);
    if (info.isSymbolicLink()) rmSync(dest);
    else if (realpathSync(dest) === realpathSync(root)) return;
    else throw new Error(`Refusing to replace ${dest}`);
  } catch (err) {
    if (!err || err.code !== "ENOENT") throw err;
  }
  symlinkSync(root, dest);
}

const entry = process.argv[1] ? realpathSync(process.argv[1]) : "";
if (entry === realpathSync(fileURLToPath(import.meta.url))) {
  if (process.env.npm_config_global === "true") {
    const root = dirname(dirname(fileURLToPath(import.meta.url)));
    linkSkill(root, homedir());
    console.log(`Guided PR review is installed at ${root}`);
  }
}
