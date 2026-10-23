import { lstatSync, mkdirSync, readlinkSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const packageName = "guided-pr-review";
const binName = "pr-guide";

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

function ephemeralGitClone(root) {
  return root.split(sep).join("/").includes("/_cacache/tmp/git-clone");
}

function globalPackagePath(prefix) {
  if (process.platform === "win32") return join(prefix, "node_modules", packageName);
  return join(prefix, "lib", "node_modules", packageName);
}

function globalBinPath(prefix) {
  if (process.platform === "win32") return join(prefix, `${binName}.cmd`);
  return join(prefix, "bin", binName);
}

function pointsInside(linkPath, root) {
  let info;
  try {
    info = lstatSync(linkPath);
  } catch (err) {
    if (!err || err.code !== "ENOENT") throw err;
    return false;
  }
  if (!info.isSymbolicLink()) return false;
  const target = readlinkSync(linkPath);
  const resolved = isAbsolute(target) ? target : resolve(dirname(linkPath), target);
  const rootReal = realpathSync(root);
  let resolvedReal = resolved;
  try {
    resolvedReal = realpathSync(resolved);
  } catch (err) {
    if (!err || err.code !== "ENOENT") throw err;
  }
  return resolvedReal === rootReal || resolvedReal.startsWith(rootReal + sep);
}

// npm install -g leaks the global flag into pacote's temporary git clone.
// That nested install symlinks the real package at the clone, which pacote then deletes.
function releaseLeakedGlobalLink(root, prefix) {
  if (!prefix) return;
  const dest = globalPackagePath(prefix);
  if (pointsInside(dest, root)) {
    rmSync(dest);
    mkdirSync(dest);
  }
  const bin = globalBinPath(prefix);
  if (pointsInside(bin, root)) rmSync(bin);
}

const entry = process.argv[1] ? realpathSync(process.argv[1]) : "";
if (entry === realpathSync(fileURLToPath(import.meta.url))) {
  if (process.env.npm_config_global === "true") {
    const root = dirname(dirname(fileURLToPath(import.meta.url)));
    if (ephemeralGitClone(root)) {
      releaseLeakedGlobalLink(root, process.env.npm_config_prefix);
    } else {
      linkSkill(root, homedir());
      console.log(`Guided PR review is installed at ${root}`);
    }
  }
}
