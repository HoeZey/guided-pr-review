import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  emptyStore,
  GuideV1,
  pullRequestSyncKey,
  StoreV1,
  type ListReviewsOutput,
  type PullRequestSource,
  type ReviewRecord,
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

const TICKET_RE = /\b[A-Z][A-Z0-9]+-\d+\b/i;

function normalizeGitRef(ref: string): string {
  return ref.replace(/^refs\/heads\//i, "").toLowerCase();
}

function rangeHead(range: string | undefined): string | undefined {
  if (!range) return undefined;
  const idx = range.lastIndexOf("...");
  if (idx === -1) return undefined;
  return range.slice(idx + 3).trim() || undefined;
}

function ticketKey(value: string): string | undefined {
  const match = value.match(TICKET_RE);
  return match ? match[0].toUpperCase() : undefined;
}

function sameRepository(review: ReviewRecord, source: PullRequestSource): boolean {
  const repo = review.guide.repo;
  return !repo || repo === source.repository.name;
}

function findLocalReviewToAdopt(
  reviews: ReviewRecord[],
  source: PullRequestSource,
): ReviewRecord | undefined {
  const unsourced = reviews.filter(
    (review) => !review.guide.source && sameRepository(review, source),
  );
  const sourceHead = normalizeGitRef(source.sourceRef);
  const exact = unsourced.filter((review) => {
    const head = rangeHead(review.guide.range);
    return head !== undefined && normalizeGitRef(head) === sourceHead;
  });
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return undefined;

  const ticket = ticketKey(source.sourceRef);
  if (!ticket) return undefined;
  const byTicket = unsourced.filter((review) => {
    const head = rangeHead(review.guide.range);
    return head !== undefined && ticketKey(head) === ticket;
  });
  if (byTicket.length === 1) return byTicket[0];
  return undefined;
}

function unwrapGuide(body: unknown): GuideV1 {
  return GuideV1.parse(
    body && typeof body === "object" && "guide" in body
      ? (body as { guide: unknown }).guide
      : body,
  );
}

function toSummary(record: ReviewRecord): ListReviewsOutput["reviews"][number] {
  const source = record.guide.source;
  if (!source) {
    return {
      id: record.id,
      title: record.guide.title,
      range: record.guide.range,
      addedAt: record.addedAt,
    };
  }
  return {
    id: record.id,
    title: record.guide.title,
    range: record.guide.range,
    addedAt: record.addedAt,
    syncKey: pullRequestSyncKey(source),
    sourceCommit: source.sourceCommit,
    pullRequest: {
      provider: source.provider,
      host: source.host,
      repository: {
        id: source.repository.id,
        owner: source.repository.owner,
        name: source.repository.name,
      },
      number: source.number,
      webUrl: source.webUrl,
    },
  };
}

async function appendActive(guide: GuideV1): Promise<{ id: string }> {
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

export async function listReviews(): Promise<ListReviewsOutput> {
  const store = await readStore();
  return {
    activeId: store.activeId,
    reviews: store.reviews.map(toSummary),
  };
}

export async function addReview(input: unknown): Promise<{ id: string }> {
  return appendActive(GuideV1.parse(input));
}

export async function addReviewFromTool(
  body: unknown,
): Promise<{ id: string }> {
  return addReview(unwrapGuide(body));
}

export async function upsertReview(input: unknown): Promise<{ id: string }> {
  const guide = GuideV1.parse(input);
  if (!guide.source) {
    throw Object.assign(new Error("upsert_review requires pull-request source"), {
      status: 400,
    });
  }
  const key = pullRequestSyncKey(guide.source);
  const store = await readStore();
  const found =
    store.reviews.find(
      (review) =>
        review.guide.source && pullRequestSyncKey(review.guide.source) === key,
    ) ?? findLocalReviewToAdopt(store.reviews, guide.source);
  if (found) {
    found.guide = guide;
    store.activeId = found.id;
    await writeStore(store);
    return { id: found.id };
  }
  return appendActive(guide);
}

export async function upsertReviewFromTool(
  body: unknown,
): Promise<{ id: string }> {
  return upsertReview(unwrapGuide(body));
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
