import assert from "node:assert/strict";
import { test } from "node:test";
import type { StoredAction } from "../../shared/contracts/catalog.ts";
import { GuideV1, type FileChange } from "../../shared/contracts/guide.ts";
import type { PullRequestSource } from "../../shared/contracts/provenance.ts";
import type { ChapteringAdapter } from "../chaptering/ports.ts";
import type { AppRepositories } from "../repositories/ports.ts";
import { createGuideHandoffService } from "./guides.ts";

const SOURCE = "1111111111111111111111111111111111111111";
const TARGET = "2222222222222222222222222222222222222222";

const files: FileChange[] = [
  {
    path: "src/open.ts",
    language: "typescript",
    hunks: [{ lines: [{ type: "added", content: "export const n = 1;", newLine: 1 }] }],
  },
];

const source: PullRequestSource = {
  kind: "pull-request",
  provider: "azure-devops",
  host: "dev.azure.com",
  repository: {
    id: "repo-1",
    owner: "braidteam/BRAID",
    name: "braid-connection-designer",
    webUrl: "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer",
  },
  number: 1101,
  webUrl:
    "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1101",
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

const unchaptered = GuideV1.parse({
  version: 1,
  title: "PR 1101",
  base: TARGET,
  head: SOURCE,
  range: "develop...feature/review-me",
  repo: "braid-connection-designer",
  unchaptered: true,
  chapters: [
    {
      id: "unchaptered",
      kind: "core",
      title: "PR 1101",
      why: "Raw diff until a reading-order guide is generated.",
      files,
    },
  ],
  source,
});

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

test("completeGenerateGuide chapters in place through injected repositories", async () => {
  const action: StoredAction = {
    id: "g1",
    kind: "generate-guide",
    status: "claimed",
    queuedAt: "t",
    claimedAt: "t",
    reviewId: "r1",
  };
  let upserted: unknown;
  const chaptering: ChapteringAdapter = {
    chapter: async (input) =>
      GuideV1.parse({
        version: 1,
        title: input.title,
        base: input.source.targetCommit,
        head: input.source.sourceCommit,
        range: "develop...feature/review-me",
        repo: input.source.repository.name,
        chapters: [
          {
            id: "core",
            kind: "core",
            title: "Behavior",
            why: "The reading-order walkthrough of this diff.",
            open: true,
            files: input.files,
          },
        ],
        source: input.source,
      }),
  };
  const guides = createGuideHandoffService(
    repos({
      listReviews: async () => ({
        reviews: [],
        activeId: "r1",
        repositories: [],
        catalog: [],
        actions: [action],
        agentConnected: true,
      }),
      getReview: async (id) => {
        assert.equal(id, "r1");
        return { guide: unchaptered, outcomes: [] };
      },
      upsertReview: async (input) => {
        upserted = input;
        return { id: "r1" };
      },
      completeAction: async () => ({ ok: true as const }),
    }),
  );
  const result = await guides.completeGenerateGuide("g1", chaptering);
  assert.equal(result.reviewId, "r1");
  const guide = upserted as GuideV1;
  assert.equal(guide.unchaptered, undefined);
  assert.equal(guide.chapters[0].id, "core");
  assert.equal(guide.source?.number, 1101);
});
