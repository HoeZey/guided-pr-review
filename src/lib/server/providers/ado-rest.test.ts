import assert from "node:assert/strict";
import { test } from "node:test";
import type { CredentialResult, CredentialSource } from "../auth/ports.ts";
import { createAdoRestAdapter } from "./ado-rest.ts";
import { ProviderError } from "./errors.ts";
import type { ProviderRepositoryIdentity } from "./ports.ts";

const TOKEN = "ado_FIXTURE_TOKEN_not_for_network";
const LOGIN = "ada@contoso.com";
const HOST = "dev.azure.com";
const ORG = "braidteam";
const PROJECT = "BRAID";
const OWNER = `${ORG}/${PROJECT}`;
const REPO_NAME = "braid-connection-designer";
const REPO_ID = "5febef5a-833d-4e14-b9c0-14cb3394e21f";
const WEB_URL = `https://dev.azure.com/${ORG}/${PROJECT}/_git/${REPO_NAME}`;
const CLONE_URL = WEB_URL;
const SHA_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SHA_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SHA_C = "cccccccccccccccccccccccccccccccccccccccc";
const SHA_D = "dddddddddddddddddddddddddddddddddddddddd";

function jsonResponse(body: unknown, status = 200, headers?: Record<string, string>): Response {
  return new Response(typeof body === "string" ? body : JSON.stringify(body), {
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
  const calls: { url: string; method: string; authorization: string | null }[] = [];
  const fetchFn: typeof fetch = async (input, init) => {
    const request = input instanceof Request ? input : new Request(input, init);
    const url = new URL(request.url);
    calls.push({
      url: request.url,
      method: request.method,
      authorization: request.headers.get("authorization"),
    });
    return handler(url, request);
  };
  return { fetch: fetchFn, calls };
}

function repoPayload(overrides: Record<string, unknown> = {}) {
  return {
    id: REPO_ID,
    name: REPO_NAME,
    defaultBranch: "refs/heads/develop",
    remoteUrl: CLONE_URL,
    webUrl: WEB_URL,
    project: { id: "project-1", name: PROJECT },
    ...overrides,
  };
}

function identityRef(uniqueName: string, displayName: string) {
  return { id: `id-${uniqueName}`, uniqueName, displayName };
}

function prPayload(overrides: Record<string, unknown> = {}) {
  return {
    pullRequestId: 1101,
    title: "Current work",
    status: "active",
    isDraft: false,
    createdBy: identityRef("other@contoso.com", "Other"),
    creationDate: "2026-09-14T11:00:00.000Z",
    sourceRefName: "refs/heads/feature/review-me",
    targetRefName: "refs/heads/develop",
    lastMergeSourceCommit: { commitId: SHA_A },
    lastMergeTargetCommit: { commitId: SHA_B },
    reviewers: [identityRef(LOGIN, "Ada")],
    repository: {
      id: REPO_ID,
      name: REPO_NAME,
      project: { name: PROJECT },
    },
    ...overrides,
  };
}

function repositoryIdentity(): ProviderRepositoryIdentity {
  return {
    provider: "azure-devops",
    host: HOST,
    id: REPO_ID,
    owner: OWNER,
    name: REPO_NAME,
    webUrl: WEB_URL,
    cloneUrl: CLONE_URL,
    defaultBranch: "refs/heads/develop",
  };
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

function isRepoRequest(url: URL) {
  return (
    url.pathname.includes(`/_apis/git/repositories/${REPO_NAME}`) &&
    !url.pathname.includes("/pullrequests")
  );
}

function isPrListRequest(url: URL) {
  return url.pathname.endsWith(`/repositories/${REPO_ID}/pullrequests`);
}

function isPrGetRequest(url: URL, number: number) {
  return url.pathname.endsWith(`/repositories/${REPO_ID}/pullrequests/${number}`);
}

test("repository validation rejects wrong host, project, and repository identity", async () => {
  const { fetch, calls } = recordingFetch(() => jsonResponse(repoPayload(), 200));
  const adapter = createAdoRestAdapter({ credentials: connectedCredentials(), fetch });

  await assert.rejects(
    () => adapter.getRepository({ provider: "azure-devops", host: "github.com", owner: OWNER, name: REPO_NAME }),
    (err) => {
      assertProviderError(err, "not-found");
      return true;
    },
  );
  await assert.rejects(
    () => adapter.getRepository({ provider: "github", host: HOST, owner: OWNER, name: REPO_NAME }),
    (err) => {
      assertProviderError(err, "not-found");
      return true;
    },
  );
  await assert.rejects(
    () => adapter.getRepository({ provider: "azure-devops", host: HOST, owner: "BRAID", name: REPO_NAME }),
    (err) => {
      assertProviderError(err, "not-found");
      return true;
    },
  );
  assert.equal(calls.length, 0);

  const mismatch = recordingFetch(() => jsonResponse(repoPayload({ name: "other-repo" })));
  const mismatchAdapter = createAdoRestAdapter({
    credentials: connectedCredentials(),
    fetch: mismatch.fetch,
  });
  await assert.rejects(
    () =>
      mismatchAdapter.getRepository({
        provider: "azure-devops",
        host: HOST,
        owner: OWNER,
        name: REPO_NAME,
      }),
    (err) => {
      assertProviderError(err, "not-found");
      return true;
    },
  );

  const wrongProject = recordingFetch(() =>
    jsonResponse(repoPayload({ project: { id: "p2", name: "OTHER" } })),
  );
  const wrongProjectAdapter = createAdoRestAdapter({
    credentials: connectedCredentials(),
    fetch: wrongProject.fetch,
  });
  await assert.rejects(
    () =>
      wrongProjectAdapter.getRepository({
        provider: "azure-devops",
        host: HOST,
        owner: OWNER,
        name: REPO_NAME,
      }),
    (err) => {
      assertProviderError(err, "not-found");
      return true;
    },
  );
});

test("getRepository returns id, owner, name, clone/web URLs, and default branch", async () => {
  const { fetch, calls } = recordingFetch((url, request) => {
    assert.equal(url.searchParams.get("api-version"), "7.1");
    assert.equal(request.headers.get("authorization"), `Bearer ${TOKEN}`);
    assert.equal(isRepoRequest(url), true);
    return jsonResponse(repoPayload());
  });
  const adapter = createAdoRestAdapter({ credentials: connectedCredentials(), fetch });
  const repo = await adapter.getRepository({
    provider: "azure-devops",
    host: HOST,
    owner: OWNER,
    name: REPO_NAME,
  });
  assert.deepEqual(repo, repositoryIdentity());
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.method, "GET");
  assert.equal(calls[0]?.authorization, `Bearer ${TOKEN}`);
  assert.equal(calls[0]?.url.includes("api-version=7.1"), true);
  assert.equal(/az\s+rest|az\s+devops/i.test(calls[0]?.url ?? ""), false);
  assert.equal(/\/mcp(?:\/|$|\?)/i.test(calls[0]?.url ?? ""), false);
  assert.equal(calls[0]?.url.includes(TOKEN), false);
  assertNoToken(repo, "repository");
});

test("listPullRequests pages through every eligible configured-repository PR", async () => {
  const pages = [
    [prPayload({ pullRequestId: 1, title: "One" }), prPayload({ pullRequestId: 2, title: "Two" })],
    [prPayload({ pullRequestId: 3, title: "Three" })],
  ];
  const { fetch, calls } = recordingFetch((url) => {
    assert.equal(isPrListRequest(url), true);
    assert.equal(url.searchParams.get("api-version"), "7.1");
    assert.equal(url.searchParams.get("searchCriteria.status"), "active");
    const skip = Number(url.searchParams.get("$skip") ?? "0");
    const top = Number(url.searchParams.get("$top") ?? "0");
    assert.equal(top, 2);
    const index = skip / top;
    return jsonResponse({ value: pages[index] ?? [], count: (pages[index] ?? []).length });
  });
  const adapter = createAdoRestAdapter({
    credentials: connectedCredentials(),
    fetch,
    pageSize: 2,
  });
  const listed = await adapter.listPullRequests(repositoryIdentity());
  assert.deepEqual(
    listed.map((row) => row.number),
    [1, 2, 3],
  );
  assert.deepEqual(
    listed.map((row) => row.title),
    ["One", "Two", "Three"],
  );
  assert.equal(calls.length, 2);
  assert.equal(calls.every((call) => call.authorization === `Bearer ${TOKEN}`), true);
  assertNoToken(listed, "list");
});

test("active review requests and authored drafts normalize correctly", async () => {
  const review = prPayload({
    pullRequestId: 1101,
    title: "Please review",
    isDraft: false,
    createdBy: identityRef("other@contoso.com", "Other"),
    reviewers: [identityRef(LOGIN, "Ada")],
  });
  const draft = prPayload({
    pullRequestId: 1102,
    title: "My draft",
    isDraft: true,
    createdBy: identityRef(LOGIN, "Ada"),
    reviewers: [],
    lastMergeSourceCommit: { commitId: SHA_C },
    lastMergeTargetCommit: { commitId: SHA_D },
  });
  const { fetch } = recordingFetch((url) => {
    assert.equal(url.searchParams.get("searchCriteria.status"), "active");
    return jsonResponse({ value: [review, draft], count: 2 });
  });
  const adapter = createAdoRestAdapter({ credentials: connectedCredentials(), fetch });
  const listed = await adapter.listPullRequests(repositoryIdentity());
  assert.equal(listed.length, 2);
  assert.deepEqual(
    listed.map((row) => ({
      number: row.number,
      title: row.title,
      webUrl: row.webUrl,
      isDraft: row.isDraft,
      status: row.status,
      sourceRef: row.sourceRef,
      targetRef: row.targetRef,
      sourceCommit: row.sourceCommit,
      targetCommit: row.targetCommit,
      author: row.author,
      isReviewer: row.isReviewer,
      isAuthor: row.isAuthor,
      updatedAt: row.updatedAt,
      provider: row.provider,
      host: row.host,
      repositoryId: row.repository.id,
      owner: row.repository.owner,
    })),
    [
      {
        number: 1101,
        title: "Please review",
        webUrl: `${WEB_URL}/pullrequest/1101`,
        isDraft: false,
        status: "active",
        sourceRef: "refs/heads/feature/review-me",
        targetRef: "refs/heads/develop",
        sourceCommit: SHA_A,
        targetCommit: SHA_B,
        author: "Other",
        isReviewer: true,
        isAuthor: false,
        updatedAt: "2026-09-14T11:00:00.000Z",
        provider: "azure-devops",
        host: HOST,
        repositoryId: REPO_ID,
        owner: OWNER,
      },
      {
        number: 1102,
        title: "My draft",
        webUrl: `${WEB_URL}/pullrequest/1102`,
        isDraft: true,
        status: "active",
        sourceRef: "refs/heads/feature/review-me",
        targetRef: "refs/heads/develop",
        sourceCommit: SHA_C,
        targetCommit: SHA_D,
        author: "Ada",
        isReviewer: false,
        isAuthor: true,
        updatedAt: "2026-09-14T11:00:00.000Z",
        provider: "azure-devops",
        host: HOST,
        repositoryId: REPO_ID,
        owner: OWNER,
      },
    ],
  );
});

test("getPullRequest fetches saved completed and abandoned details", async () => {
  const completed = prPayload({
    pullRequestId: 2201,
    title: "Done work",
    status: "completed",
    description: "Ships the pin maps change",
    closedDate: "2026-09-15T08:00:00.000Z",
    lastMergeSourceCommit: { commitId: SHA_C },
    lastMergeTargetCommit: { commitId: SHA_D },
    reviewers: [],
    createdBy: identityRef(LOGIN, "Ada"),
  });
  const abandoned = prPayload({
    pullRequestId: 2202,
    title: "Dropped work",
    status: "abandoned",
    closedDate: "2026-09-15T09:00:00.000Z",
    createdBy: identityRef("other@contoso.com", "Other"),
    reviewers: [identityRef(LOGIN, "Ada")],
  });
  const { fetch, calls } = recordingFetch((url) => {
    if (isPrGetRequest(url, 2201)) return jsonResponse(completed);
    if (isPrGetRequest(url, 2202)) return jsonResponse(abandoned);
    return jsonResponse({ message: "not found" }, 404);
  });
  const adapter = createAdoRestAdapter({ credentials: connectedCredentials(), fetch });
  const repo = { id: REPO_ID, owner: OWNER, name: REPO_NAME };
  const done = await adapter.getPullRequest({
    provider: "azure-devops",
    host: HOST,
    repository: repo,
    number: 2201,
  });
  const dropped = await adapter.getPullRequest({
    provider: "azure-devops",
    host: HOST,
    repository: repo,
    number: 2202,
  });
  assert.equal(done.status, "completed");
  assert.equal(done.isAuthor, true);
  assert.equal(done.isReviewer, false);
  assert.equal(done.sourceCommit, SHA_C);
  assert.equal(done.targetCommit, SHA_D);
  assert.equal(done.updatedAt, "2026-09-15T08:00:00.000Z");
  assert.equal(done.webUrl, `${WEB_URL}/pullrequest/2201`);
  assert.equal(done.description, "Ships the pin maps change");
  assert.equal(dropped.status, "abandoned");
  assert.equal(dropped.isAuthor, false);
  assert.equal(dropped.isReviewer, true);
  assert.equal(dropped.updatedAt, "2026-09-15T09:00:00.000Z");
  assert.equal(dropped.description, undefined);
  assert.equal(calls.length, 2);
  assert.equal(
    calls.every((call) => call.url.includes("api-version=7.1") && call.authorization === `Bearer ${TOKEN}`),
    true,
  );
});

test("getPullRequest maps description and omits it when missing or blank", async () => {
  const withText = prPayload({ description: "  Why this PR exists  " });
  const blank = prPayload({ pullRequestId: 3301, description: "   " });
  const missing = prPayload({ pullRequestId: 3302 });
  const { fetch } = recordingFetch((url) => {
    if (isPrGetRequest(url, 1101)) return jsonResponse(withText);
    if (isPrGetRequest(url, 3301)) return jsonResponse(blank);
    if (isPrGetRequest(url, 3302)) return jsonResponse(missing);
    return jsonResponse({ message: "not found" }, 404);
  });
  const adapter = createAdoRestAdapter({ credentials: connectedCredentials(), fetch });
  const repo = { id: REPO_ID, owner: OWNER, name: REPO_NAME };
  const input = {
    provider: "azure-devops" as const,
    host: HOST,
    repository: repo,
  };
  const described = await adapter.getPullRequest({ ...input, number: 1101 });
  const blankMeta = await adapter.getPullRequest({ ...input, number: 3301 });
  const missingMeta = await adapter.getPullRequest({ ...input, number: 3302 });
  assert.equal(described.description, "Why this PR exists");
  assert.equal(blankMeta.description, undefined);
  assert.equal(missingMeta.description, undefined);
});

test("missing commit ids and malformed payloads fail without inventing values", async () => {
  const adapterFor = (body: unknown, status = 200) => {
    const { fetch } = recordingFetch(() => jsonResponse(body, status));
    return createAdoRestAdapter({ credentials: connectedCredentials(), fetch });
  };

  await assert.rejects(
    () => adapterFor("not-json").getRepository({
      provider: "azure-devops",
      host: HOST,
      owner: OWNER,
      name: REPO_NAME,
    }),
    (err) => {
      assertProviderError(err, "malformed-response");
      return true;
    },
  );

  await assert.rejects(
    () =>
      adapterFor({ value: [prPayload({ lastMergeSourceCommit: {}, lastMergeTargetCommit: { commitId: SHA_B } })] })
        .listPullRequests(repositoryIdentity()),
    (err) => {
      assertProviderError(err, "malformed-response");
      return true;
    },
  );

  await assert.rejects(
    () =>
      adapterFor(prPayload({ lastMergeSourceCommit: { commitId: "short" }, lastMergeTargetCommit: { commitId: SHA_B } }))
        .getPullRequest({
          provider: "azure-devops",
          host: HOST,
          repository: { id: REPO_ID, owner: OWNER, name: REPO_NAME },
          number: 1101,
        }),
    (err) => {
      assertProviderError(err, "malformed-response");
      return true;
    },
  );
});

test("maps auth, rate, unavailable, and not-found errors", async () => {
  const rows: Array<{
    name: string;
    status?: number;
    headers?: Record<string, string>;
    throwNetwork?: boolean;
    credentials?: CredentialSource;
    code: string;
  }> = [
    { name: "credential", credentials: failedCredentials("login-required"), code: "auth" },
    { name: "401", status: 401, code: "auth" },
    { name: "403", status: 403, code: "auth" },
    { name: "429", status: 429, headers: { "retry-after": "12" }, code: "rate" },
    { name: "503", status: 503, code: "unavailable" },
    { name: "network", throwNetwork: true, code: "unavailable" },
    { name: "404", status: 404, code: "not-found" },
  ];

  for (const row of rows) {
    const { fetch, calls } = recordingFetch(() => {
      if (row.throwNetwork) throw new TypeError("fetch failed");
      return jsonResponse({ message: "nope" }, row.status ?? 200, row.headers);
    });
    const adapter = createAdoRestAdapter({
      credentials: row.credentials ?? connectedCredentials(),
      fetch,
    });
    await assert.rejects(
      () =>
        adapter.getRepository({
          provider: "azure-devops",
          host: HOST,
          owner: OWNER,
          name: REPO_NAME,
        }),
      (err) => {
        assertProviderError(err, row.code);
        if (row.code === "rate") {
          assert.equal((err as ProviderError).retryAfterSec, 12);
        }
        return true;
      },
      row.name,
    );
    if (row.credentials) assert.equal(calls.length, 0, row.name);
  }
});
