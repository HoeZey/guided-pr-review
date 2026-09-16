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

const claimed: StoredAction = {
  id: "a1",
  kind: "refresh",
  status: "claimed",
  queuedAt: "t",
  claimedAt: "t",
};

function fakeServices(overrides: {
  list?: AppServices["reviews"]["list"];
  wait?: AppServices["actions"]["wait"];
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
      completeOpen: unused("completeOpen"),
      completeUpdateDiff: unused("completeUpdateDiff"),
    },
    catalog: { replace: unused("replace") },
    catalogRefresh: { refresh: unused("catalogRefresh") },
    actions: {
      queue: unused("queue"),
      wait: overrides.wait ?? unused("wait"),
      complete: unused("complete"),
    },
    outcomes: { publish: overrides.publish ?? unused("publish") },
    guides: { completeGenerateGuide: unused("completeGenerateGuide") },
    connections: {
      list: unused("connections.list"),
      retry: unused("connections.retry"),
    },
    repositories: {
      list: unused("repositories.list"),
      add: unused("repositories.add"),
      remove: unused("repositories.remove"),
    },
  };
}

test("MCP tools/call uses injected review and action services", async () => {
  const { handleMcpJson } = createMcpHandler(
    fakeServices({
      list: async () => listed,
      wait: async (input) => {
        assert.deepEqual(input, { timeoutMs: 0 });
        return claimed;
      },
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
  const waited = await handleMcpJson({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "wait_for_action", arguments: { timeoutMs: 0 } },
  });
  assert.deepEqual(
    (waited as { result: { structuredContent: unknown } }).result.structuredContent,
    { action: claimed },
  );
});
