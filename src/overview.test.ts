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
