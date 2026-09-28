import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { AppRepositories, ConfiguredRepositoryPort } from "../repositories/ports.ts";
import type { CommandRunner, CredentialSource } from "../auth/ports.ts";
import type { GitDiff, ManagedGitCache } from "../git/ports.ts";
import { createManagedGitCache } from "../git/managed-cache.ts";
import { createGitProcessRunner } from "../git/process.ts";
import type { ProviderPullRequestReader, ProviderRepositoryReader } from "../providers/ports.ts";
import type { CommentProvider } from "../providers/comments.ts";
import { createCliCredentialSource } from "../auth/cli-credentials.ts";
import { createProcessCommandRunner } from "../auth/command-runner.ts";
import { createAdoCommentAdapter } from "../providers/ado-comments.ts";
import { createAdoRestAdapter } from "../providers/ado-rest.ts";
import { createGithubCommentProvider } from "../providers/github/comments.ts";
import { createGithubProvider } from "../providers/github/rest.ts";
import { createActionService, type ActionService } from "./actions.ts";
import { createCatalogService, type CatalogService } from "./catalog.ts";
import {
  createCatalogRefreshService,
  type CatalogRefreshService,
} from "./catalog-refresh.ts";
import { createCommentService, type CommentService } from "./comments.ts";
import { createConnectionService, type ConnectionService } from "./connections.ts";
import {
  createConfiguredRepositoryService,
  createCliHostRepositoryLister,
  type ConfiguredRepositoryService,
  type HostRepositoryLister,
} from "./configured-repositories.ts";
import { createOutcomeService, type OutcomeService } from "./outcomes.ts";
import { createReviewService, type ReviewService } from "./reviews.ts";

export type AppServices = {
  reviews: ReviewService;
  catalog: CatalogService;
  catalogRefresh: CatalogRefreshService;
  actions: ActionService;
  outcomes: OutcomeService;
  connections: ConnectionService;
  repositories: ConfiguredRepositoryService;
  comments: CommentService;
};

function defaultDataDir(): string {
  return (
    process.env.GUIDED_PR_REVIEW_DATA ||
    join(fileURLToPath(new URL("../../../../", import.meta.url)), "data")
  );
}

export function createAppServices(
  repos: AppRepositories,
  options: {
    credentials?: CredentialSource;
    configured?: ConfiguredRepositoryPort;
    collectionPresent?: () => Promise<boolean>;
    originRemoteUrl?: () => Promise<string | undefined>;
    hostList?: HostRepositoryLister;
    commandRunner?: CommandRunner;
    readers?: {
      ado: ProviderRepositoryReader & Partial<ProviderPullRequestReader>;
      github: ProviderRepositoryReader & Partial<ProviderPullRequestReader>;
    };
    git?: ManagedGitCache & GitDiff;
    commentProviders?: {
      ado: CommentProvider;
      github: CommentProvider;
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
  const hostList =
    options.hostList ??
    createCliHostRepositoryLister(options.commandRunner ?? createProcessCommandRunner());
  const repositories = createConfiguredRepositoryService({
    configured: options.configured ?? emptyConfigured(),
    collectionPresent: options.collectionPresent ?? (async () => false),
    originRemoteUrl: options.originRemoteUrl ?? (async () => undefined),
    readers,
    hostList,
  });
  const prReaders = {
    ado: pullRequestReader(readers.ado),
    github: pullRequestReader(readers.github),
  };
  const git =
    options.git ??
    createManagedGitCache({
      dataDir: defaultDataDir(),
      runner: createGitProcessRunner(),
      credentials,
    });
  const commentProviders = options.commentProviders ?? {
    ado: createAdoCommentAdapter({ credentials }),
    github: createGithubCommentProvider({ credentials }),
  };
  return {
    reviews: createReviewService(repos, {
      readers: prReaders,
      repositoryReaders: { ado: readers.ado, github: readers.github },
      listConfigured: async () => (await repositories.list()).repositories,
      git,
    }),
    catalog,
    catalogRefresh: createCatalogRefreshService({
      listRepositories: () => repositories.list(),
      replaceCatalog: catalog.replace,
      listReviews: repos.listReviews,
      readers: prReaders,
    }),
    actions: createActionService(repos),
    outcomes: createOutcomeService(repos),
    connections: createConnectionService(credentials),
    repositories,
    comments: createCommentService({
      reviews: repos,
      credentials,
      providers: commentProviders,
    }),
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
    getCommentContext: reader.getCommentContext?.bind(reader),
  };
}

function emptyConfigured(): ConfiguredRepositoryPort {
  return {
    list: async () => [],
    add: async () => ({ ok: true as const }),
    remove: async () => ({ ok: true as const }),
  };
}
