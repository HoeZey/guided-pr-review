import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { alreadyRunning, stopCommand, stopServer } from "./pr-guide.js";

const script = join(dirname(fileURLToPath(import.meta.url)), "pr-guide.js");

test("alreadyRunning follows a local port", async () => {
  const server = createServer();
  const dir = mkdtempSync(join(tmpdir(), "pr-guide-"));
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.equal(typeof address, "object");
  assert.equal(await alreadyRunning(address.port), true);
  await new Promise((resolve) => server.close(resolve));
  assert.equal(await alreadyRunning(address.port), false);
  rmSync(dir, { recursive: true });
});

test("stop ends the server process group and removes the pid file", async () => {
  const dir = mkdtempSync(join(tmpdir(), "pr-guide-stop-"));
  const pidFile = join(dir, "guided-pr-review-8765.pid");
  const child = spawn("sleep", ["30"], { detached: true, stdio: "ignore" });
  writeFileSync(pidFile, String(child.pid));
  try {
    stopServer(pidFile);
    const exited = await new Promise((resolve) => {
      child.once("exit", () => resolve(true));
      setTimeout(() => resolve(false), 1000);
    });
    assert.equal(exited, true);
    assert.equal(existsSync(pidFile), false);
  } finally {
    try { process.kill(-child.pid, "SIGKILL"); } catch { /* already gone */ }
    rmSync(dir, { recursive: true, force: true });
  }
});

test("stop reports when pr-guide did not start the server", async () => {
  const missing = join(tmpdir(), `no-such-pr-guide-${process.pid}.pid`);
  const closed = await stopCommand(missing, async () => false);
  assert.deepEqual(closed, { code: 0, message: "Not running" });
  const open = await stopCommand(missing, async () => true);
  assert.equal(open.code, 1);
  assert.match(open.message, /not started by pr-guide/);
});

test("usage names start and stop", () => {
  const result = spawnSync(process.execPath, [script, "nope"], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Usage: pr-guide start\|stop/);
});
