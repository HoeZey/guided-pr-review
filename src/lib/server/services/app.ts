import type { AppRepositories } from "../repositories/ports.ts";
import { createActionService, type ActionService } from "./actions.ts";
import { createCatalogService, type CatalogService } from "./catalog.ts";
import { createGuideHandoffService, type GuideHandoffService } from "./guides.ts";
import { createOutcomeService, type OutcomeService } from "./outcomes.ts";
import { createReviewService, type ReviewService } from "./reviews.ts";

export type AppServices = {
  reviews: ReviewService;
  catalog: CatalogService;
  actions: ActionService;
  outcomes: OutcomeService;
  guides: GuideHandoffService;
};

export function createAppServices(repos: AppRepositories): AppServices {
  return {
    reviews: createReviewService(repos),
    catalog: createCatalogService(repos),
    actions: createActionService(repos),
    outcomes: createOutcomeService(repos),
    guides: createGuideHandoffService(repos),
  };
}
