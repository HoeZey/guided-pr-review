import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  emptyStore,
  GuideV1,
  StoreV1,
  type ListReviewsOutput,
} from "./contracts.ts";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");

let cache: StoreV1 | null = null;

export function dataFile(): string {
  const dir = process.env.GUIDED_PR_REVIEW_DATA || join(root, "data");
  return join(dir, "reviews.json");
}

export function resetStoreCache(): void {
  cache = null;
}

async function readStore(): Promise<StoreV1> {
  if (cache) return cache;
  const file = dataFile();
  try {
    const raw = await readFile(file, "utf8");
    cache = StoreV1.parse(JSON.parse(raw));
    return cache;
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      cache = emptyStore();
      return cache;
    }
    throw err;
  }
}

async function writeStore(next: StoreV1): Promise<void> {
  const parsed = StoreV1.parse(next);
  const file = dataFile();
  await mkdir(dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  await writeFile(tmp, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  await rename(tmp, file);
  cache = parsed;
}

export async function listReviews(): Promise<ListReviewsOutput> {
  const store = await readStore();
  return {
    activeId: store.activeId,
    reviews: store.reviews.map((r) => ({
      id: r.id,
      title: r.guide.title,
      range: r.guide.range,
      addedAt: r.addedAt,
    })),
  };
}

export async function addReview(input: unknown): Promise<{ id: string }> {
  const { guide } = { guide: GuideV1.parse(input) };
  const store = await readStore();
  const id = crypto.randomUUID();
  store.reviews.push({
    id,
    addedAt: new Date().toISOString(),
    guide,
  });
  store.activeId = id;
  await writeStore(store);
  return { id };
}

export async function addReviewFromTool(
  body: unknown,
): Promise<{ id: string }> {
  const parsed = GuideV1.parse(
    body && typeof body === "object" && "guide" in body
      ? (body as { guide: unknown }).guide
      : body,
  );
  return addReview(parsed);
}

export async function removeReview(id: string): Promise<{ ok: true }> {
  const store = await readStore();
  const next = store.reviews.filter((r) => r.id !== id);
  if (next.length === store.reviews.length) {
    throw Object.assign(new Error(`unknown review ${id}`), { status: 404 });
  }
  store.reviews = next;
  if (store.activeId === id) {
    store.activeId = next[0]?.id ?? null;
  }
  await writeStore(store);
  return { ok: true };
}

export async function getReview(id: string): Promise<{ guide: GuideV1 }> {
  const store = await readStore();
  const found = store.reviews.find((r) => r.id === id);
  if (!found) {
    throw Object.assign(new Error(`unknown review ${id}`), { status: 404 });
  }
  return { guide: found.guide };
}

export async function setActive(id: string): Promise<{ activeId: string }> {
  const store = await readStore();
  if (!store.reviews.some((r) => r.id === id)) {
    throw Object.assign(new Error(`unknown review ${id}`), { status: 404 });
  }
  store.activeId = id;
  await writeStore(store);
  return { activeId: id };
}

export async function seedIfEmpty(guide: GuideV1): Promise<void> {
  const store = await readStore();
  if (store.reviews.length > 0) return;
  await addReview(guide);
}
