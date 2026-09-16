import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { StoredAction } from "../shared/contracts/catalog.ts";
import { GuideV1 } from "../shared/contracts/guide.ts";
import { createHttpHandlers, type HttpEvent } from "./http.ts";
import { createMcpHandler } from "./mcp/handler.ts";
import { jsonRepositories, resetJsonStoreCache } from "./repositories/json/store.ts";
import { createAppServices, type AppServices } from "./services/app.ts";

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
  wait?: AppServices["actions"]["wait"];
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
    actions: {
      queue: unused("queue"),
      wait: overrides.wait ?? unused("wait"),
      complete: unused("complete"),
    },
    outcomes: { publish: unused("publish") },
    guides: { completeGenerateGuide: unused("completeGenerateGuide") },
  };
}

test("HTTP and MCP list_reviews and wait_for_action call the same services", async () => {
  const seen: string[] = [];
  const claimed: StoredAction = {
    id: "a1",
    kind: "refresh",
    status: "claimed",
    queuedAt: "t",
    claimedAt: "t",
  };
  const services = fakeServices({
    list: async () => {
      seen.push("list");
      return listed;
    },
    wait: async (input) => {
      seen.push("wait");
      assert.deepEqual(input, { timeoutMs: 0 });
      return claimed;
    },
  });
  const http = createHttpHandlers(services);
  const mcp = createMcpHandler(services);

  const listedHttp = await http.reviews.GET();
  assert.equal(listedHttp.status, 200);
  assert.deepEqual(await listedHttp.json(), listed);

  const listedMcp = await mcp.handleMcpJson({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name: "list_reviews", arguments: {} },
  });
  assert.deepEqual(
    (listedMcp as { result: { structuredContent: unknown } }).result.structuredContent,
    listed,
  );

  const waitedHttp = await http.wait.POST({
    request: new Request("http://localhost/api/actions/wait", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ timeoutMs: 0 }),
    }),
    params: {},
  });
  assert.equal(waitedHttp.status, 200);
  assert.deepEqual(await waitedHttp.json(), { action: claimed });

  const waitedMcp = await mcp.handleMcpJson({
    jsonrpc: "2.0",
    id: 2,
    method: "tools/call",
    params: { name: "wait_for_action", arguments: { timeoutMs: 0 } },
  });
  assert.deepEqual(
    (waitedMcp as { result: { structuredContent: unknown } }).result.structuredContent,
    { action: claimed },
  );
  assert.deepEqual(seen, ["list", "list", "wait", "wait"]);
});

const SHA_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SHA_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const sampleGuide = GuideV1.parse({
  version: 1,
  title: "One",
  base: SHA_A,
  head: SHA_B,
  range: "main...feature/one",
  chapters: [
    {
      id: "core",
      kind: "core",
      title: "Core",
      why: "The behavior change.",
      files: [{ path: "a.py", stub: true, reason: "placeholder" }],
    },
  ],
});

const sampleOutcome = {
  version: 1 as const,
  base: SHA_A,
  head: SHA_B,
  standards: { findings: [] },
  spec: { findings: [] },
};

function jsonRequest(url: string, method: string, body?: unknown): Request {
  const init: RequestInit = { method, headers: { "content-type": "application/json" } };
  if (body !== undefined) init.body = typeof body === "string" ? body : JSON.stringify(body);
  return new Request(url, init);
}

function event(request: Request, params: HttpEvent["params"] = {}): HttpEvent {
  return { request, params };
}

async function withStore(fn: () => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "gpr-06-05-"));
  const prev = process.env.GUIDED_PR_REVIEW_DATA;
  process.env.GUIDED_PR_REVIEW_DATA = dir;
  resetJsonStoreCache();
  try {
    await fn();
  } finally {
    resetJsonStoreCache();
    if (prev === undefined) delete process.env.GUIDED_PR_REVIEW_DATA;
    else process.env.GUIDED_PR_REVIEW_DATA = prev;
    await rm(dir, { recursive: true, force: true });
  }
}

test("isolated HTTP and MCP adapters preserve route contracts", async () => {
  await withStore(async () => {
    const http = createHttpHandlers(createAppServices(jsonRepositories));

    const empty = await http.reviews.GET();
    assert.equal(empty.status, 200);
    assert.deepEqual(await empty.json(), {
      reviews: [],
      activeId: null,
      repositories: [],
      catalog: [],
      actions: [],
      agentConnected: false,
    });

    const badJson = await http.reviews.POST(
      event(jsonRequest("http://localhost/api/reviews", "POST", "{"), {}),
    );
    assert.equal(badJson.status, 400);
    assert.deepEqual(await badJson.json(), { error: "invalid JSON" });

    const created = await http.reviews.POST(
      event(jsonRequest("http://localhost/api/reviews", "POST", { guide: sampleGuide })),
    );
    assert.equal(created.status, 201);
    const { id } = (await created.json()) as { id: string };
    assert.match(id, /^[0-9a-f-]{36}$/i);

    const listed = await http.reviews.GET();
    const listedBody = (await listed.json()) as { reviews: { id: string; title: string }[]; activeId: string };
    assert.equal(listedBody.reviews.length, 1);
    assert.equal(listedBody.reviews[0].id, id);
    assert.equal(listedBody.activeId, id);

    const upsertRejected = await http.reviews.PUT(
      event(jsonRequest("http://localhost/api/reviews", "PUT", { guide: sampleGuide })),
    );
    assert.equal(upsertRejected.status, 400);
    const upsertBody = (await upsertRejected.json()) as { error: string };
    assert.match(upsertBody.error, /upsert_review requires pull-request source/);

    const got = await http.review.GET(event(new Request(`http://localhost/api/reviews/${id}`), { id }));
    assert.equal(got.status, 200);
    const gotBody = (await got.json()) as { guide: { title: string }; outcomes: unknown[] };
    assert.equal(gotBody.guide.title, "One");
    assert.deepEqual(gotBody.outcomes, []);

    const missing = await http.review.GET(
      event(new Request("http://localhost/api/reviews/missing"), { id: "missing" }),
    );
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { error: "unknown review missing" });

    const activated = await http.active.POST(
      event(new Request(`http://localhost/api/reviews/${id}/active`, { method: "POST" }), { id }),
    );
    assert.equal(activated.status, 200);
    assert.deepEqual(await activated.json(), { activeId: id });

    const published = await http.outcomes.POST(
      event(
        jsonRequest(`http://localhost/api/reviews/${id}/outcomes`, "POST", { outcome: sampleOutcome }),
        { id },
      ),
    );
    assert.equal(published.status, 201);
    const { id: outcomeId } = (await published.json()) as { id: string };
    assert.match(outcomeId, /^[0-9a-f-]{36}$/i);

    const catalog = await http.catalog.PUT(
      event(
        jsonRequest("http://localhost/api/catalog", "PUT", {
          origin: true,
          repository: {
            provider: "azure-devops",
            host: "dev.azure.com",
            id: "repo-1",
            owner: "braidteam/BRAID",
            name: "braid-connection-designer",
            webUrl: "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer",
          },
          syncedAt: "2026-09-14T12:00:00.000Z",
          pullRequests: [],
        }),
      ),
    );
    assert.equal(catalog.status, 200);
    assert.deepEqual(await catalog.json(), { ok: true });

    const queued = await http.actions.POST(
      event(jsonRequest("http://localhost/api/actions", "POST", { kind: "refresh" })),
    );
    assert.equal(queued.status, 201);
    const { id: actionId } = (await queued.json()) as { id: string };

    const waited = await http.wait.POST(
      event(jsonRequest("http://localhost/api/actions/wait", "POST", { timeoutMs: 0 })),
    );
    assert.equal(waited.status, 200);
    const waitedBody = (await waited.json()) as { action: { id: string; status: string } };
    assert.equal(waitedBody.action.id, actionId);
    assert.equal(waitedBody.action.status, "claimed");

    const emptyWait = await http.wait.POST(
      event(new Request("http://localhost/api/actions/wait", { method: "POST" })),
    );
    assert.equal(emptyWait.status, 200);
    assert.deepEqual(await emptyWait.json(), { action: waitedBody.action });

    const completed = await http.complete.POST(
      event(
        jsonRequest(`http://localhost/api/actions/${actionId}/complete`, "POST", {
          status: "succeeded",
        }),
        { id: actionId },
      ),
    );
    assert.equal(completed.status, 200);
    assert.deepEqual(await completed.json(), { ok: true });

    const mcpGet = await http.mcp.GET(event(new Request("http://localhost/mcp")));
    assert.equal(mcpGet.status, 200);
    assert.match(await mcpGet.text(), /guided-pr-review MCP/);

    const mcpList = await http.mcp.POST(
      event(
        jsonRequest("http://localhost/mcp", "POST", {
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "get_review", arguments: { id } },
        }),
      ),
    );
    assert.equal(mcpList.status, 200);
    const mcpBody = (await mcpList.json()) as {
      result: { structuredContent: { guide: { title: string }; outcomes: { id: string }[] } };
    };
    assert.equal(mcpBody.result.structuredContent.guide.title, "One");
    assert.equal(mcpBody.result.structuredContent.outcomes[0].id, outcomeId);

    const removed = await http.review.DELETE(
      event(new Request(`http://localhost/api/reviews/${id}`, { method: "DELETE" }), { id }),
    );
    assert.equal(removed.status, 200);
    assert.deepEqual(await removed.json(), { ok: true });
  });
});
