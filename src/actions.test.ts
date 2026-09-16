import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { completeGenerateGuideAction, completeOpenAction, completeUpdateDiffAction, type ChapteringAdapter, type GitHostAdapter } from "./actions.ts";
import type { OpenActionTarget } from "./lib/shared/contracts/catalog.ts";
import { GuideV1, type FileChange } from "./lib/shared/contracts/guide.ts";
import type { PullRequestSource } from "./lib/shared/contracts/provenance.ts";
import { filesForDiff } from "./lib/shared/domain/guide-view.ts";
import { guidePresentsWalkthrough, reviewLandingTab } from "./lib/shared/domain/overview.ts";
import {
  addReview,
  getReview,
  listReviews,
  queueAction,
  resetJsonStoreCache,
  waitForAction,
} from "./lib/server/repositories/json/store.ts";

const SOURCE = "1111111111111111111111111111111111111111";
const TARGET = "2222222222222222222222222222222222222222";

const sample = GuideV1.parse({
  version: 1,
  title: "Saved",
  base: TARGET,
  head: SOURCE,
  range: "develop...feature/saved",
  chapters: [
    {
      id: "core",
      kind: "core",
      title: "Core",
      why: "The behavior change.",
      files: [
        {
          path: "saved.py",
          language: "python",
          hunks: [{ lines: [{ type: "added", content: "y = 2", newLine: 1 }] }],
        },
      ],
    },
  ],
});

function openTarget(number = 1101): OpenActionTarget {
  return {
    provider: "azure-devops",
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

function hostSource(number = 1101): PullRequestSource {
  const target = openTarget(number);
  return {
    kind: "pull-request",
    provider: "azure-devops",
    host: "dev.azure.com",
    repository: target.repository,
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

const OPEN_FILES: FileChange[] = [
  {
    path: "src/open.ts",
    language: "typescript",
    hunks: [{ lines: [{ type: "added", content: "export const n = 1;", newLine: 1 }] }],
  },
];

function fakeHost(number = 1101, files = OPEN_FILES): GitHostAdapter {
  return {
    fetchOpen: async (target) => {
      assert.equal(target.number, number);
      assert.equal(target.host, "dev.azure.com");
      return {
        title: `PR ${number}`,
        files,
        source: hostSource(number),
      };
    },
  };
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

test("the waiting agent claims Open, upserts an unchaptered review, and lands on Diff", async () => {
  await withStore(async () => {
    const queued = await queueAction({ kind: "open", target: openTarget() });
    const claimed = await waitForAction();
    assert.equal(claimed?.id, queued.id);
    assert.equal(claimed?.status, "claimed");
    const result = await completeOpenAction(queued.id, fakeHost());
    const listed = await listReviews();
    assert.equal(listed.actions[0].status, "succeeded");
    assert.equal(listed.actions[0].reviewId, result.reviewId);
    assert.equal(listed.activeId, result.reviewId);
    const got = await getReview(result.reviewId);
    assert.equal(got.guide.unchaptered, true);
    assert.equal(got.guide.title, "PR 1101");
    assert.equal(got.guide.source?.number, 1101);
    assert.equal(got.guide.chapters.length, 1);
    assert.equal(got.guide.chapters[0].files[0].path, "src/open.ts");
    assert.equal(reviewLandingTab(got.guide), "diff");
  });
});

test("Open does not invoke a chaptering adapter", async () => {
  await withStore(async () => {
    const queued = await queueAction({ kind: "open", target: openTarget() });
    await waitForAction({ timeoutMs: 0 });
    let called = false;
    const chaptering: ChapteringAdapter = {
      chapter: async () => {
        called = true;
        throw new Error("chaptering must not run for Open");
      },
    };
    await completeOpenAction(queued.id, fakeHost(), chaptering);
    assert.equal(called, false);
  });
});

test("a failed Open reports a structured error without changing other reviews", async () => {
  await withStore(async () => {
    const saved = await addReview(sample);
    const queued = await queueAction({ kind: "open", target: openTarget() });
    await waitForAction({ timeoutMs: 0 });
    const host: GitHostAdapter = {
      fetchOpen: async () => {
        throw new Error("Azure DevOps returned 404");
      },
    };
    await assert.rejects(
      () => completeOpenAction(queued.id, host),
      /Azure DevOps returned 404/,
    );
    const listed = await listReviews();
    assert.equal(listed.actions[0].status, "failed");
    assert.equal(listed.actions[0].error?.code, "open-failed");
    assert.equal(listed.actions[0].error?.message, "Azure DevOps returned 404");
    assert.equal(listed.reviews.length, 1);
    assert.equal(listed.reviews[0].id, saved.id);
    assert.equal(listed.activeId, saved.id);
  });
});

test("after success the agent waits again and a second Open can fetch another PR", async () => {
  await withStore(async () => {
    const first = await queueAction({ kind: "open", target: openTarget(1101) });
    await waitForAction({ timeoutMs: 0 });
    const opened = await completeOpenAction(first.id, fakeHost(1101));
    const idle = await waitForAction({ timeoutMs: 0 });
    assert.equal(idle, null);
    const second = await queueAction({ kind: "open", target: openTarget(1102) });
    assert.notEqual(second.id, first.id);
    const claimed = await waitForAction({ timeoutMs: 0 });
    assert.equal(claimed?.id, second.id);
    const next = await completeOpenAction(second.id, fakeHost(1102));
    assert.notEqual(next.reviewId, opened.reviewId);
    const listed = await listReviews();
    assert.equal(listed.reviews.length, 2);
    assert.equal(listed.activeId, next.reviewId);
  });
});

test("Update Diff refreshes the snapshot through upsert without requiring chaptering", async () => {
  await withStore(async () => {
    const queued = await queueAction({ kind: "open", target: openTarget() });
    await waitForAction({ timeoutMs: 0 });
    const opened = await completeOpenAction(queued.id, fakeHost());
    const SHA_NEW = "cccccccccccccccccccccccccccccccccccccccc";
    const update = await queueAction({ kind: "update-diff", target: openTarget() });
    await waitForAction({ timeoutMs: 0 });
    let called = false;
    const chaptering: ChapteringAdapter = {
      chapter: async () => {
        called = true;
        throw new Error("chaptering must not run for Update Diff");
      },
    };
    const host: GitHostAdapter = {
      fetchOpen: async (target) => {
        assert.equal(target.number, 1101);
        return {
          title: "PR 1101 updated",
          files: [
            {
              path: "src/newer.ts",
              language: "typescript",
              hunks: [{ lines: [{ type: "added", content: "export const n = 2;", newLine: 1 }] }],
            },
          ],
          source: { ...hostSource(), sourceCommit: SHA_NEW },
        };
      },
    };
    const result = await completeUpdateDiffAction(update.id, host, chaptering);
    assert.equal(result.reviewId, opened.reviewId);
    assert.equal(called, false);
    const got = await getReview(opened.reviewId);
    assert.equal(got.guide.unchaptered, true);
    assert.equal(got.guide.title, "PR 1101 updated");
    assert.equal(got.guide.source?.sourceCommit, SHA_NEW);
    assert.equal(got.guide.chapters[0].files[0].path, "src/newer.ts");
    const listed = await listReviews();
    assert.equal(listed.reviews.length, 1);
    assert.equal(listed.actions[1].kind, "update-diff");
    assert.equal(listed.actions[1].status, "succeeded");
    assert.equal(listed.actions[1].reviewId, opened.reviewId);
  });
});

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

test("the waiting agent chapters in place and keeps the same review id", async () => {
  await withStore(async () => {
    const opened = await queueAction({ kind: "open", target: openTarget() });
    await waitForAction({ timeoutMs: 0 });
    const { reviewId } = await completeOpenAction(opened.id, fakeHost());
    const queued = await queueAction({ kind: "generate-guide", reviewId });
    const claimed = await waitForAction({ timeoutMs: 0 });
    assert.equal(claimed?.id, queued.id);
    assert.equal(claimed?.kind, "generate-guide");
    const chaptering = fakeChaptering();
    const result = await completeGenerateGuideAction(queued.id, chaptering.adapter);
    assert.equal(result.reviewId, reviewId);
    assert.equal(chaptering.calls, 1);
    const listed = await listReviews();
    assert.equal(listed.actions.at(-1)?.status, "succeeded");
    assert.equal(listed.actions.at(-1)?.reviewId, reviewId);
    assert.equal(listed.reviews.length, 1);
    assert.equal(listed.reviews[0].id, reviewId);
    const got = await getReview(reviewId);
    assert.equal(got.guide.unchaptered, undefined);
    assert.equal(got.guide.chapters[0].id, "core");
    assert.equal(got.guide.source?.number, 1101);
  });
});

test("after success the Guide tab shows the walkthrough and Diff still lists each path", async () => {
  await withStore(async () => {
    const opened = await queueAction({ kind: "open", target: openTarget() });
    await waitForAction({ timeoutMs: 0 });
    const { reviewId } = await completeOpenAction(opened.id, fakeHost());
    const queued = await queueAction({ kind: "generate-guide", reviewId });
    await waitForAction({ timeoutMs: 0 });
    await completeGenerateGuideAction(queued.id, fakeChaptering().adapter);
    const got = await getReview(reviewId);
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
    const opened = await queueAction({ kind: "open", target: openTarget() });
    await waitForAction({ timeoutMs: 0 });
    const { reviewId } = await completeOpenAction(opened.id, fakeHost());
    const queued = await queueAction({ kind: "generate-guide", reviewId });
    await waitForAction({ timeoutMs: 0 });
    const chaptering: ChapteringAdapter = {
      chapter: async () => {
        throw new Error("chaptering timed out");
      },
    };
    await assert.rejects(
      () => completeGenerateGuideAction(queued.id, chaptering),
      /chaptering timed out/,
    );
    const listed = await listReviews();
    assert.equal(listed.actions.at(-1)?.status, "failed");
    assert.equal(listed.actions.at(-1)?.error?.code, "generate-guide-failed");
    assert.equal(listed.actions.at(-1)?.error?.message, "chaptering timed out");
    const got = await getReview(reviewId);
    assert.equal(got.guide.unchaptered, true);
    assert.equal(reviewLandingTab(got.guide), "diff");
    assert.deepEqual(
      filesForDiff(got.guide).map((file) => file.path),
      ["src/open.ts"],
    );
  });
});

test("Open of a different PR can still run after Generate guide completes", async () => {
  await withStore(async () => {
    const opened = await queueAction({ kind: "open", target: openTarget(1101) });
    await waitForAction({ timeoutMs: 0 });
    const { reviewId } = await completeOpenAction(opened.id, fakeHost(1101));
    const generate = await queueAction({ kind: "generate-guide", reviewId });
    await waitForAction({ timeoutMs: 0 });
    await completeGenerateGuideAction(generate.id, fakeChaptering().adapter);
    const idle = await waitForAction({ timeoutMs: 0 });
    assert.equal(idle, null);
    const second = await queueAction({ kind: "open", target: openTarget(1102) });
    const claimed = await waitForAction({ timeoutMs: 0 });
    assert.equal(claimed?.id, second.id);
    assert.equal(claimed?.kind, "open");
    const next = await completeOpenAction(second.id, fakeHost(1102));
    assert.notEqual(next.reviewId, reviewId);
    const listed = await listReviews();
    assert.equal(listed.reviews.length, 2);
    assert.equal(listed.activeId, next.reviewId);
    const first = await getReview(reviewId);
    assert.equal(guidePresentsWalkthrough(first.guide), true);
  });
});

