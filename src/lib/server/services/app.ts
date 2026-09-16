import type { AppRepositories } from "../repositories/ports.ts";
import type { CredentialSource } from "../auth/ports.ts";
import { createCliCredentialSource } from "../auth/cli-credentials.ts";
import { createProcessCommandRunner } from "../auth/command-runner.ts";
import { createActionService, type ActionService } from "./actions.ts";
import { createCatalogService, type CatalogService } from "./catalog.ts";
import { createConnectionService, type ConnectionService } from "./connections.ts";
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
};

export function createAppServices(
  repos: AppRepositories,
  options: { credentials?: CredentialSource } = {},
): AppServices {
  const credentials =
    options.credentials ?? createCliCredentialSource({ runner: createProcessCommandRunner() });
  return {
    reviews: createReviewService(repos),
    catalog: createCatalogService(repos),
    actions: createActionService(repos),
    outcomes: createOutcomeService(repos),
    guides: createGuideHandoffService(repos),
    connections: createConnectionService(credentials),
  };
}
