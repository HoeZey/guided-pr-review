import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { ProviderError } from "../providers/errors.ts";
import { GithubProviderError } from "../providers/github/rest.ts";
import type { ProviderRepositoryIdentity, ProviderRepositoryReader } from "../providers/ports.ts";
import type {
  ConfiguredRepositoryPort,
  ConfiguredRepositoryRecord,
} from "../repositories/ports.ts";
import {
  addReview,
  getReview,
  jsonConfiguredRepositories,
  jsonRepositories,
  listReviews,
  publishReviewOutcome,
  replaceCatalog,
  resetJsonStoreCache,
} from "../repositories/json/store.ts";
import { configuredRepositoriesCollectionPresent } from "../repositories/json/file.ts";
import { GuideV1 } from "../../shared/contracts/guide.ts";
import { createHttpHandlers } from "../http.ts";
import { createAppServices } from "./app.ts";
import {
  ConfiguredRepositoryError,
  createCliHostRepositoryLister,
  createConfiguredRepositoryService,
  parseGitRemote,
  readGitOriginUrl,
} from "./configured-repositories.ts";

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

function record(
  identity: ProviderRepositoryIdentity,
  origin: boolean,
): ConfiguredRepositoryRecord {
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

function memoryConfigured(initial?: ConfiguredRepositoryRecord[]): ConfiguredRepositoryPort & {
  present: () => boolean;
} {
  let rows = initial ? [...initial] : [];
  let present = initial !== undefined;
  return {
    present: () => present,
    list: async () => rows.map((row) => ({ ...row })),
    add: async (input) => {
      present = true;
      rows = rows.filter(
        (row) => !(row.provider === input.provider && row.host === input.host && row.id === input.id),
      );
      rows.push({ ...input });
      return { ok: true as const };
    },
    remove: async (id) => {
      present = true;
      rows = rows.filter((row) => row.id !== id);
      return { ok: true as const };
    },
  };
}

function readers(known: ProviderRepositoryIdentity[]): {
  ado: ProviderRepositoryReader;
  github: ProviderRepositoryReader;
} {
  async function lookup(
    provider: ProviderRepositoryIdentity["provider"],
    input: { host: string; owner: string; name: string },
  ): Promise<ProviderRepositoryIdentity> {
    const found = known.find(
      (row) =>
        row.provider === provider &&
        row.host === input.host &&
        row.owner === input.owner &&
        row.name === input.name,
    );
    if (!found) {
      if (provider === "github") {
        throw new GithubProviderError("not-found", "GitHub repository or pull request was not found");
      }
      throw new ProviderError({ code: "not-found", provider, host: input.host });
    }
    return found;
  }
  return {
    ado: { getRepository: (input) => lookup("azure-devops", input) },
    github: { getRepository: (input) => lookup("github", input) },
  };
}

function service(options: {
  configured?: ReturnType<typeof memoryConfigured>;
  origin?: string;
  known?: ProviderRepositoryIdentity[];
  ado?: ProviderRepositoryReader;
  github?: ProviderRepositoryReader;
}) {
  const configured = options.configured ?? memoryConfigured();
  const known = options.known ?? [ADO, GITHUB];
  const pair = readers(known);
  return createConfiguredRepositoryService({
    configured,
    collectionPresent: async () => configured.present(),
    originRemoteUrl: async () => options.origin,
    readers: {
      ado: options.ado ?? pair.ado,
      github: options.github ?? pair.github,
    },
  });
}


test("parseGitRemote maps supported ADO and GitHub remotes and rejects other hosts", () => {
  assert.deepEqual(
    parseGitRemote("https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer"),
    {
      provider: "azure-devops",
      host: "dev.azure.com",
      owner: "braidteam/BRAID",
      name: "braid-connection-designer",
    },
  );
  assert.deepEqual(
    parseGitRemote("https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer.git"),
    {
      provider: "azure-devops",
      host: "dev.azure.com",
      owner: "braidteam/BRAID",
      name: "braid-connection-designer",
    },
  );
  assert.deepEqual(parseGitRemote("git@ssh.dev.azure.com:v3/braidteam/BRAID/braid-connection-designer"), {
    provider: "azure-devops",
    host: "dev.azure.com",
    owner: "braidteam/BRAID",
    name: "braid-connection-designer",
  });
  assert.deepEqual(
    parseGitRemote("https://braidteam.visualstudio.com/BRAID/_git/braid-connection-designer"),
    {
      provider: "azure-devops",
      host: "braidteam.visualstudio.com",
      owner: "braidteam/BRAID",
      name: "braid-connection-designer",
    },
  );
  assert.deepEqual(parseGitRemote("https://github.com/octocat/Hello-World.git"), {
    provider: "github",
    host: "github.com",
    owner: "octocat",
    name: "Hello-World",
  });
  assert.deepEqual(parseGitRemote("git@github.com:octocat/Hello-World.git"), {
    provider: "github",
    host: "github.com",
    owner: "octocat",
    name: "Hello-World",
  });
  assert.equal(parseGitRemote(undefined), undefined);
  assert.equal(parseGitRemote(""), undefined);
  assert.equal(parseGitRemote("https://bitbucket.org/octocat/Hello-World.git"), undefined);
});

test("readGitOriginUrl returns a trimmed remote and ignores git failures", async () => {
  assert.equal(
    await readGitOriginUrl({
      async run() {
        return {
          code: 0,
          stdout: " https://github.com/octocat/Hello-World.git \n",
          stderr: "",
          timedOut: false,
          commandMissing: false,
        };
      },
    }),
    "https://github.com/octocat/Hello-World.git",
  );
  assert.equal(
    await readGitOriginUrl({
      async run() {
        return {
          code: 1,
          stdout: "https://github.com/octocat/Hello-World.git",
          stderr: "fatal",
          timedOut: false,
          commandMissing: false,
        };
      },
    }),
    undefined,
  );
});

test("supported current origin appears once without a manual add", async () => {
  const configured = memoryConfigured();
  const repos = service({
    configured,
    origin: "git@ssh.dev.azure.com:v3/braidteam/BRAID/braid-connection-designer",
  });
  const first = await repos.list();
  assert.deepEqual(first.repositories, [record(ADO, true)]);
  assert.equal(first.error, undefined);
  const second = await repos.list();
  assert.deepEqual(second.repositories, [record(ADO, true)]);
  assert.equal((await configured.list()).length, 1);
});

test("valid ADO and GitHub repositories persist with stable provider identity", async () => {
  const repos = service({ origin: undefined, configured: memoryConfigured([]) });
  const ado = await repos.add({
    url: "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer",
  });
  const github = await repos.add({
    provider: "github",
    host: "github.com",
    owner: "octocat",
    name: "Hello-World",
  });
  assert.deepEqual(ado.repository, record(ADO, false));
  assert.deepEqual(github.repository, record(GITHUB, false));
  const listed = await repos.list();
  assert.deepEqual(listed.repositories, [record(ADO, false), record(GITHUB, false)]);
});

test("duplicate aliases cannot create duplicate configured rows", async () => {
  const repos = service({
    configured: memoryConfigured([]),
    origin: undefined,
  });
  await repos.add({ url: "https://github.com/octocat/Hello-World.git" });
  await assert.rejects(
    () => repos.add({ url: "git@github.com:octocat/Hello-World.git" }),
    (err: unknown) => {
      assert.ok(err instanceof ConfiguredRepositoryError);
      assert.equal(err.code, "duplicate");
      return true;
    },
  );
  const listed = await repos.list();
  assert.deepEqual(listed.repositories, [record(GITHUB, false)]);
});

test("invalid or inaccessible repositories are not persisted", async () => {
  const configured = memoryConfigured([]);
  const repos = service({
    configured,
    origin: undefined,
    ado: {
      async getRepository() {
        throw new ProviderError({ code: "auth", provider: "azure-devops", host: "dev.azure.com" });
      },
    },
    github: {
      async getRepository(input) {
        if (input.name === "missing") {
          throw new GithubProviderError(
            "not-found",
            "GitHub repository or pull request was not found",
          );
        }
        throw Object.assign(new Error("Access to this repository was denied"), { code: "denied" });
      },
    },
  });

  await assert.rejects(
    () => repos.add({ url: "https://bitbucket.org/octocat/Hello-World.git" }),
    (err: unknown) => err instanceof ConfiguredRepositoryError && err.code === "unsupported-host",
  );
  await assert.rejects(
    () =>
      repos.add({
        url: "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer",
      }),
    (err: unknown) => err instanceof ConfiguredRepositoryError && err.code === "auth",
  );
  await assert.rejects(
    () => repos.add({ url: "https://github.com/octocat/missing" }),
    (err: unknown) => err instanceof ConfiguredRepositoryError && err.code === "not-found",
  );
  await assert.rejects(
    () => repos.add({ url: "https://github.com/octocat/Hello-World" }),
    (err: unknown) => err instanceof ConfiguredRepositoryError && err.code === "denied",
  );
  assert.deepEqual(await configured.list(), []);
});

test("provider rate and availability failures are not mapped to auth", async () => {
  const cases: {
    reader: "ado" | "github";
    error: Error;
    url: string;
    code: "rate" | "unavailable" | "malformed-response";
    status: number;
  }[] = [
    {
      reader: "ado",
      error: new ProviderError({
        code: "rate",
        provider: "azure-devops",
        host: "dev.azure.com",
      }),
      url: "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer",
      code: "rate",
      status: 429,
    },
    {
      reader: "ado",
      error: new ProviderError({
        code: "unavailable",
        provider: "azure-devops",
        host: "dev.azure.com",
      }),
      url: "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer",
      code: "unavailable",
      status: 503,
    },
    {
      reader: "ado",
      error: new ProviderError({
        code: "malformed-response",
        provider: "azure-devops",
        host: "dev.azure.com",
      }),
      url: "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer",
      code: "malformed-response",
      status: 400,
    },
    {
      reader: "github",
      error: new GithubProviderError("rate-limited", "GitHub rate limit exceeded"),
      url: "https://github.com/octocat/Hello-World",
      code: "rate",
      status: 429,
    },
    {
      reader: "github",
      error: new GithubProviderError("unavailable", "GitHub is unavailable"),
      url: "https://github.com/octocat/Hello-World",
      code: "unavailable",
      status: 503,
    },
    {
      reader: "github",
      error: new GithubProviderError("malformed", "GitHub returned an unexpected response"),
      url: "https://github.com/octocat/Hello-World",
      code: "malformed-response",
      status: 400,
    },
  ];
  for (const row of cases) {
    const configured = memoryConfigured([]);
    const repos = service({
      configured,
      origin: undefined,
      ado:
        row.reader === "ado"
          ? {
              async getRepository() {
                throw row.error;
              },
            }
          : undefined,
      github:
        row.reader === "github"
          ? {
              async getRepository() {
                throw row.error;
              },
            }
          : undefined,
    });
    await assert.rejects(
      () => repos.add({ url: row.url }),
      (err: unknown) => {
        assert.ok(err instanceof ConfiguredRepositoryError);
        assert.equal(err.code, row.code);
        assert.equal(err.status, row.status);
        assert.notEqual(err.code, "auth");
        return true;
      },
    );
    assert.deepEqual(await configured.list(), []);
  }
});

test("removing configuration keeps saved reviews, outcomes, and catalog history", async () => {
  await withStore(async (dir) => {
    const guide = GuideV1.parse({
      version: 1,
      title: "One",
      base: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      head: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
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
    const saved = await addReview(guide);
    await publishReviewOutcome(saved.id, {
      version: 1,
      base: guide.base,
      head: guide.head,
      standards: { findings: [] },
      spec: { findings: [] },
    });
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
      pullRequests: [],
    });
    await jsonConfiguredRepositories.add(record(GITHUB, false));
    const repos = jsonService({ origin: undefined });
    await repos.remove(GITHUB.id);
    const listed = await listReviews();
    assert.equal(listed.reviews[0].id, saved.id);
    assert.equal(listed.catalog[0].repository.id, ADO.id);
    assert.equal(listed.catalog[0].syncedAt, "2026-09-14T12:00:00.000Z");
    const got = await getReview(saved.id);
    assert.equal(got.outcomes.length, 1);
    assert.deepEqual(
      (await jsonConfiguredRepositories.list()).map((row) => row.id),
      [ADO.id],
    );
    const raw = JSON.parse(await readFile(join(dir, "reviews.json"), "utf8")) as {
      reviews: unknown[];
      catalog: unknown[];
    };
    assert.equal(raw.reviews.length, 1);
    assert.equal(raw.catalog.length, 1);
  });
});

test("Store v1 without a repository collection loads lossless and migrates only when required", async () => {
  await withStore(async (dir) => {
    const file = join(dir, "reviews.json");
    const guide = {
      version: 1,
      title: "One",
      base: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      head: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
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
    };
    await writeFile(
      file,
      `${JSON.stringify({
        version: 1,
        activeId: "r1",
        reviews: [
          {
            id: "r1",
            addedAt: "2020-01-01T00:00:00.000Z",
            guide,
            outcomes: [
              {
                id: "o1",
                addedAt: "2020-01-02T00:00:00.000Z",
                outcome: {
                  version: 1,
                  base: guide.base,
                  head: guide.head,
                  standards: { findings: [] },
                  spec: { findings: [] },
                },
              },
            ],
          },
        ],
        catalog: [
          {
            provider: "azure-devops",
            host: "dev.azure.com",
            repository: {
              id: "repo-1",
              owner: "braidteam/BRAID",
              name: "braid-connection-designer",
              webUrl: "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer",
            },
            pullRequests: [],
          },
        ],
        actions: [
          {
            id: "a1",
            kind: "generate-guide",
            status: "queued",
            queuedAt: "2020-01-01T00:00:00.000Z",
            reviewId: "r1",
          },
        ],
      })}\n`,
    );
    resetJsonStoreCache();
    const listed = await listReviews();
    assert.equal(listed.reviews[0].id, "r1");
    assert.equal(listed.reviews[0].title, "One");
    assert.equal(listed.catalog[0].repository.id, "repo-1");
    assert.equal(listed.actions[0].id, "a1");
    const got = await getReview("r1");
    assert.equal(got.outcomes[0].id, "o1");
    assert.equal("repositories" in JSON.parse(await readFile(file, "utf8")), false);

    await addReview(
      GuideV1.parse({
        ...guide,
        title: "Two",
        range: "main...two",
      }),
    );
    assert.equal("repositories" in JSON.parse(await readFile(file, "utf8")), false);

    const repos = jsonService({
      origin: "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer",
    });
    const first = await repos.list();
    assert.deepEqual(first.repositories, [record(ADO, true)]);
    const persisted = JSON.parse(await readFile(file, "utf8")) as { repositories: unknown[] };
    assert.equal(persisted.repositories.length, 1);
    const second = await repos.list();
    assert.deepEqual(second.repositories, first.repositories);
    assert.equal((await listReviews()).reviews.length, 2);
    assert.equal((await getReview("r1")).outcomes[0].id, "o1");
  });
});

async function withStore(fn: (dir: string) => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "gpr-07-04-"));
  const prev = process.env.GUIDED_PR_REVIEW_DATA;
  process.env.GUIDED_PR_REVIEW_DATA = dir;
  resetJsonStoreCache();
  try {
    await fn(dir);
  } finally {
    resetJsonStoreCache();
    if (prev === undefined) delete process.env.GUIDED_PR_REVIEW_DATA;
    else process.env.GUIDED_PR_REVIEW_DATA = prev;
    await rm(dir, { recursive: true, force: true });
  }
}

function jsonService(options: { origin?: string }) {
  const pair = readers([ADO, GITHUB]);
  return createConfiguredRepositoryService({
    configured: jsonConfiguredRepositories,
    collectionPresent: async () => configuredRepositoriesCollectionPresent(),
    originRemoteUrl: async () => options.origin,
    readers: pair,
  });
}

test("HTTP repository handlers use the service without agent actions", async () => {
  await withStore(async () => {
    const pair = readers([ADO, GITHUB]);
    let adoScope: { organization: string; project: string } | undefined;
    const http = createHttpHandlers(
      createAppServices(jsonRepositories, {
        configured: jsonConfiguredRepositories,
        collectionPresent: async () => configuredRepositoriesCollectionPresent(),
        originRemoteUrl: async () =>
          "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer",
        readers: pair,
        hostList: {
          listGithub: async () => [
            {
              provider: "github",
              host: "github.com",
              owner: "octocat",
              name: "Hello-World",
              webUrl: "https://github.com/octocat/Hello-World",
            },
          ],
          listAdo: async (scope?: { organization: string; project: string }) => {
            adoScope = scope;
            return [
              {
                provider: "azure-devops",
                host: "dev.azure.com",
                owner: "braidteam/BRAID",
                name: "braid-connection-designer",
                webUrl: ADO.webUrl,
              },
            ];
          },
        },
      }),
    );
    const listed = await http.repositories.GET();
    assert.equal(listed.status, 200);
    const listedBody = (await listed.json()) as { repositories: ConfiguredRepositoryRecord[] };
    assert.deepEqual(listedBody.repositories, [record(ADO, true)]);

    const searched = await http.repositories.SEARCH({
      request: new Request("http://localhost/api/repositories/search?q=Hello"),
      params: {},
    });
    assert.equal(searched.status, 200);
    const searchedBody = (await searched.json()) as {
      repositories: { provider: string; owner: string; name: string }[];
    };
    assert.deepEqual(
      searchedBody.repositories.map((row) => `${row.provider}:${row.owner}/${row.name}`),
      ["github:octocat/Hello-World"],
    );
    assert.equal(adoScope, undefined);
    const scoped = await http.repositories.SEARCH({
      request: new Request(
        "http://localhost/api/repositories/search?organization=braidteam&project=BRAID",
      ),
      params: {},
    });
    assert.equal(scoped.status, 200);
    assert.deepEqual(adoScope, { organization: "braidteam", project: "BRAID" });

    const created = await http.repositories.POST({
      request: new Request("http://localhost/api/repositories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "https://github.com/octocat/Hello-World.git" }),
      }),
      params: {},
    });
    assert.equal(created.status, 201);
    const createdBody = (await created.json()) as { repository: ConfiguredRepositoryRecord };
    assert.deepEqual(createdBody.repository, record(GITHUB, false));

    const duplicate = await http.repositories.POST({
      request: new Request("http://localhost/api/repositories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "git@github.com:octocat/Hello-World.git" }),
      }),
      params: {},
    });
    assert.equal(duplicate.status, 409);
    assert.deepEqual(await duplicate.json(), {
      error: "This repository is already configured",
    });

    const unsupported = await http.repositories.POST({
      request: new Request("http://localhost/api/repositories", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: "https://bitbucket.org/octocat/Hello-World.git" }),
      }),
      params: {},
    });
    assert.equal(unsupported.status, 400);

    const removed = await http.repositories.DELETE({
      request: new Request(`http://localhost/api/repositories/${GITHUB.id}`, { method: "DELETE" }),
      params: { id: GITHUB.id },
    });
    assert.equal(removed.status, 200);
    const after = await http.repositories.GET();
    const afterBody = (await after.json()) as { repositories: ConfiguredRepositoryRecord[] };
    assert.deepEqual(afterBody.repositories, [record(ADO, true)]);
  });
});

test("listing origin after same-process replace_catalog does not report duplicate", async () => {
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
      pullRequests: [],
    });
    const pair = readers([ADO, GITHUB]);
    const originUrl = "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer";
    const listed = await jsonService({ origin: originUrl }).list();
    assert.equal(listed.error, undefined);
    assert.equal(listed.repositories.filter((row) => row.origin).length, 1);
    assert.equal(listed.repositories.filter((row) => row.id === ADO.id).length, 1);

    const http = createHttpHandlers(
      createAppServices(jsonRepositories, {
        configured: jsonConfiguredRepositories,
        collectionPresent: async () => configuredRepositoriesCollectionPresent(),
        originRemoteUrl: async () => originUrl,
        readers: pair,
      }),
    );
    const got = await http.repositories.GET();
    assert.equal(got.status, 200);
    const body = (await got.json()) as {
      repositories: ConfiguredRepositoryRecord[];
      error?: { code: string; message: string };
    };
    assert.equal(body.error, undefined);
    assert.equal(body.repositories.filter((row) => row.origin).length, 1);
    assert.equal(body.repositories.filter((row) => row.id === ADO.id).length, 1);
  });
});


test("search lists repos from fake gh and az scoped lists and filters by query", async () => {
  const repos = createConfiguredRepositoryService({
    configured: memoryConfigured([]),
    collectionPresent: async () => true,
    originRemoteUrl: async () => undefined,
    readers: readers([ADO, GITHUB]),
    hostList: {
      listGithub: async () => [
        {
          provider: "github",
          host: "github.com",
          owner: "octocat",
          name: "Hello-World",
          webUrl: "https://github.com/octocat/Hello-World",
        },
        {
          provider: "github",
          host: "github.com",
          owner: "octocat",
          name: "Spoon-Knife",
          webUrl: "https://github.com/octocat/Spoon-Knife",
        },
      ],
      listAdo: async () => [
        {
          provider: "azure-devops",
          host: "dev.azure.com",
          owner: "braidteam/BRAID",
          name: "braid-connection-designer",
          webUrl: "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer",
        },
        {
          provider: "azure-devops",
          host: "dev.azure.com",
          owner: "braidteam/BRAID",
          name: "braid-frontend",
          webUrl: "https://dev.azure.com/braidteam/BRAID/_git/braid-frontend",
        },
      ],
    },
  });
  const all = await repos.search();
  assert.equal(all.error, undefined);
  assert.equal(all.repositories.length, 4);
  const filtered = await repos.search("braid-front");
  assert.deepEqual(
    filtered.repositories.map((row) => `${row.owner}/${row.name}`),
    ["braidteam/BRAID/braid-frontend"],
  );
  const github = await repos.search("hello");
  assert.deepEqual(
    github.repositories.map((row) => `${row.owner}/${row.name}`),
    ["octocat/Hello-World"],
  );
});

test("failed gh or az list leaves configured repositories and returns search error", async () => {
  const configured = memoryConfigured([record(ADO, true)]);
  const repos = createConfiguredRepositoryService({
    configured,
    collectionPresent: async () => true,
    originRemoteUrl: async () => undefined,
    readers: readers([ADO, GITHUB]),
    hostList: {
      listGithub: async () => {
        throw new Error("gh list failed");
      },
      listAdo: async () => {
        throw new Error("az list failed");
      },
    },
  });
  const listed = await repos.list();
  assert.deepEqual(listed.repositories, [record(ADO, true)]);
  assert.equal(listed.error, undefined);
  const searched = await repos.search("braid");
  assert.deepEqual(searched.repositories, []);
  assert.equal(searched.error?.code, "unavailable");
  assert.match(searched.error?.message ?? "", /list failed/);
});

test("createConfiguredRepositoryService search uses createCliHostRepositoryLister over fake gh and az", async () => {
  let configureCalls = 0;
  const runner = {
    async run(request: { argv: readonly string[] }) {
      const argv = request.argv;
      if (argv[0] === "gh" && argv[1] === "repo" && argv[2] === "list") {
        return {
          code: 0,
          stdout: JSON.stringify([
            {
              name: "Hello-World",
              owner: { login: "octocat" },
              url: "https://github.com/octocat/Hello-World",
              nameWithOwner: "octocat/Hello-World",
            },
          ]),
          stderr: "",
          timedOut: false,
          commandMissing: false,
        };
      }
      if (argv[0] === "az" && argv[1] === "devops" && argv[2] === "configure") {
        configureCalls += 1;
        return {
          code: 0,
          stdout: "[defaults]\norganization = https://dev.azure.com/braidteam\nproject = BRAID\n",
          stderr: "",
          timedOut: false,
          commandMissing: false,
        };
      }
      if (argv[0] === "az" && argv[1] === "repos" && argv[2] === "list") {
        const organization = argv[argv.indexOf("--organization") + 1];
        const project = argv[argv.indexOf("--project") + 1];
        if (organization === "https://dev.azure.com/contoso") {
          assert.equal(project, "Widgets");
          return {
            code: 0,
            stdout: JSON.stringify([
              {
                name: "widget-api",
                webUrl: "https://dev.azure.com/contoso/Widgets/_git/widget-api",
                project: { name: "Widgets" },
              },
            ]),
            stderr: "",
            timedOut: false,
            commandMissing: false,
          };
        }
        assert.equal(organization, "https://dev.azure.com/braidteam");
        assert.equal(project, "BRAID");
        return {
          code: 0,
          stdout: JSON.stringify([
            {
              name: "braid-connection-designer",
              webUrl: "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer",
              project: { name: "BRAID" },
            },
          ]),
          stderr: "",
          timedOut: false,
          commandMissing: false,
        };
      }
      return {
        code: 1,
        stdout: "",
        stderr: `unexpected ${argv.join(" ")}`,
        timedOut: false,
        commandMissing: false,
      };
    },
  };
  const repos = createConfiguredRepositoryService({
    configured: memoryConfigured([]),
    collectionPresent: async () => true,
    originRemoteUrl: async () => undefined,
    readers: readers([ADO, GITHUB]),
    hostList: createCliHostRepositoryLister(runner),
  });
  const searched = await repos.search("braid");
  assert.equal(searched.error, undefined);
  assert.deepEqual(
    searched.repositories.map((row) => ({
      provider: row.provider,
      owner: row.owner,
      name: row.name,
    })),
    [
      {
        provider: "azure-devops",
        owner: "braidteam/BRAID",
        name: "braid-connection-designer",
      },
    ],
  );
  const github = await repos.search("Hello");
  assert.deepEqual(
    github.repositories.map((row) => `${row.provider}:${row.owner}/${row.name}`),
    ["github:octocat/Hello-World"],
  );
  const beforeExplicit = configureCalls;
  const named = await repos.search(undefined, { organization: "contoso", project: "Widgets" });
  assert.equal(configureCalls, beforeExplicit);
  assert.deepEqual(
    named.repositories
      .filter((row) => row.provider === "azure-devops")
      .map((row) => `${row.owner}/${row.name}`),
    ["contoso/Widgets/widget-api"],
  );
});
