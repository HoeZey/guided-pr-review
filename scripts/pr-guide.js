#!/usr/bin/env node
import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";

const port = 8765;
const root = dirname(dirname(fileURLToPath(import.meta.url)));

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

async function main() {
  const command = process.argv[2] ?? "start";
  if (command !== "start") {
    console.error("Usage: pr-guide start");
    process.exit(1);
  }
  if (await alreadyRunning()) {
    console.log(`Already running at http://localhost:${port}/`);
    return;
  }
  const child = spawn("npm", ["run", "dev"], { cwd: root, stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 0));
}

const entry = process.argv[1] ? realpathSync(process.argv[1]) : "";
if (entry === realpathSync(fileURLToPath(import.meta.url))) {
  main();
}
