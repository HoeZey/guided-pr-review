import { GuideV1 } from "./contracts.ts";
import { seedIfEmpty } from "./store.ts";
import sample from "../examples/sample-guide.json";

let seeded = false;

export async function ensureSeed(): Promise<void> {
  if (seeded) return;
  await seedIfEmpty(GuideV1.parse(sample));
  seeded = true;
}
