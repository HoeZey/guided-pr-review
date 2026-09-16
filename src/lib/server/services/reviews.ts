import type { CatalogPullRequest, OpenActionTarget } from "../../shared/contracts/catalog.ts";
import { FileChange, GuideV1 } from "../../shared/contracts/guide.ts";
import type { ListReviewsOutput } from "../../shared/contracts/persistence.ts";
import type { StoredOutcome } from "../../shared/contracts/outcomes.ts";
import { pullRequestSyncKey } from "../../shared/contracts/provenance.ts";
import { catalogAsSource } from "../../shared/domain/reviews.ts";
import { GitOperationError, type GitDiff, type ManagedGitCache } from "../git/ports.ts";
import type {
  ProviderPullRequestMetadata,
  ProviderPullRequestReader,
  ProviderRepositoryReader,
} from "../providers/ports.ts";
import type {
  ConfiguredRepositoryRecord,
  ReviewRepository,
} from "../repositories/ports.ts";

export type DiffSyncResult = {
  reviewId: string;
  skipped: boolean;
};

export type ReviewDiffOptions = {
  readers: {
    ado: ProviderPullRequestReader;
    github: ProviderPullRequestReader;
  };
  repositoryReaders: {
    ado: ProviderRepositoryReader;
    github: ProviderRepositoryReader;
  };
  listConfigured: () => Promise<ConfiguredRepositoryRecord[]>;
  git: ManagedGitCache & GitDiff;
};

export type ReviewService = {
  list: () => Promise<ListReviewsOutput>;
  get: (id: string) => Promise<{ guide: GuideV1; outcomes: StoredOutcome[] }>;
  add: (input: unknown) => Promise<{ id: string }>;
  addFromTool: (body: unknown) => Promise<{ id: string }>;
  upsert: (input: unknown) => Promise<{ id: string }>;
  upsertFromTool: (body: unknown) => Promise<{ id: string }>;
  remove: (id: string) => Promise<{ ok: true }>;
  setActive: (id: string) => Promise<{ activeId: string }>;
  seedIfEmpty: (guide: GuideV1) => Promise<void>;
  openDiff: (target: OpenActionTarget) => Promise<DiffSyncResult>;
  updateDiff: (target: OpenActionTarget) => Promise<DiffSyncResult>;
};

function stripHeads(ref: string): string {
  return ref.replace(/^refs\/heads\//i, "");
}

function unchapteredGuide(fetched: {
  title: string;
  files: GuideV1["chapters"][number]["files"];
  source: NonNullable<GuideV1["source"]>;
}): GuideV1 {
  return GuideV1.parse({
    version: 1,
    title: fetched.title,
    base: fetched.source.targetCommit,
    head: fetched.source.sourceCommit,
    range: `${stripHeads(fetched.source.targetRef)}...${stripHeads(fetched.source.sourceRef)}`,
    repo: fetched.source.repository.name,
    unchaptered: true,
    chapters: [
      {
        id: "unchaptered",
        kind: "core",
        title: fetched.title,
        why: "Raw diff until a reading-order guide is generated.",
        files: fetched.files,
      },
    ],
    source: fetched.source,
  });
}

function withStatus(err: unknown, status: number): Error {
  if (err instanceof Error) {
    if (typeof (err as { status?: number }).status !== "number") {
      (err as { status?: number }).status = status;
    }
    return err;
  }
  return Object.assign(new Error(String(err)), { status });
}

function toCatalogItem(meta: ProviderPullRequestMetadata): CatalogPullRequest {
  return {
    provider: meta.provider,
    host: meta.host,
    repository: {
      id: meta.repository.id,
      owner: meta.repository.owner,
      name: meta.repository.name,
      webUrl: meta.repository.webUrl,
    },
    number: meta.number,
    title: meta.title,
    webUrl: meta.webUrl,
    sourceRef: meta.sourceRef,
    targetRef: meta.targetRef,
    sourceCommit: meta.sourceCommit,
    targetCommit: meta.targetCommit,
    isDraft: meta.isDraft,
    status: meta.status,
    author: meta.author,
    isReviewer: meta.isReviewer,
    isAuthor: meta.isAuthor,
    updatedAt: meta.updatedAt,
  };
}

export function createReviewService(
  repos: ReviewRepository,
  options?: ReviewDiffOptions,
): ReviewService {
  const inflight = new Map<string, Promise<DiffSyncResult>>();

  async function resolveCloneUrl(
    meta: ProviderPullRequestMetadata,
    target: OpenActionTarget,
  ): Promise<string> {
    if (meta.repository.cloneUrl) return meta.repository.cloneUrl;
    const configured = await options!.listConfigured();
    const row = configured.find(
      (item) =>
        item.provider === target.provider &&
        item.host === target.host &&
        item.id === target.repository.id,
    );
    if (row?.cloneUrl) return row.cloneUrl;
    const reader =
      target.provider === "github" ? options!.repositoryReaders.github : options!.repositoryReaders.ado;
    const repository = await reader.getRepository({
      provider: target.provider,
      host: target.host,
      owner: target.repository.owner,
      name: target.repository.name,
    });
    if (repository.cloneUrl) return repository.cloneUrl;
    throw Object.assign(new Error("clone URL required to fetch commits"), { status: 502 });
  }

  async function syncDiff(target: OpenActionTarget): Promise<DiffSyncResult> {
    if (!options) {
      throw Object.assign(new Error("diff sync is not configured"), { status: 500 });
    }
    const reader = target.provider === "github" ? options.readers.github : options.readers.ado;
    const prInput = {
      provider: target.provider,
      host: target.host,
      repository: {
        id: target.repository.id,
        owner: target.repository.owner,
        name: target.repository.name,
      },
      number: target.number,
    };
    const meta = await reader.getPullRequest(prInput);
    const listed = await repos.listReviews();
    const key = pullRequestSyncKey({
      provider: meta.provider,
      host: meta.host,
      repository: { id: meta.repository.id },
      number: meta.number,
    });
    const existing = listed.reviews.find((row) => row.syncKey === key);
    if (
      existing &&
      existing.sourceCommit &&
      existing.sourceCommit.toLowerCase() === meta.sourceCommit.toLowerCase()
    ) {
      return { reviewId: existing.id, skipped: true };
    }
    const cloneUrl = await resolveCloneUrl(meta, target);
    const identity = {
      provider: meta.provider,
      host: meta.host,
      repositoryId: meta.repository.id,
    };
    await options.git.ensureBare(identity);
    await options.git.fetchCommits(identity, [meta.sourceCommit, meta.targetCommit], { cloneUrl });
    const raw = await options.git.unifiedThreeDot({
      identity,
      sourceCommit: meta.sourceCommit,
      targetCommit: meta.targetCommit,
    });
    const files = raw.map((file) => FileChange.parse(file));
    const adoContext =
      target.provider === "azure-devops" ? await reader.getCommentContext?.(prInput) : undefined;
    const source = catalogAsSource(
      toCatalogItem(meta),
      meta.sourceCommit,
      meta.targetCommit,
      adoContext,
    );
    const { id: reviewId } = await repos.upsertReview(
      unchapteredGuide({ title: meta.title, files, source }),
    );
    return { reviewId, skipped: false };
  }

  async function runDiff(target: OpenActionTarget): Promise<DiffSyncResult> {
    const key = pullRequestSyncKey(target);
    const shared = inflight.get(key);
    if (shared) return shared;
    const pending = (async () => {
      try {
        return await syncDiff(target);
      } catch (err) {
        if (err instanceof GitOperationError) throw withStatus(err, 502);
        throw withStatus(err, (err as { status?: number }).status ?? 502);
      }
    })().finally(() => {
      inflight.delete(key);
    });
    inflight.set(key, pending);
    return pending;
  }

  return {
    list: () => repos.listReviews(),
    get: (id) => repos.getReview(id),
    add: (input) => repos.addReview(input),
    addFromTool: (body) => repos.addReviewFromTool(body),
    upsert: (input) => repos.upsertReview(input),
    upsertFromTool: (body) => repos.upsertReviewFromTool(body),
    remove: (id) => repos.removeReview(id),
    setActive: (id) => repos.setActive(id),
    seedIfEmpty: (guide) => repos.seedIfEmpty(guide),
    openDiff: (target) => runDiff(target),
    updateDiff: (target) => runDiff(target),
  };
}
