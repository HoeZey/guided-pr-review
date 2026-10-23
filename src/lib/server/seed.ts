import { GuideV1 } from "../shared/contracts/guide.ts";
import { jsonRepositories } from "./repositories/json/store.ts";
import type { ReviewRepository } from "./repositories/ports.ts";
import sample from "../../../examples/sample-guide.json";

export function createEnsureSeed(repos: Pick<ReviewRepository, "seedIfEmpty">) {
  let seeded = false;
  return async function ensureSeed(): Promise<void> {
    if (seeded) return;
    await repos.seedIfEmpty(GuideV1.parse(sample));
    seeded = true;
  };
}

export const ensureSeed = createEnsureSeed(jsonRepositories);
