import assert from "node:assert/strict";
import { test } from "node:test";
import type { StoredAction } from "../../shared/contracts/catalog.ts";
import type { AppServices } from "../services/app.ts";
import { createMcpHandler } from "./handler.ts";

function unused(name: string) {
  return async () => {
    throw new Error(`unexpected ${name}`);
  };
}

const listed = {
  reviews: [],
  activeId: null,
  repositories: [],
  catalog: [],
  actions: [] as StoredAction[],
  agentConnected: false,
};

function fakeServices(overrides: {
  list?: AppServices["reviews"]["list"];
  publish?: AppServices["outcomes"]["publish"];
}): AppServices {
  return {
    reviews: {
      list: overrides.list ?? unused("list"),
      get: unused("get"),
      add: unused("add"),
      addFromTool: unused("addFromTool"),
      upsert: unused("upsert"),
      upsertFromTool: unused("upsertFromTool"),
      remove: unused("remove"),
      setActive: unused("setActive"),
      seedIfEmpty: unused("seedIfEmpty"),
      openDiff: unused("openDiff"),
      updateDiff: unused("updateDiff"),
    },
    catalog: { replace: unused("replace") },
    catalogRefresh: { refresh: unused("catalogRefresh") },
    actions: {
      queue: unused("queue"),
      wait: unused("wait"),
      complete: unused("complete"),
    },
    outcomes: { publish: overrides.publish ?? unused("publish") },
    connections: {
      list: unused("connections.list"),
      retry: unused("connections.retry"),
    },
    repositories: {
      list: unused("repositories.list"),
      add: unused("repositories.add"),
      remove: unused("repositories.remove"),
      search: unused("repositories.search"),
    },
    comments: {
      list: unused("comments.list"),
      createThread: unused("comments.createThread"),
      reply: unused("comments.reply"),
      update: unused("comments.update"),
      delete: unused("comments.delete"),
    },
  };
}

test("MCP tools/list omits the retired action queue tools", async () => {
  const { handleMcpJson } = createMcpHandler(fakeServices({ list: async () => listed }));
  const listedRpc = await handleMcpJson({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
  });
  const tools = (
    listedRpc as { result: { tools: { name: string }[] } }
  ).result.tools.map((tool) => tool.name);
  assert.ok(tools.includes("list_reviews"));
  assert.ok(tools.includes("get_review"));
  assert.ok(tools.includes("upsert_review"));
  assert.equal(tools.includes("queue_action"), false);
  assert.equal(tools.includes("wait_for_action"), false);
  assert.equal(tools.includes("complete_action"), false);
});

test("MCP tools/call list_reviews uses the injected review service", async () => {
  const { handleMcpJson } = createMcpHandler(
    fakeServices({
      list: async () => listed,
    }),
  );
  const listedRpc = await handleMcpJson({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "list_reviews", arguments: {} },
  });
  assert.deepEqual(
    (listedRpc as { result: { structuredContent: unknown } }).result.structuredContent,
    listed,
  );
});

test("MCP tools/call rejects retired action queue tools", async () => {
  const { handleMcpJson } = createMcpHandler(fakeServices({ list: async () => listed }));
  for (const name of ["queue_action", "wait_for_action", "complete_action"] as const) {
    const rpc = await handleMcpJson({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name, arguments: {} },
    });
    assert.equal((rpc as { error?: { code: number } }).error?.code, -32601);
  }
});
