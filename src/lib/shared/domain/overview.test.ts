import assert from "node:assert/strict";
import { test } from "node:test";
import type { CatalogPullRequest, CatalogSnapshot } from "../contracts/catalog.ts";
import type { ReviewSummary } from "../contracts/persistence.ts";
import {
  HOME_PATH,
  generateGuideHint,
  guidePresentsWalkthrough,
  homeCardAction,
  hostActionHint,
  inFlightGenerateGuideCopy,
  inFlightOpenCopy,
  inFlightActionCopy,
  latestGenerateGuideAction,
  offersGenerateGuide,
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
  const overview = projectHomeOverview(
    [
      summary({
        id: "saved-1101",
        title: "Needs review",
        syncKey: "azure-devops:dev.azure.com:repo-1:1101",
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
    [originSnapshot([requested, leftover])],
  );
  const cards = overview.groups.find((group) => group.id === "review-requests")?.cards ?? [];
  assert.equal(cards.length, 2);
  assert.equal(cards[0].title, "Needs review");
  assert.equal(cards[0].hasGuide, true);
  assert.equal(cards[0].reviewId, "saved-1101");
  assert.equal(cards[1].title, "No guide yet");
  assert.equal(cards[1].hasGuide, false);
  assert.equal(cards[1].reviewId, undefined);
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

test("the Guide tab does not present a placeholder walkthrough for an unchaptered review", () => {
  assert.equal(guidePresentsWalkthrough({ unchaptered: true }), false);
  assert.equal(guidePresentsWalkthrough({}), true);
  assert.equal(reviewLandingTab({ unchaptered: true }), "diff");
  assert.equal(reviewLandingTab({}), "guide");
});

test("Generate guide is offered only for an unchaptered saved review", () => {
  const unchaptered = projectHomeCards([
    summary({
      id: "saved-1101",
      title: "Needs review",
      unchaptered: true,
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
  ])[0];
  const chaptered = projectHomeCards([
    summary({
      id: "saved-1101",
      title: "Needs review",
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
  ])[0];
  const catalogOnly = projectHomeOverview([], [originSnapshot([catalogItem()])]).groups[0]
    .cards[0];
  const local = projectHomeCards([
    summary({ id: "local-1", title: "Local", unchaptered: true }),
  ])[0];
  assert.equal(offersGenerateGuide(unchaptered), true);
  assert.equal(offersGenerateGuide(chaptered), false);
  assert.equal(offersGenerateGuide(catalogOnly), false);
  assert.equal(offersGenerateGuide(local), false);
});

test("catalog cards without a saved review expose an Open target", () => {
  const overview = projectHomeOverview([], [originSnapshot([catalogItem()])]);
  const card = overview.groups[0].cards[0];
  assert.equal(card.reviewId, undefined);
  assert.deepEqual(card.openTarget, {
    provider: "azure-devops",
    host: "dev.azure.com",
    repository: {
      id: "repo-1",
      owner: "braidteam/BRAID",
      name: "braid-connection-designer",
      webUrl: "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer",
    },
    number: 1101,
  });
  assert.equal(homeCardAction(card, true), "queue-open");
});

test("host-backed actions explain that the skill must be running when disconnected", () => {
  assert.equal(hostActionHint(true), undefined);
  assert.match(hostActionHint(false) ?? "", /skill must be running/);
  assert.equal(inFlightOpenCopy("queued"), "Waiting");
  assert.equal(inFlightOpenCopy("claimed"), "Opening");
  assert.equal(inFlightActionCopy("refresh", "queued"), "Waiting");
  assert.equal(inFlightActionCopy("refresh", "claimed"), "Refreshing");
  assert.equal(inFlightActionCopy("update-diff", "claimed"), "Opening");
});

test("Generate guide shows Waiting, Generating guide, and a disconnected hint", () => {
  assert.equal(inFlightGenerateGuideCopy("queued"), "Waiting");
  assert.equal(inFlightGenerateGuideCopy("claimed"), "Generating guide");
  assert.equal(inFlightGenerateGuideCopy("succeeded"), undefined);
  assert.equal(generateGuideHint(true), undefined);
  assert.match(generateGuideHint(false) ?? "", /skill must be running/);
  const latest = latestGenerateGuideAction("rev-1", [
    {
      id: "open-1",
      kind: "open",
      status: "failed",
      queuedAt: "2026-09-15T00:00:00.000Z",
      target: {
        provider: "azure-devops",
        host: "dev.azure.com",
        repository: {
          id: "repo-1",
          owner: "braidteam/BRAID",
          name: "braid-connection-designer",
          webUrl: "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer",
        },
        number: 1101,
      },
      error: { code: "open-failed", message: "ignored" },
    },
    {
      id: "gen-1",
      kind: "generate-guide",
      status: "failed",
      queuedAt: "2026-09-15T00:01:00.000Z",
      reviewId: "rev-1",
      error: { code: "generate-guide-failed", message: "chaptering timed out" },
    },
  ]);
  assert.equal(latest?.id, "gen-1");
  assert.equal(latest?.error?.message, "chaptering timed out");
});

test("current saved reviews remain openable while disconnected", () => {
  const saved = projectHomeOverview(
    [summary({ id: "local-1", title: "Local" })],
    [],
  ).groups[0].cards[0];
  assert.equal(homeCardAction(saved, false), "open-saved");
  const catalog = projectHomeOverview([], [originSnapshot([catalogItem()])]).groups[0]
    .cards[0];
  assert.equal(homeCardAction(catalog, false), "disabled-host");
  assert.equal(homeCardAction(catalog, true), "queue-open");
});

const SHA_C = "cccccccccccccccccccccccccccccccccccccccc";

test("a changed source commit shows Outdated with Update Diff plus Open saved", () => {
  const item = catalogItem({ sourceCommit: SHA_C });
  const overview = projectHomeOverview(
    [
      summary({
        id: "saved-1101",
        title: "Needs review",
        syncKey: "azure-devops:dev.azure.com:repo-1:1101",
        sourceCommit: SHA_A,
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
  assert.equal(card.archived, false);
  assert.equal(card.reviewId, "saved-1101");
  assert.equal(homeCardAction(card, true), "queue-update-diff");
  assert.equal(homeCardAction(card, false), "open-saved");
});

test("Open saved keeps the old review and a persistent Outdated warning", () => {
  const saved = summary({
    id: "saved-1101",
    title: "Needs review",
    head: SHA_A,
    syncKey: "azure-devops:dev.azure.com:repo-1:1101",
    sourceCommit: SHA_A,
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

test("a leftover hosted Other saved PR is Outdated with Update Diff when the catalog commit moved", () => {
  const saved = hostedSummary("saved-other", 1301, "Someone else's PR");
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
  assert.equal(card.archived, false);
  assert.equal(card.openTarget?.number, 1301);
  assert.equal(homeCardAction(card, true), "queue-update-diff");
  assert.equal(homeCardAction(card, false), "open-saved");
});

test("a saved merged or abandoned PR moves to collapsed Archived and stays openable", () => {
  const merged = hostedSummary("saved-merged", 1201, "Merged work");
  const abandoned = hostedSummary("saved-abandoned", 1202, "Abandoned work");
  const overview = projectHomeOverview(
    [merged, abandoned],
    [
      originSnapshot([
        catalogItem({
          number: 1201,
          title: "Merged work",
          webUrl:
            "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1201",
          status: "completed",
          isReviewer: true,
        }),
        catalogItem({
          number: 1202,
          title: "Abandoned work",
          webUrl:
            "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1202",
          status: "abandoned",
          isReviewer: false,
          isAuthor: true,
        }),
      ]),
    ],
  );
  assert.deepEqual(
    overview.groups.map((group) => ({
      id: group.id,
      title: group.title,
      collapsed: group.collapsed,
      titles: group.cards.map((card) => card.title),
    })),
    [
      {
        id: "archived",
        title: "Archived",
        collapsed: true,
        titles: ["Merged work", "Abandoned work"],
      },
    ],
  );
  const [mergedCard, abandonedCard] = overview.groups[0].cards;
  assert.equal(mergedCard.archived, true);
  assert.equal(mergedCard.outdated, false);
  assert.equal(homeCardAction(mergedCard, true), "open-saved");
  assert.equal(abandonedCard.archived, true);
  assert.equal(homeCardAction(abandonedCard, true), "open-saved");
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
  assert.deepEqual(
    overview.groups.map((group) => ({
      id: group.id,
      titles: group.cards.map((card) => card.title),
    })),
    [{ id: "review-requests", titles: ["Still open"] }],
  );
});

test("projection covers current, outdated, archived, and removed-unguided catalog cases", () => {
  const current = hostedSummary("saved-current", 1101, "Current work");
  const outdated = hostedSummary("saved-outdated", 1102, "Outdated work", {
    sourceCommit: SHA_A,
  });
  const archived = hostedSummary("saved-archived", 1103, "Archived work");
  const overview = projectHomeOverview(
    [current, outdated, archived],
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
        outdated: card.outdated,
        archived: card.archived,
        action: homeCardAction(card, true),
      })),
    })),
    [
      {
        id: "review-requests",
        collapsed: false,
        cards: [
          {
            title: "Current work",
            outdated: false,
            archived: false,
            action: "open-saved",
          },
        ],
      },
      {
        id: "authored-by-me",
        collapsed: false,
        cards: [
          {
            title: "Outdated work",
            outdated: true,
            archived: false,
            action: "queue-update-diff",
          },
        ],
      },
      {
        id: "archived",
        collapsed: true,
        cards: [
          {
            title: "Archived work",
            outdated: false,
            archived: true,
            action: "open-saved",
          },
        ],
      },
    ],
  );
});
