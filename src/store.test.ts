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
  publishReviewOutcome,
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

function sampleOutcome() {
  return {
    version: 1 as const,
    base: sample.base,
    head: sample.head,
    standards: {
      findings: [
        {
          severity: "major" as const,
          title: "Guide expansion is lost after visiting Diff",
          explanation: "Diff state is written back into Guide collapse state.",
        },
      ],
    },
    spec: { findings: [] },
  };
}

test("publish appends an immutable run to the requested review", async () => {
  await withStore(async () => {
    const { id } = await addReview(sample);
    const other = await addReview(GuideV1.parse({ ...sample, title: "Two" }));
    const published = await publishReviewOutcome(id, sampleOutcome());
    const got = await getReview(id);
    assert.equal(got.outcomes.length, 1);
    assert.equal(got.outcomes[0].id, published.id);
    assert.equal(got.outcomes[0].outcome.standards.findings[0].title, "Guide expansion is lost after visiting Diff");
    assert.match(got.outcomes[0].addedAt, /^\d{4}-\d{2}-\d{2}T/);
    const untouched = await getReview(other.id);
    assert.equal(untouched.outcomes.length, 0);
  });
});

test("repeat runs at one head remain distinct", async () => {
  await withStore(async () => {
    const { id } = await addReview(sample);
    const first = await publishReviewOutcome(id, sampleOutcome());
    const second = await publishReviewOutcome(id, sampleOutcome());
    const got = await getReview(id);
    assert.equal(got.outcomes.length, 2);
    assert.notEqual(first.id, second.id);
    assert.deepEqual(
      got.outcomes.map((row) => row.id),
      [first.id, second.id],
    );
  });
});

test("unknown review id or invalid outcome is rejected", async () => {
  await withStore(async () => {
    const { id } = await addReview(sample);
    await assert.rejects(
      () => publishReviewOutcome("missing", sampleOutcome()),
      /unknown review missing/,
    );
    await assert.rejects(() =>
      publishReviewOutcome(id, { ...sampleOutcome(), extra: true }),
    );
    await assert.rejects(() =>
      publishReviewOutcome(id, {
        ...sampleOutcome(),
        spec: {
          findings: [
            { severity: "minor", title: "T", explanation: "E" },
          ],
        },
      }),
    );
    await assert.rejects(() =>
      publishReviewOutcome(id, {
        ...sampleOutcome(),
        standards: { findings: [], count: 0 },
      }),
    );
    const got = await getReview(id);
    assert.equal(got.outcomes.length, 0);
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
    assert.equal(listed.reviews[0].base, sample.base);
    assert.equal(listed.reviews[0].head, sample.head);
    const got = await getReview("r1");
    assert.equal(got.guide.source, undefined);
    assert.deepEqual(got.outcomes, []);
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
    assert.equal(listed.reviews[0].pullRequest?.targetRef, "refs/heads/develop");
    assert.equal(listed.reviews[0].pullRequest?.sourceRef, "refs/heads/feature/example");
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

test("upsert adopts an unsourced local review when the range head matches the PR branch", async () => {
  await withStore(async () => {
    const local = await addReview(
      GuideV1.parse({ ...sample, range: "develop...feature/example" }),
    );
    const other = await addReview(
      GuideV1.parse({ ...sample, title: "Other", range: "develop...feature/other" }),
    );
    const adopted = await upsertReview(
      GuideV1.parse({
        ...sample,
        title: "PR 1027",
        range: "develop...feature/example",
        source: prSource(),
      }),
    );
    assert.equal(adopted.id, local.id);
    const listed = await listReviews();
    assert.equal(listed.reviews.length, 2);
    assert.equal(listed.reviews.find((row) => row.id === local.id)?.pullRequest?.number, 1027);
    assert.equal(listed.reviews.find((row) => row.id === other.id)?.pullRequest, undefined);
    const got = await getReview(local.id);
    assert.equal(got.guide.source?.number, 1027);
  });
});

test("upsert adopts a renamed branch when exactly one local range shares the ticket key", async () => {
  await withStore(async () => {
    const local = await addReview(
      GuideV1.parse({
        ...sample,
        range: "develop...feature/tcd-3343-pin-maps",
        repo: "braid-connection-designer",
      }),
    );
    const adopted = await upsertReview(
      GuideV1.parse({
        ...sample,
        title: "[TCD-3343] Pin maps to SNAPSHOT",
        source: prSource({
          sourceRef: "refs/heads/feature/TCD-3343-pin-output-model-snapshot",
        }),
      }),
    );
    assert.equal(adopted.id, local.id);
    const got = await getReview(local.id);
    assert.equal(got.guide.source?.sourceRef, "refs/heads/feature/TCD-3343-pin-output-model-snapshot");
  });
});

test("upsert does not adopt when two unsourced locals share the ticket key", async () => {
  await withStore(async () => {
    await addReview(
      GuideV1.parse({ ...sample, title: "A", range: "develop...feature/tcd-3343-pin-maps" }),
    );
    await addReview(
      GuideV1.parse({
        ...sample,
        title: "B",
        range: "develop...feature/tcd-3343-follow-up",
      }),
    );
    const created = await upsertReview(
      GuideV1.parse({
        ...sample,
        title: "PR 1029",
        source: prSource({
          number: 1029,
          webUrl:
            "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1029",
          sourceRef: "refs/heads/feature/TCD-3343-pin-output-model-snapshot",
        }),
      }),
    );
    const listed = await listReviews();
    assert.equal(listed.reviews.length, 3);
    assert.equal(listed.reviews.filter((row) => !row.pullRequest).length, 2);
    assert.equal(
      listed.reviews.find((row) => row.id === created.id)?.pullRequest?.number,
      1029,
    );
  });
});

test("upsert does not adopt a local review from a different repository name", async () => {
  await withStore(async () => {
    const local = await addReview(
      GuideV1.parse({
        ...sample,
        range: "develop...feature/example",
        repo: "other-repo",
      }),
    );
    const created = await upsertReview(
      GuideV1.parse({
        ...sample,
        title: "PR 1027",
        source: prSource(),
      }),
    );
    assert.notEqual(created.id, local.id);
    const listed = await listReviews();
    assert.equal(listed.reviews.length, 2);
    assert.equal(listed.reviews.find((row) => row.id === local.id)?.pullRequest, undefined);
  });
});

test("list_reviews exposes guide base and head", async () => {
  await withStore(async () => {
    await addReview(sample);
    const listed = await listReviews();
    assert.equal(listed.reviews[0].base, sample.base);
    assert.equal(listed.reviews[0].head, sample.head);
  });
});
