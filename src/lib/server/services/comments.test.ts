import assert from "node:assert/strict";
import { test } from "node:test";
import type { CredentialIdentity, CredentialSource } from "../auth/ports.ts";
import type { GuideV1 } from "../../shared/contracts/guide.ts";
import { CommentThreadList } from "../../shared/contracts/comments.ts";
import { createHttpHandlers } from "../http.ts";
import type { ReviewRepository } from "../repositories/ports.ts";
import { createFakeCommentProvider, commentFixtures } from "../providers/fake-comments.ts";
import type { CommentProvider } from "../providers/comments.ts";
import { createAppServices, type AppServices } from "./app.ts";
import { CommentError, createCommentService } from "./comments.ts";

function adoGithub(callsAdo: unknown[] = [], callsGithub: unknown[] = []) {
  const ado = recordingProvider(
    createFakeCommentProvider({ provider: "azure-devops", threads: commentFixtures("azure-devops") }),
    callsAdo,
  );
  const github = recordingProvider(
    createFakeCommentProvider({ provider: "github", threads: commentFixtures("github") }),
    callsGithub,
  );
  return { ado, github, callsAdo, callsGithub };
}

const SHA_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SHA_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const COP = "cop_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const COP_REPLY = "cop_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function prSource(provider: "azure-devops" | "github" = "azure-devops") {
  if (provider === "github") {
    return {
      kind: "pull-request" as const,
      provider: "github" as const,
      host: "github.com",
      repository: {
        id: "1296269",
        owner: "octocat",
        name: "Hello-World",
        webUrl: "https://github.com/octocat/Hello-World",
      },
      number: 42,
      webUrl: "https://github.com/octocat/Hello-World/pull/42",
      sourceRef: "refs/heads/feature/review-me",
      targetRef: "refs/heads/develop",
      sourceCommit: SHA_B,
      targetCommit: SHA_A,
      providerContext: { kind: "github" as const },
    };
  }
  return {
    kind: "pull-request" as const,
    provider: "azure-devops" as const,
    host: "dev.azure.com",
    repository: {
      id: "repo-1",
      owner: "braidteam/BRAID",
      name: "braid-connection-designer",
      webUrl: "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer",
    },
    number: 1027,
    webUrl:
      "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1027",
    sourceRef: "refs/heads/feature/example",
    targetRef: "refs/heads/develop",
    sourceCommit: SHA_B,
    targetCommit: SHA_A,
    providerContext: {
      kind: "azure-devops" as const,
      project: "BRAID",
      firstComparingIteration: 0,
      secondComparingIteration: 1,
      changes: { "src/a.ts": { changeTrackingId: 1 } },
    },
  };
}

function guide(source?: GuideV1["source"]): GuideV1 {
  return {
    version: 1,
    title: "One",
    base: SHA_A,
    head: SHA_B,
    range: "develop...feature",
    chapters: [
      {
        id: "core",
        kind: "core",
        title: "Core",
        why: "The behavior change.",
        files: [
          {
            path: "src/a.ts",
            hunks: [
              {
                lines: [
                  { type: "context", content: "keep", oldLine: 10, newLine: 10 },
                  { type: "added", content: "x = 1", newLine: 11 },
                  { type: "added", content: "x = 2", newLine: 12 },
                  { type: "added", content: "x = 3", newLine: 13 },
                  { type: "removed", content: "gone", oldLine: 11 },
                ],
              },
            ],
          },
          { path: "src/b.ts", stub: true, reason: "placeholder" },
        ],
      },
    ],
    ...(source ? { source } : {}),
  };
}

function unused(name: string) {
  return async () => {
    throw new Error(`unexpected ${name}`);
  };
}

function repos(guides: Record<string, GuideV1>): ReviewRepository {
  return {
    listReviews: unused("listReviews"),
    getReview: async (id) => {
      const found = guides[id];
      if (!found) throw Object.assign(new Error(`unknown review ${id}`), { status: 404 });
      return { guide: found, outcomes: [] };
    },
    addReview: unused("addReview"),
    addReviewFromTool: unused("addReviewFromTool"),
    upsertReview: unused("upsertReview"),
    upsertReviewFromTool: unused("upsertReviewFromTool"),
    removeReview: unused("removeReview"),
    setActive: unused("setActive"),
    chapterReview: unused("chapterReview"),
    seedIfEmpty: unused("seedIfEmpty"),
  };
}

function credentials(login: string, provider: CredentialIdentity["provider"] = "azure-devops"): CredentialSource {
  const host = provider === "github" ? "github.com" : "dev.azure.com";
  return {
    async getAccessToken(input) {
      return {
        status: "connected",
        identity: { provider: input.provider, host: input.host, login },
        token: "FIXTURE_TOKEN",
      };
    },
  };
}

function recordingProvider(inner: CommentProvider, calls: unknown[]): CommentProvider {
  return {
    async list(input) {
      calls.push(["list", input]);
      return inner.list(input);
    },
    async createThread(input) {
      calls.push(["createThread", input]);
      return inner.createThread(input);
    },
    async reply(input) {
      calls.push(["reply", input]);
      return inner.reply(input);
    },
    async update(input) {
      calls.push(["update", input]);
      return inner.update(input);
    },
    async delete(input) {
      calls.push(["delete", input]);
      return inner.delete(input);
    },
  };
}

test("list dispatches the stored provider and never a browser URL or repository", async () => {
  const adoCalls: unknown[] = [];
  const githubCalls: unknown[] = [];
  const ado = recordingProvider(
    createFakeCommentProvider({ provider: "azure-devops", threads: commentFixtures("azure-devops") }),
    adoCalls,
  );
  const github = recordingProvider(
    createFakeCommentProvider({ provider: "github", threads: commentFixtures("github") }),
    githubCalls,
  );
  const service = createCommentService({
    reviews: repos({ r1: guide(prSource("azure-devops")) }),
    credentials: credentials("ada@contoso.com"),
    providers: { ado, github },
  });

  const listed = await service.list("r1");
  CommentThreadList.parse(listed);
  assert.equal(listed.threads.length >= 5, true);
  assert.equal(
    listed.threads.every((thread) => thread.provider === "azure-devops"),
    true,
  );
  assert.deepEqual(
    [...new Set(listed.threads.map((thread) => thread.anchor.kind))].sort(),
    ["file", "line", "pr", "range", "stale"],
  );
  assert.equal(githubCalls.length, 0);
  const listCall = adoCalls[0] as [string, { provenance: { webUrl: string; number: number } }];
  assert.equal(listCall[0], "list");
  assert.equal(listCall[1].provenance.number, 1027);
  assert.equal(
    listCall[1].provenance.webUrl,
    "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1027",
  );
});

test("list rejects unknown reviews and local-range reviews without host provenance", async () => {
  const { ado, github } = adoGithub();
  const service = createCommentService({
    reviews: repos({ local: guide() }),
    credentials: credentials("ada@contoso.com"),
    providers: { ado, github },
  });
  await assert.rejects(() => service.list("missing"), (err: unknown) => {
    assert.equal(err instanceof CommentError, true);
    assert.equal((err as CommentError).code, "unknown-review");
    return true;
  });
  await assert.rejects(() => service.list("local"), (err: unknown) => {
    assert.equal((err as CommentError).code, "no-host-provenance");
    return true;
  });
});

test("create, reply, update, and delete resolve host identity from saved provenance", async () => {
  const callsAdo: unknown[] = [];
  const callsGithub: unknown[] = [];
  const { ado, github } = adoGithub(callsAdo, callsGithub);
  const service = createCommentService({
    reviews: repos({ r1: guide(prSource("azure-devops")) }),
    credentials: credentials("ada@contoso.com"),
    providers: { ado, github },
  });

  await assert.rejects(
    () =>
      service.createThread("r1", {
        anchor: { kind: "line", path: "src/a.ts", side: "current", line: 11 },
        body: "please rename",
        clientOperationId: COP,
        provider: "github",
        host: "github.com",
        number: 99,
        webUrl: "https://evil.example/pull/99",
      }),
    (err: unknown) => {
      assert.equal((err as CommentError).code, "foreign-target");
      return true;
    },
  );
  assert.equal(callsAdo.length, 0);
  assert.equal(callsGithub.length, 0);

  const created = await service.createThread("r1", {
    anchor: { kind: "line", path: "src/a.ts", side: "current", line: 11 },
    body: "please rename",
    clientOperationId: COP,
  });
  assert.equal(created.provider, "azure-devops");
  assert.equal(created.id.startsWith("cop_"), false);
  assert.equal(created.messages[0]?.id.startsWith("cop_"), false);
  assert.equal(callsGithub.length, 0);
  const createCall = callsAdo.find((row) => Array.isArray(row) && row[0] === "createThread") as
    | [string, { provenance: { number: number; host: string } }]
    | undefined;
  assert.equal(createCall?.[1].provenance.number, 1027);
  assert.equal(createCall?.[1].provenance.host, "dev.azure.com");

  const replied = await service.reply("r1", created.id, {
    body: "also here",
    clientOperationId: COP_REPLY,
  });
  assert.equal(replied.body, "also here");

  const updated = await service.update("r1", created.id, created.messages[0]!.id, {
    body: "renamed",
  });
  assert.equal(updated.body, "renamed");

  const deleted = await service.delete("r1", created.id, created.messages[0]!.id);
  assert.deepEqual(deleted, { ok: true });
});

test("create accepts current-side line, range, file, and PR-wide anchors and rejects the rest", async () => {
  const { ado, github } = adoGithub();
  const service = createCommentService({
    reviews: repos({ r1: guide(prSource("azure-devops")) }),
    credentials: credentials("ada@contoso.com"),
    providers: { ado, github },
  });

  const cases: Array<{ anchor: Record<string, unknown>; ok?: true; code?: string }> = [
    { anchor: { kind: "line", path: "src/a.ts", side: "current", line: 11 }, ok: true },
    { anchor: { kind: "range", path: "src/a.ts", side: "current", startLine: 12, endLine: 13 }, ok: true },
    { anchor: { kind: "file", path: "src/a.ts" }, ok: true },
    { anchor: { kind: "pr" }, ok: true },
    { anchor: { kind: "file", path: "src/missing.ts" }, code: "unknown-path" },
    { anchor: { kind: "line", path: "src/a.ts", side: "current", line: 99 }, code: "anchor-outside-diff" },
    { anchor: { kind: "line", path: "src/b.ts", side: "current", line: 1 }, code: "anchor-outside-diff" },
    { anchor: { kind: "line", path: "src/a.ts", side: "current", line: 11, extra: true }, code: "invalid-anchor" },
    { anchor: { kind: "stale", reason: "unmappable", path: "src/a.ts" }, code: "invalid-anchor" },
  ];
  for (const [i, row] of cases.entries()) {
    const op = `cop_${i.toString().padStart(32, "0")}`;
    if (row.ok) {
      const thread = await service.createThread("r1", {
        anchor: row.anchor,
        body: "ok",
        clientOperationId: op,
      });
      assert.equal(thread.anchor.kind, row.anchor.kind);
      continue;
    }
    await assert.rejects(
      () => service.createThread("r1", { anchor: row.anchor, body: "no", clientOperationId: op }),
      (err: unknown) => {
        assert.equal((err as CommentError).code, row.code, String(row.anchor.kind));
        return true;
      },
    );
  }
});

test("edit and delete require current-user ownership and still call the provider when owned", async () => {
  const callsAdo: unknown[] = [];
  const { ado, github } = adoGithub(callsAdo);
  const service = createCommentService({
    reviews: repos({ r1: guide(prSource("azure-devops")) }),
    credentials: credentials("ada@contoso.com"),
    providers: { ado, github },
  });

  await assert.rejects(
    () => service.update("r1", "ado_thr_line", "ado_cmt_line_reply", { body: "forged" }),
    (err: unknown) => {
      assert.equal((err as CommentError).code, "not-owned");
      return true;
    },
  );
  await assert.rejects(
    () => service.delete("r1", "ado_thr_line", "ado_cmt_line_reply"),
    (err: unknown) => {
      assert.equal((err as CommentError).code, "not-owned");
      return true;
    },
  );
  assert.equal(
    callsAdo.some((row) => Array.isArray(row) && (row[0] === "update" || row[0] === "delete")),
    false,
  );

  await service.update("r1", "ado_thr_line", "ado_cmt_line", { body: "edited by owner" });
  await service.delete("r1", "ado_thr_line", "ado_cmt_line");
  assert.equal(callsAdo.some((row) => Array.isArray(row) && row[0] === "update"), true);
  assert.equal(callsAdo.some((row) => Array.isArray(row) && row[0] === "delete"), true);

  const githubFake = createFakeCommentProvider({ provider: "github", threads: commentFixtures("github") });
  const githubService = createCommentService({
    reviews: repos({ r1: guide(prSource("github")) }),
    credentials: credentials("octocat", "github"),
    providers: { ado: createFakeCommentProvider({ provider: "azure-devops" }), github: githubFake },
  });
  await githubService.delete("r1", "gh_thr_line", "gh_cmt_line");
  const listed = await githubService.list("r1");
  const remaining = listed.threads.find((thread) => thread.id === "gh_thr_line");
  assert.equal(remaining?.messages.some((row) => row.id === "gh_cmt_line"), false);
});

test("client operation id cannot target provider resources and is not stored as thread identity", async () => {
  const fake = createFakeCommentProvider({
    provider: "azure-devops",
    threads: commentFixtures("azure-devops"),
  });
  const service = createCommentService({
    reviews: repos({ r1: guide(prSource("azure-devops")) }),
    credentials: credentials("ada@contoso.com"),
    providers: { ado: fake, github: createFakeCommentProvider({ provider: "github" }) },
  });

  await assert.rejects(
    () =>
      service.createThread("r1", {
        anchor: { kind: "pr" },
        body: "x",
        clientOperationId: "ado_thr_line",
      }),
    (err: unknown) => {
      assert.equal((err as CommentError).code, "invalid-operation-id");
      return true;
    },
  );
  await assert.rejects(
    () => service.reply("r1", COP, { body: "x", clientOperationId: COP_REPLY }),
    (err: unknown) => {
      assert.equal((err as CommentError).code, "operation-id-as-resource");
      return true;
    },
  );

  const created = await service.createThread("r1", {
    anchor: { kind: "pr" },
    body: "pending create",
    clientOperationId: COP,
  });
  const matched = fake.findByClientOperationId(COP);
  assert.equal(matched?.threadId, created.id);
  assert.equal(matched?.threadId === COP, false);
  assert.equal(JSON.stringify(created).includes(COP), false);
});

test("list downgrades unmappable anchors to stale without fabricating a current line", async () => {
  const staleLine = commentFixtures("github")[0]!;
  staleLine.anchor = { kind: "line", path: "src/a.ts", side: "current", line: 400 };
  const service = createCommentService({
    reviews: repos({ r1: guide(prSource("github")) }),
    credentials: credentials("octocat", "github"),
    providers: {
      ado: createFakeCommentProvider({ provider: "azure-devops" }),
      github: createFakeCommentProvider({ provider: "github", threads: [staleLine] }),
    },
  });
  const listed = await service.list("r1");
  assert.equal(listed.threads[0]?.anchor.kind, "stale");
  assert.equal(listed.threads[0]?.outdated, true);
  assert.equal("line" in listed.threads[0]!.anchor, false);
});

function appWithComments(comments: AppServices["comments"]): AppServices {
  return {
    reviews: {
      list: unused("list"),
      get: unused("get"),
      add: unused("add"),
      addFromTool: unused("addFromTool"),
      upsert: unused("upsert"),
      upsertFromTool: unused("upsertFromTool"),
      remove: unused("remove"),
      setActive: unused("setActive"),
      chapterReview: unused("chapterReview"),
      seedIfEmpty: unused("seedIfEmpty"),
      openDiff: unused("openDiff"),
      updateDiff: unused("updateDiff"),
      openPullRequest: unused("openPullRequest"),
      addLocalReview: unused("addLocalReview"),
      readHead: unused("readHead"),
    },
    catalog: { replace: unused("replace") },
    catalogRefresh: { refresh: unused("catalogRefresh") },
    actions: {
      queue: unused("queue"),
      wait: unused("wait"),
      complete: unused("complete"),
    },
    outcomes: { publish: unused("publish") },
    connections: { list: unused("connections.list"), retry: unused("connections.retry") },
    repositories: {
      list: unused("repositories.list"),
      add: unused("repositories.add"),
      remove: unused("repositories.remove"),
      search: unused("repositories.search"),
    },
    comments,
  };
}

function commentEvent(url: string, init: RequestInit, params: Record<string, string>): {
  request: Request;
  params: Record<string, string | undefined>;
} {
  return { request: new Request(url, init), params };
}

test("comment HTTP routes reject foreign Origin and return structured errors", async () => {
  const { ado, github } = adoGithub();
  const comments = createCommentService({
    reviews: repos({ r1: guide(prSource("azure-devops")) }),
    credentials: credentials("ada@contoso.com"),
    providers: { ado, github },
  });
  const http = createHttpHandlers(appWithComments(comments));

  const foreign = await http.comments.GET(
    commentEvent(
      "http://localhost/api/reviews/r1/comments",
      { headers: { origin: "https://evil.example" } },
      { id: "r1" },
    ),
  );
  assert.equal(foreign.status, 403);
  assert.deepEqual(await foreign.json(), {
    error: "foreign origin is not allowed",
    code: "foreign-origin",
  });

  const listed = await http.comments.GET(
    commentEvent(
      "http://localhost/api/reviews/r1/comments",
      { headers: { origin: "http://localhost" } },
      { id: "r1" },
    ),
  );
  assert.equal(listed.status, 200);
  CommentThreadList.parse(await listed.json());

  const missing = await http.comments.GET(
    commentEvent("http://localhost/api/reviews/missing/comments", {}, { id: "missing" }),
  );
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), {
    error: "unknown review missing",
    code: "unknown-review",
  });

  const targeted = await http.comments.POST(
    commentEvent(
      "http://localhost/api/reviews/r1/comments",
      {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost" },
        body: JSON.stringify({
          anchor: { kind: "pr" },
          body: "nope",
          clientOperationId: COP,
          webUrl: "https://github.com/octocat/Hello-World/pull/1",
        }),
      },
      { id: "r1" },
    ),
  );
  assert.equal(targeted.status, 400);
  assert.deepEqual(await targeted.json(), {
    error: "browser cannot choose git host identity",
    code: "foreign-target",
  });

  const created = await http.comments.POST(
    commentEvent(
      "http://localhost/api/reviews/r1/comments",
      {
        method: "POST",
        headers: { "content-type": "application/json", origin: "http://localhost" },
        body: JSON.stringify({
          anchor: { kind: "pr" },
          body: "from http",
          clientOperationId: COP,
        }),
      },
      { id: "r1" },
    ),
  );
  assert.equal(created.status, 201);
  const createdBody = (await created.json()) as { id: string; messages: { id: string }[] };
  assert.equal(createdBody.id.startsWith("cop_"), false);
  const commentId = createdBody.messages[0]!.id;

  const replied = await http.commentReply.POST(
    commentEvent(
      `http://localhost/api/reviews/r1/comments/${createdBody.id}/replies`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: "reply http", clientOperationId: COP_REPLY }),
      },
      { id: "r1", threadId: createdBody.id },
    ),
  );
  assert.equal(replied.status, 201);

  const patched = await http.comment.PATCH(
    commentEvent(
      `http://localhost/api/reviews/r1/comments/${createdBody.id}/${commentId}`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ body: "edited http" }),
      },
      { id: "r1", threadId: createdBody.id, commentId },
    ),
  );
  assert.equal(patched.status, 200);
  assert.equal(((await patched.json()) as { body: string }).body, "edited http");

  const removed = await http.comment.DELETE(
    commentEvent(
      `http://localhost/api/reviews/r1/comments/${createdBody.id}/${commentId}`,
      { method: "DELETE" },
      { id: "r1", threadId: createdBody.id, commentId },
    ),
  );
  assert.equal(removed.status, 200);
  assert.deepEqual(await removed.json(), { ok: true });
});
test("createAppServices defaults to live ADO and GitHub comment REST", async () => {
  const seen: { url: string; auth: string | null }[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input instanceof Request ? input.url : input);
    seen.push({ url, auth: new Headers(init?.headers).get("authorization") });
    if (url.includes("dev.azure.com")) {
      return new Response(JSON.stringify({ value: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  try {
    const ado = createAppServices(
      {
        ...repos({ r1: guide(prSource("azure-devops")) }),
        replaceCatalog: unused("replaceCatalog"),
        queueAction: unused("queueAction"),
        waitForAction: unused("waitForAction"),
        completeAction: unused("completeAction"),
        publishReviewOutcome: unused("publishReviewOutcome"),
      },
      { credentials: credentials("me", "azure-devops") },
    );
    assert.deepEqual((await ado.comments.list("r1")).threads, []);
    const github = createAppServices(
      {
        ...repos({ r1: guide(prSource("github")) }),
        replaceCatalog: unused("replaceCatalog"),
        queueAction: unused("queueAction"),
        waitForAction: unused("waitForAction"),
        completeAction: unused("completeAction"),
        publishReviewOutcome: unused("publishReviewOutcome"),
      },
      { credentials: credentials("octocat", "github") },
    );
    assert.deepEqual((await github.comments.list("r1")).threads, []);
  } finally {
    globalThis.fetch = original;
  }
  assert.equal(
    seen.some(
      (row) =>
        row.url.includes("/_apis/git/repositories/repo-1/pullrequests/1027/threads") &&
        row.url.includes("api-version=7.1"),
    ),
    true,
  );
  assert.equal(
    seen.some((row) =>
      row.url.includes("https://api.github.com/repos/octocat/Hello-World/pulls/42/comments"),
    ),
    true,
  );
  assert.equal(
    seen.some((row) =>
      row.url.includes("https://api.github.com/repos/octocat/Hello-World/issues/42/comments"),
    ),
    true,
  );
  assert.equal(seen.every((row) => row.auth === "Bearer FIXTURE_TOKEN"), true);
  assert.equal(seen.some((row) => row.url.includes("evil.example")), false);
});

test("line create with empty stored changes fetches iterations and change tracking, then posts them", async () => {
  const source = {
    ...prSource("azure-devops"),
    webUrl: "https://evil.example/pull/99",
    providerContext: {
      kind: "azure-devops" as const,
      project: "BRAID",
      firstComparingIteration: 0,
      secondComparingIteration: 0,
      changes: {} as Record<string, { changeTrackingId: number }>,
    },
  };
  const saved = guide(source);
  const seen: { url: string; method: string; authorization: string | null; body: string }[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    seen.push({
      url: request.url,
      method: request.method,
      authorization: request.headers.get("authorization"),
      body: await request.clone().text(),
    });
    const url = request.url;
    if (request.method === "GET" && url.includes("/iterations/") && url.includes("/changes")) {
      return new Response(
        JSON.stringify({
          changeEntries: [{ changeTrackingId: 42, change: { item: { path: "/src/a.ts" } } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (request.method === "GET" && url.includes("/iterations")) {
      return new Response(JSON.stringify({ value: [{ id: 4 }, { id: 9 }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (request.method === "POST" && url.includes("/threads")) {
      return new Response(
        JSON.stringify({
          id: 21,
          status: "active",
          publishedDate: "2026-09-16T10:00:00.000Z",
          lastUpdatedDate: "2026-09-16T10:00:00.000Z",
          comments: [
            {
              id: 1,
              content: "please rename",
              author: { uniqueName: "me", displayName: "me" },
              publishedDate: "2026-09-16T10:00:00.000Z",
              lastUpdatedDate: "2026-09-16T10:00:00.000Z",
              lastContentUpdatedDate: "2026-09-16T10:00:00.000Z",
              commentType: "text",
            },
          ],
          threadContext: {
            filePath: "/src/a.ts",
            rightFileStart: { line: 11, offset: 1 },
            rightFileEnd: { line: 11, offset: 1 },
          },
        }),
        { status: 201, headers: { "content-type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ message: "unexpected" }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  try {
    const services = createAppServices(
      {
        ...repos({ r1: saved }),
        replaceCatalog: unused("replaceCatalog"),
        queueAction: unused("queueAction"),
        waitForAction: unused("waitForAction"),
        completeAction: unused("completeAction"),
        publishReviewOutcome: unused("publishReviewOutcome"),
      },
      { credentials: credentials("me", "azure-devops") },
    );
    const created = await services.comments.createThread("r1", {
      anchor: { kind: "line", path: "src/a.ts", side: "current", line: 11 },
      body: "please rename",
      clientOperationId: COP,
    });
    assert.equal(created.id, "21");
    assert.equal(created.anchor.kind, "line");
  } finally {
    globalThis.fetch = original;
  }
  assert.deepEqual(saved.source?.providerContext, {
    kind: "azure-devops",
    project: "BRAID",
    firstComparingIteration: 0,
    secondComparingIteration: 0,
    changes: {},
  });
  const iterationGet = seen.findIndex(
    (call) => call.method === "GET" && call.url.includes("/iterations") && !call.url.includes("/changes"),
  );
  const changesGet = seen.findIndex((call) => call.method === "GET" && call.url.includes("/changes"));
  const post = seen.findIndex((call) => call.method === "POST");
  assert.equal(iterationGet >= 0 && changesGet > iterationGet && post > changesGet, true);
  assert.equal(seen.filter((call) => call.method === "POST").length, 1);
  assert.equal(seen[changesGet]?.url.includes("/pullrequests/1027/iterations/9/changes"), true);
  assert.equal(
    seen.every(
      (call) =>
        call.url.startsWith(
          "https://dev.azure.com/braidteam/BRAID/_apis/git/repositories/repo-1/pullrequests/1027/",
        ) &&
        call.authorization === "Bearer FIXTURE_TOKEN" &&
        !call.url.includes("evil.example"),
    ),
    true,
  );
  const posted = JSON.parse(seen[post]!.body) as {
    threadContext: { filePath: string; rightFileStart: { line: number } };
    pullRequestThreadContext: {
      changeTrackingId: number;
      iterationContext: { firstComparingIteration: number; secondComparingIteration: number };
    };
  };
  assert.equal(posted.threadContext.filePath, "/src/a.ts");
  assert.equal(posted.threadContext.rightFileStart.line, 11);
  assert.equal(posted.pullRequestThreadContext.changeTrackingId, 42);
  assert.equal(posted.pullRequestThreadContext.iterationContext.firstComparingIteration, 4);
  assert.equal(posted.pullRequestThreadContext.iterationContext.secondComparingIteration, 9);
  assert.equal(JSON.stringify(posted).includes("evil.example"), false);
});

test("createAppServices still injects fake comment providers", async () => {
  const services = createAppServices(
    {
      ...repos({ r1: guide(prSource("github")) }),
      replaceCatalog: unused("replaceCatalog"),
      queueAction: unused("queueAction"),
      waitForAction: unused("waitForAction"),
      completeAction: unused("completeAction"),
      publishReviewOutcome: unused("publishReviewOutcome"),
    },
    {
      credentials: credentials("octocat", "github"),
      commentProviders: {
        ado: createFakeCommentProvider({ provider: "azure-devops", threads: commentFixtures("azure-devops") }),
        github: createFakeCommentProvider({ provider: "github", threads: commentFixtures("github") }),
      },
    },
  );
  const listed = await services.comments.list("r1");
  assert.equal(listed.threads.every((thread) => thread.provider === "github"), true);
  assert.equal(listed.threads.some((thread) => thread.anchor.kind === "stale"), true);
});

test("createAppServices keeps the host old line on an outdated GitHub thread", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes("/pulls/42/comments")) {
      return new Response(
        JSON.stringify([
          {
            id: 50,
            user: { login: "octocat" },
            body: "outdated line",
            created_at: "2011-04-14T16:00:49Z",
            updated_at: "2011-04-14T16:00:49Z",
            path: "src/gone.ts",
            side: "RIGHT",
            line: null,
            original_line: 40,
            subject_type: "line",
          },
        ]),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (url.includes("/issues/42/comments")) {
      return new Response("[]", { status: 200, headers: { "content-type": "application/json" } });
    }
    return new Response("unexpected", { status: 500 });
  }) as typeof fetch;
  try {
    const services = createAppServices(
      {
        ...repos({ r1: guide(prSource("github")) }),
        replaceCatalog: unused("replaceCatalog"),
        queueAction: unused("queueAction"),
        waitForAction: unused("waitForAction"),
        completeAction: unused("completeAction"),
        publishReviewOutcome: unused("publishReviewOutcome"),
      },
      { credentials: credentials("octocat", "github") },
    );
    const listed = await services.comments.list("r1");
    assert.equal(listed.threads.length, 1);
    assert.equal(listed.threads[0]?.outdated, true);
    assert.deepEqual(listed.threads[0]?.anchor, {
      kind: "stale",
      reason: "outdated",
      path: "src/gone.ts",
      line: 40,
    });
  } finally {
    globalThis.fetch = original;
  }
});
