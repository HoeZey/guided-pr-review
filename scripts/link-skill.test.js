import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, lstatSync, mkdirSync, mkdtempSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { linkSkill } from "./link-skill.js";

const script = join(dirname(fileURLToPath(import.meta.url)), "link-skill.js");

function home() {
  return mkdtempSync(join(tmpdir(), "guided-pr-review-link-"));
}

test("linkSkill points both skill directories at the app", () => {
  const root = mkdtempSync(join(tmpdir(), "guided-pr-review-app-"));
  const dir = home();
  linkSkill(root, dir);
  for (const dest of [
    join(dir, ".cursor", "skills", "guided-pr-review"),
    join(dir, ".agents", "skills", "guided-pr-review"),
  ]) {
    assert.equal(lstatSync(dest).isSymbolicLink(), true);
    assert.equal(readlinkSync(dest), root);
  }
  rmSync(root, { recursive: true });
  rmSync(dir, { recursive: true });
});

test("linkSkill replaces a stale symlink and refuses a real directory", () => {
  const root = mkdtempSync(join(tmpdir(), "guided-pr-review-app-"));
  const other = mkdtempSync(join(tmpdir(), "guided-pr-review-other-"));
  const dir = home();
  const cursor = join(dir, ".cursor", "skills", "guided-pr-review");
  mkdirSync(dirname(cursor), { recursive: true });
  symlinkSync(other, cursor);
  linkSkill(root, dir);
  assert.equal(readlinkSync(cursor), root);

  rmSync(cursor);
  mkdirSync(cursor);
  writeFileSync(join(cursor, "keep.txt"), "x");
  assert.throws(() => linkSkill(root, dir), /Refusing to replace/);
  rmSync(root, { recursive: true });
  rmSync(other, { recursive: true });
  rmSync(dir, { recursive: true });
});

test("a global install from the pacote clone drops the leaked package link", () => {
  const cache = mkdtempSync(join(tmpdir(), "npm-cache-"));
  const clone = join(cache, "_cacache", "tmp", "git-cloneAbCd");
  mkdirSync(join(clone, "scripts"), { recursive: true });
  copyFileSync(script, join(clone, "scripts", "link-skill.js"));
  writeFileSync(join(clone, "scripts", "pr-guide.js"), "");
  const prefix = mkdtempSync(join(tmpdir(), "npm-prefix-"));
  const pkg = join(prefix, "lib", "node_modules", "guided-pr-review");
  mkdirSync(dirname(pkg), { recursive: true });
  symlinkSync(clone, pkg);
  const bin = join(prefix, "bin", "pr-guide");
  mkdirSync(dirname(bin), { recursive: true });
  symlinkSync(join(clone, "scripts", "pr-guide.js"), bin);
  const dir = home();
  const result = spawnSync(process.execPath, [join(clone, "scripts", "link-skill.js")], {
    env: { ...process.env, HOME: dir, npm_config_global: "true", npm_config_prefix: prefix },
  });
  assert.equal(result.status, 0, result.stderr?.toString());
  assert.equal(lstatSync(pkg).isDirectory(), true);
  assert.equal(lstatSync(pkg).isSymbolicLink(), false);
  assert.throws(() => lstatSync(bin));
  assert.throws(() => lstatSync(join(dir, ".cursor", "skills", "guided-pr-review")));
  assert.throws(() => lstatSync(join(dir, ".agents", "skills", "guided-pr-review")));
  rmSync(cache, { recursive: true });
  rmSync(prefix, { recursive: true });
  rmSync(dir, { recursive: true });
});

test("a global install links both skills at the installed package", () => {
  const dir = home();
  const result = spawnSync(process.execPath, [script], {
    env: { ...process.env, HOME: dir, npm_config_global: "true" },
  });
  assert.equal(result.status, 0, result.stderr?.toString());
  const app = dirname(script);
  for (const dest of [
    join(dir, ".cursor", "skills", "guided-pr-review"),
    join(dir, ".agents", "skills", "guided-pr-review"),
  ]) {
    assert.equal(readlinkSync(dest), dirname(app));
  }
  rmSync(dir, { recursive: true });
});

test("a local npm install does not link the skill", () => {
  const dir = home();
  const result = spawnSync(process.execPath, [script], {
    env: { ...process.env, HOME: dir, npm_config_global: "" },
  });
  assert.equal(result.status, 0);
  assert.throws(() => lstatSync(join(dir, ".cursor", "skills", "guided-pr-review")));
  rmSync(dir, { recursive: true });
});
