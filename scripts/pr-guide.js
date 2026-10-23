#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

const port = 8765;
const root = dirname(dirname(fileURLToPath(import.meta.url)));

export function pidPath(dir = tmpdir()) {
  return join(dir, "guided-pr-review-8765.pid");
}

export function portOpen(checkPort, host) {
  return new Promise((resolve) => {
    const socket = createConnection({ host, port: checkPort });
    const done = (open) => {
      socket.destroy();
      resolve(open);
    };
    socket.setTimeout(400);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
  });
}

export async function alreadyRunning(checkPort = port) {
  if (await portOpen(checkPort, "127.0.0.1")) return true;
  return portOpen(checkPort, "::1");
}

export function stopServer(pidFile) {
  const pid = Number(readFileSync(pidFile, "utf8").trim());
  try {
    process.kill(-pid, "SIGTERM");
  } catch (err) {
    if (!err || err.code !== "ESRCH") throw err;
  }
  rmSync(pidFile, { force: true });
}

export async function stopCommand(pidFile, portIsOpen) {
  try {
    stopServer(pidFile);
    return { code: 0, message: "Stopped" };
  } catch (err) {
    if (!err || err.code !== "ENOENT") throw err;
  }
  if (await portIsOpen()) {
    return { code: 1, message: "Server on port 8765 was not started by pr-guide" };
  }
  return { code: 0, message: "Not running" };
}

function forwardStop(child) {
  const stop = (signal) => {
    try { process.kill(-child.pid, signal); } catch { /* already gone */ }
  };
  process.on("SIGINT", () => stop("SIGINT"));
  process.on("SIGTERM", () => stop("SIGTERM"));
  child.on("exit", (code) => {
    rmSync(pidPath(), { force: true });
    process.exit(code ?? 0);
  });
}

async function main() {
  const command = process.argv[2] ?? "start";
  if (command === "stop") {
    const outcome = await stopCommand(pidPath(), () => alreadyRunning());
    if (outcome.code === 0) console.log(outcome.message);
    else console.error(outcome.message);
    process.exit(outcome.code);
  }
  if (command !== "start") {
    console.error("Usage: pr-guide start|stop");
    process.exit(1);
  }
  if (await alreadyRunning()) {
    console.log(`Already running at http://localhost:${port}/`);
    return;
  }
  const child = spawn("npm", ["run", "dev"], { cwd: root, stdio: "inherit", detached: true });
  writeFileSync(pidPath(), String(child.pid));
  forwardStop(child);
}

const entry = process.argv[1] ? realpathSync(process.argv[1]) : "";
if (entry === realpathSync(fileURLToPath(import.meta.url))) {
  main();
}
