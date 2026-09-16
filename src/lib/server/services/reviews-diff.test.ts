import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { test } from "node:test";
import type { OpenActionTarget } from "../../shared/contracts/catalog.ts";
import { FileChange, type GuideV1 } from "../../shared/contracts/guide.ts";
import { pullRequestSyncKey } from "../../shared/contracts/provenance.ts";
import { GitOperationError, type GitCacheIdentity, type GitDiff, type ManagedGitCache } from "../git/ports.ts";
import { createManagedGitCache } from "../git/managed-cache.ts";
import { createGitProcessRunner } from "../git/process.ts";
import type {
  ProviderPullRequestMetadata,
  ProviderPullRequestReader,
  ProviderRepositoryIdentity,
  ProviderRepositoryReader,
} from "../providers/ports.ts";
import type { AppRepositories, ConfiguredRepositoryRecord } from "../repositories/ports.ts";
import type { CredentialResult, CredentialSource } from "../auth/ports.ts";
import { createAdoRestAdapter } from "../providers/ado-rest.ts";
import { createAppServices } from "./app.ts";
import { createReviewService } from "./reviews.ts";

const SOURCE = "1111111111111111111111111111111111111111";
const TARGET = "2222222222222222222222222222222222222222";
const SOURCE_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const ADO_REPO: ProviderRepositoryIdentity = {
  provider: "azure-devops",
  host: "dev.azure.com",
  id: "repo-1",
  owner: "braidteam/BRAID",
  name: "braid-connection-designer",
  webUrl: "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer",
  cloneUrl: "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer",
};

const GITHUB_REPO: ProviderRepositoryIdentity = {
  provider: "github",
  host: "github.com",
  id: "1296269",
  owner: "octocat",
  name: "Hello-World",
  webUrl: "https://github.com/octocat/Hello-World",
  cloneUrl: "https://github.com/octocat/Hello-World.git",
};

const FILES: FileChange[] = [
  {
    path: "src/open.ts",
    language: "typescript",
    hunks: [{ lines: [{ type: "added", content: "export const n = 1;", newLine: 1 }] }],
  },
];

function unused(name: string) {
  return async () => {
    throw new Error(`unexpected ${name}`);
  };
}

function repos(overrides: Partial<AppRepositories>): AppRepositories {
  return {
    listReviews: unused("listReviews"),
    getReview: unused("getReview"),
    addReview: unused("addReview"),
    addReviewFromTool: unused("addReviewFromTool"),
    upsertReview: unused("upsertReview"),
    upsertReviewFromTool: unused("upsertReviewFromTool"),
    removeReview: unused("removeReview"),
    setActive: unused("setActive"),
    seedIfEmpty: unused("seedIfEmpty"),
    replaceCatalog: unused("replaceCatalog"),
    queueAction: unused("queueAction"),
    waitForAction: unused("waitForAction"),
    completeAction: unused("completeAction"),
    publishReviewOutcome: unused("publishReviewOutcome"),
    ...overrides,
  };
}

function emptyList() {
  return {
    reviews: [] as {
      id: string;
      title: string;
      addedAt: string;
      base: string;
      head: string;
      syncKey?: string;
      sourceCommit?: string;
      unchaptered?: boolean;
    }[],
    activeId: null,
    repositories: [],
    catalog: [],
    actions: [],
    agentConnected: false,
  };
}

function targetOf(repo: ProviderRepositoryIdentity, number: number): OpenActionTarget {
  return {
    provider: repo.provider,
    host: repo.host,
    repository: {
      id: repo.id,
      owner: repo.owner,
      name: repo.name,
      webUrl: repo.webUrl,
    },
    number,
  };
}

function metaOf(
  repo: ProviderRepositoryIdentity,
  number: number,
  extra: Partial<ProviderPullRequestMetadata> = {},
): ProviderPullRequestMetadata {
  return {
    provider: repo.provider,
    host: repo.host,
    repository: repo,
    number,
    title: `PR ${number}`,
    webUrl:
      repo.provider === "github"
        ? `${repo.webUrl}/pull/${number}`
        : `${repo.webUrl}/pullrequest/${number}`,
    sourceRef: "refs/heads/feature/review-me",
    targetRef: "refs/heads/develop",
    sourceCommit: SOURCE,
    targetCommit: TARGET,
    isDraft: false,
    status: "active",
    author: "Ada",
    isReviewer: true,
    isAuthor: false,
    updatedAt: "2026-09-16T11:00:00.000Z",
    ...extra,
  };
}

function fakeReaders(rows: ProviderPullRequestMetadata[]): {
  ado: ProviderPullRequestReader & ProviderRepositoryReader;
  github: ProviderPullRequestReader & ProviderRepositoryReader;
} {
  const get = async (input: {
    provider: ProviderRepositoryIdentity["provider"];
    host: string;
    repository: Pick<ProviderRepositoryIdentity, "id" | "owner" | "name">;
    number: number;
  }) => {
    const found = rows.find(
      (row) =>
        row.provider === input.provider &&
        row.host === input.host &&
        row.repository.id === input.repository.id &&
        row.number === input.number,
    );
    if (!found) throw new Error(`unexpected getPullRequest ${input.provider}:${input.number}`);
    return found;
  };
  const getRepository: ProviderRepositoryReader["getRepository"] = async (input) => {
    const found = rows.find(
      (row) =>
        row.provider === input.provider &&
        row.host === input.host &&
        row.repository.owner === input.owner &&
        row.repository.name === input.name,
    );
    if (!found) throw new Error(`unexpected getRepository ${input.provider}`);
    return found.repository;
  };
  const reader = {
    listPullRequests: unused("listPullRequests") as ProviderPullRequestReader["listPullRequests"],
    getPullRequest: get,
    getRepository,
  };
  return { ado: reader, github: reader };
}

function recordingGit(options: {
  files?: FileChange[];
  fail?: GitOperationError["kind"];
  delayMs?: number;
  onFetch?: (identity: GitCacheIdentity, commits: readonly string[], cloneUrl?: string) => void;
} = {}): ManagedGitCache & GitDiff & { fetches: number; diffs: number } {
  const git = {
    fetches: 0,
    diffs: 0,
    async ensureBare() {
      return;
    },
    async fetchCommits(
      identity: GitCacheIdentity,
      commits: readonly string[],
      fetchOptions?: { cloneUrl: string },
    ) {
      git.fetches += 1;
      options.onFetch?.(identity, commits, fetchOptions?.cloneUrl);
      if (options.fail === "fetch-failure" || options.fail === "missing-commit" || options.fail === "corrupt") {
        throw new GitOperationError(options.fail, identity, options.fail);
      }
      if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    },
    async unifiedThreeDot(input: {
      identity: GitCacheIdentity;
      sourceCommit: string;
      targetCommit: string;
    }) {
      git.diffs += 1;
      if (options.fail === "empty-diff") {
        throw new GitOperationError("empty-diff", input.identity, "three-dot diff is empty");
      }
      if (options.fail === "missing-commit") {
        throw new GitOperationError("missing-commit", input.identity, "commit is not in the managed cache");
      }
      return options.files ?? FILES;
    },
  };
  return git;
}

function configured(repo: ProviderRepositoryIdentity): ConfiguredRepositoryRecord {
  return {
    provider: repo.provider,
    host: repo.host,
    id: repo.id,
    owner: repo.owner,
    name: repo.name,
    webUrl: repo.webUrl,
    cloneUrl: repo.cloneUrl,
    origin: true,
  };
}

function service(options: {
  repos: AppRepositories;
  rows: ProviderPullRequestMetadata[];
  git: ManagedGitCache & GitDiff;
  configured?: ConfiguredRepositoryRecord[];
}) {
  const readers = fakeReaders(options.rows);
  return createReviewService(options.repos, {
    readers,
    repositoryReaders: readers,
    listConfigured: async () => options.configured ?? options.rows.map((row) => configured(row.repository)),
    git: options.git,
  });
}

for (const row of [
  { label: "ADO", repo: ADO_REPO, number: 1101 },
  { label: "GitHub", repo: GITHUB_REPO, number: 42 },
]) {
  test(`openDiff upserts an unchaptered ${row.label} Diff with exact commits and identity`, async () => {
    const target = targetOf(row.repo, row.number);
    const metadata = metaOf(row.repo, row.number);
    let upserted: GuideV1 | undefined;
    const fetches: Array<{ identity: GitCacheIdentity; commits: readonly string[]; cloneUrl?: string }> = [];
    const git = recordingGit({
      onFetch: (identity, commits, cloneUrl) => {
        fetches.push({ identity, commits, cloneUrl });
      },
    });
    const reviews = service({
      repos: repos({
        listReviews: async () => emptyList(),
        upsertReview: async (input) => {
          upserted = input as GuideV1;
          return { id: "r1" };
        },
      }),
      rows: [metadata],
      git,
    });
    const result = await reviews.openDiff(target);
    assert.equal(result.reviewId, "r1");
    assert.equal(result.skipped, false);
    assert.equal(upserted?.unchaptered, true);
    assert.equal(upserted?.title, `PR ${row.number}`);
    assert.equal(upserted?.head, SOURCE);
    assert.equal(upserted?.base, TARGET);
    assert.equal(upserted?.source?.provider, row.repo.provider);
    assert.equal(upserted?.source?.host, row.repo.host);
    assert.equal(upserted?.source?.repository.id, row.repo.id);
    assert.equal(upserted?.source?.number, row.number);
    assert.equal(upserted?.source?.sourceCommit, SOURCE);
    assert.equal(upserted?.source?.targetCommit, TARGET);
    assert.equal(upserted?.source?.providerContext.kind, row.repo.provider);
    assert.deepEqual(fetches[0]?.commits, [SOURCE, TARGET]);
    assert.equal(fetches[0]?.cloneUrl, row.repo.cloneUrl);
    assert.equal(fetches[0]?.identity.repositoryId, row.repo.id);
    assert.equal(JSON.stringify(upserted).includes("gho_"), false);
  });
}

test("updateDiff skips git and upsert when the saved source commit is current", async () => {
  const target = targetOf(ADO_REPO, 1101);
  const git = recordingGit();
  let upserts = 0;
  const reviews = service({
    repos: repos({
      listReviews: async () => ({
        ...emptyList(),
        reviews: [
          {
            id: "saved-1",
            title: "PR 1101",
            addedAt: "t",
            base: TARGET,
            head: SOURCE,
            syncKey: pullRequestSyncKey(target),
            sourceCommit: SOURCE,
          },
        ],
      }),
      upsertReview: async () => {
        upserts += 1;
        return { id: "saved-1" };
      },
    }),
    rows: [metaOf(ADO_REPO, 1101)],
    git,
  });
  const result = await reviews.updateDiff(target);
  assert.equal(result.reviewId, "saved-1");
  assert.equal(result.skipped, true);
  assert.equal(git.fetches, 0);
  assert.equal(git.diffs, 0);
  assert.equal(upserts, 0);
});

test("host, cache, parse, and empty-diff failures never call upsert", async () => {
  const target = targetOf(GITHUB_REPO, 42);
  for (const fail of ["fetch-failure", "empty-diff"] as const) {
    let upserts = 0;
    const reviews = service({
      repos: repos({
        listReviews: async () => emptyList(),
        upsertReview: async () => {
          upserts += 1;
          return { id: "nope" };
        },
      }),
      rows: [metaOf(GITHUB_REPO, 42)],
      git: recordingGit({ fail }),
    });
    await assert.rejects(() => reviews.openDiff(target));
    assert.equal(upserts, 0);
  }

  let upserts = 0;
  const missingReader = fakeReaders([]);
  const reviews = createReviewService(
    repos({
      listReviews: async () => emptyList(),
      upsertReview: async () => {
        upserts += 1;
        return { id: "nope" };
      },
    }),
    {
      readers: missingReader,
      repositoryReaders: missingReader,
      listConfigured: async () => [],
      git: recordingGit(),
    },
  );
  await assert.rejects(() => reviews.openDiff(target));
  assert.equal(upserts, 0);
});

test("concurrent Open calls for the same PR share one in-flight fetch", async () => {
  const target = targetOf(ADO_REPO, 1101);
  const git = recordingGit({ delayMs: 40 });
  let upserts = 0;
  const reviews = service({
    repos: repos({
      listReviews: async () => emptyList(),
      upsertReview: async () => {
        upserts += 1;
        return { id: "r1" };
      },
    }),
    rows: [metaOf(ADO_REPO, 1101)],
    git,
  });
  const [a, b] = await Promise.all([reviews.openDiff(target), reviews.openDiff(target)]);
  assert.equal(a.reviewId, "r1");
  assert.equal(b.reviewId, "r1");
  assert.equal(git.fetches, 1);
  assert.equal(upserts, 1);
});

test("openDiff builds a complete Diff from a local git cache fixture without a host network", async () => {
  const root = await mkdtemp(join(tmpdir(), "gpr-07-07-"));
  const fixture = await makeFixtureRemote(join(root, "remote"));
  const repo: ProviderRepositoryIdentity = {
    ...GITHUB_REPO,
    cloneUrl: fixture.remote,
  };
  const target = targetOf(repo, 7);
  let upserted: GuideV1 | undefined;
  const git = createManagedGitCache({
    dataDir: join(root, "data"),
    runner: createGitProcessRunner(),
    credentials: {
      getAccessToken: async () => {
        throw new Error("local fixture remotes must not request credentials");
      },
    },
  });
  const reviews = service({
    repos: repos({
      listReviews: async () => emptyList(),
      upsertReview: async (input) => {
        upserted = input as GuideV1;
        return { id: "fixture-1" };
      },
    }),
    rows: [
      metaOf(repo, 7, {
        sourceCommit: fixture.source,
        targetCommit: fixture.target,
      }),
    ],
    git,
  });
  const result = await reviews.openDiff(target);
  assert.equal(result.reviewId, "fixture-1");
  assert.equal(upserted?.unchaptered, true);
  assert.equal(upserted?.source?.provider, "github");
  assert.equal(upserted?.source?.sourceCommit, fixture.source);
  assert.equal(upserted?.source?.targetCommit, fixture.target);
  const maps = upserted?.chapters[0]?.files.find((file) => file.path === "src/maps.py");
  assert.ok(maps);
  FileChange.parse(maps);
  assert.ok((maps.hunks || []).some((hunk) => hunk.lines.some((line) => line.content.includes("snapshot.workflow_id"))));
});

async function makeFixtureRemote(dir: string): Promise<{
  remote: string;
  source: string;
  target: string;
}> {
  const work = join(dir, "work");
  const remote = join(dir, "remote.git");
  await mkdir(join(work, "src"), { recursive: true });
  await writeFile(
    join(work, "src/maps.py"),
    "keep\nalso keep\nmaps = list_maps(model.workflow_id)\ndone\n",
  );
  await runGit(["init"], work);
  await runGit(["add", "src/maps.py"], work);
  await runGit(["commit", "-m", "base"], work);
  const target = (await runGit(["rev-parse", "HEAD"], work)).stdout.trim();
  await writeFile(
    join(work, "src/maps.py"),
    'keep\nalso keep\nmaps = list_maps(snapshot.workflow_id)\nextra = "<script>x</script>"\ndone\n',
  );
  await runGit(["add", "src/maps.py"], work);
  await runGit(["commit", "-m", "feature"], work);
  const source = (await runGit(["rev-parse", "HEAD"], work)).stdout.trim();
  await runGit(["clone", "--bare", work, remote], dir);
  return { remote, source, target };
}

function runGit(argv: string[], cwd: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", argv, {
      cwd,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "fixture",
        GIT_AUTHOR_EMAIL: "fixture@example.com",
        GIT_COMMITTER_NAME: "fixture",
        GIT_COMMITTER_EMAIL: "fixture@example.com",
        GIT_CONFIG_NOSYSTEM: "1",
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_TERMINAL_PROMPT: "0",
      },
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf8");
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ stdout, stderr, code }));
  });
}

test("openDiff stores ADO iteration and change-tracking ids returned by REST", async () => {
  const credentials: CredentialSource = {
    async getAccessToken(input): Promise<CredentialResult> {
      if (input.provider !== "azure-devops") {
        return { status: "malformed", provider: input.provider, host: input.host, recovery: "az login" };
      }
      return {
        status: "connected",
        identity: { provider: "azure-devops", host: input.host, login: "ada@contoso.com" },
        token: "ado_FIXTURE_TOKEN_not_for_network",
      };
    },
  };
  const seen: string[] = [];
  const fetchFn: typeof fetch = async (input) => {
    const url = String(input instanceof Request ? input.url : input);
    seen.push(url);
    if (url.includes("/iterations/") && url.includes("/changes")) {
      return new Response(
        JSON.stringify({
          changeEntries: [
            { changeTrackingId: 7, change: { item: { path: "/src/open.ts" } } },
            { changeTrackingId: 8, change: { item: { path: "/docs/readme.md" } } },
            { change: { item: { path: "/no-tracking.ts" } } },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (url.includes("/iterations")) {
      return new Response(JSON.stringify({ value: [{ id: 1 }, { id: 2 }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("/pullrequests/1101")) {
      return new Response(
        JSON.stringify({
          pullRequestId: 1101,
          title: "PR 1101",
          status: "active",
          createdBy: { uniqueName: "ada@contoso.com", displayName: "Ada" },
          creationDate: "2026-09-16T11:00:00.000Z",
          sourceRefName: "refs/heads/feature/review-me",
          targetRefName: "refs/heads/develop",
          lastMergeSourceCommit: { commitId: SOURCE },
          lastMergeTargetCommit: { commitId: TARGET },
          reviewers: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  const ado = createAdoRestAdapter({ credentials, fetch: fetchFn });
  const unusedGithub = fakeReaders([]);
  let upserted: GuideV1 | undefined;
  const reviews = createReviewService(
    repos({
      listReviews: async () => emptyList(),
      upsertReview: async (input) => {
        upserted = input as GuideV1;
        return { id: "r-ado" };
      },
    }),
    {
      readers: { ado, github: unusedGithub.github },
      repositoryReaders: { ado, github: unusedGithub.github },
      listConfigured: async () => [configured(ADO_REPO)],
      git: recordingGit(),
    },
  );
  await reviews.openDiff(targetOf(ADO_REPO, 1101));
  const context = upserted?.source?.providerContext;
  assert.equal(context?.kind, "azure-devops");
  if (context?.kind !== "azure-devops") throw new Error("expected azure-devops context");
  assert.equal(context.firstComparingIteration, 1);
  assert.equal(context.secondComparingIteration, 2);
  assert.deepEqual(context.changes["src/open.ts"], { changeTrackingId: 7 });
  assert.deepEqual(context.changes["docs/readme.md"], { changeTrackingId: 8 });
  assert.equal("no-tracking.ts" in context.changes, false);
  assert.equal(Object.keys(context.changes).length > 0, true);
  assert.equal(
    seen.some((url) => url.includes("/pullrequests/1101/iterations") && url.includes("api-version=7.1")),
    true,
  );
  assert.equal(
    seen.some((url) => url.includes("/iterations/2/changes") && url.includes("api-version=7.1")),
    true,
  );
  assert.equal(seen.some((url) => /az\s+rest|gh\s+api/i.test(url)), false);
});

test("createAppServices openDiff keeps ADO comment context through pullRequestReader", async () => {
  const credentials: CredentialSource = {
    async getAccessToken(input): Promise<CredentialResult> {
      if (input.provider !== "azure-devops") {
        return { status: "malformed", provider: input.provider, host: input.host, recovery: "az login" };
      }
      return {
        status: "connected",
        identity: { provider: "azure-devops", host: input.host, login: "ada@contoso.com" },
        token: "ado_FIXTURE_TOKEN_not_for_network",
      };
    },
  };
  const fetchFn: typeof fetch = async (input) => {
    const url = String(input instanceof Request ? input.url : input);
    if (url.includes("/iterations/") && url.includes("/changes")) {
      return new Response(
        JSON.stringify({
          changeEntries: [{ changeTrackingId: 7, change: { item: { path: "/src/open.ts" } } }],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    if (url.includes("/iterations")) {
      return new Response(JSON.stringify({ value: [{ id: 1 }, { id: 2 }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    if (url.includes("/pullrequests/1101")) {
      return new Response(
        JSON.stringify({
          pullRequestId: 1101,
          title: "PR 1101",
          status: "active",
          createdBy: { uniqueName: "ada@contoso.com", displayName: "Ada" },
          creationDate: "2026-09-16T11:00:00.000Z",
          sourceRefName: "refs/heads/feature/review-me",
          targetRefName: "refs/heads/develop",
          lastMergeSourceCommit: { commitId: SOURCE },
          lastMergeTargetCommit: { commitId: TARGET },
          reviewers: [],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }
    throw new Error(`unexpected fetch ${url}`);
  };
  const ado = createAdoRestAdapter({ credentials, fetch: fetchFn });
  const unusedGithub = fakeReaders([]);
  let upserted: GuideV1 | undefined;
  const services = createAppServices(
    repos({
      listReviews: async () => emptyList(),
      upsertReview: async (input) => {
        upserted = input as GuideV1;
        return { id: "r-ado" };
      },
    }),
    {
      credentials,
      readers: { ado, github: unusedGithub.github },
      configured: {
        list: async () => [configured(ADO_REPO)],
        add: async () => ({ ok: true as const }),
        remove: async () => ({ ok: true as const }),
      },
      git: recordingGit(),
    },
  );
  await services.reviews.openDiff(targetOf(ADO_REPO, 1101));
  const context = upserted?.source?.providerContext;
  assert.equal(context?.kind, "azure-devops");
  if (context?.kind !== "azure-devops") throw new Error("expected azure-devops context");
  assert.equal(context.firstComparingIteration, 1);
  assert.equal(context.secondComparingIteration, 2);
  assert.deepEqual(context.changes["src/open.ts"], { changeTrackingId: 7 });
});

