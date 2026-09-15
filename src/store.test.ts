import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { GuideV1 } from "./lib/shared/contracts/guide.ts";
import { projectHomeOverview } from "./lib/shared/domain/overview.ts";
import {
  addReview,
  agentIsConnected,
  completeAction,
  dataFile,
  getReview,
  listReviews,
  publishReviewOutcome,
  queueAction,
  removeReview,
  replaceCatalog,
  resetStoreCache,
  setActive,
  upsertReview,
  waitForAction,
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

test("removing a review removes all of its outcome history", async () => {
  await withStore(async () => {
    const { id } = await addReview(sample);
    const other = await addReview(GuideV1.parse({ ...sample, title: "Two" }));
    await publishReviewOutcome(id, sampleOutcome());
    await publishReviewOutcome(id, sampleOutcome());
    await publishReviewOutcome(other.id, sampleOutcome());
    await removeReview(id);
    await assert.rejects(() => getReview(id), /unknown review/);
    const leftover = await getReview(other.id);
    assert.equal(leftover.outcomes.length, 1);
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

function catalogRepository() {
  return {
    provider: "azure-devops" as const,
    host: "dev.azure.com",
    id: "repo-1",
    owner: "braidteam/BRAID",
    name: "braid-connection-designer",
    webUrl: "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer",
  };
}

function catalogPullRequest(overrides: Record<string, unknown> = {}) {
  return {
    provider: "azure-devops" as const,
    host: "dev.azure.com",
    repository: {
      id: "repo-1",
      owner: "braidteam/BRAID",
      name: "braid-connection-designer",
      webUrl: "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer",
    },
    number: 1101,
    title: "Please review",
    webUrl:
      "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1101",
    sourceRef: "refs/heads/feature/review-me",
    targetRef: "refs/heads/develop",
    sourceCommit: SOURCE_A,
    targetCommit: TARGET,
    isDraft: false,
    status: "active" as const,
    author: "Ada",
    isReviewer: true,
    isAuthor: false,
    updatedAt: "2026-09-14T11:00:00.000Z",
    ...overrides,
  };
}

test("replace_catalog persists the current origin repository and a fake host snapshot", async () => {
  await withStore(async () => {
    const syncedAt = "2026-09-14T12:00:00.000Z";
    const result = await replaceCatalog({
      origin: true,
      repository: catalogRepository(),
      syncedAt,
      pullRequests: [catalogPullRequest()],
    });
    assert.deepEqual(result, { ok: true });
    const listed = await listReviews();
    assert.equal(listed.reviews.length, 0);
    assert.deepEqual(listed.repositories, [{ ...catalogRepository(), origin: true }]);
    assert.equal(listed.catalog.length, 1);
    assert.equal(listed.catalog[0].syncedAt, syncedAt);
    assert.equal(listed.catalog[0].error, undefined);
    assert.equal(listed.catalog[0].pullRequests[0].number, 1101);
    assert.equal(listed.catalog[0].pullRequests[0].isReviewer, true);
  });
});

test("replace_catalog never deletes a saved guide", async () => {
  await withStore(async () => {
    const saved = await addReview(sample);
    await replaceCatalog({
      origin: true,
      repository: catalogRepository(),
      syncedAt: "2026-09-14T12:00:00.000Z",
      pullRequests: [],
    });
    const listed = await listReviews();
    assert.equal(listed.reviews.length, 1);
    assert.equal(listed.reviews[0].id, saved.id);
    assert.equal(listed.reviews[0].title, "One");
    const got = await getReview(saved.id);
    assert.equal(got.guide.title, "One");
  });
});

test("a failed catalog replacement records an isolated error and keeps saved reviews", async () => {
  await withStore(async () => {
    const saved = await addReview(sample);
    await replaceCatalog({
      origin: true,
      repository: catalogRepository(),
      error: "Azure DevOps returned 401",
    });
    const listed = await listReviews();
    assert.equal(listed.reviews.length, 1);
    assert.equal(listed.reviews[0].id, saved.id);
    assert.equal(listed.catalog[0].error, "Azure DevOps returned 401");
    assert.equal(listed.catalog[0].syncedAt, undefined);
    assert.deepEqual(listed.catalog[0].pullRequests, []);
    assert.equal(listed.repositories[0].origin, true);
  });
});

function openTarget(number = 1101) {
  return {
    provider: "azure-devops" as const,
    host: "dev.azure.com",
    repository: {
      id: "repo-1",
      owner: "braidteam/BRAID",
      name: "braid-connection-designer",
      webUrl: "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer",
    },
    number,
  };
}

test("selecting an unopened PR queues exactly one Open action", async () => {
  await withStore(async () => {
    const first = await queueAction({ kind: "open", target: openTarget() });
    const second = await queueAction({ kind: "open", target: openTarget() });
    assert.equal(second.id, first.id);
    const listed = await listReviews();
    assert.equal(listed.actions.length, 1);
    assert.equal(listed.actions[0].id, first.id);
    assert.equal(listed.actions[0].kind, "open");
    assert.equal(listed.actions[0].status, "queued");
    assert.equal(listed.actions[0].target?.number, 1101);
  });
});

test("an in-flight Refresh is reused", async () => {
  await withStore(async () => {
    const first = await queueAction({ kind: "refresh" });
    const second = await queueAction({ kind: "refresh" });
    assert.equal(second.id, first.id);
    const listed = await listReviews();
    assert.equal(listed.actions.length, 1);
    assert.equal(listed.actions[0].kind, "refresh");
  });
});

test("Open success still requires reviewId", async () => {
  await withStore(async () => {
    const open = await queueAction({ kind: "open", target: openTarget() });
    await waitForAction({ timeoutMs: 0 });
    await assert.rejects(
      () => completeAction({ id: open.id, status: "succeeded" }),
      /reviewId required/,
    );
  });
});

test("waitForAction claims a queued Open and marks the agent connected", async () => {
  await withStore(async () => {
    let listed = await listReviews();
    assert.equal(listed.agentConnected, false);
    const queued = await queueAction({ kind: "open", target: openTarget() });
    const claimed = await waitForAction({ timeoutMs: 0 });
    assert.equal(claimed?.id, queued.id);
    assert.equal(claimed?.status, "claimed");
    listed = await listReviews();
    assert.equal(listed.agentConnected, true);
    assert.equal(listed.actions[0].status, "claimed");
  });
});

test("queueing Generate guide for a chaptered review is rejected", async () => {
  await withStore(async () => {
    const saved = await addReview(sample);
    await assert.rejects(
      () => queueAction({ kind: "generate-guide", reviewId: saved.id }),
      /unchaptered/,
    );
    const listed = await listReviews();
    assert.equal(listed.actions.length, 0);
  });
});

test("queueing Generate guide for an unchaptered review dedupes in flight", async () => {
  await withStore(async () => {
    const saved = await addReview(GuideV1.parse({ ...sample, unchaptered: true }));
    const first = await queueAction({ kind: "generate-guide", reviewId: saved.id });
    const second = await queueAction({ kind: "generate-guide", reviewId: saved.id });
    assert.equal(second.id, first.id);
    const listed = await listReviews();
    assert.equal(listed.actions.length, 1);
    assert.equal(listed.actions[0].kind, "generate-guide");
    assert.equal(listed.actions[0].status, "queued");
    assert.equal(listed.actions[0].reviewId, saved.id);
  });
});

test("a missing or stale heartbeat is disconnected", () => {
  assert.equal(agentIsConnected(undefined), false);
  assert.equal(agentIsConnected(new Date(Date.now() - 40_000).toISOString()), false);
  assert.equal(agentIsConnected(new Date().toISOString()), true);
});

test("manual Refresh updates Last synced and replaces catalog snapshots", async () => {
  await withStore(async () => {
    await replaceCatalog({
      origin: true,
      repository: catalogRepository(),
      syncedAt: "2026-09-14T12:00:00.000Z",
      pullRequests: [catalogPullRequest({ number: 1101 })],
    });
    const queued = await queueAction({ kind: "refresh" });
    const claimed = await waitForAction({ timeoutMs: 0 });
    assert.equal(claimed?.id, queued.id);
    assert.equal(claimed?.kind, "refresh");
    assert.equal(claimed?.status, "claimed");
    await replaceCatalog({
      origin: true,
      repository: catalogRepository(),
      syncedAt: "2026-09-15T08:00:00.000Z",
      pullRequests: [catalogPullRequest({ number: 1102, title: "Later" })],
    });
    await completeAction({ id: queued.id, status: "succeeded" });
    const listed = await listReviews();
    assert.equal(listed.actions[0].status, "succeeded");
    assert.equal(listed.actions[0].reviewId, undefined);
    assert.equal(listed.catalog[0].syncedAt, "2026-09-15T08:00:00.000Z");
    assert.equal(listed.catalog[0].pullRequests[0].number, 1102);
    assert.equal(listed.catalog[0].pullRequests[0].title, "Later");
  });
});

test("Refresh never deletes a saved guide", async () => {
  await withStore(async () => {
    const saved = await addReview(sample);
    const queued = await queueAction({ kind: "refresh" });
    await waitForAction({ timeoutMs: 0 });
    await replaceCatalog({
      origin: true,
      repository: catalogRepository(),
      syncedAt: "2026-09-15T08:00:00.000Z",
      pullRequests: [catalogPullRequest({ status: "completed" })],
    });
    await completeAction({ id: queued.id, status: "succeeded" });
    const listed = await listReviews();
    assert.equal(listed.reviews.length, 1);
    assert.equal(listed.reviews[0].id, saved.id);
    assert.equal(listed.reviews[0].title, "One");
    const got = await getReview(saved.id);
    assert.equal(got.guide.title, "One");
    assert.equal(got.guide.chapters[0].id, "core");
  });
});

test("Refresh adopts an unsourced local-range review onto a matching catalog PR", async () => {
  await withStore(async () => {
    const local = await addReview(
      GuideV1.parse({ ...sample, range: "develop...feature/review-me" }),
    );
    const other = await addReview(
      GuideV1.parse({ ...sample, title: "Other", range: "develop...feature/other" }),
    );
    await replaceCatalog({
      origin: true,
      repository: catalogRepository(),
      syncedAt: "2026-09-15T08:00:00.000Z",
      pullRequests: [catalogPullRequest()],
    });
    const listed = await listReviews();
    const adopted = listed.reviews.find((row) => row.id === local.id);
    assert.equal(adopted?.pullRequest?.number, 1101);
    assert.equal(adopted?.sourceCommit, sample.head);
    const leftover = listed.reviews.find((row) => row.id === other.id);
    assert.equal(leftover?.pullRequest, undefined);
    const got = await getReview(local.id);
    assert.equal(got.guide.source?.number, 1101);
    assert.equal(got.guide.chapters[0].id, "core");
    const overview = projectHomeOverview(listed.reviews, listed.catalog);
    const localGroup = overview.groups.find((group) => group.id === "local-ranges");
    assert.deepEqual(
      localGroup?.cards.map((card) => card.id),
      [other.id],
    );
    const requests = overview.groups.find((group) => group.id === "review-requests");
    assert.equal(requests?.cards[0].reviewId, local.id);
  });
});

test("Refresh adopts a renamed local range when the ticket key is unique", async () => {
  await withStore(async () => {
    const local = await addReview(
      GuideV1.parse({
        ...sample,
        range: "develop...feature/tcd-3343-pin-maps",
        repo: "braid-connection-designer",
      }),
    );
    await replaceCatalog({
      origin: true,
      repository: catalogRepository(),
      syncedAt: "2026-09-15T08:00:00.000Z",
      pullRequests: [
        catalogPullRequest({
          sourceRef: "refs/heads/feature/TCD-3343-pin-output-model-snapshot",
        }),
      ],
    });
    const listed = await listReviews();
    assert.equal(listed.reviews.find((row) => row.id === local.id)?.pullRequest?.number, 1101);
    const overview = projectHomeOverview(listed.reviews, listed.catalog);
    assert.equal(overview.groups.find((group) => group.id === "local-ranges"), undefined);
    assert.equal(
      overview.groups.find((group) => group.id === "review-requests")?.cards[0].reviewId,
      local.id,
    );
  });
});

test("Refresh leaves two locals with the same ticket in Local ranges", async () => {
  await withStore(async () => {
    const a = await addReview(
      GuideV1.parse({ ...sample, title: "A", range: "develop...feature/tcd-3343-pin-maps" }),
    );
    const b = await addReview(
      GuideV1.parse({
        ...sample,
        title: "B",
        range: "develop...feature/tcd-3343-follow-up",
      }),
    );
    await replaceCatalog({
      origin: true,
      repository: catalogRepository(),
      syncedAt: "2026-09-15T08:00:00.000Z",
      pullRequests: [
        catalogPullRequest({
          sourceRef: "refs/heads/feature/TCD-3343-pin-output-model-snapshot",
        }),
      ],
    });
    const listed = await listReviews();
    assert.equal(listed.reviews.find((row) => row.id === a.id)?.pullRequest, undefined);
    assert.equal(listed.reviews.find((row) => row.id === b.id)?.pullRequest, undefined);
    const overview = projectHomeOverview(listed.reviews, listed.catalog);
    assert.deepEqual(
      overview.groups.find((group) => group.id === "local-ranges")?.cards.map((card) => card.id),
      [a.id, b.id],
    );
    assert.equal(
      overview.groups.find((group) => group.id === "review-requests")?.cards[0].reviewId,
      undefined,
    );
  });
});
