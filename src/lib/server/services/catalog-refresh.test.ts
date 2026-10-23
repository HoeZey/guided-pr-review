import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { GuideV1 } from "../../shared/contracts/guide.ts";
import { CATALOG_REFRESH_STALE_MS } from "../../shared/domain/catalog.ts";
import { projectHomeOverview } from "../../shared/domain/overview.ts";
import { ProviderError } from "../providers/errors.ts";
import { GithubProviderError } from "../providers/github/rest.ts";
import type {
  ProviderPullRequestMetadata,
  ProviderPullRequestReader,
  ProviderRepositoryIdentity,
} from "../providers/ports.ts";
import type { ConfiguredRepositoryPort, ConfiguredRepositoryRecord } from "../repositories/ports.ts";
import {
  addReview,
  jsonConfiguredRepositories,
  jsonRepositories,
  listReviews,
  replaceCatalog,
  resetJsonStoreCache,
} from "../repositories/json/store.ts";
import { createCatalogService } from "./catalog.ts";
import {
  createCatalogRefreshService,
  createCatalogStartupLatch,
} from "./catalog-refresh.ts";
import { createConfiguredRepositoryService } from "./configured-repositories.ts";

const SHA_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SHA_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const SHA_C = "cccccccccccccccccccccccccccccccccccccccc";
const T0 = Date.parse("2026-09-16T12:00:00.000Z");

const ADO: ProviderRepositoryIdentity = {
  provider: "azure-devops",
  host: "dev.azure.com",
  id: "ado-1",
  owner: "braidteam/BRAID",
  name: "braid-connection-designer",
  webUrl: "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer",
  cloneUrl: "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer",
};

const GITHUB: ProviderRepositoryIdentity = {
  provider: "github",
  host: "github.com",
  id: "1296269",
  owner: "octocat",
  name: "Hello-World",
  webUrl: "https://github.com/octocat/Hello-World",
  cloneUrl: "https://github.com/octocat/Hello-World.git",
};

function record(identity: ProviderRepositoryIdentity, origin: boolean): ConfiguredRepositoryRecord {
  return {
    provider: identity.provider,
    host: identity.host,
    id: identity.id,
    owner: identity.owner,
    name: identity.name,
    webUrl: identity.webUrl,
    cloneUrl: identity.cloneUrl,
    origin,
  };
}

function meta(
  repository: ProviderRepositoryIdentity,
  overrides: Partial<ProviderPullRequestMetadata> & Pick<ProviderPullRequestMetadata, "number" | "title">,
): ProviderPullRequestMetadata {
  return {
    provider: repository.provider,
    host: repository.host,
    repository,
    webUrl:
      repository.provider === "github"
        ? `${repository.webUrl}/pull/${overrides.number}`
        : `${repository.webUrl}/pullrequest/${overrides.number}`,
    sourceRef: "refs/heads/feature/review-me",
    targetRef: "refs/heads/develop",
    sourceCommit: SHA_A,
    targetCommit: SHA_B,
    isDraft: false,
    status: "active",
    author: "Ada",
    isReviewer: true,
    isAuthor: false,
    updatedAt: "2026-09-16T11:00:00.000Z",
    ...overrides,
  };
}

function memoryConfigured(initial: ConfiguredRepositoryRecord[]): ConfiguredRepositoryPort {
  let rows = initial.map((row) => ({ ...row }));
  return {
    list: async () => rows.map((row) => ({ ...row })),
    add: async (input) => {
      rows = rows.filter(
        (row) => !(row.provider === input.provider && row.host === input.host && row.id === input.id),
      );
      rows.push({ ...input });
      return { ok: true as const };
    },
    remove: async (id) => {
      rows = rows.filter((row) => row.id !== id);
      return { ok: true as const };
    },
  };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function withStore(fn: () => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "gpr-07-06-refresh-"));
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

function fakeReaders(options: {
  list: Record<string, () => Promise<ProviderPullRequestMetadata[]>>;
  get?: Record<string, () => Promise<ProviderPullRequestMetadata>>;
  listCalls?: string[];
  getCalls?: string[];
}): { ado: ProviderPullRequestReader; github: ProviderPullRequestReader } {
  const listCalls = options.listCalls ?? [];
  const getCalls = options.getCalls ?? [];
  function reader(provider: ProviderRepositoryIdentity["provider"]): ProviderPullRequestReader {
    return {
      async listPullRequests(repository) {
        listCalls.push(`${provider}:${repository.id}`);
        const run = options.list[repository.id];
        if (!run) throw new Error(`unexpected list ${repository.id}`);
        return run();
      },
      async getPullRequest(input) {
        const key = `${input.repository.id}:${input.number}`;
        getCalls.push(key);
        const run = options.get?.[key];
        if (!run) throw new Error(`unexpected get ${key}`);
        return run();
      },
    };
  }
  return { ado: reader("azure-devops"), github: reader("github") };
}

function refreshService(options: {
  configured: ConfiguredRepositoryRecord[];
  readers: { ado: ProviderPullRequestReader; github: ProviderPullRequestReader };
  now: () => number;
}) {
  const configured = memoryConfigured(options.configured);
  const repositories = createConfiguredRepositoryService({
    configured,
    collectionPresent: async () => true,
    originRemoteUrl: async () => undefined,
    readers: {
      ado: { getRepository: async () => ADO },
      github: { getRepository: async () => GITHUB },
    },
  });
  return createCatalogRefreshService({
    listRepositories: () => repositories.list(),
    replaceCatalog: createCatalogService(jsonRepositories).replace,
    listReviews: jsonRepositories.listReviews,
    readers: options.readers,
    now: options.now,
  });
}

test("catalog refresh stale window is 60 seconds in one shared constant", () => {
  assert.equal(CATALOG_REFRESH_STALE_MS, 60_000);
});

test("startup and manual refresh both providers through fake readers without queuing an agent", async () => {
  await withStore(async () => {
    const listCalls: string[] = [];
    const adoOpen = meta(ADO, { number: 1101, title: "ADO open", isReviewer: true, isAuthor: false });
    const ghOpen = meta(GITHUB, { number: 42, title: "GitHub open", isReviewer: false, isAuthor: true });
    let now = T0;
    const service = refreshService({
      configured: [record(ADO, true), record(GITHUB, false)],
      readers: fakeReaders({
        listCalls,
        list: {
          [ADO.id]: async () => [adoOpen],
          [GITHUB.id]: async () => [ghOpen],
        },
      }),
      now: () => now,
    });
    await service.refresh({ reason: "startup" });
    const listed = await listReviews();
    assert.equal(listed.actions.length, 0);
    const adoSnap = listed.catalog.find((row) => row.repository.id === ADO.id);
    const ghSnap = listed.catalog.find((row) => row.repository.id === GITHUB.id);
    assert.equal(adoSnap?.pullRequests[0]?.title, "ADO open");
    assert.equal(adoSnap?.syncedAt, new Date(T0).toISOString());
    assert.equal(adoSnap?.error, undefined);
    assert.equal(ghSnap?.pullRequests[0]?.title, "GitHub open");
    assert.equal(ghSnap?.provider, "github");
    const configured = listed.repositories.find((row) => row.id === ADO.id);
    assert.equal(configured?.cloneUrl, ADO.cloneUrl);
    const overview = projectHomeOverview(listed.reviews, listed.catalog);
    assert.deepEqual(overview.groups.map((group) => group.id), []);
    assert.equal(overview.lastSynced, new Date(T0).toISOString());
    now = T0 + 1_000;
    await service.refresh({ reason: "manual" });
    assert.deepEqual(listCalls, [
      `azure-devops:${ADO.id}`,
      `github:${GITHUB.id}`,
      `azure-devops:${ADO.id}`,
      `github:${GITHUB.id}`,
    ]);
  });
});

test("focus inside 60 seconds skips provider calls; focus at 60 seconds refreshes", async () => {
  await withStore(async () => {
    const listCalls: string[] = [];
    let now = T0;
    const service = refreshService({
      configured: [record(ADO, true)],
      readers: fakeReaders({
        listCalls,
        list: {
          [ADO.id]: async () => [meta(ADO, { number: 1, title: "One" })],
        },
      }),
      now: () => now,
    });
    await service.refresh({ reason: "startup" });
    now = T0 + CATALOG_REFRESH_STALE_MS - 1;
    const skipped = await service.refresh({ reason: "focus" });
    assert.equal(skipped.skipped, true);
    now = T0 + CATALOG_REFRESH_STALE_MS;
    const ran = await service.refresh({ reason: "focus" });
    assert.equal(ran.skipped, false);
    assert.deepEqual(listCalls, [`azure-devops:${ADO.id}`, `azure-devops:${ADO.id}`]);
    now = T0 + CATALOG_REFRESH_STALE_MS + 5_000;
    await service.refresh({ reason: "manual" });
    assert.equal(listCalls.length, 3);
  });
});

test("overlapping startup, focus, and manual share one in-flight provider round", async () => {
  await withStore(async () => {
    const listCalls: string[] = [];
    const gate = deferred<ProviderPullRequestMetadata[]>();
    let now = T0;
    const service = refreshService({
      configured: [record(ADO, true), record(GITHUB, false)],
      readers: fakeReaders({
        listCalls,
        list: {
          [ADO.id]: async () => gate.promise,
          [GITHUB.id]: async () => [meta(GITHUB, { number: 7, title: "GH" })],
        },
      }),
      now: () => now,
    });
    const first = service.refresh({ reason: "startup" });
    const second = service.refresh({ reason: "focus" });
    const third = service.refresh({ reason: "manual" });
    gate.resolve([meta(ADO, { number: 1, title: "ADO" })]);
    const [a, b, c] = await Promise.all([first, second, third]);
    assert.equal(a.skipped, false);
    assert.equal(b.skipped, false);
    assert.equal(c.skipped, false);
    assert.deepEqual(
      [...listCalls].sort(),
      [`azure-devops:${ADO.id}`, `github:${GITHUB.id}`].sort(),
    );
  });
});

test("one repository auth failure keeps the other snapshot and prior failed data with attempted time", async () => {
  await withStore(async () => {
    await replaceCatalog({
      origin: true,
      repository: {
        provider: ADO.provider,
        host: ADO.host,
        id: ADO.id,
        owner: ADO.owner,
        name: ADO.name,
        webUrl: ADO.webUrl,
      },
      syncedAt: "2026-09-14T12:00:00.000Z",
      pullRequests: [
        {
          provider: ADO.provider,
          host: ADO.host,
          repository: {
            id: ADO.id,
            owner: ADO.owner,
            name: ADO.name,
            webUrl: ADO.webUrl,
          },
          number: 1101,
          title: "Prior ADO",
          webUrl: `${ADO.webUrl}/pullrequest/1101`,
          sourceRef: "refs/heads/feature/review-me",
          targetRef: "refs/heads/develop",
          sourceCommit: SHA_A,
          targetCommit: SHA_B,
          isDraft: false,
          status: "active",
          author: "Ada",
          isReviewer: true,
          isAuthor: false,
          updatedAt: "2026-09-14T11:00:00.000Z",
        },
      ],
    });
    const saved = await addReview(
      GuideV1.parse({
        version: 1,
        title: "Saved guide",
        base: SHA_B,
        head: SHA_A,
        range: "develop...feature/review-me",
        chapters: [
          {
            id: "core",
            kind: "core",
            title: "Core",
            why: "The behavior change.",
            files: [{ path: "a.py", stub: true, reason: "placeholder" }],
          },
        ],
      }),
    );
    let now = T0;
    const service = refreshService({
      configured: [record(ADO, true), record(GITHUB, false)],
      readers: fakeReaders({
        list: {
          [ADO.id]: async () => {
            throw new ProviderError({ code: "auth", provider: "azure-devops", host: ADO.host });
          },
          [GITHUB.id]: async () => [meta(GITHUB, { number: 9, title: "GH ok" })],
        },
      }),
      now: () => now,
    });
    await service.refresh({ reason: "manual" });
    const listed = await listReviews();
    assert.equal(listed.reviews[0].id, saved.id);
    const adoSnap = listed.catalog.find((row) => row.repository.id === ADO.id);
    const ghSnap = listed.catalog.find((row) => row.repository.id === GITHUB.id);
    assert.equal(adoSnap?.pullRequests[0]?.title, "Prior ADO");
    assert.equal(adoSnap?.syncedAt, "2026-09-14T12:00:00.000Z");
    assert.equal(adoSnap?.attemptedAt, new Date(T0).toISOString());
    assert.equal(
      adoSnap?.error,
      "Could not refresh the PR list. Check az login, the organization, and the project.",
    );
    assert.equal(ghSnap?.pullRequests[0]?.title, "GH ok");
    assert.equal(ghSnap?.error, undefined);
    const overview = projectHomeOverview(listed.reviews, listed.catalog);
    assert.ok(overview.catalogErrors.some((row) => row.message.includes("az login")));
    now = T0 + CATALOG_REFRESH_STALE_MS;
    const ghFail = refreshService({
      configured: [record(ADO, true), record(GITHUB, false)],
      readers: fakeReaders({
        list: {
          [ADO.id]: async () => [meta(ADO, { number: 1101, title: "ADO recovered" })],
          [GITHUB.id]: async () => {
            throw new GithubProviderError("unauthorized", "GitHub authentication failed");
          },
        },
      }),
      now: () => now,
    });
    await ghFail.refresh({ reason: "manual" });
    const after = await listReviews();
    const ghAfter = after.catalog.find((row) => row.repository.id === GITHUB.id);
    assert.equal(ghAfter?.pullRequests[0]?.title, "GH ok");
    assert.equal(
      ghAfter?.error,
      "Could not refresh the PR list. Check gh auth login and the repository access.",
    );
    assert.equal(after.reviews[0].id, saved.id);
    const dumped = JSON.stringify(after);
    assert.equal(dumped.includes("token"), false);
    assert.equal(dumped.includes("gho_"), false);
  });
});

test("a busy host asks to try the PR list refresh again later", async () => {
  await withStore(async () => {
    const service = refreshService({
      configured: [record(ADO, true)],
      readers: fakeReaders({
        list: {
          [ADO.id]: async () => {
            throw new ProviderError({ code: "rate", provider: "azure-devops", host: ADO.host });
          },
        },
      }),
      now: () => T0,
    });
    await service.refresh({ reason: "manual" });
    const listed = await listReviews();
    const snap = listed.catalog.find((row) => row.repository.id === ADO.id);
    assert.equal(snap?.error, "Could not refresh the PR list. Try again later.");
  });
});

test("closed saved PRs archive; closed unsaved catalog items disappear", async () => {
  await withStore(async () => {
    const savedClosed = await addReview(
      GuideV1.parse({
        version: 1,
        title: "Saved closed",
        base: SHA_B,
        head: SHA_C,
        range: "develop...feature/closed",
        chapters: [
          {
            id: "core",
            kind: "core",
            title: "Core",
            why: "The behavior change.",
            files: [{ path: "closed.py", stub: true, reason: "placeholder" }],
          },
        ],
        source: {
          kind: "pull-request",
          provider: "azure-devops",
          host: ADO.host,
          repository: {
            id: ADO.id,
            owner: ADO.owner,
            name: ADO.name,
            webUrl: ADO.webUrl,
          },
          number: 88,
          webUrl: `${ADO.webUrl}/pullrequest/88`,
          sourceRef: "refs/heads/feature/closed",
          targetRef: "refs/heads/develop",
          sourceCommit: SHA_C,
          targetCommit: SHA_B,
          providerContext: {
            kind: "azure-devops",
            project: "BRAID",
            firstComparingIteration: 0,
            secondComparingIteration: 1,
            changes: {},
          },
        },
      }),
    );
    await jsonConfiguredRepositories.add(record(ADO, true));
    await jsonConfiguredRepositories.add(record(GITHUB, false));
    await replaceCatalog({
      origin: false,
      repository: {
        provider: GITHUB.provider,
        host: GITHUB.host,
        id: GITHUB.id,
        owner: GITHUB.owner,
        name: GITHUB.name,
        webUrl: GITHUB.webUrl,
      },
      syncedAt: "2026-09-14T12:00:00.000Z",
      pullRequests: [
        {
          provider: "github",
          host: GITHUB.host,
          repository: {
            id: GITHUB.id,
            owner: GITHUB.owner,
            name: GITHUB.name,
            webUrl: GITHUB.webUrl,
          },
          number: 3,
          title: "Unsaved closed GitHub",
          webUrl: `${GITHUB.webUrl}/pull/3`,
          sourceRef: "refs/heads/feature/gone",
          targetRef: "refs/heads/main",
          sourceCommit: SHA_A,
          targetCommit: SHA_B,
          isDraft: false,
          status: "active",
          author: "Ada",
          isReviewer: true,
          isAuthor: false,
          updatedAt: "2026-09-14T11:00:00.000Z",
        },
      ],
    });
    const getCalls: string[] = [];
    const service = refreshService({
      configured: [record(ADO, true), record(GITHUB, false)],
      readers: fakeReaders({
        getCalls,
        list: {
          [ADO.id]: async () => [meta(ADO, { number: 1101, title: "Still open", isReviewer: true })],
          [GITHUB.id]: async () => [],
        },
        get: {
          [`${ADO.id}:88`]: async () =>
            meta(ADO, {
              number: 88,
              title: "Saved closed",
              status: "completed",
              isReviewer: true,
              sourceCommit: SHA_C,
            }),
        },
      }),
      now: () => T0,
    });
    await service.refresh({ reason: "startup" });
    const listed = await listReviews();
    assert.equal(listed.reviews[0].id, savedClosed.id);
    const adoSnap = listed.catalog.find((row) => row.repository.id === ADO.id);
    const ghSnap = listed.catalog.find((row) => row.repository.id === GITHUB.id);
    assert.ok(adoSnap?.pullRequests.some((row) => row.number === 88 && row.status === "completed"));
    assert.ok(adoSnap?.pullRequests.some((row) => row.number === 1101));
    assert.equal(ghSnap?.pullRequests.some((row) => row.number === 3), false);
    const overview = projectHomeOverview(listed.reviews, listed.catalog);
    const archived = overview.groups.find((group) => group.id === "archived");
    assert.ok(archived?.cards.some((card) => card.reviewId === savedClosed.id));
    assert.equal(
      overview.groups.some((group) => group.cards.some((card) => card.title === "Unsaved closed GitHub")),
      false,
    );
    assert.deepEqual(getCalls, [`${ADO.id}:88`]);
  });
});

test("failed startup refresh does not latch later handle or manual refresh", async () => {
  await withStore(async () => {
    let failList = true;
    let listCalls = 0;
    const service = refreshService({
      configured: [record(ADO, true)],
      readers: fakeReaders({
        list: {
          [ADO.id]: async () => [meta(ADO, { number: 1, title: "Recovered" })],
        },
      }),
      now: () => T0,
    });
    const originalList = service.refresh;
    const latch = createCatalogStartupLatch(async () => {
      listCalls += 1;
      if (failList) throw new Error("listRepositories failed");
      return originalList({ reason: "startup" });
    });
    await latch();
    assert.equal(listCalls, 1);
    const afterFail = await listReviews();
    assert.equal(afterFail.catalog.length, 0);
    failList = false;
    await latch();
    assert.equal(listCalls, 2);
    const afterHandle = await listReviews();
    assert.equal(afterHandle.catalog[0]?.pullRequests[0]?.title, "Recovered");
    const manual = await service.refresh({ reason: "manual" });
    assert.equal(manual.skipped, false);
  });
});

test("hooks.server.ts startup handle resolves without awaiting catalog refresh", async () => {
  const dir = await mkdtemp(join(tmpdir(), "gpr-09-04-hooks-"));
  const prev = process.env.GUIDED_PR_REVIEW_DATA;
  process.env.GUIDED_PR_REVIEW_DATA = dir;
  resetJsonStoreCache();
  try {
    const { handle } = await import("../../../hooks.server.ts");
    const { appServices } = await import("../runtime.ts");
    const gate = deferred<{ skipped: boolean }>();
    let refreshDone = false;
    appServices.catalogRefresh.refresh = async () => {
      await gate.promise;
      refreshDone = true;
      return { skipped: false };
    };
    const response = await handle({
      event: { url: new URL("http://localhost/") } as never,
      resolve: async () => new Response("ok"),
    });
    assert.equal(refreshDone, false);
    assert.equal(await response.text(), "ok");
    gate.resolve({ skipped: false });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(refreshDone, true);
  } finally {
    resetJsonStoreCache();
    if (prev === undefined) delete process.env.GUIDED_PR_REVIEW_DATA;
    else process.env.GUIDED_PR_REVIEW_DATA = prev;
    await rm(dir, { recursive: true, force: true });
  }
});

test("catalog refresh stays light and never writes a saved diff", async () => {
  await withStore(async () => {
    const guide = GuideV1.parse({
      version: 1,
      title: "Pre-epic",
      base: SHA_B,
      head: SHA_A,
      chapters: [
        {
          id: "core",
          kind: "core",
          title: "Core",
          why: "Why",
          files: [
            {
              path: "a.ts",
              language: "typescript",
              hunks: [{ lines: [{ type: "added", content: "x", newLine: 1 }] }],
            },
          ],
        },
      ],
      source: {
        kind: "pull-request",
        provider: "azure-devops",
        host: "dev.azure.com",
        repository: {
          id: ADO.id,
          owner: ADO.owner,
          name: ADO.name,
          webUrl: ADO.webUrl,
        },
        number: 1101,
        webUrl: `${ADO.webUrl}/pullrequest/1101`,
        sourceRef: "refs/heads/feature/review-me",
        targetRef: "refs/heads/develop",
        sourceCommit: SHA_A,
        targetCommit: SHA_B,
        providerContext: {
          kind: "azure-devops",
          project: "BRAID",
          firstComparingIteration: 0,
          secondComparingIteration: 1,
          changes: {},
        },
      },
    });
    await addReview(guide);
    const service = refreshService({
      configured: [record(ADO, true)],
      readers: fakeReaders({
        list: {
          [ADO.id]: async () => [
            meta(ADO, {
              number: 1101,
              title: "Pre-epic",
              sourceCommit: SHA_C,
              isReviewer: true,
            }),
            meta(ADO, {
              number: 1106,
              title: "New without review",
              isReviewer: true,
            }),
          ],
        },
      }),
      now: () => T0,
    });
    await service.refresh({ reason: "focus" });
    await service.refresh({ reason: "manual" });
    const listed = await listReviews();
    assert.equal(listed.reviews.length, 1);
    assert.equal(listed.reviews[0].diffCommit, undefined);
    const got = await jsonRepositories.getReview(listed.reviews[0].id);
    assert.equal(got.diff, undefined);
    const overview = projectHomeOverview(listed.reviews, listed.catalog);
    assert.equal(
      overview.groups.some((group) =>
        group.cards.some((card) => card.title === "New without review"),
      ),
      false,
    );
  });
});
