import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CodeReviewOutcome,
  emptyStore,
  GuideV1,
  pullRequestSyncKey,
  PullRequestSource,
  StoreV1,
  tools,
  type CatalogPullRequest,
  type CatalogSnapshot,
  type ConfiguredRepository,
  type ListReviewsOutput,
  type OpenActionTarget,
  type ReviewRecord,
  type StoredAction,
  type StoredOutcome,
} from "./contracts.ts";

export const AGENT_CONNECTED_MS = 35_000;

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

const SHA_RE = /^[0-9a-f]{40}$/i;

function projectFromOwner(owner: string): string {
  const idx = owner.indexOf("/");
  return idx === -1 ? owner : owner.slice(idx + 1);
}

function catalogAsSource(
  item: CatalogPullRequest,
  sourceCommit: string,
  targetCommit: string,
): PullRequestSource {
  return PullRequestSource.parse({
    kind: "pull-request",
    provider: item.provider,
    host: item.host,
    repository: item.repository,
    number: item.number,
    webUrl: item.webUrl,
    sourceRef: item.sourceRef,
    targetRef: item.targetRef,
    sourceCommit,
    targetCommit,
    providerContext: {
      kind: "azure-devops",
      project: projectFromOwner(item.repository.owner),
      // ponytail: catalog has no iteration payload; Update Diff fills changes
      firstComparingIteration: 0,
      secondComparingIteration: 0,
      changes: {},
    },
  });
}

function adoptLocalsFromCatalog(
  reviews: ReviewRecord[],
  pullRequests: CatalogPullRequest[],
): void {
  for (const item of pullRequests) {
    const key = pullRequestSyncKey(item);
    if (
      reviews.some(
        (review) => review.guide.source && pullRequestSyncKey(review.guide.source) === key,
      )
    ) {
      continue;
    }
    const match = findLocalReviewToAdopt(
      reviews,
      catalogAsSource(item, item.sourceCommit, item.targetCommit),
    );
    if (!match) continue;
    match.guide = GuideV1.parse({
      ...match.guide,
      source: catalogAsSource(
        item,
        SHA_RE.test(match.guide.head) ? match.guide.head : item.sourceCommit,
        SHA_RE.test(match.guide.base) ? match.guide.base : item.targetCommit,
      ),
    });
  }
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
  const summary = {
    id: record.id,
    title: record.guide.title,
    range: record.guide.range,
    addedAt: record.addedAt,
    base: record.guide.base,
    head: record.guide.head,
    ...(record.guide.unchaptered ? { unchaptered: true as const } : {}),
  };
  if (!source) return summary;
  return {
    ...summary,
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
      targetRef: source.targetRef,
      sourceRef: source.sourceRef,
    },
  };
}

export function agentIsConnected(
  lastSeen: string | undefined,
  now = Date.now(),
): boolean {
  if (!lastSeen) return false;
  const seen = Date.parse(lastSeen);
  return Number.isFinite(seen) && now - seen <= AGENT_CONNECTED_MS;
}

function sameOpenTarget(a: OpenActionTarget, b: OpenActionTarget): boolean {
  return pullRequestSyncKey(a) === pullRequestSyncKey(b);
}

function isInFlight(action: StoredAction): boolean {
  return action.status === "queued" || action.status === "claimed";
}

function sameQueuedAction(
  existing: StoredAction,
  parsed: { kind: StoredAction["kind"]; target?: OpenActionTarget; reviewId?: string },
): boolean {
  if (!isInFlight(existing) || existing.kind !== parsed.kind) return false;
  if (parsed.kind === "refresh") return true;
  if (parsed.kind === "generate-guide") {
    return existing.kind === "generate-guide" && existing.reviewId === parsed.reviewId;
  }
  return Boolean(
    (existing.kind === "open" || existing.kind === "update-diff") &&
      parsed.target &&
      sameOpenTarget(existing.target, parsed.target),
  );
}

async function appendActive(guide: GuideV1): Promise<{ id: string }> {
  const store = await readStore();
  const id = crypto.randomUUID();
  store.reviews.push({
    id,
    addedAt: new Date().toISOString(),
    guide,
    outcomes: [],
  });
  store.activeId = id;
  await writeStore(store);
  return { id };
}

function repositoryKey(repository: {
  provider: string;
  host: string;
  id: string;
}): string {
  return `${repository.provider}:${repository.host}:${repository.id}`;
}

function snapshotKey(snapshot: CatalogSnapshot): string {
  return repositoryKey({
    provider: snapshot.provider,
    host: snapshot.host,
    id: snapshot.repository.id,
  });
}

export async function listReviews(): Promise<ListReviewsOutput> {
  const store = await readStore();
  return {
    activeId: store.activeId,
    reviews: store.reviews.map(toSummary),
    repositories: store.repositories,
    catalog: store.catalog,
    actions: store.actions,
    agentConnected: agentIsConnected(store.agentLastSeen),
  };
}

export async function queueAction(input: unknown): Promise<{ id: string }> {
  const parsed = tools.queue_action.input.parse(input);
  const store = await readStore();
  if (parsed.kind === "generate-guide") {
    const found = store.reviews.find((review) => review.id === parsed.reviewId);
    if (!found) {
      throw Object.assign(new Error(`unknown review ${parsed.reviewId}`), { status: 404 });
    }
    if (!found.guide.unchaptered) {
      throw Object.assign(new Error("Generate guide is only for an unchaptered review"), {
        status: 400,
      });
    }
  }
  const existing = store.actions.find((action) => sameQueuedAction(action, parsed));
  if (existing) return { id: existing.id };
  const id = crypto.randomUUID();
  const queuedAt = new Date().toISOString();
  if (parsed.kind === "generate-guide") {
    store.actions.push({
      id,
      kind: "generate-guide",
      status: "queued",
      queuedAt,
      reviewId: parsed.reviewId,
    });
  } else if (parsed.kind === "refresh") {
    store.actions.push({
      id,
      kind: "refresh",
      status: "queued",
      queuedAt,
    });
  } else {
    store.actions.push({
      id,
      kind: parsed.kind,
      status: "queued",
      queuedAt,
      target: parsed.target,
    });
  }
  await writeStore(store);
  return { id };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function waitForAction(input: unknown = {}): Promise<StoredAction | null> {
  const parsed = tools.wait_for_action.input.parse(input ?? {});
  const timeoutMs = parsed.timeoutMs ?? 25_000;
  const deadline = Date.now() + timeoutMs;
  // ponytail: 50ms poll, fine for one waiting agent; evented wait if that changes
  for (;;) {
    const store = await readStore();
    store.agentLastSeen = new Date().toISOString();
    const claimed = store.actions.find((action) => action.status === "claimed");
    if (claimed) {
      await writeStore(store);
      return claimed;
    }
    const queued = store.actions.find((action) => action.status === "queued");
    if (queued) {
      queued.status = "claimed";
      queued.claimedAt = store.agentLastSeen;
      await writeStore(store);
      return queued;
    }
    await writeStore(store);
    if (Date.now() >= deadline) return null;
    await sleep(50);
  }
}

export async function completeAction(input: unknown): Promise<{ ok: true }> {
  const parsed = tools.complete_action.input.parse(input);
  const store = await readStore();
  const action = store.actions.find((row) => row.id === parsed.id);
  if (!action) {
    throw Object.assign(new Error(`unknown action ${parsed.id}`), { status: 404 });
  }
  if (!isInFlight(action)) {
    throw Object.assign(new Error(`action ${parsed.id} is not in flight`), { status: 409 });
  }
  if (
    parsed.status === "succeeded" &&
    action.kind !== "refresh" &&
    !parsed.reviewId
  ) {
    throw Object.assign(
      new Error("reviewId required when Open, Update Diff, or Generate guide succeeds"),
      { status: 400 },
    );
  }
  action.status = parsed.status;
  action.completedAt = new Date().toISOString();
  if (parsed.status === "succeeded" && parsed.reviewId) action.reviewId = parsed.reviewId;
  if (parsed.status === "failed") action.error = parsed.error;
  await writeStore(store);
  return { ok: true };
}

export async function replaceCatalog(input: unknown): Promise<{ ok: true }> {
  const parsed = tools.replace_catalog.input.parse(input);
  const store = await readStore();
  const key = repositoryKey(parsed.repository);
  const configured: ConfiguredRepository = {
    ...parsed.repository,
    origin: parsed.origin,
  };
  store.repositories = store.repositories.filter(
    (repository) => repositoryKey(repository) !== key,
  );
  if (parsed.origin) {
    store.repositories = store.repositories.map((repository) => ({
      ...repository,
      origin: false,
    }));
  }
  store.repositories.push(configured);
  const previous = store.catalog.find((snapshot) => snapshotKey(snapshot) === key);
  const snapshot: CatalogSnapshot = {
    provider: parsed.repository.provider,
    host: parsed.repository.host,
    repository: {
      id: parsed.repository.id,
      owner: parsed.repository.owner,
      name: parsed.repository.name,
      webUrl: parsed.repository.webUrl,
    },
    pullRequests: parsed.error ? previous?.pullRequests ?? [] : parsed.pullRequests,
  };
  if (parsed.error) {
    snapshot.error = parsed.error;
    if (previous?.syncedAt) snapshot.syncedAt = previous.syncedAt;
  } else if (parsed.syncedAt) {
    snapshot.syncedAt = parsed.syncedAt;
  }
  store.catalog = store.catalog.filter((entry) => snapshotKey(entry) !== key);
  store.catalog.push(snapshot);
  if (!parsed.error) adoptLocalsFromCatalog(store.reviews, snapshot.pullRequests);
  await writeStore(store);
  return { ok: true };
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

export async function getReview(
  id: string,
): Promise<{ guide: GuideV1; outcomes: StoredOutcome[] }> {
  const store = await readStore();
  const found = store.reviews.find((r) => r.id === id);
  if (!found) {
    throw Object.assign(new Error(`unknown review ${id}`), { status: 404 });
  }
  return { guide: found.guide, outcomes: found.outcomes };
}

export async function publishReviewOutcome(
  reviewId: string,
  outcome: unknown,
): Promise<{ id: string }> {
  const parsed = CodeReviewOutcome.parse(outcome);
  const store = await readStore();
  const found = store.reviews.find((r) => r.id === reviewId);
  if (!found) {
    throw Object.assign(new Error(`unknown review ${reviewId}`), { status: 404 });
  }
  const id = crypto.randomUUID();
  found.outcomes.push({
    id,
    addedAt: new Date().toISOString(),
    outcome: parsed,
  });
  await writeStore(store);
  return { id };
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
