import assert from "node:assert/strict";
import { createServer } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { alreadyRunning } from "./pr-guide.js";

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
