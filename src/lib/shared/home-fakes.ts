import type {
  CatalogPullRequest,
  CatalogSnapshot,
  StoredAction,
} from "./contracts/catalog";
import type { ReviewSummary } from "./contracts/persistence";
import type { HomePageData } from "./page-data";

export const SHA_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
export const SHA_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
export const SHA_C = "cccccccccccccccccccccccccccccccccccccccc";

const REPO = {
  id: "repo-1",
  owner: "braidteam/BRAID",
  name: "braid-connection-designer",
  webUrl: "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer",
} as const;

function catalogItem(overrides: Partial<CatalogPullRequest> = {}): CatalogPullRequest {
  return {
    provider: "azure-devops",
    host: "dev.azure.com",
    repository: { ...REPO },
    number: 1101,
    title: "Current work",
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

function hostedSummary(
  id: string,
  number: number,
  title: string,
  extra: Partial<ReviewSummary> = {},
): ReviewSummary {
  return {
    id,
    title,
    addedAt: "2026-09-14T00:00:00.000Z",
    base: SHA_A,
    head: SHA_B,
    syncKey: `azure-devops:dev.azure.com:repo-1:${number}`,
    sourceCommit: SHA_A,
    pullRequest: {
      provider: "azure-devops",
      host: "dev.azure.com",
      repository: {
        id: REPO.id,
        owner: REPO.owner,
        name: REPO.name,
      },
      number,
      webUrl: `https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/${number}`,
      targetRef: "develop",
      sourceRef: "feature/review-me",
    },
    ...extra,
  };
}

function originSnapshot(
  pullRequests: CatalogPullRequest[],
  extra: Partial<CatalogSnapshot> = {},
): CatalogSnapshot {
  return {
    provider: "azure-devops",
    host: "dev.azure.com",
    repository: { ...REPO },
    syncedAt: "2026-09-14T12:00:00.000Z",
    pullRequests,
    ...extra,
  };
}

const current = hostedSummary("saved-current", 1101, "Current work");
const outdated = hostedSummary("saved-outdated", 1102, "Outdated work");
const archived = hostedSummary("saved-archived", 1103, "Archived work");
const unchaptered = hostedSummary("saved-noguide", 1105, "Needs a guide", {
  unchaptered: true,
});
const local: ReviewSummary = {
  id: "saved-local",
  title: "Local range",
  range: "main...feature/one",
  addedAt: "2026-09-14T00:00:00.000Z",
  base: SHA_A,
  head: SHA_B,
};

export const HOME_FIXTURE: HomePageData = {
  kind: "home",
  status: "ok",
  reviews: [current, outdated, archived, unchaptered, local],
  catalog: [
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
        isReviewer: false,
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
        number: 1106,
        title: "Open from host",
        webUrl:
          "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1106",
        isReviewer: true,
        isAuthor: false,
      }),
    ]),
    originSnapshot([], {
      repository: {
        id: "repo-2",
        owner: "braidteam/BRAID",
        name: "other-repo",
        webUrl: "https://dev.azure.com/braidteam/BRAID/_git/other-repo",
      },
      syncedAt: undefined,
      error: "Azure DevOps returned 401",
      pullRequests: [],
    }),
  ],
  actions: [],
  activeId: "saved-current",
  agentConnected: true,
  repositories: [],
};

export const HOME_FIXTURE_WAITING: HomePageData = {
  ...HOME_FIXTURE,
  actions: [
    {
      id: "open-1",
      kind: "open",
      status: "queued",
      queuedAt: "2026-09-16T00:00:00.000Z",
      target: {
        provider: "azure-devops",
        host: "dev.azure.com",
        repository: { ...REPO },
        number: 1106,
      },
    } satisfies StoredAction,
  ],
};

export const HOME_FIXTURE_DISCONNECTED: HomePageData = {
  ...HOME_FIXTURE,
  agentConnected: false,
};
