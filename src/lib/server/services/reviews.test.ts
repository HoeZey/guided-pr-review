import assert from "node:assert/strict";
import { test } from "node:test";
import type { OpenActionTarget, StoredAction } from "../../shared/contracts/catalog.ts";
import type { GuideV1 } from "../../shared/contracts/guide.ts";
import type { PullRequestSource } from "../../shared/contracts/provenance.ts";
import type { AppRepositories } from "../repositories/ports.ts";
import type { GitHostAdapter } from "../providers/ports.ts";
import { createReviewService } from "./reviews.ts";

const SOURCE = "1111111111111111111111111111111111111111";
const TARGET = "2222222222222222222222222222222222222222";

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

function fakeHost(number = 1101): GitHostAdapter {
  return {
    fetchOpen: async (target) => {
      assert.equal(target.number, number);
      return {
        title: `PR ${number}`,
        files: [
          {
            path: "src/open.ts",
            language: "typescript",
            hunks: [{ lines: [{ type: "added", content: "export const n = 1;", newLine: 1 }] }],
          },
        ],
        source: hostSource(number),
      };
    },
  };
}

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

test("completeOpen upserts an unchaptered review through injected repositories", async () => {
  const target = openTarget();
  const action: StoredAction = {
    id: "a1",
    kind: "open",
    status: "claimed",
    queuedAt: "t",
    claimedAt: "t",
    target,
  };
  let upserted: unknown;
  let completed: unknown;
  const reviews = createReviewService(
    repos({
      listReviews: async () => ({
        reviews: [],
        activeId: null,
        repositories: [],
        catalog: [],
        actions: [action],
        agentConnected: true,
      }),
      upsertReview: async (input) => {
        upserted = input;
        return { id: "r1" };
      },
      completeAction: async (input) => {
        completed = input;
        return { ok: true as const };
      },
    }),
  );
  const result = await reviews.completeOpen("a1", fakeHost());
  assert.equal(result.reviewId, "r1");
  const guide = upserted as GuideV1;
  assert.equal(guide.unchaptered, true);
  assert.equal(guide.title, "PR 1101");
  assert.equal(guide.source?.number, 1101);
  assert.deepEqual(completed, { id: "a1", status: "succeeded", reviewId: "r1" });
});
