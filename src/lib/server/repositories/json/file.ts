import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { emptyStore, StoreV1 } from "../../../shared/contracts/persistence.ts";

const root = fileURLToPath(new URL("../../../../../", import.meta.url));

let cache: StoreV1 | null = null;
let configuredCollectionPresent = false;
// ponytail: one in-process lock. Fine for a single Node. SQLite if writers multiply.
let chain: Promise<void> = Promise.resolve();

function dataFile(): string {
  const dir = process.env.GUIDED_PR_REVIEW_DATA || join(root, "data");
  return join(dir, "reviews.json");
}

export function resetJsonStoreCache(): void {
  cache = null;
  configuredCollectionPresent = false;
}

export function configuredRepositoriesCollectionPresent(): boolean {
  return configuredCollectionPresent;
}

export function markConfiguredRepositoriesCollection(): void {
  configuredCollectionPresent = true;
}

export async function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(fn, fn);
  chain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function readStore(): Promise<StoreV1> {
  if (cache) return cache;
  const file = dataFile();
  try {
    const raw = await readFile(file, "utf8");
    const parsedJson: unknown = JSON.parse(raw);
    configuredCollectionPresent =
      Boolean(parsedJson) &&
      typeof parsedJson === "object" &&
      !Array.isArray(parsedJson) &&
      Object.prototype.hasOwnProperty.call(parsedJson, "repositories");
    cache = StoreV1.parse(parsedJson);
    return cache;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      configuredCollectionPresent = false;
      cache = emptyStore();
      return cache;
    }
    throw err;
  }
}

export async function writeStore(next: StoreV1): Promise<void> {
  const parsed = StoreV1.parse(next);
  if (parsed.repositories.length > 0) configuredCollectionPresent = true;
  const file = dataFile();
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  const body: Record<string, unknown> = { ...parsed };
  if (!configuredCollectionPresent && parsed.repositories.length === 0) {
    delete body.repositories;
  }
  await writeFile(tmp, `${JSON.stringify(body, null, 2)}\n`, "utf8");
  await rename(tmp, file);
  cache = parsed;
}

export async function mutateStore<T>(fn: (store: StoreV1) => T): Promise<T> {
  return locked(async () => {
    const store = structuredClone(await readStore());
    const result = fn(store);
    await writeStore(store);
    return result;
  });
}
