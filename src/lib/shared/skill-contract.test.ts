import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const skill = readFileSync(fileURLToPath(new URL("../../../SKILL.md", import.meta.url)), "utf8");

function section(heading: string): string {
  const start = skill.indexOf(`## ${heading}`);
  assert.ok(start >= 0, `missing ## ${heading}`);
  const rest = skill.slice(start + 3);
  const next = rest.search(/\n## /);
  return next < 0 ? skill.slice(start) : skill.slice(start, start + 3 + next);
}

test("Home path opens the app and waits only for Generate guide", () => {
  const home = section("Home");
  assert.match(home, /Generate guide/i);
  assert.doesNotMatch(home, /action\.kind is open/);
  assert.doesNotMatch(home, /action\.kind is update-diff/);
  assert.doesNotMatch(home, /action\.kind is refresh/);
  assert.doesNotMatch(home, /repo_pull_request/);
  assert.doesNotMatch(home, /replace_catalog/);
  assert.doesNotMatch(home, /git fetch/);
  assert.match(home, /wait_for_action/);
});

test("queue_action is Generate guide only and the app never launches an LLM", () => {
  const tools = section("MCP tools");
  assert.match(tools, /queue_action \{ kind: "generate-guide"/);
  assert.doesNotMatch(tools, /kind: "open" \| "update-diff" \| "refresh"/);
  assert.doesNotMatch(skill, /launch an LLM/i);
  assert.match(skill, /No LLM inside the app/);
  const choose = section("Choose a path");
  assert.doesNotMatch(choose, /wait for Open, Update Diff, Refresh/);
});
