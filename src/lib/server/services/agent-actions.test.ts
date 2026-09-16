import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { GuideV1, type FileChange } from "../../shared/contracts/guide.ts";
import type { PullRequestSource } from "../../shared/contracts/provenance.ts";
import { filesForDiff } from "../../shared/domain/guide-view.ts";
import { guidePresentsWalkthrough, reviewLandingTab } from "../../shared/domain/overview.ts";
import type { ChapteringAdapter } from "../chaptering/ports.ts";
import { jsonRepositories, resetJsonStoreCache } from "../repositories/json/store.ts";
import { createAppServices } from "./app.ts";

const { reviews, actions, guides } = createAppServices(jsonRepositories);

const SOURCE = "1111111111111111111111111111111111111111";
const TARGET = "2222222222222222222222222222222222222222";

const OPEN_FILES: FileChange[] = [
  {
    path: "src/open.ts",
    language: "typescript",
    hunks: [{ lines: [{ type: "added", content: "export const n = 1;", newLine: 1 }] }],
  },
];

function hostSource(number = 1101): PullRequestSource {
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
    number,
    webUrl: `https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/${number}`,
    sourceRef: "refs/heads/feature/review-me",
    targetRef: "refs/heads/develop",
    sourceCommit: SOURCE,
    targetCommit: TARGET,
    providerContext: {
      kind: "azure-devops",
      project: "BRAID",
      firstComparingIteration: 0,
      secondComparingIteration: 1,
      changes: { "src/open.ts": { changeTrackingId: 1 } },
    },
  };
}

function unchaptered(number = 1101): GuideV1 {
  return GuideV1.parse({
    version: 1,
    title: `PR ${number}`,
    base: TARGET,
    head: SOURCE,
    range: "develop...feature/review-me",
    repo: "braid-connection-designer",
    unchaptered: true,
    chapters: [
      {
        id: "unchaptered",
        kind: "core",
        title: `PR ${number}`,
        why: "Raw diff until a reading-order guide is generated.",
        files: OPEN_FILES,
      },
    ],
    source: hostSource(number),
  });
}

function fakeChaptering(): { adapter: ChapteringAdapter; calls: number } {
  const state = { adapter: {} as ChapteringAdapter, calls: 0 };
  state.adapter = {
    chapter: async ({ title, files, source }) => {
      state.calls += 1;
      return GuideV1.parse({
        version: 1,
        title,
        base: source.targetCommit,
        head: source.sourceCommit,
        range: "develop...feature/review-me",
        repo: source.repository.name,
        chapters: [
          {
            id: "core",
            kind: "core",
            title: "Behavior",
            why: "The reading-order walkthrough of this diff.",
            open: true,
            files,
          },
        ],
        source,
      });
    },
  };
  return state;
}

async function withStore(fn: () => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "gpr-"));
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

test("the waiting agent chapters in place and keeps the same review id", async () => {
  await withStore(async () => {
    const saved = await reviews.add(unchaptered());
    const queued = await actions.queue({ kind: "generate-guide", reviewId: saved.id });
    const claimed = await actions.wait({ timeoutMs: 0 });
    assert.equal(claimed?.id, queued.id);
    assert.equal(claimed?.kind, "generate-guide");
    const chaptering = fakeChaptering();
    const result = await guides.completeGenerateGuide(queued.id, chaptering.adapter);
    assert.equal(result.reviewId, saved.id);
    assert.equal(chaptering.calls, 1);
    const listed = await reviews.list();
    assert.equal(listed.actions.at(-1)?.status, "succeeded");
    assert.equal(listed.actions.at(-1)?.reviewId, saved.id);
    assert.equal(listed.reviews.length, 1);
    assert.equal(listed.reviews[0].id, saved.id);
    const got = await reviews.get(saved.id);
    assert.equal(got.guide.unchaptered, undefined);
    assert.equal(got.guide.chapters[0].id, "core");
    assert.equal(got.guide.source?.number, 1101);
  });
});

test("after success the Guide tab shows the walkthrough and Diff still lists each path", async () => {
  await withStore(async () => {
    const saved = await reviews.add(unchaptered());
    const queued = await actions.queue({ kind: "generate-guide", reviewId: saved.id });
    await actions.wait({ timeoutMs: 0 });
    await guides.completeGenerateGuide(queued.id, fakeChaptering().adapter);
    const got = await reviews.get(saved.id);
    assert.equal(guidePresentsWalkthrough(got.guide), true);
    assert.equal(reviewLandingTab(got.guide), "guide");
    assert.deepEqual(
      filesForDiff(got.guide).map((file) => file.path),
      ["src/open.ts"],
    );
  });
});

test("a failed Generate guide reports a structured error and leaves the Diff openable", async () => {
  await withStore(async () => {
    const saved = await reviews.add(unchaptered());
    const queued = await actions.queue({ kind: "generate-guide", reviewId: saved.id });
    await actions.wait({ timeoutMs: 0 });
    const chaptering: ChapteringAdapter = {
      chapter: async () => {
        throw new Error("chaptering timed out");
      },
    };
    await assert.rejects(
      () => guides.completeGenerateGuide(queued.id, chaptering),
      /chaptering timed out/,
    );
    const listed = await reviews.list();
    assert.equal(listed.actions.at(-1)?.status, "failed");
    assert.equal(listed.actions.at(-1)?.error?.code, "generate-guide-failed");
    assert.equal(listed.actions.at(-1)?.error?.message, "chaptering timed out");
    const got = await reviews.get(saved.id);
    assert.equal(got.guide.unchaptered, true);
    assert.equal(reviewLandingTab(got.guide), "diff");
    assert.deepEqual(
      filesForDiff(got.guide).map((file) => file.path),
      ["src/open.ts"],
    );
  });
});

test("code-review still publishes matching outcomes independently of Generate guide", async () => {
  await withStore(async () => {
    const saved = await reviews.add(unchaptered());
    const { outcomes } = createAppServices(jsonRepositories);
    const published = await outcomes.publish(saved.id, {
      version: 1,
      base: TARGET,
      head: SOURCE,
      standards: { findings: [] },
      spec: { findings: [] },
    });
    const got = await reviews.get(saved.id);
    assert.equal(got.guide.unchaptered, true);
    assert.equal(got.outcomes.length, 1);
    assert.equal(got.outcomes[0].id, published.id);
    assert.equal(got.outcomes[0].outcome.base, TARGET);
    assert.equal(got.outcomes[0].outcome.head, SOURCE);
  });
});
