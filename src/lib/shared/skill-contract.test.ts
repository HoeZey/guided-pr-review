import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const skillPath = fileURLToPath(new URL("../../../SKILL.md", import.meta.url));
const skill = readFileSync(skillPath, "utf8");
const handlerSource = readFileSync(
  fileURLToPath(new URL("../server/mcp/handler.ts", import.meta.url)),
  "utf8",
);

function section(heading: string): string {
  const start = skill.indexOf(`## ${heading}`);
  assert.ok(start >= 0, `missing ## ${heading}`);
  const rest = skill.slice(start + 3);
  const next = rest.search(/\n## /);
  return next < 0 ? skill.slice(start) : skill.slice(start, start + 3 + next);
}

function skillToolNames(): string[] {
  const tools = section("MCP tools");
  const names = [...tools.matchAll(/^-\s+([a-z][a-z0-9_]*)\b/gm)].map((m) => m[1]!);
  assert.ok(names.length > 0, "MCP tools section lists no tools");
  return names;
}

function handlerToolNames(): string[] {
  const blockStart = handlerSource.indexOf("const TOOL_DEFS");
  assert.ok(blockStart >= 0, "handler missing TOOL_DEFS");
  const after = handlerSource.slice(blockStart);
  const blockEnd = after.indexOf("];");
  assert.ok(blockEnd >= 0, "handler TOOL_DEFS not closed");
  const block = after.slice(0, blockEnd);
  const names = [...block.matchAll(/name:\s*"([a-z][a-z0-9_]*)"/g)].map((m) => m[1]!);
  assert.ok(names.length > 0, "handler TOOL_DEFS lists no tools");
  return names;
}

test("Home, Named, and Local each name read_diff and chapter_review", () => {
  for (const heading of ["Home", "Named", "Local"] as const) {
    const body = section(heading);
    assert.match(body, /read_diff/, `${heading} names read_diff`);
    assert.match(body, /chapter_review/, `${heading} names chapter_review`);
  }
});

test("Home contains the fixed subagent brief and the retry rule", () => {
  const home = section("Home");
  assert.match(home, /list_reviews/);
  assert.match(home, /isReviewer/);
  assert.match(home, /grey|yellow/i);
  assert.match(home, /Chapter section/i);
  assert.match(home, /read_diff/);
  assert.match(home, /chapter_review/);
  assert.match(home, /sourceCommit/);
  assert.match(home, /400/);
  assert.match(home, /retry up to twice|up to twice/i);
  assert.match(home, /named ranges|named range/i);
  assert.match(home, /one line|reply with one line/i);
  assert.match(home, /chapter count/i);
  assert.match(home, /Grok 4\.7 high/);
  assert.match(home, /parallel subagents|subagents|one subagent/i);
  assert.match(home, /authored|unless.*ask/i);
  assert.match(home, /green|nothing behind|does not rewrite/i);
  assert.doesNotMatch(home, /wait_for_action/);
  assert.doesNotMatch(home, /queue_action/);
  assert.doesNotMatch(home, /complete_action/);
  assert.doesNotMatch(home, /Generate guide/i);
  assert.doesNotMatch(home, /repo_pull_request/);
  assert.doesNotMatch(home, /replace_catalog/);
});

test("Named opens a PR URL or number and skips when chaptered and not behind", () => {
  const named = section("Named");
  assert.match(named, /open_pull_request/);
  assert.match(named, /chaptered/i);
  assert.match(named, /behind/i);
  assert.match(named, /set_active/);
  assert.match(named, /read_diff/);
  assert.match(named, /chapter_review/);
});

test("Local pins the range, adds a local review, then chapters by reference", () => {
  const local = section("Local");
  assert.match(local, /add_local_review/);
  assert.match(local, /read_diff/);
  assert.match(local, /chapter_review/);
  assert.match(local, /pin|BASE|base|HEAD|head/i);
});

test("Chapter states the kind order, the split rule, and the why shape", () => {
  const chapter = section("Chapter");
  assert.match(chapter, /1\. core/);
  assert.match(chapter, /2\. consequences/);
  assert.match(chapter, /3\. glue/);
  assert.match(chapter, /4\. tests/);
  assert.match(chapter, /5\. noise/);
  assert.match(chapter, /own chapters at the end/i);
  assert.match(chapter, /behavior change is one thing/i);
  assert.match(chapter, /revert(?:ed)? alone|reverted alone/i);
  assert.match(chapter, /changed line belongs to one chapter/i);
  assert.match(chapter, /lines core needs/i);
  assert.match(chapter, /duplicated/i);
  assert.match(chapter, /60 character|about 60/i);
  assert.match(chapter, /2 to 4 sentences|2–4 sentences/i);
  assert.match(chapter, /present tense/i);
  assert.match(chapter, /description|commits|intent/i);
  assert.match(chapter, /code wins/i);
  assert.match(chapter, /(?:no|not|without|do not).{0,20}Jira|Jira.{0,20}(?:no|not|fetch)/i);
});

test("Skill drops removed paths", () => {
  assert.doesNotMatch(skill, /\badd_review\b/);
  assert.doesNotMatch(skill, /\bupsert_review\b/);
  assert.doesNotMatch(skill, /\bsummary\b/i);
  assert.doesNotMatch(skill, /az\s+rest/i);
  assert.doesNotMatch(skill, /git\s+fetch/i);
  assert.doesNotMatch(skill, /launch an LLM/i);
  assert.match(skill, /No LLM inside the app/);
});

test("MCP tools section matches the handler tools/list names", () => {
  const fromSkill = skillToolNames().slice().sort();
  const fromHandler = handlerToolNames().slice().sort();
  assert.deepEqual(fromSkill, fromHandler);
  for (const name of [
    "list_reviews",
    "open_pull_request",
    "add_local_review",
    "read_diff",
    "chapter_review",
    "get_review",
    "set_active",
    "remove_review",
    "replace_catalog",
    "publish_review_outcome",
  ]) {
    assert.ok(fromHandler.includes(name), `handler missing ${name}`);
  }
  assert.doesNotMatch(section("MCP tools"), /queue_action|wait_for_action|complete_action|generate-guide/);
});

test("Choose a path routes Home, Named, and Local without action-queue waits", () => {
  const choose = section("Choose a path");
  assert.match(choose, /Home/);
  assert.match(choose, /Named/);
  assert.match(choose, /Local/);
  assert.doesNotMatch(choose, /wait for Open, Update Diff, Refresh/);
  assert.doesNotMatch(choose, /Generate Guide/i);
  assert.doesNotMatch(choose, /wait_for_action/);
});
