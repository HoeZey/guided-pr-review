import assert from "node:assert/strict";
import { test } from "node:test";
import type { CatalogPullRequest, CatalogSnapshot } from "../contracts/catalog.ts";
import type { ReviewSummary } from "../contracts/persistence.ts";
import {
  HOME_PATH,
  guideBookHover,
  guidePresentsWalkthrough,
  homeCardAction,
  catalogHasNewChanges,
  homeDiffSyncTargets,
  projectHomeCards,
  projectHomeOverview,
  resolveOverviewView,
  reviewLandingTab,
  reviewOutdatedWarning,
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
  const published = catalogItem({
    number: 1104,
    title: "My published",
    webUrl:
      "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1104",
    isReviewer: false,
    isAuthor: true,
    isDraft: false,
  });
  const overview = projectHomeOverview(
    [
      hostedSummary("saved-1101", 1101, "Needs review", { diffCommit: SHA_A }),
      hostedSummary("saved-1102", 1102, "My draft", { unchaptered: true, diffCommit: SHA_A }),
      hostedSummary("saved-1103", 1103, "Mine and assigned", { diffCommit: SHA_A }),
      hostedSummary("saved-1104", 1104, "My published", { diffCommit: SHA_A }),
    ],
    [originSnapshot([requested, draft, both, published])],
  );
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
        id: "my-published-prs",
        title: "My published PRs",
        titles: ["My published"],
      },
      {
        id: "my-draft-prs",
        title: "My draft PRs",
        titles: ["My draft"],
      },
    ],
  );
});

test("catalog cards say whether a saved Guide already exists", () => {
  const requested = catalogItem({
    number: 1101,
    title: "Needs review",
    isReviewer: true,
    isAuthor: false,
  });
  const leftover = catalogItem({
    number: 1102,
    title: "No guide yet",
    webUrl:
      "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1102",
    isReviewer: true,
    isAuthor: false,
  });
  const saved = summary({
    id: "saved-1101",
    title: "Needs review",
    syncKey: "azure-devops:dev.azure.com:repo-1:1101",
    diffCommit: SHA_A,
    pullRequest: {
      provider: "azure-devops",
      host: "dev.azure.com",
      repository: {
        id: "repo-1",
        owner: "braidteam/BRAID",
        name: "braid-connection-designer",
      },
      number: 1101,
      webUrl:
        "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1101",
      targetRef: "develop",
      sourceRef: "feature/review-me",
    },
  });
  const overview = projectHomeOverview([saved], [originSnapshot([requested, leftover])]);
  const cards = overview.groups.find((group) => group.id === "review-requests")?.cards ?? [];
  assert.equal(cards.length, 1);
  assert.equal(cards[0].title, "Needs review");
  assert.equal(cards[0].hasGuide, true);
  assert.equal(cards[0].reviewId, "saved-1101");
  assert.equal(catalogHasNewChanges([saved], [originSnapshot([requested, leftover])]), true);
});

test("every host PR on the overview has a compact owner and repository badge", () => {
  const overview = projectHomeOverview(
    [
      summary({
        id: "saved-pr",
        title: "Saved PR",
        syncKey: "azure-devops:dev.azure.com:repo-1:1027",
        diffCommit: SHA_A,
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
      hostedSummary("saved-1101", 1101, "Needs review", { diffCommit: SHA_A }),
      hostedSummary("saved-1102", 1102, "My draft", {
        unchaptered: true,
        diffCommit: SHA_A,
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
      provider: "azure-devops",
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

test("the Guide tab does not present a placeholder walkthrough for an unchaptered review", () => {
  assert.equal(guidePresentsWalkthrough({ unchaptered: true }), false);
  assert.equal(guidePresentsWalkthrough({}), true);
  assert.equal(reviewLandingTab({ unchaptered: true }), "diff");
  assert.equal(reviewLandingTab({}), "guide");
});

test("catalog rows without a saved review are not Home cards", () => {
  const overview = projectHomeOverview([], [originSnapshot([catalogItem()])]);
  assert.equal(overview.groups.length, 0);
  assert.equal(catalogHasNewChanges([], [originSnapshot([catalogItem()])]), true);
});

test("current saved reviews remain openable while disconnected", () => {
  const saved = projectHomeOverview(
    [summary({ id: "local-1", title: "Local" })],
    [],
  ).groups[0].cards[0];
  assert.equal(homeCardAction(saved, false), "open-saved");
  const catalogOnly = projectHomeOverview([], [originSnapshot([catalogItem()])]);
  assert.equal(catalogOnly.groups.length, 0);
});

const SHA_C = "cccccccccccccccccccccccccccccccccccccccc";

test("a changed saved diff marks the book yellow and the title still opens the saved review", () => {
  const item = catalogItem({ sourceCommit: SHA_C });
  const overview = projectHomeOverview(
    [
      summary({
        id: "saved-1101",
        title: "Needs review",
        syncKey: "azure-devops:dev.azure.com:repo-1:1101",
        sourceCommit: SHA_A,
        diffCommit: SHA_C,
        pullRequest: {
          provider: "azure-devops",
          host: "dev.azure.com",
          repository: {
            id: "repo-1",
            owner: "braidteam/BRAID",
            name: "braid-connection-designer",
          },
          number: 1101,
          webUrl:
            "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1101",
          targetRef: "develop",
          sourceRef: "feature/review-me",
        },
      }),
    ],
    [originSnapshot([item])],
  );
  const card = overview.groups[0].cards[0];
  assert.equal(card.outdated, true);
  assert.equal(card.bookStatus, "yellow");
  assert.equal(card.archived, false);
  assert.equal(card.reviewId, "saved-1101");
  assert.equal(homeCardAction(card, true), "open-saved");
  assert.equal(homeCardAction(card, false), "open-saved");
  assert.equal(guideBookHover(card.bookStatus), "Guide stale. Ask your coding agent to update the guide");
});

test("Open saved keeps the old review and a persistent Outdated warning", () => {
  const saved = summary({
    id: "saved-1101",
    title: "Needs review",
    head: SHA_A,
    syncKey: "azure-devops:dev.azure.com:repo-1:1101",
    sourceCommit: SHA_A,
    diffCommit: SHA_C,
    pullRequest: {
      provider: "azure-devops",
      host: "dev.azure.com",
      repository: {
        id: "repo-1",
        owner: "braidteam/BRAID",
        name: "braid-connection-designer",
      },
      number: 1101,
      webUrl:
        "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1101",
      targetRef: "develop",
      sourceRef: "feature/review-me",
    },
  });
  const catalog = [originSnapshot([catalogItem({ sourceCommit: SHA_C })])];
  const overview = projectHomeOverview([saved], catalog);
  assert.equal(overview.groups[0].cards[0].reviewId, "saved-1101");
  assert.equal(overview.groups[0].cards[0].outdated, true);
  const warning = reviewOutdatedWarning(saved, catalog);
  assert.match(warning ?? "", /outdated/i);
  assert.equal(reviewOutdatedWarning(saved, [originSnapshot([catalogItem()])]), undefined);
});

function hostedSummary(
  id: string,
  number: number,
  title: string,
  extra: Partial<ReviewSummary> = {},
): ReviewSummary {
  return summary({
    id,
    title,
    syncKey: `azure-devops:dev.azure.com:repo-1:${number}`,
    sourceCommit: SHA_A,
    pullRequest: {
      provider: "azure-devops",
      host: "dev.azure.com",
      repository: {
        id: "repo-1",
        owner: "braidteam/BRAID",
        name: "braid-connection-designer",
      },
      number,
      webUrl: `https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/${number}`,
      targetRef: "develop",
      sourceRef: "feature/review-me",
    },
    ...extra,
  });
}

test("a leftover hosted Other saved PR marks the book yellow when the saved diff moved", () => {
  const saved = hostedSummary("saved-other", 1301, "Someone else's PR", {
    diffCommit: SHA_C,
  });
  const overview = projectHomeOverview(
    [saved],
    [
      originSnapshot([
        catalogItem({
          number: 1301,
          title: "Someone else's PR",
          webUrl:
            "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1301",
          sourceCommit: SHA_C,
          isReviewer: false,
          isAuthor: false,
        }),
      ]),
    ],
  );
  assert.deepEqual(
    overview.groups.map((group) => group.id),
    ["other-saved-prs"],
  );
  const card = overview.groups[0].cards[0];
  assert.equal(card.reviewId, "saved-other");
  assert.equal(card.outdated, true);
  assert.equal(card.bookStatus, "yellow");
  assert.equal(card.archived, false);
  assert.equal(card.openTarget?.number, 1301);
  assert.equal(homeCardAction(card, true), "open-saved");
  assert.equal(homeCardAction(card, false), "open-saved");
});

test("archived cards say Merged or Closed and their book never turns yellow", () => {
  const merged = hostedSummary("saved-merged", 1201, "Merged work", {
    sourceCommit: SHA_A,
  });
  const closed = hostedSummary("saved-closed", 1202, "Closed work", {
    sourceCommit: SHA_A,
  });
  const abandoned = hostedSummary("saved-abandoned", 1203, "Abandoned work", {
    sourceCommit: SHA_A,
  });
  const overview = projectHomeOverview(
    [merged, closed, abandoned],
    [
      originSnapshot([
        catalogItem({
          number: 1201,
          title: "Merged work",
          webUrl:
            "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1201",
          status: "completed",
          sourceCommit: SHA_C,
          isReviewer: true,
          updatedAt: "2026-09-01T00:00:00.000Z",
        }),
        catalogItem({
          number: 1202,
          title: "Closed work",
          webUrl:
            "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1202",
          status: "closed",
          sourceCommit: SHA_C,
          isReviewer: false,
          isAuthor: true,
          updatedAt: "2026-09-20T00:00:00.000Z",
        }),
        catalogItem({
          number: 1203,
          title: "Abandoned work",
          webUrl:
            "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1203",
          status: "abandoned",
          sourceCommit: SHA_C,
          isReviewer: false,
          isAuthor: true,
          updatedAt: "2026-09-10T00:00:00.000Z",
        }),
      ]),
    ],
  );
  assert.deepEqual(
    overview.groups.map((group) => ({
      id: group.id,
      title: group.title,
      collapsed: group.collapsed,
      cards: group.cards.map((card) => ({
        title: card.title,
        archivedLabel: card.archivedLabel,
        bookStatus: card.bookStatus,
        outdated: card.outdated,
        action: homeCardAction(card, true),
      })),
    })),
    [
      {
        id: "archived",
        title: "Archived",
        collapsed: true,
        cards: [
          {
            title: "Closed work",
            archivedLabel: "Closed",
            bookStatus: "green",
            outdated: false,
            action: "open-saved",
          },
          {
            title: "Abandoned work",
            archivedLabel: "Closed",
            bookStatus: "green",
            outdated: false,
            action: "open-saved",
          },
          {
            title: "Merged work",
            archivedLabel: "Merged",
            bookStatus: "green",
            outdated: false,
            action: "open-saved",
          },
        ],
      },
    ],
  );
});

test("a closed unguided catalog item disappears after refresh", () => {
  const overview = projectHomeOverview(
    [],
    [
      originSnapshot([
        catalogItem({
          number: 1201,
          title: "Merged with no guide",
          webUrl:
            "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1201",
          status: "completed",
          isReviewer: true,
        }),
        catalogItem({
          number: 1103,
          title: "Still open",
          webUrl:
            "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1103",
          isReviewer: true,
          isAuthor: false,
        }),
      ]),
    ],
  );
  assert.equal(overview.groups.length, 0);
});

test("projection covers grey, yellow, green, and archived book states", () => {
  const current = hostedSummary("saved-current", 1101, "Current work", {
    diffCommit: SHA_A,
  });
  const outdated = hostedSummary("saved-outdated", 1102, "Outdated work", {
    sourceCommit: SHA_A,
    diffCommit: SHA_C,
  });
  const unchaptered = hostedSummary("saved-noguide", 1105, "Needs a guide", {
    unchaptered: true,
    diffCommit: SHA_A,
  });
  const archived = hostedSummary("saved-archived", 1103, "Archived work", {
    diffCommit: SHA_A,
  });
  const overview = projectHomeOverview(
    [current, outdated, unchaptered, archived],
    [
      originSnapshot([
        catalogItem({
          number: 1101,
          title: "Current work",
          sourceCommit: SHA_A,
          isReviewer: true,
          isAuthor: false,
        }),
        catalogItem({
          number: 1102,
          title: "Outdated work",
          webUrl:
            "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1102",
          sourceCommit: SHA_C,
          isReviewer: false,
          isAuthor: true,
        }),
        catalogItem({
          number: 1105,
          title: "Needs a guide",
          webUrl:
            "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1105",
          isReviewer: true,
          isAuthor: false,
        }),
        catalogItem({
          number: 1103,
          title: "Archived work",
          webUrl:
            "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1103",
          status: "completed",
          isReviewer: true,
        }),
        catalogItem({
          number: 1104,
          title: "Closed unguided",
          webUrl:
            "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1104",
          status: "abandoned",
          isAuthor: true,
        }),
      ]),
    ],
  );
  assert.deepEqual(
    overview.groups.map((group) => ({
      id: group.id,
      collapsed: group.collapsed ?? false,
      cards: group.cards.map((card) => ({
        title: card.title,
        bookStatus: card.bookStatus,
        archivedLabel: card.archivedLabel,
        outdated: card.outdated,
        archived: card.archived,
        action: homeCardAction(card, true),
        hover: guideBookHover(card.bookStatus),
      })),
    })),
    [
      {
        id: "review-requests",
        collapsed: false,
        cards: [
          {
            title: "Current work",
            bookStatus: "green",
            archivedLabel: undefined,
            outdated: false,
            archived: false,
            action: "open-saved",
            hover: "The guide is up to date",
          },
          {
            title: "Needs a guide",
            bookStatus: "grey",
            archivedLabel: undefined,
            outdated: false,
            archived: false,
            action: "open-saved",
            hover: "Guide missing. Ask your coding agent to generate the guide",
          },
        ],
      },
      {
        id: "my-published-prs",
        collapsed: false,
        cards: [
          {
            title: "Outdated work",
            bookStatus: "yellow",
            archivedLabel: undefined,
            outdated: true,
            archived: false,
            action: "open-saved",
            hover: "Guide stale. Ask your coding agent to update the guide",
          },
        ],
      },
      {
        id: "archived",
        collapsed: true,
        cards: [
          {
            title: "Archived work",
            bookStatus: "green",
            archivedLabel: "Merged",
            outdated: false,
            archived: true,
            action: "open-saved",
            hover: "The guide is up to date",
          },
        ],
      },
    ],
  );
});

test("a chaptered review with no saved diff stays green and still dots the refresh icon", () => {
  const saved = hostedSummary("saved-current", 1101, "Current work");
  const catalog = [originSnapshot([catalogItem({ number: 1101, sourceCommit: SHA_A })])];
  const card = projectHomeOverview([saved], catalog).groups[0].cards[0];
  assert.equal(card.bookStatus, "green");
  assert.equal(catalogHasNewChanges([saved], catalog), true);
});

test("homeDiffSyncTargets covers reviewer authored rows and reviews missing a diff", () => {
  const withDiff = hostedSummary("saved-current", 1101, "Current work", {
    diffCommit: SHA_A,
  });
  const missingDiff = hostedSummary("saved-other", 1301, "Other");
  const catalog = [
    originSnapshot([
      catalogItem({ number: 1101, sourceCommit: SHA_B, isReviewer: true }),
      catalogItem({
        number: 1106,
        title: "New PR",
        webUrl:
          "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1106",
        isReviewer: true,
      }),
      catalogItem({
        number: 1301,
        title: "Other",
        webUrl:
          "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1301",
        isReviewer: false,
        isAuthor: false,
      }),
    ]),
  ];
  const targets = homeDiffSyncTargets([withDiff, missingDiff], catalog);
  assert.deepEqual(
    targets.map((row) => row.number).sort((a, b) => a - b),
    [1101, 1106, 1301],
  );
});
