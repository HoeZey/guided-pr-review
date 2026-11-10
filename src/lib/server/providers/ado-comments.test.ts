import assert from "node:assert/strict";
import { test } from "node:test";
import type { CredentialIdentity, CredentialResult, CredentialSource } from "../auth/ports.ts";
import type { GuideV1 } from "../../shared/contracts/guide.ts";
import { CommentThread, CommentThreadList } from "../../shared/contracts/comments.ts";
import type { PullRequestSource } from "../../shared/contracts/provenance.ts";
import { CommentError } from "./comments.ts";
import { ProviderError } from "./errors.ts";
import { createFakeCommentProvider } from "./fake-comments.ts";
import type { ReviewRepository } from "../repositories/ports.ts";
import { createCommentService } from "../services/comments.ts";
import { createAdoCommentAdapter } from "./ado-comments.ts";

const TOKEN = "ado_FIXTURE_TOKEN_not_for_network";
const LOGIN = "ada@contoso.com";
const HOST = "dev.azure.com";
const ORG = "braidteam";
const PROJECT = "BRAID";
const OWNER = `${ORG}/${PROJECT}`;
const REPO_NAME = "braid-connection-designer";
const REPO_ID = "5febef5a-833d-4e14-b9c0-14cb3394e21f";
const WEB_URL = `https://dev.azure.com/${ORG}/${PROJECT}/_git/${REPO_NAME}`;
const SHA_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SHA_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const COP = "cop_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const WHEN = "2026-09-16T10:00:00.000Z";
const WHEN_LATER = "2026-09-16T10:02:00.000Z";
const EVIL_WEB = "https://evil.example/pull/99";

function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>): Response {
  const empty = body === undefined || body === "";
  return new Response(empty ? null : typeof body === "string" ? body : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function connectedCredentials(login = LOGIN): CredentialSource {
  return {
    async getAccessToken(input): Promise<CredentialResult> {
      if (input.provider !== "azure-devops") {
        return { status: "malformed", provider: input.provider, host: input.host, recovery: "az login" };
      }
      return {
        status: "connected",
        identity: { provider: "azure-devops", host: input.host, login },
        token: TOKEN,
      };
    },
  };
}

function failedCredentials(status: Exclude<CredentialResult["status"], "connected">): CredentialSource {
  return {
    async getAccessToken(input): Promise<CredentialResult> {
      return { status, provider: "azure-devops", host: input.host, recovery: "az login" };
    },
  };
}

function recordingFetch(handler: (url: URL, request: Request) => Response | Promise<Response>) {
  const calls: { url: string; method: string; authorization: string | null; body: string }[] = [];
  const fetchFn: typeof fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    calls.push({
      url: request.url,
      method: request.method,
      authorization: request.headers.get("authorization"),
      body: await request.clone().text(),
    });
    return handler(new URL(request.url), request);
  };
  return { fetch: fetchFn, calls };
}

function identity(login = LOGIN): CredentialIdentity {
  return { provider: "azure-devops", host: HOST, login };
}

function adoSource(overrides: Partial<PullRequestSource> = {}): PullRequestSource {
  return {
    kind: "pull-request",
    provider: "azure-devops",
    host: HOST,
    repository: {
      id: REPO_ID,
      owner: OWNER,
      name: REPO_NAME,
      webUrl: WEB_URL,
    },
    number: 1027,
    webUrl: `${WEB_URL}/pullrequest/1027`,
    sourceRef: "refs/heads/feature/review-me",
    targetRef: "refs/heads/develop",
    sourceCommit: SHA_B,
    targetCommit: SHA_A,
    providerContext: {
      kind: "azure-devops",
      project: PROJECT,
      firstComparingIteration: 1,
      secondComparingIteration: 2,
      changes: {
        "src/a.ts": { changeTrackingId: 7 },
        "src/b.ts": { changeTrackingId: 8 },
      },
    },
    ...overrides,
  };
}

function listInput(source = adoSource({ webUrl: EVIL_WEB })) {
  return { provenance: source, identity: identity() };
}

function author(uniqueName: string) {
  return { uniqueName, displayName: uniqueName.split("@")[0], id: `id-${uniqueName}` };
}

function commentRow(
  id: number,
  content: string,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id,
    content,
    author: author(LOGIN),
    publishedDate: WHEN,
    lastUpdatedDate: WHEN,
    lastContentUpdatedDate: WHEN,
    commentType: "text",
    parentCommentId: 0,
    ...extra,
  };
}

function threadRow(id: number, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    status: "active",
    publishedDate: WHEN,
    lastUpdatedDate: WHEN,
    comments: [commentRow(1, "line note")],
    threadContext: {
      filePath: "/src/a.ts",
      rightFileStart: { line: 11, offset: 1 },
      rightFileEnd: { line: 11, offset: 1 },
    },
    pullRequestThreadContext: {
      changeTrackingId: 7,
      iterationContext: { firstComparingIteration: 1, secondComparingIteration: 2 },
    },
    ...extra,
  };
}

function fixtureThreads(): unknown[] {
  return [
    threadRow(11, {
      comments: [
        commentRow(1, "line note"),
        commentRow(2, "line reply", {
          author: author("other@contoso.com"),
          parentCommentId: 1,
          publishedDate: WHEN_LATER,
          lastUpdatedDate: WHEN_LATER,
          lastContentUpdatedDate: WHEN_LATER,
        }),
        commentRow(3, "removed later", { isDeleted: true, publishedDate: "2026-09-16T10:01:30.000Z" }),
      ],
    }),
    threadRow(12, {
      comments: [
        commentRow(1, "range note", {
          lastUpdatedDate: WHEN_LATER,
          lastContentUpdatedDate: WHEN_LATER,
        }),
      ],
      threadContext: {
        filePath: "/src/a.ts",
        rightFileStart: { line: 12, offset: 1 },
        rightFileEnd: { line: 13, offset: 1 },
      },
    }),
    threadRow(13, {
      comments: [commentRow(1, "file note")],
      threadContext: { filePath: "/src/a.ts" },
    }),
    threadRow(14, {
      status: "closed",
      comments: [commentRow(1, "pr-wide note")],
      threadContext: undefined,
      pullRequestThreadContext: undefined,
    }),
    threadRow(15, {
      comments: [commentRow(1, "cannot map this")],
      threadContext: { filePath: "/src/gone.ts", rightFileStart: { offset: 1 }, rightFileEnd: { offset: 1 } },
    }),
    threadRow(16, {
      comments: [commentRow(1, "deleted line")],
      threadContext: {
        filePath: "/src/a.ts",
        leftFileStart: { line: 11, offset: 1 },
        leftFileEnd: { line: 11, offset: 1 },
      },
    }),
    threadRow(17, {
      comments: [commentRow(1, "old iteration still on line")],
      pullRequestThreadContext: {
        changeTrackingId: 7,
        iterationContext: { firstComparingIteration: 1, secondComparingIteration: 1 },
      },
    }),
  ];
}

function dumpPublic(value: unknown): string {
  return JSON.stringify(value);
}

function assertNoToken(value: unknown, label: string) {
  const text = dumpPublic(value);
  assert.equal(text.includes(TOKEN), false, label);
}

function assertProviderError(err: unknown, code: string) {
  assert.ok(err instanceof ProviderError, String(err));
  assert.equal(err.code, code);
  assert.equal(err.provider, "azure-devops");
  assert.equal(err.message.includes(TOKEN), false);
  assertNoToken(err, code);
}

function assertCommentError(err: unknown, code: string) {
  assert.ok(err instanceof CommentError, String(err));
  assert.equal(err.code, code);
  assert.equal(err.message.includes(TOKEN), false);
  assertNoToken(err, code);
}

function isThreadList(url: URL) {
  return url.pathname.endsWith(`/repositories/${REPO_ID}/pullrequests/1027/threads`);
}

function isThreadGet(url: URL, threadId: string) {
  return url.pathname.endsWith(`/repositories/${REPO_ID}/pullrequests/1027/threads/${threadId}`);
}

function isCommentCreate(url: URL, threadId: string) {
  return url.pathname.endsWith(
    `/repositories/${REPO_ID}/pullrequests/1027/threads/${threadId}/comments`,
  );
}

function isCommentItem(url: URL, threadId: string, commentId: string) {
  return url.pathname.endsWith(
    `/repositories/${REPO_ID}/pullrequests/1027/threads/${threadId}/comments/${commentId}`,
  );
}

function guide(source = adoSource()): GuideV1 {
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
                ],
              },
            ],
          },
        ],
      },
    ],
    source,
  };
}

function repos(guides: Record<string, GuideV1>): ReviewRepository {
  return {
    listReviews: async () => {
      throw new Error("unexpected listReviews");
    },
    getReview: async (id) => {
      const found = guides[id];
      if (!found) throw Object.assign(new Error(`unknown review ${id}`), { status: 404 });
      return { guide: found, outcomes: [] };
    },
    addReview: async () => {
      throw new Error("unexpected addReview");
    },
    addReviewFromTool: async () => {
      throw new Error("unexpected addReviewFromTool");
    },
    upsertReview: async () => {
      throw new Error("unexpected upsertReview");
    },
    upsertReviewFromTool: async () => {
      throw new Error("unexpected upsertReviewFromTool");
    },
    removeReview: async () => {
      throw new Error("unexpected removeReview");
    },
    setActive: async () => {
      throw new Error("unexpected setActive");
    },
    chapterReview: async () => {
      throw new Error("unexpected chapterReview");
    },
    seedIfEmpty: async () => {
      throw new Error("unexpected seedIfEmpty");
    },
  };
}

test("list uses authenticated fetch against stored provenance, never a browser URL", async () => {
  const { fetch, calls } = recordingFetch((url, request) => {
    assert.equal(url.searchParams.get("api-version"), "7.1");
    assert.equal(request.headers.get("authorization"), `Bearer ${TOKEN}`);
    assert.equal(isThreadList(url), true);
    return jsonResponse({ value: [threadRow(11)], count: 1 });
  });
  const adapter = createAdoCommentAdapter({ credentials: connectedCredentials(), fetch });
  const listed = await adapter.list(listInput());

  assert.equal(listed.length, 1);
  assert.equal(listed[0]?.id, "11");
  assert.equal(listed[0]?.provider, "azure-devops");
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.method, "GET");
  assert.equal(calls[0]?.authorization, `Bearer ${TOKEN}`);
  assert.equal(calls[0]?.url.includes("api-version=7.1"), true);
  assert.equal(calls[0]?.url.includes(REPO_ID), true);
  assert.equal(calls[0]?.url.includes("/pullrequests/1027/threads"), true);
  assert.equal(calls[0]?.url.includes("evil.example"), false);
  assert.equal(/az\s+rest|az\s+devops/i.test(calls[0]?.url ?? ""), false);
  assert.equal(/\/mcp(?:\/|$|\?)/i.test(calls[0]?.url ?? ""), false);
  assertNoToken(listed, "list");

  await assert.rejects(
    () =>
      adapter.list({
        provenance: { ...adoSource(), provider: "github", providerContext: { kind: "github" } },
        identity: identity(),
      }),
    (err) => {
      assertCommentError(err, "cross-provider");
      return true;
    },
  );
  assert.equal(calls.length, 1);

  const creds = recordingFetch(() => jsonResponse({ value: [] }));
  const denied = createAdoCommentAdapter({
    credentials: failedCredentials("denied-scope"),
    fetch: creds.fetch,
  });
  await assert.rejects(
    () => denied.list(listInput()),
    (err) => {
      assertProviderError(err, "auth");
      return true;
    },
  );
  assert.equal(creds.calls.length, 0);
});

test("list normalizes line, range, file, PR-wide, status, authors, ownership, and timestamps", async () => {
  const { fetch } = recordingFetch(() => jsonResponse({ value: fixtureThreads(), count: 7 }));
  const adapter = createAdoCommentAdapter({ credentials: connectedCredentials(), fetch });
  const listed = await adapter.list({
    provenance: adoSource(),
    identity: identity("Ada@contoso.com"),
  });
  for (const thread of listed) CommentThread.parse(thread);

  const byId = Object.fromEntries(listed.map((thread) => [thread.id, thread]));
  assert.deepEqual(byId["11"]?.anchor, { kind: "line", path: "src/a.ts", side: "current", line: 11 });
  assert.equal(byId["11"]?.status, "active");
  assert.equal(byId["11"]?.outdated, false);
  assert.equal(byId["11"]?.messages[0]?.ownedByCurrentUser, true);
  assert.equal(byId["11"]?.messages[0]?.author.login, "Ada@contoso.com");
  assert.equal(byId["11"]?.messages[1]?.ownedByCurrentUser, false);
  assert.equal(byId["11"]?.messages[1]?.author.login, "other@contoso.com");
  assert.equal(byId["11"]?.messages[2]?.deleted, true);
  assert.equal(byId["11"]?.messages[0]?.createdAt, WHEN);
  assert.equal(byId["11"]?.messages[1]?.updatedAt, WHEN_LATER);

  assert.deepEqual(byId["12"]?.anchor, {
    kind: "range",
    path: "src/a.ts",
    side: "current",
    startLine: 12,
    endLine: 13,
  });
  assert.equal(byId["12"]?.messages[0]?.updatedAt, WHEN_LATER);
  assert.deepEqual(byId["13"]?.anchor, { kind: "file", path: "src/a.ts" });
  assert.deepEqual(byId["14"]?.anchor, { kind: "pr" });
  assert.equal(byId["14"]?.status, "closed");
  assert.equal(byId["17"]?.outdated, true);
  assert.deepEqual(byId["17"]?.anchor, { kind: "line", path: "src/a.ts", side: "current", line: 11 });

  assert.equal(dumpPublic(listed).includes("changeTrackingId"), false);
  assert.equal(dumpPublic(listed).includes("rightFileStart"), false);
  assert.equal(dumpPublic(listed).includes("uniqueName"), false);
  assert.equal(dumpPublic(listed).includes("pullRequestThreadContext"), false);
});

test("deleted and unmappable anchors downgrade without a fabricated current line", async () => {
  const { fetch } = recordingFetch(() => jsonResponse({ value: fixtureThreads(), count: 7 }));
  const adapter = createAdoCommentAdapter({ credentials: connectedCredentials(), fetch });
  const listed = await adapter.list(listInput(adoSource()));
  const gone = listed.find((thread) => thread.id === "15");
  const deleted = listed.find((thread) => thread.id === "16");

  assert.equal(gone?.anchor.kind, "stale");
  if (gone?.anchor.kind === "stale") {
    assert.equal(gone.anchor.reason, "unmappable");
    assert.equal(gone.anchor.path, "src/gone.ts");
  }
  assert.equal("line" in (gone?.anchor ?? {}), false);
  assert.equal(gone?.outdated, true);

  assert.equal(deleted?.anchor.kind, "stale");
  if (deleted?.anchor.kind === "stale") {
    assert.equal(deleted.anchor.reason, "deleted-line");
    assert.equal(deleted.anchor.path, "src/a.ts");
  }
  assert.equal("line" in (deleted?.anchor ?? {}), false);
  assert.equal("startLine" in (deleted?.anchor ?? {}), false);
});

test("create line and range threads send stored iteration and change-tracking ids", async () => {
  const { fetch, calls } = recordingFetch((url, request) => {
    assert.equal(isThreadList(url) || url.pathname.endsWith("/threads"), true);
    assert.equal(url.searchParams.get("api-version"), "7.1");
    assert.equal(request.method, "POST");
    return jsonResponse(
      threadRow(21, {
        comments: [commentRow(1, "please rename")],
      }),
      201,
    );
  });
  const adapter = createAdoCommentAdapter({ credentials: connectedCredentials(), fetch });
  const created = await adapter.createThread({
    provenance: adoSource({ webUrl: EVIL_WEB }),
    identity: identity(),
    anchor: { kind: "line", path: "src/a.ts", side: "current", line: 11 },
    body: "please rename",
    clientOperationId: COP,
  });
  assert.equal(created.id, "21");
  assert.equal(created.messages[0]?.body, "please rename");
  assert.equal(created.messages[0]?.ownedByCurrentUser, true);
  assert.equal(JSON.stringify(created).includes(COP), false);
  const posted = JSON.parse(calls[0]!.body) as {
    comments: { content: string }[];
    threadContext: { filePath: string; rightFileStart: { line: number }; rightFileEnd: { line: number } };
    pullRequestThreadContext: {
      changeTrackingId: number;
      iterationContext: { firstComparingIteration: number; secondComparingIteration: number };
    };
    clientOperationId?: string;
  };
  assert.equal(posted.comments[0]?.content, "please rename");
  assert.equal(posted.threadContext.filePath, "/src/a.ts");
  assert.equal(posted.threadContext.rightFileStart.line, 11);
  assert.equal(posted.threadContext.rightFileEnd.line, 11);
  assert.equal(posted.pullRequestThreadContext.changeTrackingId, 7);
  assert.equal(posted.pullRequestThreadContext.iterationContext.firstComparingIteration, 1);
  assert.equal(posted.pullRequestThreadContext.iterationContext.secondComparingIteration, 2);
  assert.equal(posted.clientOperationId, undefined);
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.url.includes("evil.example"), false);

  const rangeFetch = recordingFetch(() =>
    jsonResponse(
      threadRow(22, {
        comments: [commentRow(1, "range")],
        threadContext: {
          filePath: "/src/a.ts",
          rightFileStart: { line: 12, offset: 1 },
          rightFileEnd: { line: 13, offset: 1 },
        },
      }),
      201,
    ),
  );
  const rangeAdapter = createAdoCommentAdapter({
    credentials: connectedCredentials(),
    fetch: rangeFetch.fetch,
  });
  await rangeAdapter.createThread({
    provenance: adoSource(),
    identity: identity(),
    anchor: { kind: "range", path: "src/a.ts", side: "current", startLine: 12, endLine: 13 },
    body: "range",
    clientOperationId: "cop_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  });
  const rangePosted = JSON.parse(rangeFetch.calls[0]!.body) as {
    threadContext: { rightFileStart: { line: number }; rightFileEnd: { line: number } };
    pullRequestThreadContext: { changeTrackingId: number };
  };
  assert.equal(rangePosted.threadContext.rightFileStart.line, 12);
  assert.equal(rangePosted.threadContext.rightFileEnd.line, 13);
  assert.equal(rangePosted.pullRequestThreadContext.changeTrackingId, 7);

  const fileFetch = recordingFetch(() => jsonResponse(threadRow(23, { threadContext: { filePath: "/src/a.ts" } }), 201));
  const fileAdapter = createAdoCommentAdapter({
    credentials: connectedCredentials(),
    fetch: fileFetch.fetch,
  });
  await fileAdapter.createThread({
    provenance: adoSource(),
    identity: identity(),
    anchor: { kind: "file", path: "src/a.ts" },
    body: "file",
    clientOperationId: "cop_cccccccccccccccccccccccccccccccc",
  });
  const filePosted = JSON.parse(fileFetch.calls[0]!.body) as {
    threadContext: { filePath: string; rightFileStart?: unknown };
    pullRequestThreadContext: { changeTrackingId: number };
  };
  assert.equal(filePosted.threadContext.filePath, "/src/a.ts");
  assert.equal(filePosted.threadContext.rightFileStart, undefined);
  assert.equal(filePosted.pullRequestThreadContext.changeTrackingId, 7);

  const prFetch = recordingFetch(() =>
    jsonResponse(threadRow(24, { threadContext: undefined, pullRequestThreadContext: undefined }), 201),
  );
  const prAdapter = createAdoCommentAdapter({
    credentials: connectedCredentials(),
    fetch: prFetch.fetch,
  });
  await prAdapter.createThread({
    provenance: adoSource(),
    identity: identity(),
    anchor: { kind: "pr" },
    body: "pr",
    clientOperationId: "cop_dddddddddddddddddddddddddddddddd",
  });
  const prPosted = JSON.parse(prFetch.calls[0]!.body) as {
    threadContext?: unknown;
    pullRequestThreadContext?: unknown;
  };
  assert.equal(prPosted.threadContext, undefined);
  assert.equal(prPosted.pullRequestThreadContext, undefined);
});

test("stored iteration 0 is read from the host and never sent", async () => {
  const { fetch, calls } = recordingFetch((url, request) => {
    if (request.method === "GET" && url.pathname.includes("/changes")) {
      return jsonResponse({
        changeEntries: [{ changeTrackingId: 42, change: { item: { path: "/src/a.ts" } } }],
      });
    }
    if (request.method === "GET" && url.pathname.endsWith("/iterations")) {
      return jsonResponse({ value: [{ id: 4 }, { id: 9 }] });
    }
    if (request.method === "POST" && isThreadList(url)) {
      return jsonResponse(threadRow(21, { comments: [commentRow(1, "please rename")] }), 201);
    }
    return jsonResponse({ message: `unexpected ${request.method} ${url.pathname}` }, 500);
  });
  const adapter = createAdoCommentAdapter({ credentials: connectedCredentials(), fetch });
  await adapter.createThread({
    provenance: adoSource({
      webUrl: EVIL_WEB,
      providerContext: {
        kind: "azure-devops",
        project: PROJECT,
        firstComparingIteration: 0,
        secondComparingIteration: 1,
        changes: { "src/a.ts": { changeTrackingId: 7 } },
      },
    }),
    identity: identity(),
    anchor: { kind: "line", path: "src/a.ts", side: "current", line: 11 },
    body: "please rename",
    clientOperationId: COP,
  });
  assert.equal(calls.some((call) => call.url.includes("/iterations/0") || call.url.includes("evil.example")), false);
  const post = calls.find((call) => call.method === "POST");
  assert.equal(post === undefined, false);
  const posted = JSON.parse(post!.body) as {
    pullRequestThreadContext: {
      changeTrackingId: number;
      iterationContext: { firstComparingIteration: number; secondComparingIteration: number };
    };
  };
  assert.equal(posted.pullRequestThreadContext.changeTrackingId, 42);
  assert.equal(posted.pullRequestThreadContext.iterationContext.firstComparingIteration, 4);
  assert.equal(posted.pullRequestThreadContext.iterationContext.secondComparingIteration, 9);
});

test("a path missing from the host changes fails with invalid-anchor and posts nothing", async () => {
  const { fetch, calls } = recordingFetch((url, request) => {
    if (request.method === "POST") return jsonResponse(threadRow(25), 201);
    if (request.method === "GET" && url.pathname.includes("/changes")) {
      return jsonResponse({
        changeEntries: [{ changeTrackingId: 7, change: { item: { path: "/src/a.ts" } } }],
      });
    }
    if (request.method === "GET" && url.pathname.endsWith("/iterations")) {
      return jsonResponse({ value: [{ id: 1 }, { id: 2 }] });
    }
    return jsonResponse({ message: `unexpected ${request.method} ${url.pathname}` }, 500);
  });
  const adapter = createAdoCommentAdapter({ credentials: connectedCredentials(), fetch });
  await assert.rejects(
    () =>
      adapter.createThread({
        provenance: adoSource(),
        identity: identity(),
        anchor: { kind: "line", path: "src/missing.ts", side: "current", line: 1 },
        body: "no tracking",
        clientOperationId: COP,
      }),
    (err) => {
      assertCommentError(err, "invalid-anchor");
      return true;
    },
  );
  assert.equal(calls.some((call) => call.method === "GET" && call.url.includes("/changes")), true);
  assert.equal(calls.some((call) => call.method === "POST"), false);
});

test("reply, update, and delete validate ids inside one pull request", async () => {
  const thread = threadRow(11, {
    comments: [commentRow(1, "line note"), commentRow(2, "line reply", { author: author("other@contoso.com") })],
  });
  const { fetch, calls } = recordingFetch((url, request) => {
    assert.equal(url.pathname.includes("/pullrequests/1027/"), true);
    assert.equal(url.pathname.includes("pullrequests/99"), false);
    if (request.method === "GET" && isThreadGet(url, "11")) return jsonResponse(thread);
    if (request.method === "POST" && isCommentCreate(url, "11")) {
      return jsonResponse(commentRow(4, "also here", { parentCommentId: 1 }), 201);
    }
    if (request.method === "PATCH" && isCommentItem(url, "11", "1")) {
      return jsonResponse(commentRow(1, "renamed"));
    }
    if (request.method === "DELETE" && isCommentItem(url, "11", "1")) {
      return jsonResponse(undefined, 204);
    }
    if (request.method === "GET" && isThreadGet(url, "99")) return jsonResponse({ message: "gone" }, 404);
    return jsonResponse({ message: "unexpected" }, 500);
  });
  const adapter = createAdoCommentAdapter({ credentials: connectedCredentials(), fetch });
  const source = adoSource({ webUrl: EVIL_WEB });

  const replied = await adapter.reply({
    provenance: source,
    identity: identity(),
    threadId: "11",
    body: "also here",
    clientOperationId: "cop_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  });
  assert.equal(replied.id, "4");
  assert.equal(replied.body, "also here");
  assert.equal(replied.ownedByCurrentUser, true);
  const replyPost = calls.find((call) => call.method === "POST");
  assert.equal(JSON.parse(replyPost!.body).parentCommentId, 1);
  assert.equal(JSON.parse(replyPost!.body).content, "also here");

  const updated = await adapter.update({
    provenance: source,
    identity: identity(),
    threadId: "11",
    commentId: "1",
    body: "renamed",
  });
  assert.equal(updated.body, "renamed");
  assert.equal(updated.ownedByCurrentUser, true);

  const deleted = await adapter.delete({
    provenance: source,
    identity: identity(),
    threadId: "11",
    commentId: "1",
  });
  assert.deepEqual(deleted, { ok: true });

  await assert.rejects(
    () =>
      adapter.reply({
        provenance: source,
        identity: identity(),
        threadId: "https://evil.example/_apis/git/repositories/other/pullRequests/99/threads/11",
        body: "nope",
        clientOperationId: COP,
      }),
    (err) => {
      assertCommentError(err, "unknown-thread");
      return true;
    },
  );
  await assert.rejects(
    () =>
      adapter.update({
        provenance: source,
        identity: identity(),
        threadId: "11",
        commentId: "99",
        body: "forged",
      }),
    (err) => {
      assertCommentError(err, "unknown-comment");
      return true;
    },
  );
  await assert.rejects(
    () =>
      adapter.delete({
        provenance: source,
        identity: identity(),
        threadId: "11",
        commentId: "cop_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      }),
    (err) => {
      assertCommentError(err, "unknown-comment");
      return true;
    },
  );
  await assert.rejects(
    () =>
      adapter.reply({
        provenance: source,
        identity: identity(),
        threadId: "99",
        body: "missing",
        clientOperationId: COP,
      }),
    (err) => {
      assertCommentError(err, "unknown-thread");
      return true;
    },
  );

  assert.equal(
    calls.every((call) => call.url.includes(`/pullrequests/1027/`) && !call.url.includes("evil.example")),
    true,
  );
  assert.equal(calls.some((call) => call.method === "PATCH" && call.url.endsWith("/comments/99")), false);
  assert.equal(
    calls.some((call) => call.method === "DELETE" && call.url.includes("cop_")),
    false,
  );
  assert.equal(calls.filter((call) => call.method === "PATCH").length, 1);
  assert.equal(calls.filter((call) => call.method === "DELETE").length, 1);
});

test("maps auth, permission, stale create, missing resource, rate, timeout, and malformed failures", async () => {
  const source = adoSource();
  const input = listInput(source);

  const rows: Array<{
    name: string;
    status?: number;
    headers?: Record<string, string>;
    throwNetwork?: boolean;
    credentials?: CredentialSource;
    body?: unknown;
    expect: "provider" | "comment";
    code: string;
  }> = [
    { name: "credential", credentials: failedCredentials("login-required"), expect: "provider", code: "auth" },
    { name: "401", status: 401, expect: "provider", code: "auth" },
    { name: "403", status: 403, expect: "comment", code: "denied" },
    { name: "429", status: 429, headers: { "retry-after": "12" }, expect: "provider", code: "rate" },
    { name: "timeout", throwNetwork: true, expect: "provider", code: "unavailable" },
    { name: "malformed", status: 200, body: "not-json", expect: "provider", code: "malformed-response" },
    { name: "missing-pr", status: 404, expect: "provider", code: "not-found" },
  ];

  for (const row of rows) {
    const { fetch, calls } = recordingFetch(() => {
      if (row.throwNetwork) throw new Error("AbortError");
      return jsonResponse(row.body ?? { message: "nope TOKEN-should-not-leak" }, row.status ?? 200, row.headers);
    });
    const adapter = createAdoCommentAdapter({
      credentials: row.credentials ?? connectedCredentials(),
      fetch,
    });
    await assert.rejects(
      () => adapter.list(input),
      (err) => {
        if (row.expect === "provider") {
          assertProviderError(err, row.code);
          if (row.code === "rate") assert.equal((err as ProviderError).retryAfterSec, 12);
        } else {
          assertCommentError(err, row.code);
        }
        return true;
      },
      row.name,
    );
    if (row.credentials) assert.equal(calls.length, 0, row.name);
  }

  const staleCreate = recordingFetch(() => jsonResponse({ message: "invalid position" }, 400));
  const staleAdapter = createAdoCommentAdapter({
    credentials: connectedCredentials(),
    fetch: staleCreate.fetch,
  });
  await assert.rejects(
    () =>
      staleAdapter.createThread({
        provenance: source,
        identity: identity(),
        anchor: { kind: "line", path: "src/a.ts", side: "current", line: 11 },
        body: "stale",
        clientOperationId: COP,
      }),
    (err) => {
      assertCommentError(err, "invalid-anchor");
      return true;
    },
  );

  const missingThread = recordingFetch((url) => {
    if (url.pathname.endsWith("/threads/11")) return jsonResponse({ message: "gone" }, 404);
    return jsonResponse({ message: "unexpected" }, 500);
  });
  const missingAdapter = createAdoCommentAdapter({
    credentials: connectedCredentials(),
    fetch: missingThread.fetch,
  });
  await assert.rejects(
    () =>
      missingAdapter.update({
        provenance: source,
        identity: identity(),
        threadId: "11",
        commentId: "1",
        body: "x",
      }),
    (err) => {
      assertCommentError(err, "unknown-thread");
      return true;
    },
  );
});

test("CommentService lists, creates, and replies through the injected ADO adapter", async () => {
  const { fetch, calls } = recordingFetch((url, request) => {
    if (request.method === "GET" && isThreadList(url)) {
      return jsonResponse({ value: [threadRow(11)], count: 1 });
    }
    if (request.method === "GET" && isThreadGet(url, "11")) {
      return jsonResponse(threadRow(11));
    }
    if (request.method === "POST" && isCommentCreate(url, "11")) {
      return jsonResponse(commentRow(3, "also here"), 201);
    }
    if (request.method === "POST" && isThreadList(url)) {
      return jsonResponse(threadRow(21, { comments: [commentRow(1, "from service")] }), 201);
    }
    return jsonResponse({ message: "unexpected" }, 500);
  });
  const comments = createCommentService({
    reviews: repos({ r1: guide() }),
    credentials: connectedCredentials(),
    providers: {
      ado: createAdoCommentAdapter({ credentials: connectedCredentials(), fetch }),
      github: createFakeCommentProvider({ provider: "github" }),
    },
  });
  const listed = await comments.list("r1");
  CommentThreadList.parse(listed);
  assert.equal(listed.threads[0]?.id, "11");
  const created = await comments.createThread("r1", {
    anchor: { kind: "line", path: "src/a.ts", side: "current", line: 11 },
    body: "from service",
    clientOperationId: COP,
  });
  assert.equal(created.id, "21");
  const replied = await comments.reply("r1", "11", {
    body: "also here",
    clientOperationId: "cop_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  });
  assert.equal(replied.body, "also here");
  assert.equal(
    calls.every((call) => call.authorization === `Bearer ${TOKEN}` && call.url.includes("api-version=7.1")),
    true,
  );
  assert.equal(calls.some((call) => call.url.includes("evil.example")), false);
});

test("CommentService update and delete through the injected ADO adapter reject other authors and keep deleted flags", async () => {
  const thread = threadRow(11, {
    comments: [
      commentRow(1, "line note"),
      commentRow(2, "line reply", { author: author("other@contoso.com"), parentCommentId: 1 }),
    ],
  });
  let denyPatch = false;
  const { fetch, calls } = recordingFetch(async (url, request) => {
    if (request.method === "GET" && isThreadList(url)) return jsonResponse({ value: [thread], count: 1 });
    if (request.method === "GET" && isThreadGet(url, "11")) return jsonResponse(thread);
    if (request.method === "PATCH" && isCommentItem(url, "11", "1")) {
      if (denyPatch) return jsonResponse({ message: "denied" }, 403);
      const payload = JSON.parse(await request.clone().text()) as { content?: string };
      const next = commentRow(1, payload.content ?? "renamed");
      (thread.comments as Record<string, unknown>[])[0] = next;
      return jsonResponse(next);
    }
    if (request.method === "DELETE" && isCommentItem(url, "11", "1")) {
      (thread.comments as Record<string, unknown>[])[0] = commentRow(1, "line note", { isDeleted: true });
      return jsonResponse(undefined, 204);
    }
    if (request.method === "PATCH" && isCommentItem(url, "11", "2")) {
      return jsonResponse({ message: "should not patch other author" }, 500);
    }
    if (request.method === "DELETE" && isCommentItem(url, "11", "2")) {
      return jsonResponse({ message: "should not delete other author" }, 500);
    }
    return jsonResponse({ message: `unexpected ${request.method} ${url.pathname}` }, 500);
  });
  const comments = createCommentService({
    reviews: repos({ r1: guide() }),
    credentials: connectedCredentials(),
    providers: {
      ado: createAdoCommentAdapter({ credentials: connectedCredentials(), fetch }),
      github: createFakeCommentProvider({ provider: "github" }),
    },
  });

  await assert.rejects(
    () => comments.update("r1", "11", "2", { body: "forged" }),
    (err: unknown) => {
      assert.equal((err as CommentError).code, "not-owned");
      return true;
    },
  );
  await assert.rejects(
    () => comments.delete("r1", "11", "2"),
    (err: unknown) => {
      assert.equal((err as CommentError).code, "not-owned");
      return true;
    },
  );
  await assert.rejects(
    () => comments.update("r1", "99", "1", { body: "cross-pr" }),
    (err: unknown) => {
      assert.equal((err as CommentError).code, "unknown-thread");
      return true;
    },
  );
  assert.equal(calls.some((call) => call.method === "PATCH" || call.method === "DELETE"), false);

  const updated = await comments.update("r1", "11", "1", { body: "renamed" });
  assert.equal(updated.body, "renamed");
  assert.equal(updated.ownedByCurrentUser, true);

  denyPatch = true;
  await assert.rejects(
    () => comments.update("r1", "11", "1", { body: "blocked" }),
    (err: unknown) => {
      assert.equal((err as CommentError).code, "denied");
      return true;
    },
  );
  denyPatch = false;

  await comments.delete("r1", "11", "1");
  const listed = await comments.list("r1");
  assert.equal(listed.threads[0]?.messages[0]?.deleted, true);
  assert.equal(listed.threads[0]?.messages[1]?.deleted, undefined);
  assert.equal(
    calls.filter((call) => call.method === "DELETE").length,
    1,
  );
});
