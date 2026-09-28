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

test("Home path fans out grey or yellow reviewer reviews from saved diffs", () => {
  const home = section("Home");
  assert.match(home, /list_reviews/);
  assert.match(home, /isReviewer/);
  assert.match(home, /sync\s+key/i);
  assert.match(home, /grey|yellow/i);
  assert.match(home, /get_review/);
  assert.match(home, /diff\.sourceCommit|diff sourceCommit/i);
  assert.match(home, /upsert_review/);
  assert.match(home, /guide\.source\.sourceCommit/);
  assert.match(home, /parallel subagents|subagents/i);
  assert.match(home, /authored|unless.*ask/i);
  assert.doesNotMatch(home, /wait_for_action/);
  assert.doesNotMatch(home, /queue_action/);
  assert.doesNotMatch(home, /complete_action/);
  assert.doesNotMatch(home, /Generate guide/i);
  assert.doesNotMatch(home, /git checkout|git fetch|git switch/i);
  assert.doesNotMatch(home, /repo_pull_request/);
  assert.doesNotMatch(home, /replace_catalog/);
});

test("Home skips green reviews and includes a named extra only when asked", () => {
  const home = section("Home");
  assert.match(home, /green|nothing behind|does not rewrite/i);
  assert.match(home, /named|asks for|when asked/i);
});

test("MCP tools drop the action queue and the app never launches an LLM", () => {
  const tools = section("MCP tools");
  assert.doesNotMatch(tools, /queue_action/);
  assert.doesNotMatch(tools, /wait_for_action/);
  assert.doesNotMatch(tools, /complete_action/);
  assert.doesNotMatch(tools, /generate-guide/);
  assert.match(tools, /list_reviews/);
  assert.match(tools, /upsert_review/);
  assert.match(tools, /get_review/);
  assert.doesNotMatch(skill, /launch an LLM/i);
  assert.match(skill, /No LLM inside the app/);
  const choose = section("Choose a path");
  assert.doesNotMatch(choose, /wait for Open, Update Diff, Refresh/);
  assert.doesNotMatch(choose, /Generate Guide/i);
  assert.doesNotMatch(choose, /wait_for_action/);
});
