import type { AppRepositories, ConfiguredRepositoryPort } from "../repositories/ports.ts";
import type { CredentialSource } from "../auth/ports.ts";
import type { ProviderRepositoryReader } from "../providers/ports.ts";
import { createCliCredentialSource } from "../auth/cli-credentials.ts";
import { createProcessCommandRunner } from "../auth/command-runner.ts";
import { createAdoRestAdapter } from "../providers/ado-rest.ts";
import { createGithubProvider } from "../providers/github/rest.ts";
import { createActionService, type ActionService } from "./actions.ts";
import { createCatalogService, type CatalogService } from "./catalog.ts";
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
    readers?: { ado: ProviderRepositoryReader; github: ProviderRepositoryReader };
  } = {},
): AppServices {
  const credentials =
    options.credentials ?? createCliCredentialSource({ runner: createProcessCommandRunner() });
  const readers = options.readers ?? {
    ado: createAdoRestAdapter({ credentials }),
    github: createGithubProvider({ credentials }),
  };
  return {
    reviews: createReviewService(repos),
    catalog: createCatalogService(repos),
    actions: createActionService(repos),
    outcomes: createOutcomeService(repos),
    guides: createGuideHandoffService(repos),
    connections: createConnectionService(credentials),
    repositories: createConfiguredRepositoryService({
      configured: options.configured ?? emptyConfigured(),
      collectionPresent: options.collectionPresent ?? (async () => false),
      originRemoteUrl: options.originRemoteUrl ?? (async () => undefined),
      readers,
    }),
  };
}

function emptyConfigured(): ConfiguredRepositoryPort {
  return {
    list: async () => [],
    add: async () => ({ ok: true as const }),
    remove: async () => ({ ok: true as const }),
  };
}

