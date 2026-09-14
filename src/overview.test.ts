import assert from "node:assert/strict";
import { test } from "node:test";
import type { CatalogPullRequest, CatalogSnapshot, ReviewSummary } from "./contracts.ts";
import {
  HOME_PATH,
  projectHomeCards,
  projectHomeOverview,
  resolveOverviewView,
  reviewPath,
} from "./overview.ts";

function summary(overrides: Partial<ReviewSummary> = {}): ReviewSummary {
  return {
    id: "rev-1",
    title: "Local range",
    range: "main...feature/one",
    addedAt: "2026-09-14T00:00:00.000Z",
    base: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    head: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    ...overrides,
  };
}

test("projectHomeCards lists every saved review once", () => {
  const local = summary({ id: "local-1", title: "Local" });
  const hosted = summary({
    id: "pr-1027",
    title: "Named PR",
    range: "develop...feature/example",
    pullRequest: {
      provider: "azure-devops",
      host: "dev.azure.com",
      repository: {
        id: "repo-1",
        owner: "braidteam/BRAID",
        name: "braid-connection-designer",
      },
      number: 1027,
      webUrl:
        "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1027",
      targetRef: "develop",
      sourceRef: "feature/example",
    },
  });
  const cards = projectHomeCards([local, hosted]);
  assert.deepEqual(
    cards.map((card) => card.id),
    ["local-1", "pr-1027"],
  );
});

test("host-backed Home cards expose owner and repository; local cards do not", () => {
  const local = summary({ id: "local-1", title: "Local" });
  const hosted = summary({
    id: "pr-1027",
    title: "Named PR",
    pullRequest: {
      provider: "azure-devops",
      host: "dev.azure.com",
      repository: {
        id: "repo-1",
        owner: "braidteam/BRAID",
        name: "braid-connection-designer",
      },
      number: 1027,
      webUrl:
        "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1027",
      targetRef: "develop",
      sourceRef: "feature/example",
    },
  });
  const cards = projectHomeCards([local, hosted]);
  assert.equal(cards[0].repository, undefined);
  assert.deepEqual(cards[1].repository, {
    owner: "braidteam/BRAID",
    name: "braid-connection-designer",
  });
});

test("host-backed Home cards expose the pull-request web URL; local cards do not", () => {
  const local = summary({ id: "local-1", title: "Local" });
  const hosted = summary({
    id: "pr-1027",
    title: "Named PR",
    pullRequest: {
      provider: "azure-devops",
      host: "dev.azure.com",
      repository: {
        id: "repo-1",
        owner: "braidteam/BRAID",
        name: "braid-connection-designer",
      },
      number: 1027,
      webUrl:
        "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1027",
      targetRef: "develop",
      sourceRef: "feature/example",
    },
  });
  const cards = projectHomeCards([local, hosted]);
  assert.equal(cards[0].webUrl, undefined);
  assert.equal(
    cards[1].webUrl,
    "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1027",
  );
});

test("host-backed Home cards strip refs/heads from structured refs", () => {
  const cards = projectHomeCards([
    summary({
      id: "pr-1027",
      title: "Named PR",
      pullRequest: {
        provider: "azure-devops",
        host: "dev.azure.com",
        repository: {
          id: "repo-1",
          owner: "braidteam/BRAID",
          name: "braid-connection-designer",
        },
        number: 1027,
        webUrl:
          "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1027",
        targetRef: "Refs/Heads/develop",
        sourceRef: "refs/heads/feature/foo",
      },
    }),
  ]);
  assert.equal(cards[0].range, "develop ← feature/foo");
});

test("host-backed Home cards show target into source", () => {
  const cards = projectHomeCards([
    summary({
      id: "pr-1027",
      title: "Named PR",
      range: "abc...def",
      pullRequest: {
        provider: "azure-devops",
        host: "dev.azure.com",
        repository: {
          id: "repo-1",
          owner: "braidteam/BRAID",
          name: "braid-connection-designer",
        },
        number: 1027,
        webUrl:
          "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1027",
        targetRef: "develop",
        sourceRef: "feature/foo",
      },
    }),
  ]);
  assert.equal(cards[0].range, "develop ← feature/foo");
});

test("local Home cards parse the three-dot range as target into source", () => {
  const cards = projectHomeCards([
    summary({ id: "local-1", title: "Local", range: "main...feature/one" }),
  ]);
  assert.equal(cards[0].range, "main ← feature/one");
});

test("Home cards omit the range line without refs or a parseable three-dot range", () => {
  const cards = projectHomeCards([
    summary({ id: "a", range: undefined }),
    summary({ id: "b", range: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" }),
    summary({ id: "c", range: "..." }),
  ]);
  assert.deepEqual(
    cards.map((card) => card.range),
    [undefined, undefined, undefined],
  );
});

test("Home cards keep title", () => {
  const cards = projectHomeCards([
    summary({ id: "local-1", title: "Local", range: "main...feature/one" }),
    summary({ id: "pr-1027", title: "Named PR", range: undefined }),
  ]);
  assert.deepEqual(
    cards.map((card) => card.title),
    ["Local", "Named PR"],
  );
});

test("bare path stays on Home even when saved reviews exist", () => {
  const ids = ["local-1", "pr-1027"];
  assert.deepEqual(resolveOverviewView("/", ids), { kind: "home" });
  assert.deepEqual(resolveOverviewView("", ids), { kind: "home" });
});

test("a review URL opens that saved guide when the id exists", () => {
  assert.deepEqual(resolveOverviewView("/reviews/pr-1027", ["local-1", "pr-1027"]), {
    kind: "review",
    reviewId: "pr-1027",
  });
  assert.deepEqual(resolveOverviewView("/reviews/pr-1027/", ["pr-1027"]), {
    kind: "review",
    reviewId: "pr-1027",
  });
});

test("an unknown review URL falls back to Home", () => {
  assert.deepEqual(resolveOverviewView("/reviews/missing", ["pr-1027"]), { kind: "home" });
});

test("reviewPath is the URL an explicit target opens and a reload preserves", () => {
  assert.equal(HOME_PATH, "/");
  assert.equal(reviewPath("pr-1027"), "/reviews/pr-1027");
  assert.deepEqual(resolveOverviewView(reviewPath("pr-1027"), ["pr-1027"]), {
    kind: "review",
    reviewId: "pr-1027",
  });
  assert.deepEqual(resolveOverviewView(HOME_PATH, ["pr-1027"]), { kind: "home" });
});

const SHA_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SHA_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

function catalogItem(overrides: Partial<CatalogPullRequest> = {}): CatalogPullRequest {
  return {
    provider: "azure-devops",
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
    sourceCommit: SHA_A,
    targetCommit: SHA_B,
    isDraft: false,
    status: "active",
    author: "Ada",
    isReviewer: true,
    isAuthor: false,
    updatedAt: "2026-09-14T11:00:00.000Z",
    ...overrides,
  };
}

function originSnapshot(
  pullRequests: CatalogPullRequest[],
  extra: Partial<CatalogSnapshot> = {},
): CatalogSnapshot {
  return {
    provider: "azure-devops",
    host: "dev.azure.com",
    repository: {
      id: "repo-1",
      owner: "braidteam/BRAID",
      name: "braid-connection-designer",
      webUrl: "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer",
    },
    syncedAt: "2026-09-14T12:00:00.000Z",
    pullRequests,
    ...extra,
  };
}

test("projectHomeOverview places each live catalog item once by reviewer then author", () => {
  const requested = catalogItem({
    number: 1101,
    title: "Needs review",
    isReviewer: true,
    isAuthor: false,
    isDraft: false,
  });
  const draft = catalogItem({
    number: 1102,
    title: "My draft",
    webUrl:
      "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1102",
    isReviewer: false,
    isAuthor: true,
    isDraft: true,
  });
  const both = catalogItem({
    number: 1103,
    title: "Mine and assigned",
    webUrl:
      "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1103",
    isReviewer: true,
    isAuthor: true,
    isDraft: false,
  });
  const overview = projectHomeOverview([], [originSnapshot([requested, draft, both])]);
  assert.deepEqual(
    overview.groups.map((group) => ({
      id: group.id,
      title: group.title,
      titles: group.cards.map((card) => card.title),
    })),
    [
      {
        id: "review-requests",
        title: "Review requests",
        titles: ["Needs review", "Mine and assigned"],
      },
      {
        id: "authored-by-me",
        title: "Authored by me",
        titles: ["My draft"],
      },
    ],
  );
});

test("every host PR on the overview has a compact owner and repository badge", () => {
  const overview = projectHomeOverview(
    [
      summary({
        id: "saved-pr",
        title: "Saved PR",
        pullRequest: {
          provider: "azure-devops",
          host: "dev.azure.com",
          repository: {
            id: "repo-1",
            owner: "braidteam/BRAID",
            name: "braid-connection-designer",
          },
          number: 1027,
          webUrl:
            "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1027",
          targetRef: "develop",
          sourceRef: "feature/example",
        },
      }),
    ],
    [
      originSnapshot([
        catalogItem({ isReviewer: true, isAuthor: false }),
        catalogItem({
          number: 1102,
          title: "My draft",
          webUrl:
            "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1102",
          isReviewer: false,
          isAuthor: true,
          isDraft: true,
        }),
      ]),
    ],
  );
  const hostCards = overview.groups.flatMap((group) => group.cards);
  assert.equal(hostCards.length, 3);
  for (const card of hostCards) {
    assert.deepEqual(card.repository, {
      owner: "braidteam/BRAID",
      name: "braid-connection-designer",
    });
  }
});

test("successful catalog replacement exposes Last synced", () => {
  const overview = projectHomeOverview(
    [],
    [originSnapshot([catalogItem()], { syncedAt: "2026-09-14T12:00:00.000Z" })],
  );
  assert.equal(overview.lastSynced, "2026-09-14T12:00:00.000Z");
  assert.deepEqual(overview.catalogErrors, []);
});

test("a failed catalog snapshot reports an isolated error and keeps saved reviews", () => {
  const local = summary({ id: "local-1", title: "Local" });
  const hosted = summary({
    id: "pr-1027",
    title: "Named PR",
    syncKey: "azure-devops:dev.azure.com:repo-1:1027",
    pullRequest: {
      provider: "azure-devops",
      host: "dev.azure.com",
      repository: {
        id: "repo-1",
        owner: "braidteam/BRAID",
        name: "braid-connection-designer",
      },
      number: 1027,
      webUrl:
        "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1027",
      targetRef: "develop",
      sourceRef: "feature/example",
    },
  });
  const overview = projectHomeOverview(
    [local, hosted],
    [
      originSnapshot([], {
        syncedAt: undefined,
        error: "Azure DevOps returned 401",
      }),
    ],
  );
  assert.deepEqual(overview.catalogErrors, [
    {
      owner: "braidteam/BRAID",
      name: "braid-connection-designer",
      message: "Azure DevOps returned 401",
    },
  ]);
  assert.deepEqual(
    overview.groups.map((group) => ({
      id: group.id,
      titles: group.cards.map((card) => card.title),
    })),
    [
      { id: "other-saved-prs", titles: ["Named PR"] },
      { id: "local-ranges", titles: ["Local"] },
    ],
  );
});

test("an empty catalog keeps saved guides visible", () => {
  const local = summary({ id: "local-1", title: "Local" });
  const hosted = summary({
    id: "pr-1027",
    title: "Named PR",
    pullRequest: {
      provider: "azure-devops",
      host: "dev.azure.com",
      repository: {
        id: "repo-1",
        owner: "braidteam/BRAID",
        name: "braid-connection-designer",
      },
      number: 1027,
      webUrl:
        "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1027",
      targetRef: "develop",
      sourceRef: "feature/example",
    },
  });
  const overview = projectHomeOverview([local, hosted], []);
  assert.equal(overview.lastSynced, undefined);
  assert.deepEqual(overview.catalogErrors, []);
  assert.deepEqual(
    overview.groups.map((group) => ({
      id: group.id,
      titles: group.cards.map((card) => card.title),
    })),
    [
      { id: "other-saved-prs", titles: ["Named PR"] },
      { id: "local-ranges", titles: ["Local"] },
    ],
  );
});
