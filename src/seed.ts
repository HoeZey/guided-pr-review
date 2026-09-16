import { GuideV1 } from "./lib/shared/contracts/guide.ts";
import { seedIfEmpty } from "./lib/server/repositories/json/store.ts";
import sample from "../examples/sample-guide.json";

let seeded = false;

export async function ensureSeed(): Promise<void> {
  if (seeded) return;
  await seedIfEmpty(GuideV1.parse(sample));
  seeded = true;
}
