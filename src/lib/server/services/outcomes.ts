import type { OutcomeRepository } from "../repositories/ports.ts";

export type OutcomeService = {
  publish: (reviewId: string, outcome: unknown) => Promise<{ id: string }>;
};

export function createOutcomeService(repos: OutcomeRepository): OutcomeService {
  return {
    publish: (reviewId, outcome) => repos.publishReviewOutcome(reviewId, outcome),
  };
}
