import assert from "node:assert/strict";
import { test } from "node:test";
import type { ReviewSummary } from "./contracts.ts";
import { HOME_PATH, projectHomeCards, resolveOverviewView, reviewPath } from "./overview.ts";

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
    },
  });
  const cards = projectHomeCards([local, hosted]);
  assert.equal(cards[0].repository, undefined);
  assert.deepEqual(cards[1].repository, {
    owner: "braidteam/BRAID",
    name: "braid-connection-designer",
  });
});

test("Home cards keep title and saved range", () => {
  const cards = projectHomeCards([
    summary({ id: "local-1", title: "Local", range: "main...feature/one" }),
    summary({ id: "pr-1027", title: "Named PR", range: undefined }),
  ]);
  assert.deepEqual(
    cards.map((card) => ({ title: card.title, range: card.range })),
    [
      { title: "Local", range: "main...feature/one" },
      { title: "Named PR", range: undefined },
    ],
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
