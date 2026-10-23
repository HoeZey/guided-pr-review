import assert from "node:assert/strict";
import { test } from "node:test";
import type { CredentialResult, CredentialSource } from "../../auth/ports.ts";
import { CommentError } from "../comments.ts";
import {
  CommentMessage,
  CommentThread,
  CommentThreadList,
  type ClientOperationId,
} from "../../../shared/contracts/comments.ts";
import type { PullRequestSource } from "../../../shared/contracts/provenance.ts";
import { GITHUB_API_VERSION, GithubProviderError } from "./rest.ts";
import { createGithubCommentProvider } from "./comments.ts";
import type { GuideV1 } from "../../../shared/contracts/guide.ts";
import type { ReviewRepository } from "../../repositories/ports.ts";
import { createFakeCommentProvider } from "../fake-comments.ts";
import { createCommentService } from "../../services/comments.ts";

const GH_TOKEN = "gho_FIXTURE_TOKEN_abcdef1234567890";
const GH_LOGIN = "octocat";
const OTHER = "other_user";
const HEAD_SHA = "6dcb09b5b57875f334f61aebed695e2e4193db5e";
const BASE_SHA = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
const COP: ClientOperationId = "cop_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

const PROVENANCE: PullRequestSource = {
  kind: "pull-request",
  provider: "github",
  host: "github.com",
  repository: {
    id: "1296269",
    owner: "octocat",
    name: "Hello-World",
    webUrl: "https://github.com/octocat/Hello-World",
  },
  number: 1347,
  webUrl: "https://github.com/octocat/Hello-World/pull/1347",
  sourceRef: "new-topic",
  targetRef: "master",
  sourceCommit: HEAD_SHA,
  targetCommit: BASE_SHA,
  providerContext: { kind: "github" },
};

const IDENTITY = { provider: "github" as const, host: "github.com", login: GH_LOGIN };

function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

function emptyResponse(status: number) {
  return new Response(null, { status });
}

function connectedCredentials(login = GH_LOGIN, token = GH_TOKEN): CredentialSource {
  return {
    async getAccessToken(): Promise<CredentialResult> {
      return {
        status: "connected",
        identity: { provider: "github", host: "github.com", login },
        token,
      };
    },
  };
}

function failedCredentials(): CredentialSource {
  return {
    async getAccessToken(): Promise<CredentialResult> {
      return { status: "login-required", provider: "github", host: "github.com", recovery: "gh auth login" };
    },
  };
}

type FetchCall = { url: string; init: RequestInit | undefined };

function recordingFetch(
  handler: (url: URL, init: RequestInit | undefined, calls: FetchCall[]) => Response,
): { fetch: typeof fetch; calls: FetchCall[] } {
  const calls: FetchCall[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    calls.push({ url: url.toString(), init });
    if (url.protocol !== "https:" || url.hostname !== "api.github.com") {
      throw new Error(`unexpected live network ${url.toString()}`);
    }
    return handler(url, init, calls);
  };
  return { fetch: fetchImpl, calls };
}

function header(init: RequestInit | undefined, name: string): string | undefined {
  if (!init?.headers) return undefined;
  return new Headers(init.headers).get(name) ?? undefined;
}

function user(login: string) {
  return { login, id: login === GH_LOGIN ? 1 : 2, type: "User" };
}

function reviewComment(overrides: Record<string, unknown> = {}) {
  return {
    url: "https://api.github.com/repos/octocat/Hello-World/pulls/comments/10",
    pull_request_review_id: 42,
    id: 10,
    node_id: "MDI0OlB1bGxSZXF1ZXN0UmV2aWV3Q29tbWVudDEw",
    diff_hunk: "@@ -10,4 +10,6 @@",
    path: "src/a.ts",
    position: 1,
    original_position: 1,
    commit_id: HEAD_SHA,
    original_commit_id: BASE_SHA,
    user: user(GH_LOGIN),
    body: "line note",
    created_at: "2011-04-14T16:00:49Z",
    updated_at: "2011-04-14T16:00:49Z",
    html_url: "https://github.com/octocat/Hello-World/pull/1347#discussion_r10",
    pull_request_url: "https://api.github.com/repos/octocat/Hello-World/pulls/1347",
    author_association: "OWNER",
    _links: {},
    start_line: null,
    original_start_line: null,
    start_side: "RIGHT",
    line: 11,
    original_line: 11,
    side: "RIGHT",
    subject_type: "line",
    ...overrides,
  };
}

function issueComment(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    node_id: "MDEyOklzc3VlQ29tbWVudDE=",
    url: "https://api.github.com/repos/octocat/Hello-World/issues/comments/1",
    html_url: "https://github.com/octocat/Hello-World/pull/1347#issuecomment-1",
    body: "pr-wide note",
    user: user(GH_LOGIN),
    created_at: "2011-04-14T16:00:49Z",
    updated_at: "2011-04-14T16:00:49Z",
    issue_url: "https://api.github.com/repos/octocat/Hello-World/issues/1347",
    author_association: "OWNER",
    ...overrides,
  };
}

function readJson(init: RequestInit | undefined): unknown {
  if (typeof init?.body !== "string") return undefined;
  return JSON.parse(init.body);
}

function dumpPublic(value: unknown): string {
  return JSON.stringify(value);
}

function listHandler(reviewPages: unknown[][], issuePages: unknown[][]) {
  return recordingFetch((url) => {
    if (url.pathname === "/repos/octocat/Hello-World/pulls/1347/comments") {
      const page = Number(url.searchParams.get("page") ?? "1");
      const body = reviewPages[page - 1] ?? [];
      const headers: Record<string, string> = {};
      if (page < reviewPages.length) {
        headers.Link =
          `<https://api.github.com/repos/octocat/Hello-World/pulls/1347/comments?per_page=100&page=${page + 1}>; rel="next"`;
      }
      return jsonResponse(body, { headers });
    }
    if (url.pathname === "/repos/octocat/Hello-World/issues/1347/comments") {
      const page = Number(url.searchParams.get("page") ?? "1");
      const body = issuePages[page - 1] ?? [];
      const headers: Record<string, string> = {};
      if (page < issuePages.length) {
        headers.Link =
          `<https://api.github.com/repos/octocat/Hello-World/issues/1347/comments?per_page=100&page=${page + 1}>; rel="next"`;
      }
      return jsonResponse(body, { headers });
    }
    throw new Error(`unexpected live network ${url.toString()}`);
  });
}

function providerFor(fetchImpl: typeof fetch, credentials: CredentialSource = connectedCredentials()) {
  return createGithubCommentProvider({ credentials, fetch: fetchImpl });
}

test("list maps review and issue comments into shared thread anchors", async () => {
  const { fetch, calls } = listHandler(
    [
      [
        reviewComment(),
        reviewComment({
          id: 11,
          in_reply_to_id: 10,
          user: user(OTHER),
          body: "line reply",
          created_at: "2011-04-14T16:01:49Z",
          updated_at: "2011-04-14T16:01:49Z",
          line: 11,
        }),
        reviewComment({
          id: 20,
          body: "range note",
          start_line: 12,
          line: 13,
          original_start_line: 12,
          original_line: 13,
          created_at: "2011-04-14T16:02:00Z",
          updated_at: "2011-04-14T16:03:00Z",
        }),
        reviewComment({
          id: 30,
          body: "file note",
          subject_type: "file",
          line: null,
          start_line: null,
          original_line: null,
          position: null,
        }),
      ],
      [
        reviewComment({
          id: 40,
          body: "deleted side",
          side: "LEFT",
          line: 11,
          original_line: 11,
          path: "src/a.ts",
        }),
        reviewComment({
          id: 50,
          body: "outdated line",
          path: "src/gone.ts",
          line: null,
          position: null,
          original_line: 40,
          original_position: 8,
        }),
        reviewComment({
          id: 60,
          body: "position only",
          path: "src/a.ts",
          line: null,
          start_line: null,
          original_line: null,
          original_position: null,
          position: 7,
          subject_type: "line",
        }),
      ],
    ],
    [
      [issueComment()],
      [
        issueComment({
          id: 2,
          user: user(OTHER),
          body: "later discussion",
          created_at: "2011-04-14T16:04:00Z",
          updated_at: "2011-04-14T16:05:00Z",
        }),
      ],
    ],
  );

  const listed = await providerFor(fetch).list({ provenance: PROVENANCE, identity: IDENTITY });
  CommentThreadList.parse({ threads: listed });
  assert.equal(
    listed.every((thread) => CommentThread.parse(thread) && thread.provider === "github"),
    true,
  );

  const byId = new Map(listed.map((thread) => [thread.id, thread]));
  const line = byId.get("review:10");
  assert.deepEqual(line?.anchor, { kind: "line", path: "src/a.ts", side: "current", line: 11 });
  assert.equal(line?.outdated, false);
  assert.equal(line?.status, "active");
  assert.deepEqual(
    line?.messages.map((row) => ({
      id: row.id,
      author: row.author.login,
      body: row.body,
      owned: row.ownedByCurrentUser,
    })),
    [
      { id: "review:10", author: GH_LOGIN, body: "line note", owned: true },
      { id: "review:11", author: OTHER, body: "line reply", owned: false },
    ],
  );
  assert.equal(byId.has("review:11"), false);

  const range = byId.get("review:20");
  assert.deepEqual(range?.anchor, {
    kind: "range",
    path: "src/a.ts",
    side: "current",
    startLine: 12,
    endLine: 13,
  });
  assert.equal(range?.messages[0]?.createdAt, "2011-04-14T16:02:00Z");
  assert.equal(range?.messages[0]?.updatedAt, "2011-04-14T16:03:00Z");

  assert.deepEqual(byId.get("review:30")?.anchor, { kind: "file", path: "src/a.ts" });

  const deleted = byId.get("review:40");
  assert.deepEqual(deleted?.anchor, { kind: "stale", reason: "deleted-line", path: "src/a.ts" });
  assert.equal(deleted?.outdated, true);
  assert.equal("line" in (deleted?.anchor ?? {}), false);

  const outdated = byId.get("review:50");
  assert.deepEqual(outdated?.anchor, { kind: "stale", reason: "outdated", path: "src/gone.ts" });
  assert.equal(outdated?.outdated, true);
  assert.equal("line" in (outdated?.anchor ?? {}), false);

  const unmapped = byId.get("review:60");
  assert.deepEqual(unmapped?.anchor, { kind: "stale", reason: "unmappable", path: "src/a.ts" });
  assert.equal(JSON.stringify(unmapped).includes("\"line\":7"), false);
  assert.equal(JSON.stringify(listed).includes("\"line\":40"), false);

  const pr = byId.get("issue:1");
  assert.deepEqual(pr?.anchor, { kind: "pr" });
  assert.equal(pr?.messages[0]?.ownedByCurrentUser, true);
  assert.deepEqual(byId.get("issue:2")?.anchor, { kind: "pr" });
  assert.equal(byId.get("issue:2")?.messages[0]?.ownedByCurrentUser, false);

  const publicDump = dumpPublic(listed);
  assert.equal(publicDump.includes(GH_TOKEN), false);
  assert.equal(publicDump.includes("node_id"), false);
  assert.equal(publicDump.includes("pull_request_review_id"), false);

  const listCalls = calls.filter((call) => {
    const url = new URL(call.url);
    return url.pathname.endsWith("/comments") && (!call.init?.method || call.init.method === "GET");
  });
  assert.equal(listCalls.length >= 4, true);
  assert.equal(
    listCalls.every((call) => new URL(call.url).searchParams.get("per_page") === "100"),
    true,
  );
  assert.equal(header(listCalls[0]?.init, "Authorization"), `Bearer ${GH_TOKEN}`);
  assert.equal(header(listCalls[0]?.init, "Accept"), "application/vnd.github+json");
  assert.equal(header(listCalls[0]?.init, "X-GitHub-Api-Version"), GITHUB_API_VERSION);
  assert.equal(GITHUB_API_VERSION, "2026-03-10");
  assert.equal(header(listCalls[0]?.init, "User-Agent"), "guided-pr-review");
});

test("create, reply, update, and delete use documented REST for review and issue comments", async () => {
  const created: Record<string, unknown> = {};
  const { fetch, calls } = recordingFetch((url, init) => {
    const method = (init?.method ?? "GET").toUpperCase();
    const body = readJson(init);
    if (method === "GET" && url.pathname === "/repos/octocat/Hello-World/pulls/1347/comments") {
      return jsonResponse([]);
    }
    if (method === "GET" && url.pathname === "/repos/octocat/Hello-World/issues/1347/comments") {
      return jsonResponse([]);
    }
    if (method === "POST" && url.pathname === "/repos/octocat/Hello-World/pulls/1347/comments") {
      created.review = body;
      const row = body as { subject_type?: string; line?: number; start_line?: number; path?: string; body?: string };
      if (row.subject_type === "file") {
        return jsonResponse(
          reviewComment({
            id: 30,
            body: row.body,
            path: row.path,
            subject_type: "file",
            line: null,
            start_line: null,
            original_line: null,
            position: null,
          }),
          { status: 201 },
        );
      }
      if (row.start_line !== undefined) {
        return jsonResponse(
          reviewComment({
            id: 20,
            body: row.body,
            path: row.path,
            start_line: row.start_line,
            line: row.line,
            original_start_line: row.start_line,
            original_line: row.line,
          }),
          { status: 201 },
        );
      }
      return jsonResponse(reviewComment({ id: 10, body: row.body, path: row.path, line: row.line }), { status: 201 });
    }
    if (method === "POST" && url.pathname === "/repos/octocat/Hello-World/issues/1347/comments") {
      created.issue = body;
      const row = body as { body?: string };
      return jsonResponse(issueComment({ id: 1, body: row.body }), { status: 201 });
    }
    if (method === "POST" && url.pathname === "/repos/octocat/Hello-World/pulls/1347/comments/10/replies") {
      created.reply = body;
      return jsonResponse(
        reviewComment({
          id: 11,
          in_reply_to_id: 10,
          body: (body as { body?: string }).body,
          user: user(GH_LOGIN),
        }),
        { status: 201 },
      );
    }
    if (method === "PATCH" && url.pathname === "/repos/octocat/Hello-World/pulls/comments/10") {
      created.patchReview = body;
      return jsonResponse(reviewComment({ id: 10, body: (body as { body?: string }).body, updated_at: "2011-04-14T17:00:00Z" }));
    }
    if (method === "PATCH" && url.pathname === "/repos/octocat/Hello-World/issues/comments/1") {
      created.patchIssue = body;
      return jsonResponse(issueComment({ id: 1, body: (body as { body?: string }).body, updated_at: "2011-04-14T17:00:00Z" }));
    }
    if (method === "DELETE" && url.pathname === "/repos/octocat/Hello-World/pulls/comments/10") {
      created.deleteReview = true;
      return emptyResponse(204);
    }
    if (method === "DELETE" && url.pathname === "/repos/octocat/Hello-World/issues/comments/1") {
      created.deleteIssue = true;
      return emptyResponse(204);
    }
    throw new Error(`unexpected live network ${method} ${url.toString()}`);
  });

  const comments = providerFor(fetch);
  const input = { provenance: PROVENANCE, identity: IDENTITY, clientOperationId: COP };

  const line = await comments.createThread({
    ...input,
    anchor: { kind: "line", path: "src/a.ts", side: "current", line: 11 },
    body: "line note",
  });
  CommentThread.parse(line);
  assert.equal(line.id, "review:10");
  assert.deepEqual(line.anchor, { kind: "line", path: "src/a.ts", side: "current", line: 11 });
  assert.equal(line.messages[0]?.ownedByCurrentUser, true);
  assert.deepEqual(created.review, {
    body: "line note",
    commit_id: HEAD_SHA,
    path: "src/a.ts",
    line: 11,
    side: "RIGHT",
  });

  const range = await comments.createThread({
    ...input,
    anchor: { kind: "range", path: "src/a.ts", side: "current", startLine: 12, endLine: 13 },
    body: "range note",
  });
  assert.equal(range.anchor.kind, "range");
  assert.deepEqual(created.review, {
    body: "range note",
    commit_id: HEAD_SHA,
    path: "src/a.ts",
    start_line: 12,
    start_side: "RIGHT",
    line: 13,
    side: "RIGHT",
  });

  const file = await comments.createThread({
    ...input,
    anchor: { kind: "file", path: "src/a.ts" },
    body: "file note",
  });
  assert.deepEqual(file.anchor, { kind: "file", path: "src/a.ts" });
  assert.deepEqual(created.review, {
    body: "file note",
    commit_id: HEAD_SHA,
    path: "src/a.ts",
    subject_type: "file",
  });
  assert.equal("line" in (created.review as object), false);
  assert.equal("position" in (created.review as object), false);

  const pr = await comments.createThread({
    ...input,
    anchor: { kind: "pr" },
    body: "pr-wide note",
  });
  assert.equal(pr.id, "issue:1");
  assert.deepEqual(pr.anchor, { kind: "pr" });
  assert.deepEqual(created.issue, { body: "pr-wide note" });

  const replied = await comments.reply({
    provenance: PROVENANCE,
    identity: IDENTITY,
    threadId: "review:10",
    body: "line reply",
    clientOperationId: COP,
  });
  CommentMessage.parse(replied);
  assert.equal(replied.id, "review:11");
  assert.equal(replied.body, "line reply");
  assert.deepEqual(created.reply, { body: "line reply" });

  await assert.rejects(
    () =>
      comments.reply({
        provenance: PROVENANCE,
        identity: IDENTITY,
        threadId: "issue:1",
        body: "no nested issue reply",
        clientOperationId: COP,
      }),
    (error: unknown) => {
      assert.ok(error instanceof CommentError);
      assert.equal(error.code, "unknown-thread");
      return true;
    },
  );

  const updatedReview = await comments.update({
    provenance: PROVENANCE,
    identity: IDENTITY,
    threadId: "review:10",
    commentId: "review:10",
    body: "edited line",
  });
  assert.equal(updatedReview.body, "edited line");
  assert.equal(updatedReview.updatedAt, "2011-04-14T17:00:00Z");
  assert.deepEqual(created.patchReview, { body: "edited line" });

  const updatedIssue = await comments.update({
    provenance: PROVENANCE,
    identity: IDENTITY,
    threadId: "issue:1",
    commentId: "issue:1",
    body: "edited pr",
  });
  assert.equal(updatedIssue.body, "edited pr");
  assert.deepEqual(created.patchIssue, { body: "edited pr" });

  assert.deepEqual(
    await comments.delete({
      provenance: PROVENANCE,
      identity: IDENTITY,
      threadId: "review:10",
      commentId: "review:10",
    }),
    { ok: true },
  );
  assert.deepEqual(
    await comments.delete({
      provenance: PROVENANCE,
      identity: IDENTITY,
      threadId: "issue:1",
      commentId: "issue:1",
    }),
    { ok: true },
  );
  assert.equal(created.deleteReview, true);
  assert.equal(created.deleteIssue, true);

  assert.equal(
    calls.some((call) => new URL(call.url).pathname.includes("graphql")),
    false,
  );
  assert.equal(
    dumpPublic(created).includes(COP) || dumpPublic(calls.map((call) => call.init?.body)).includes(COP),
    false,
  );
  assert.equal(
    calls.every((call) => header(call.init, "X-GitHub-Api-Version") === GITHUB_API_VERSION),
    true,
  );
});

test("pagination, auth, permission, rate, and not-found failures stay on injected fetch", async () => {
  const rate = recordingFetch(() =>
    jsonResponse(
      { message: "API rate limit exceeded" },
      { status: 403, headers: { "x-ratelimit-remaining": "0" } },
    ),
  );
  await assert.rejects(
    () => providerFor(rate.fetch).list({ provenance: PROVENANCE, identity: IDENTITY }),
    (error: unknown) => {
      assert.ok(error instanceof GithubProviderError);
      assert.equal(error.code, "rate-limited");
      assert.equal(error.message.includes(GH_TOKEN), false);
      return true;
    },
  );

  const auth = recordingFetch(() => jsonResponse({ message: "Bad credentials" }, { status: 401 }));
  await assert.rejects(
    () => providerFor(auth.fetch).list({ provenance: PROVENANCE, identity: IDENTITY }),
    (error: unknown) => {
      assert.ok(error instanceof GithubProviderError);
      assert.equal(error.code, "unauthorized");
      return true;
    },
  );

  const permission = recordingFetch(() =>
    jsonResponse({ message: "Must have push access to add pull request review comments" }, { status: 403 }),
  );
  await assert.rejects(
    () =>
      providerFor(permission.fetch).createThread({
        provenance: PROVENANCE,
        identity: IDENTITY,
        anchor: { kind: "line", path: "src/a.ts", side: "current", line: 11 },
        body: "nope",
        clientOperationId: COP,
      }),
    (error: unknown) => {
      assert.ok(error instanceof CommentError);
      assert.equal(error.code, "denied");
      return true;
    },
  );

  const missing = recordingFetch(() => jsonResponse({ message: "Not Found" }, { status: 404 }));
  await assert.rejects(
    () =>
      providerFor(missing.fetch).update({
        provenance: PROVENANCE,
        identity: IDENTITY,
        threadId: "review:99",
        commentId: "review:99",
        body: "gone",
      }),
    (error: unknown) => {
      assert.ok(error instanceof GithubProviderError);
      assert.equal(error.code, "not-found");
      return true;
    },
  );

  const unusedFetch = recordingFetch(() => {
    throw new Error("unexpected live network");
  });
  await assert.rejects(
    () =>
      providerFor(unusedFetch.fetch, failedCredentials()).list({
        provenance: PROVENANCE,
        identity: IDENTITY,
      }),
    (error: unknown) => {
      assert.ok(error instanceof GithubProviderError);
      assert.equal(error.code, "credential");
      return true;
    },
  );
  assert.equal(unusedFetch.calls.length, 0);

  await assert.rejects(
    () =>
      providerFor(unusedFetch.fetch).list({
        provenance: { ...PROVENANCE, provider: "azure-devops", host: "dev.azure.com", providerContext: { kind: "azure-devops", project: "BRAID", firstComparingIteration: 0, secondComparingIteration: 1, changes: {} } },
        identity: IDENTITY,
      }),
    (error: unknown) => {
      assert.ok(error instanceof CommentError);
      assert.equal(error.code, "cross-provider");
      return true;
    },
  );
});

test("CommentService creates and replies through the injected GitHub adapter", async () => {
  let createdReview: unknown;
  const { fetch, calls } = recordingFetch((url, init) => {
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "GET" && url.pathname === "/repos/octocat/Hello-World/pulls/1347/comments") {
      return jsonResponse(createdReview ? [createdReview] : []);
    }
    if (method === "GET" && url.pathname === "/repos/octocat/Hello-World/issues/1347/comments") {
      return jsonResponse([]);
    }
    if (method === "POST" && url.pathname === "/repos/octocat/Hello-World/pulls/1347/comments") {
      const body = readJson(init) as { body?: string; line?: number; path?: string };
      createdReview = reviewComment({ id: 90, body: body.body, path: body.path, line: body.line });
      return jsonResponse(createdReview, { status: 201 });
    }
    if (method === "POST" && url.pathname === "/repos/octocat/Hello-World/pulls/1347/comments/90/replies") {
      const body = readJson(init) as { body?: string };
      return jsonResponse(
        reviewComment({ id: 91, in_reply_to_id: 90, body: body.body, user: user(GH_LOGIN) }),
        { status: 201 },
      );
    }
    throw new Error(`unexpected ${method} ${url.pathname}`);
  });
  const comments = createCommentService({
    reviews: githubRepos(),
    credentials: connectedCredentials(),
    providers: {
      ado: createFakeCommentProvider({ provider: "azure-devops" }),
      github: createGithubCommentProvider({ credentials: connectedCredentials(), fetch }),
    },
  });
  const created = await comments.createThread("r1", {
    anchor: { kind: "line", path: "src/a.ts", side: "current", line: 11 },
    body: "from service",
    clientOperationId: COP,
  });
  assert.equal(created.id, "review:90");
  assert.equal(created.anchor.kind, "line");
  const replied = await comments.reply("r1", created.id, {
    body: "also here",
    clientOperationId: "cop_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  });
  assert.equal(replied.body, "also here");
  assert.equal(
    calls.every((call) => call.url.startsWith("https://api.github.com/")),
    true,
  );
  assert.equal(
    JSON.stringify(calls.map((call) => call.init?.body)).includes("cop_"),
    false,
  );
});

test("CommentService update and delete through the injected GitHub adapter reject other authors and omit deleted comments", async () => {
  const owned = reviewComment({ id: 10, body: "line note" });
  const other = reviewComment({
    id: 11,
    in_reply_to_id: 10,
    user: user(OTHER),
    body: "line reply",
  });
  let reviews: unknown[] = [owned, other];
  let denyPatch = false;
  const { fetch, calls } = recordingFetch((url, init) => {
    const method = (init?.method ?? "GET").toUpperCase();
    if (method === "GET" && url.pathname === "/repos/octocat/Hello-World/pulls/1347/comments") {
      return jsonResponse(reviews);
    }
    if (method === "GET" && url.pathname === "/repos/octocat/Hello-World/issues/1347/comments") {
      return jsonResponse([]);
    }
    if (method === "PATCH" && url.pathname === "/repos/octocat/Hello-World/pulls/comments/10") {
      if (denyPatch) return jsonResponse({ message: "Resource not accessible by integration" }, { status: 403 });
      const body = readJson(init) as { body?: string };
      owned.body = body.body ?? "renamed";
      owned.updated_at = "2011-04-14T17:00:00Z";
      return jsonResponse(owned);
    }
    if (method === "DELETE" && url.pathname === "/repos/octocat/Hello-World/pulls/comments/10") {
      reviews = reviews.filter((row) => (row as { id?: number }).id !== 10);
      return emptyResponse(204);
    }
    if (url.pathname === "/repos/octocat/Hello-World/pulls/comments/11") {
      throw new Error("must not mutate another author's comment");
    }
    throw new Error(`unexpected ${method} ${url.pathname}`);
  });
  const comments = createCommentService({
    reviews: githubRepos(),
    credentials: connectedCredentials(),
    providers: {
      ado: createFakeCommentProvider({ provider: "azure-devops" }),
      github: createGithubCommentProvider({ credentials: connectedCredentials(), fetch }),
    },
  });

  await assert.rejects(
    () => comments.update("r1", "review:10", "review:11", { body: "forged" }),
    (error: unknown) => {
      assert.ok(error instanceof CommentError);
      assert.equal(error.code, "not-owned");
      return true;
    },
  );
  await assert.rejects(
    () => comments.delete("r1", "review:10", "review:11"),
    (error: unknown) => {
      assert.ok(error instanceof CommentError);
      assert.equal(error.code, "not-owned");
      return true;
    },
  );
  await assert.rejects(
    () => comments.update("r1", "review:99", "review:99", { body: "cross-pr" }),
    (error: unknown) => {
      assert.ok(error instanceof CommentError);
      assert.equal(error.code, "unknown-thread");
      return true;
    },
  );
  assert.equal(
    calls.some((call) => {
      const method = (call.init?.method ?? "GET").toUpperCase();
      return method === "PATCH" || method === "DELETE";
    }),
    false,
  );

  const updated = await comments.update("r1", "review:10", "review:10", { body: "renamed" });
  assert.equal(updated.body, "renamed");
  assert.equal(updated.ownedByCurrentUser, true);

  denyPatch = true;
  await assert.rejects(
    () => comments.update("r1", "review:10", "review:10", { body: "blocked" }),
    (error: unknown) => {
      assert.ok(error instanceof CommentError);
      assert.equal(error.code, "denied");
      return true;
    },
  );
  denyPatch = false;

  await comments.delete("r1", "review:10", "review:10");
  const listed = await comments.list("r1");
  assert.equal(
    listed.threads[0]?.messages.some((row) => row.id === "review:10"),
    false,
  );
  assert.deepEqual(listed.threads[0]?.messages.map((row) => row.id), ["review:11"]);
  assert.equal(
    calls.filter((call) => (call.init?.method ?? "GET").toUpperCase() === "DELETE").length,
    1,
  );
});

function githubRepos(): ReviewRepository {
  const source = PROVENANCE;
  const loaded: GuideV1 = {
    version: 1,
    title: "One",
    base: BASE_SHA,
    head: HEAD_SHA,
    range: "master...new-topic",
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
                ],
              },
            ],
          },
        ],
      },
    ],
    source,
  };
  return {
    listReviews: async () => {
      throw new Error("unexpected listReviews");
    },
    getReview: async (id) => {
      if (id !== "r1") throw Object.assign(new Error(`unknown review ${id}`), { status: 404 });
      return { guide: loaded, outcomes: [] };
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
