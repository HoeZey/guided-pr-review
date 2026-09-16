import assert from "node:assert/strict";
import { test } from "node:test";
import {
  boundCommandRunner,
  createProcessCommandRunner,
  redactSecrets,
} from "./command-runner.ts";
import type { CommandRunner } from "./ports.ts";

const JWT = [
  Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url"),
  Buffer.from(JSON.stringify({ unique_name: "ada@contoso.com" })).toString("base64url"),
  "sig",
].join(".");
const GH_TOKEN = "gho_FIXTURE_TOKEN_abcdef1234567890";

test("redaction fixtures strip JWT, GitHub, and accessToken values", () => {
  const raw = `stderr ${JWT} ${GH_TOKEN} {"accessToken":"${JWT}"}`;
  const redacted = redactSecrets(raw);
  assert.equal(redacted.includes(JWT), false);
  assert.equal(redacted.includes(GH_TOKEN), false);
  assert.equal(redacted.includes("ada@contoso.com"), false);
  assert.match(redacted, /\[redacted\]/);
  assert.match(redacted, /"accessToken"\s*:\s*"\[redacted\]"/);
});

test("process runner maps missing command, timeout, and redacted stderr", async () => {
  const runner = createProcessCommandRunner();
  const missing = await runner.run({
    argv: ["guided-pr-review-no-such-cli-binary"],
    timeoutMs: 1000,
    maxOutputBytes: 1024,
  });
  assert.equal(missing.commandMissing, true);

  const hung = await runner.run({
    argv: [process.execPath, "-e", "setTimeout(() => {}, 60000)"],
    timeoutMs: 80,
    maxOutputBytes: 1024,
  });
  assert.equal(hung.timedOut, true);

  const leaked = await runner.run({
    argv: [
      process.execPath,
      "-e",
      "process.stderr.write('gho_FIXTURE_TOKEN_abcdef1234567890\\n')",
    ],
    timeoutMs: 2000,
    maxOutputBytes: 1024,
  });
  assert.equal(leaked.stderr.includes(GH_TOKEN), false);
  assert.match(leaked.stderr, /\[redacted\]/);
});

test("command runner bounds concurrent process work", async () => {
  let running = 0;
  let peak = 0;
  const inner: CommandRunner = {
    async run() {
      running += 1;
      peak = Math.max(peak, running);
      await new Promise((resolve) => setTimeout(resolve, 30));
      running -= 1;
      return {
        code: 0,
        stdout: "",
        stderr: "",
        timedOut: false,
        commandMissing: false,
      };
    },
  };
  const runner = boundCommandRunner(inner, 2);
  await Promise.all([
    runner.run({ argv: ["a"], timeoutMs: 1000, maxOutputBytes: 16 }),
    runner.run({ argv: ["b"], timeoutMs: 1000, maxOutputBytes: 16 }),
    runner.run({ argv: ["c"], timeoutMs: 1000, maxOutputBytes: 16 }),
    runner.run({ argv: ["d"], timeoutMs: 1000, maxOutputBytes: 16 }),
  ]);
  assert.equal(peak, 2);
});
