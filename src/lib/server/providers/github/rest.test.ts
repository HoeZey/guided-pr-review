import assert from "node:assert/strict";
import { test } from "node:test";
import { CatalogPullRequest, CatalogSnapshot } from "../../../shared/contracts/catalog.ts";
import { applyCatalogReplacement } from "../../../shared/domain/catalog.ts";
import { catalogHasNewChanges, projectHomeOverview } from "../../../shared/domain/overview.ts";
import { createCliCredentialSource } from "../../auth/cli-credentials.ts";
import type {
  CommandRunRequest,
  CommandRunResult,
  CommandRunner,
  CredentialResult,
  CredentialSource,
} from "../../auth/ports.ts";
import type { ProviderPullRequestMetadata, ProviderRepositoryIdentity } from "../ports.ts";
import {
  GITHUB_API_VERSION,
  GithubProviderError,
  createGithubProvider,
} from "./rest.ts";

const GH_TOKEN = "gho_FIXTURE_TOKEN_abcdef1234567890";
const GH_LOGIN = "octocat";
const HEAD_SHA = "6dcb09b5b57875f334f61aebed695e2e4193db5e";
const BASE_SHA = "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2";
const OTHER_SHA = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SYNTHETIC = "cccccccccccccccccccccccccccccccccccccccc";

const REPO = {
  id: 1296269,
  name: "Hello-World",
  owner: { login: "octocat" },
  html_url: "https://github.com/octocat/Hello-World",
  clone_url: "https://github.com/octocat/Hello-World.git",
};

const IDENTITY: ProviderRepositoryIdentity = {
  provider: "github",
  host: "github.com",
  id: "1296269",
  owner: "octocat",
  name: "Hello-World",
  webUrl: "https://github.com/octocat/Hello-World",
  cloneUrl: "https://github.com/octocat/Hello-World.git",
};

function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...init.headers },
  });
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

function failedCredentials(status: Exclude<CredentialResult["status"], "connected">): CredentialSource {
  return {
    async getAccessToken(): Promise<CredentialResult> {
      return { status, provider: "github", host: "github.com", recovery: "gh auth login" };
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

function user(login: string) {
  return { login, id: login === GH_LOGIN ? 1 : 2, type: "User" };
}

function pull(overrides: Record<string, unknown> = {}) {
  return {
    number: 1347,
    title: "new-feature",
    html_url: "https://github.com/octocat/Hello-World/pull/1347",
    state: "open",
    draft: false,
    merged_at: null,
    merge_commit_sha: SYNTHETIC,
    user: user("other_user"),
    requested_reviewers: [user(GH_LOGIN)],
    updated_at: "2011-01-26T19:01:12Z",
    head: {
      ref: "new-topic",
      sha: HEAD_SHA,
      repo: { name: "Hello-World" },
    },
    base: {
      ref: "master",
      sha: BASE_SHA,
      repo: { name: "Hello-World" },
    },
    ...overrides,
  };
}

function asCatalog(meta: ProviderPullRequestMetadata) {
  return CatalogPullRequest.parse({
    provider: meta.provider,
    host: meta.host,
    repository: {
      id: meta.repository.id,
      owner: meta.repository.owner,
      name: meta.repository.name,
      webUrl: meta.repository.webUrl,
    },
    number: meta.number,
    title: meta.title,
    webUrl: meta.webUrl,
    sourceRef: meta.sourceRef,
    targetRef: meta.targetRef,
    sourceCommit: meta.sourceCommit,
    targetCommit: meta.targetCommit,
    isDraft: meta.isDraft,
    status: meta.status,
    author: meta.author,
    isReviewer: meta.isReviewer,
    isAuthor: meta.isAuthor,
    updatedAt: meta.updatedAt,
  });
}

function dumpPublic(value: unknown): string {
  return JSON.stringify(value);
}

function header(init: RequestInit | undefined, name: string): string | undefined {
  if (!init?.headers) return undefined;
  const headers = new Headers(init.headers);
  return headers.get(name) ?? undefined;
}

test("getRepository maps GitHub REST identity and pins the documented API version", async () => {
  const { fetch, calls } = recordingFetch((url) => {
    assert.equal(url.pathname, "/repos/octocat/Hello-World");
    return jsonResponse(REPO);
  });
  const provider = createGithubProvider({ credentials: connectedCredentials(), fetch });
  const repository = await provider.getRepository({
    provider: "github",
    host: "github.com",
    owner: "octocat",
    name: "Hello-World",
  });
  assert.deepEqual(repository, IDENTITY);
  assert.equal(calls.length, 1);
  assert.equal(header(calls[0].init, "Authorization"), `Bearer ${GH_TOKEN}`);
  assert.equal(header(calls[0].init, "Accept"), "application/vnd.github+json");
  assert.equal(header(calls[0].init, "X-GitHub-Api-Version"), GITHUB_API_VERSION);
  assert.equal(GITHUB_API_VERSION, "2026-03-10");
  assert.equal(header(calls[0].init, "User-Agent"), "guided-pr-review");
  assert.equal(dumpPublic(repository).includes(GH_TOKEN), false);

  await assert.rejects(
    () =>
      createGithubProvider({ credentials: connectedCredentials(), fetch }).getRepository({
        provider: "github",
        host: "github.example.com",
        owner: "octocat",
        name: "Hello-World",
      }),
    (error: unknown) => {
      assert.ok(error instanceof GithubProviderError);
      assert.equal(error.code, "identity");
      return true;
    },
  );
  assert.equal(calls.length, 1);

  const missing = recordingFetch(() => jsonResponse({ message: "Not Found" }, { status: 404 }));
  await assert.rejects(
    () =>
      createGithubProvider({ credentials: connectedCredentials(), fetch: missing.fetch }).getRepository({
        provider: "github",
        host: "github.com",
        owner: "octocat",
        name: "missing",
      }),
    (error: unknown) => {
      assert.ok(error instanceof GithubProviderError);
      assert.equal(error.code, "not-found");
      return true;
    },
  );
});

test("listPullRequests paginates active PRs and classifies author versus requested reviewer", async () => {
  const page1 = [
    pull({
      number: 1,
      title: "Needs review",
      html_url: "https://github.com/octocat/Hello-World/pull/1",
      user: user("other_user"),
      requested_reviewers: [user(GH_LOGIN)],
      draft: false,
    }),
    pull({
      number: 2,
      title: "My draft",
      html_url: "https://github.com/octocat/Hello-World/pull/2",
      user: user(GH_LOGIN),
      requested_reviewers: [],
      draft: true,
      head: { ref: "draft-topic", sha: OTHER_SHA, repo: { name: "Hello-World" } },
    }),
    pull({
      number: 3,
      title: "Deleted head",
      html_url: "https://github.com/octocat/Hello-World/pull/3",
      head: { ref: "gone", sha: null, repo: null },
    }),
    { title: "malformed" },
  ];
  const page2 = [
    pull({
      number: 4,
      title: "Mine and assigned",
      html_url: "https://github.com/octocat/Hello-World/pull/4",
      user: user(GH_LOGIN),
      requested_reviewers: [user(GH_LOGIN)],
      draft: false,
      head: { ref: "mine", sha: HEAD_SHA, repo: { name: "Hello-World" } },
    }),
  ];
  const { fetch, calls } = recordingFetch((url) => {
    assert.match(url.pathname, /\/repos\/octocat\/Hello-World\/pulls$/);
    assert.equal(url.searchParams.get("state"), "open");
    assert.equal(url.searchParams.get("per_page"), "100");
    if (url.searchParams.get("page") === "2" || /[?&]page=2(?:&|$)/.test(url.search)) {
      return jsonResponse(page2);
    }
    return jsonResponse(page1, {
      headers: {
        Link: '<https://api.github.com/repos/octocat/Hello-World/pulls?state=open&per_page=100&page=2>; rel="next"',
      },
    });
  });
  const provider = createGithubProvider({ credentials: connectedCredentials(), fetch });
  const listed = await provider.listPullRequests(IDENTITY);
  assert.deepEqual(
    listed.map((row) => ({
      number: row.number,
      title: row.title,
      isAuthor: row.isAuthor,
      isReviewer: row.isReviewer,
      isDraft: row.isDraft,
      sourceRef: row.sourceRef,
      targetRef: row.targetRef,
      sourceCommit: row.sourceCommit,
      targetCommit: row.targetCommit,
      status: row.status,
    })),
    [
      {
        number: 1,
        title: "Needs review",
        isAuthor: false,
        isReviewer: true,
        isDraft: false,
        sourceRef: "new-topic",
        targetRef: "master",
        sourceCommit: HEAD_SHA,
        targetCommit: BASE_SHA,
        status: "active",
      },
      {
        number: 2,
        title: "My draft",
        isAuthor: true,
        isReviewer: false,
        isDraft: true,
        sourceRef: "draft-topic",
        targetRef: "master",
        sourceCommit: OTHER_SHA,
        targetCommit: BASE_SHA,
        status: "active",
      },
      {
        number: 4,
        title: "Mine and assigned",
        isAuthor: true,
        isReviewer: true,
        isDraft: false,
        sourceRef: "mine",
        targetRef: "master",
        sourceCommit: HEAD_SHA,
        targetCommit: BASE_SHA,
        status: "active",
      },
    ],
  );
  assert.equal(
    listed.some((row) => row.sourceCommit === SYNTHETIC || row.targetCommit === SYNTHETIC),
    false,
  );
  assert.equal(listed.some((row) => row.number === 3), false);
  assert.ok(calls.length >= 2);
  const catalogItems = listed.map(asCatalog);
  const snapshot = CatalogSnapshot.parse({
    provider: "github",
    host: "github.com",
    repository: {
      id: IDENTITY.id,
      owner: IDENTITY.owner,
      name: IDENTITY.name,
      webUrl: IDENTITY.webUrl,
    },
    syncedAt: "2011-01-26T19:01:12Z",
    pullRequests: catalogItems,
  });
  const overview = projectHomeOverview([], [snapshot]);
  assert.equal(overview.groups.length, 0);
  assert.equal(catalogHasNewChanges([], [snapshot]), true);
  assert.equal(dumpPublic(listed).includes(GH_TOKEN), false);
  assert.equal(
    applyCatalogReplacement([], [], [], {
      origin: true,
      repository: {
        provider: "github",
        host: "github.com",
        id: IDENTITY.id,
        owner: IDENTITY.owner,
        name: IDENTITY.name,
        webUrl: IDENTITY.webUrl,
      },
      syncedAt: "2011-01-26T19:01:12Z",
      pullRequests: catalogItems,
    }).catalog[0].pullRequests.length,
    3,
  );
});

test("getPullRequest fetches saved closed and merged details with exact base and head commits", async () => {
  const closed = pull({
    number: 88,
    title: "Closed unmerged",
    html_url: "https://github.com/octocat/Hello-World/pull/88",
    state: "closed",
    merged_at: null,
    body: null,
    user: user("other_user"),
    requested_reviewers: [],
  });
  const merged = pull({
    number: 99,
    title: "Merged work",
    html_url: "https://github.com/octocat/Hello-World/pull/99",
    state: "closed",
    merged_at: "2011-02-01T00:00:00Z",
    body: "Merges the feature branch",
    user: user(GH_LOGIN),
    requested_reviewers: [],
  });
  const { fetch } = recordingFetch((url) => {
    if (url.pathname.endsWith("/pulls/88")) return jsonResponse(closed);
    if (url.pathname.endsWith("/pulls/99")) return jsonResponse(merged);
    throw new Error(`unexpected live network ${url.toString()}`);
  });
  const provider = createGithubProvider({ credentials: connectedCredentials(), fetch });
  const input = {
    provider: "github" as const,
    host: "github.com",
    repository: { id: IDENTITY.id, owner: IDENTITY.owner, name: IDENTITY.name },
    number: 88,
  };
  const closedMeta = await provider.getPullRequest(input);
  const mergedMeta = await provider.getPullRequest({ ...input, number: 99 });
  assert.equal(closedMeta.status, "closed");
  assert.equal(mergedMeta.status, "completed");
  assert.equal(closedMeta.sourceCommit, HEAD_SHA);
  assert.equal(closedMeta.targetCommit, BASE_SHA);
  assert.equal(mergedMeta.sourceCommit, HEAD_SHA);
  assert.equal(mergedMeta.targetCommit, BASE_SHA);
  assert.equal(closedMeta.description, undefined);
  assert.equal(mergedMeta.description, "Merges the feature branch");
  const closedCard = asCatalog(closedMeta);
  const mergedCard = asCatalog(mergedMeta);
  const overview = projectHomeOverview(
    [
      {
        id: "saved-88",
        title: "Closed unmerged",
        addedAt: "2011-01-26T19:01:12Z",
        base: BASE_SHA,
        head: HEAD_SHA,
        syncKey: "github:github.com:1296269:88",
      },
      {
        id: "saved-99",
        title: "Merged work",
        addedAt: "2011-01-26T19:01:12Z",
        base: BASE_SHA,
        head: HEAD_SHA,
        syncKey: "github:github.com:1296269:99",
      },
    ],
    [
      CatalogSnapshot.parse({
        provider: "github",
        host: "github.com",
        repository: {
          id: IDENTITY.id,
          owner: IDENTITY.owner,
          name: IDENTITY.name,
          webUrl: IDENTITY.webUrl,
        },
        pullRequests: [closedCard, mergedCard],
      }),
    ],
  );
  assert.deepEqual(
    overview.groups.map((group) => ({
      id: group.id,
      titles: group.cards.map((card) => card.title),
      archived: group.cards.map((card) => card.archived),
    })),
    [
      {
        id: "archived",
        titles: ["Closed unmerged", "Merged work"],
        archived: [true, true],
      },
    ],
  );
});

test("deleted heads and missing SHAs fail that PR without synthesizing commits", async () => {
  const { fetch } = recordingFetch((url) => {
    if (url.pathname.endsWith("/pulls/7")) {
      return jsonResponse(
        pull({
          number: 7,
          head: { ref: "gone", sha: "", repo: null },
          merge_commit_sha: SYNTHETIC,
        }),
      );
    }
    return jsonResponse([
      pull({
        number: 8,
        title: "Head repo deleted",
        html_url: "https://github.com/octocat/Hello-World/pull/8",
        head: { ref: "fork-topic", sha: HEAD_SHA, repo: null },
      }),
    ]);
  });
  const provider = createGithubProvider({ credentials: connectedCredentials(), fetch });
  const listed = await provider.listPullRequests(IDENTITY);
  assert.equal(listed.length, 1);
  assert.equal(listed[0].number, 8);
  assert.equal(listed[0].sourceCommit, HEAD_SHA);
  assert.equal(listed[0].targetCommit, BASE_SHA);
  await assert.rejects(
    () =>
      provider.getPullRequest({
        provider: "github",
        host: "github.com",
        repository: IDENTITY,
        number: 7,
      }),
    (error: unknown) => {
      assert.ok(error instanceof GithubProviderError);
      assert.equal(error.code, "malformed");
      assert.equal(error.message.includes(SYNTHETIC), false);
      return true;
    },
  );
});

test("auth errors, rate headers, and malformed payloads fail without contacting a live host", async () => {
  const rate = recordingFetch(() =>
    jsonResponse(
      { message: "API rate limit exceeded" },
      {
        status: 403,
        headers: {
          "x-ratelimit-remaining": "0",
          "x-ratelimit-reset": "2000000000",
        },
      },
    ),
  );
  await assert.rejects(
    () =>
      createGithubProvider({
        credentials: connectedCredentials(),
        fetch: rate.fetch,
      }).listPullRequests(IDENTITY),
    (error: unknown) => {
      assert.ok(error instanceof GithubProviderError);
      assert.equal(error.code, "rate-limited");
      assert.equal(error.message.includes(GH_TOKEN), false);
      return true;
    },
  );

  const auth = recordingFetch(() => jsonResponse({ message: "Bad credentials" }, { status: 401 }));
  await assert.rejects(
    () =>
      createGithubProvider({
        credentials: connectedCredentials(),
        fetch: auth.fetch,
      }).getRepository({
        provider: "github",
        host: "github.com",
        owner: "octocat",
        name: "Hello-World",
      }),
    (error: unknown) => {
      assert.ok(error instanceof GithubProviderError);
      assert.equal(error.code, "unauthorized");
      return true;
    },
  );

  const malformed = recordingFetch(() => jsonResponse({ message: "not a list" }));
  await assert.rejects(
    () =>
      createGithubProvider({
        credentials: connectedCredentials(),
        fetch: malformed.fetch,
      }).listPullRequests(IDENTITY),
    (error: unknown) => {
      assert.ok(error instanceof GithubProviderError);
      assert.equal(error.code, "malformed");
      return true;
    },
  );

  const unusedFetch = recordingFetch(() => {
    throw new Error("unexpected live network");
  });
  await assert.rejects(
    () =>
      createGithubProvider({
        credentials: failedCredentials("login-required"),
        fetch: unusedFetch.fetch,
      }).listPullRequests(IDENTITY),
    (error: unknown) => {
      assert.ok(error instanceof GithubProviderError);
      assert.equal(error.code, "credential");
      return true;
    },
  );
  assert.equal(unusedFetch.calls.length, 0);
});

test("adapter uses injected fetch and never invokes gh api", async () => {
  const argvLog: string[][] = [];
  const runner: CommandRunner = {
    async run(request: CommandRunRequest): Promise<CommandRunResult> {
      argvLog.push([...request.argv]);
      if (request.argv[2] === "token") {
        return {
          code: 0,
          stdout: GH_TOKEN,
          stderr: "",
          timedOut: false,
          commandMissing: false,
        };
      }
      return {
        code: 0,
        stdout: `github.com\n  ✓ Logged in to github.com account ${GH_LOGIN} (keyring)\n`,
        stderr: "",
        timedOut: false,
        commandMissing: false,
      };
    },
  };
  const { fetch, calls } = recordingFetch((url) => {
    assert.equal(url.hostname, "api.github.com");
    assert.equal(url.pathname.includes("graphql"), false);
    return jsonResponse(REPO);
  });
  const provider = createGithubProvider({
    credentials: createCliCredentialSource({ runner }),
    fetch,
  });
  await provider.getRepository({
    provider: "github",
    host: "github.com",
    owner: "octocat",
    name: "Hello-World",
  });
  assert.ok(calls.length > 0);
  assert.equal(
    argvLog.some((argv) => argv.includes("api") || argv.join(" ").includes("gh api")),
    false,
  );
  assert.ok(argvLog.some((argv) => argv.join(" ") === "gh auth token --hostname github.com"));
});

test("getPullRequest maps body to description and omits it when missing or blank", async () => {
  const withText = pull({ number: 41, body: "  Why this PR exists  " });
  const blank = pull({ number: 42, body: "   " });
  const missing = pull({ number: 43, body: null });
  const { fetch } = recordingFetch((url) => {
    if (url.pathname.endsWith("/pulls/41")) return jsonResponse(withText);
    if (url.pathname.endsWith("/pulls/42")) return jsonResponse(blank);
    if (url.pathname.endsWith("/pulls/43")) return jsonResponse(missing);
    throw new Error(`unexpected live network ${url.toString()}`);
  });
  const provider = createGithubProvider({ credentials: connectedCredentials(), fetch });
  const input = {
    provider: "github" as const,
    host: "github.com",
    repository: { id: IDENTITY.id, owner: IDENTITY.owner, name: IDENTITY.name },
  };
  const described = await provider.getPullRequest({ ...input, number: 41 });
  const blankMeta = await provider.getPullRequest({ ...input, number: 42 });
  const missingMeta = await provider.getPullRequest({ ...input, number: 43 });
  assert.equal(described.description, "Why this PR exists");
  assert.equal(blankMeta.description, undefined);
  assert.equal(missingMeta.description, undefined);
});
