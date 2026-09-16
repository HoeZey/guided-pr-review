import type { AppRepositories, ConfiguredRepositoryPort } from "../repositories/ports.ts";
import type { CredentialSource } from "../auth/ports.ts";
import type { ProviderPullRequestReader, ProviderRepositoryReader } from "../providers/ports.ts";
import { createCliCredentialSource } from "../auth/cli-credentials.ts";
import { createProcessCommandRunner } from "../auth/command-runner.ts";
import { createAdoRestAdapter } from "../providers/ado-rest.ts";
import { createGithubProvider } from "../providers/github/rest.ts";
import { createActionService, type ActionService } from "./actions.ts";
import { createCatalogService, type CatalogService } from "./catalog.ts";
import {
  createCatalogRefreshService,
  type CatalogRefreshService,
} from "./catalog-refresh.ts";
import { createConnectionService, type ConnectionService } from "./connections.ts";
import {
  createConfiguredRepositoryService,
  type ConfiguredRepositoryService,
} from "./configured-repositories.ts";
import { createGuideHandoffService, type GuideHandoffService } from "./guides.ts";
import { createOutcomeService, type OutcomeService } from "./outcomes.ts";
import { createReviewService, type ReviewService } from "./reviews.ts";

export type AppServices = {
  reviews: ReviewService;
  catalog: CatalogService;
  catalogRefresh: CatalogRefreshService;
  actions: ActionService;
  outcomes: OutcomeService;
  guides: GuideHandoffService;
  connections: ConnectionService;
  repositories: ConfiguredRepositoryService;
};

export function createAppServices(
  repos: AppRepositories,
  options: {
    credentials?: CredentialSource;
    configured?: ConfiguredRepositoryPort;
    collectionPresent?: () => Promise<boolean>;
    originRemoteUrl?: () => Promise<string | undefined>;
    readers?: {
      ado: ProviderRepositoryReader & Partial<ProviderPullRequestReader>;
      github: ProviderRepositoryReader & Partial<ProviderPullRequestReader>;
    };
  } = {},
): AppServices {
  const credentials =
    options.credentials ?? createCliCredentialSource({ runner: createProcessCommandRunner() });
  const readers = options.readers ?? {
    ado: createAdoRestAdapter({ credentials }),
    github: createGithubProvider({ credentials }),
  };
  const catalog = createCatalogService(repos);
  const repositories = createConfiguredRepositoryService({
    configured: options.configured ?? emptyConfigured(),
    collectionPresent: options.collectionPresent ?? (async () => false),
    originRemoteUrl: options.originRemoteUrl ?? (async () => undefined),
    readers,
  });
  return {
    reviews: createReviewService(repos),
    catalog,
    catalogRefresh: createCatalogRefreshService({
      listRepositories: () => repositories.list(),
      replaceCatalog: catalog.replace,
      listReviews: repos.listReviews,
      readers: {
        ado: pullRequestReader(readers.ado),
        github: pullRequestReader(readers.github),
      },
    }),
    actions: createActionService(repos),
    outcomes: createOutcomeService(repos),
    guides: createGuideHandoffService(repos),
    connections: createConnectionService(credentials),
    repositories,
  };
}

function pullRequestReader(
  reader: ProviderRepositoryReader & Partial<ProviderPullRequestReader>,
): ProviderPullRequestReader {
  return {
    listPullRequests: (repository) => {
      if (!reader.listPullRequests) {
        return Promise.reject(new Error(`missing pull request reader for ${repository.provider}`));
      }
      return reader.listPullRequests(repository);
    },
    getPullRequest: (input) => {
      if (!reader.getPullRequest) {
        return Promise.reject(new Error(`missing pull request reader for ${input.provider}`));
      }
      return reader.getPullRequest(input);
    },
  };
}

function emptyConfigured(): ConfiguredRepositoryPort {
  return {
    list: async () => [],
    add: async () => ({ ok: true as const }),
    remove: async () => ({ ok: true as const }),
  };
}

