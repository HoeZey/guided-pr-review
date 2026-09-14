import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { GuideV1 } from "./contracts.ts";
import {
  addReview,
  dataFile,
  getReview,
  listReviews,
  removeReview,
  resetStoreCache,
  setActive,
  upsertReview,
} from "./store.ts";

const sample = GuideV1.parse({
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
      files: [
        {
          path: "a.py",
          language: "python",
          hunks: [
            {
              lines: [
                { type: "added", content: "x = 1", newLine: 1 },
              ],
            },
          ],
        },
      ],
    },
  ],
});

const SOURCE_A = "1111111111111111111111111111111111111111";
const SOURCE_B = "3333333333333333333333333333333333333333";
const TARGET = "2222222222222222222222222222222222222222";

function prSource(overrides: Record<string, unknown> = {}) {
  return {
    kind: "pull-request",
    provider: "azure-devops",
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
    sourceCommit: SOURCE_A,
    targetCommit: TARGET,
    providerContext: {
      kind: "azure-devops",
      project: "BRAID",
      firstComparingIteration: 0,
      secondComparingIteration: 1,
      changes: {
        "src/example.ts": { changeTrackingId: 1 },
      },
    },
    ...overrides,
  };
}

async function withStore(fn: () => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "gpr-"));
  const prev = process.env.GUIDED_PR_REVIEW_DATA;
  process.env.GUIDED_PR_REVIEW_DATA = dir;
  resetStoreCache();
  try {
    await fn();
  } finally {
    resetStoreCache();
    if (prev === undefined) delete process.env.GUIDED_PR_REVIEW_DATA;
    else process.env.GUIDED_PR_REVIEW_DATA = prev;
    await rm(dir, { recursive: true, force: true });
  }
}

test("rejects invalid guide", async () => {
  await withStore(async () => {
    await assert.rejects(() => addReview({ version: 1, title: "x" }));
  });
});

test("parses valid pull-request provenance", () => {
  const parsed = GuideV1.parse({ ...sample, source: prSource() });
  assert.equal(parsed.source?.kind, "pull-request");
  assert.equal(parsed.source?.number, 1027);
  assert.equal(parsed.source?.providerContext.kind, "azure-devops");
  assert.equal(parsed.source?.providerContext.project, "BRAID");
});

test("rejects ADO-only data outside providerContext", () => {
  assert.throws(() => GuideV1.parse({ ...sample, source: prSource({ project: "BRAID" }) }));
});

test("rejects invalid pull-request provenance", () => {
  assert.throws(() =>
    GuideV1.parse({ ...sample, source: prSource({ sourceCommit: "abc1234" }) }),
  );
});

test("add list set_active remove", async () => {
  await withStore(async () => {
    const a = await addReview(sample);
    const second = GuideV1.parse({ ...sample, title: "Two", range: "main...two" });
    const b = await addReview(second);
    let listed = await listReviews();
    assert.equal(listed.reviews.length, 2);
    assert.equal(listed.activeId, b.id);
    await setActive(a.id);
    listed = await listReviews();
    assert.equal(listed.activeId, a.id);
    const got = await getReview(a.id);
    assert.equal(got.guide.title, "One");
    await removeReview(a.id);
    listed = await listReviews();
    assert.equal(listed.reviews.length, 1);
    assert.equal(listed.activeId, b.id);
    await removeReview(b.id);
    listed = await listReviews();
    assert.equal(listed.reviews.length, 0);
    assert.equal(listed.activeId, null);
  });
});

test("old Store v1 JSON without source still loads", async () => {
  await withStore(async () => {
    await writeFile(
      dataFile(),
      `${JSON.stringify({
        version: 1,
        activeId: "r1",
        reviews: [
          {
            id: "r1",
            addedAt: "2020-01-01T00:00:00.000Z",
            guide: sample,
          },
        ],
      })}\n`,
    );
    resetStoreCache();
    const listed = await listReviews();
    assert.equal(listed.reviews.length, 1);
    assert.equal(listed.reviews[0].id, "r1");
    assert.equal(listed.reviews[0].title, "One");
    const got = await getReview("r1");
    assert.equal(got.guide.source, undefined);
  });
});

test("same provider host repository PR upserts to one stable id", async () => {
  await withStore(async () => {
    const guide = GuideV1.parse({ ...sample, title: "PR 1027", source: prSource() });
    const first = await upsertReview(guide);
    const second = await upsertReview(
      GuideV1.parse({ ...guide, title: "PR 1027 again" }),
    );
    assert.equal(second.id, first.id);
    const listed = await listReviews();
    assert.equal(listed.reviews.length, 1);
    assert.equal(listed.activeId, first.id);
    const got = await getReview(first.id);
    assert.equal(got.guide.title, "PR 1027 again");
  });
});

test("new source commit replaces the guide and keeps the id", async () => {
  await withStore(async () => {
    const firstGuide = GuideV1.parse({
      ...sample,
      title: "old sha",
      head: SOURCE_A,
      source: prSource(),
    });
    const first = await upsertReview(firstGuide);
    const refreshed = GuideV1.parse({
      ...sample,
      title: "new sha",
      head: SOURCE_B,
      source: prSource({ sourceCommit: SOURCE_B }),
    });
    const second = await upsertReview(refreshed);
    assert.equal(second.id, first.id);
    const got = await getReview(first.id);
    assert.equal(got.guide.title, "new sha");
    assert.equal(got.guide.source?.sourceCommit, SOURCE_B);
    const listed = await listReviews();
    assert.equal(listed.reviews.length, 1);
  });
});

test("list_reviews exposes source commit so an unchanged PR is detectable", async () => {
  await withStore(async () => {
    const guide = GuideV1.parse({ ...sample, source: prSource() });
    await upsertReview(guide);
    const listed = await listReviews();
    assert.equal(listed.reviews[0].sourceCommit, SOURCE_A);
    assert.equal(
      listed.reviews[0].syncKey,
      "azure-devops:dev.azure.com:repo-1:1027",
    );
    assert.equal(listed.reviews[0].pullRequest?.number, 1027);
    assert.equal(listed.reviews[0].pullRequest?.repository.id, "repo-1");
  });
});

test("a second PR is a second review", async () => {
  await withStore(async () => {
    const a = await upsertReview(
      GuideV1.parse({ ...sample, title: "PR 1027", source: prSource() }),
    );
    const b = await upsertReview(
      GuideV1.parse({
        ...sample,
        title: "PR 2048",
        source: prSource({
          number: 2048,
          webUrl:
            "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/2048",
        }),
      }),
    );
    assert.notEqual(b.id, a.id);
    const listed = await listReviews();
    assert.equal(listed.reviews.length, 2);
    assert.equal(listed.activeId, b.id);
  });
});

test("unsupported host is rejected and does not alter the store", async () => {
  await withStore(async () => {
    const local = await addReview(sample);
    await assert.rejects(
      () =>
        upsertReview({
          ...sample,
          source: prSource({ host: "github.com" }),
        }),
      /unsupported git host/,
    );
    const listed = await listReviews();
    assert.equal(listed.reviews.length, 1);
    assert.equal(listed.reviews[0].id, local.id);
  });
});
