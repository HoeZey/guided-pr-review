import type { CatalogPullRequest } from "../../shared/contracts/catalog.ts";
import type { ListReviewsOutput } from "../../shared/contracts/persistence.ts";
import { CATALOG_REFRESH_STALE_MS } from "../../shared/domain/catalog.ts";
import { ProviderError } from "../providers/errors.ts";
import { GithubProviderError } from "../providers/github/rest.ts";
import type {
  ProviderPullRequestMetadata,
  ProviderPullRequestReader,
  ProviderRepositoryIdentity,
} from "../providers/ports.ts";
import type { ConfiguredRepositoryRecord } from "../repositories/ports.ts";

export type CatalogRefreshReason = "startup" | "focus" | "manual";

export type CatalogRefreshResult = {
  skipped: boolean;
};

export type CatalogRefreshService = {
  refresh: (input?: { reason?: CatalogRefreshReason }) => Promise<CatalogRefreshResult>;
};

export function createCatalogStartupLatch(refresh: () => Promise<unknown>): () => Promise<void> {
  let startup: Promise<unknown> | undefined;
  return async () => {
    startup ??= refresh().catch((err) => {
      startup = undefined;
      throw err;
    });
    try {
      await startup;
    } catch {
      // keep prior catalog; later handle or manual refresh can retry
    }
  };
}

export function createCatalogRefreshService(options: {
  listRepositories: () => Promise<{ repositories: ConfiguredRepositoryRecord[] }>;
  replaceCatalog: (input: unknown) => Promise<{ ok: true }>;
  listReviews: () => Promise<ListReviewsOutput>;
  readers: {
    ado: ProviderPullRequestReader;
    github: ProviderPullRequestReader;
  };
  now?: () => number;
  staleMs?: number;
}): CatalogRefreshService {
  const nowFn = options.now ?? Date.now;
  const staleMs = options.staleMs ?? CATALOG_REFRESH_STALE_MS;
  let lastAttempt: number | undefined;
  let inflight: Promise<CatalogRefreshResult> | undefined;

  async function runOne(row: ConfiguredRepositoryRecord, at: string): Promise<void> {
    const reader = row.provider === "github" ? options.readers.github : options.readers.ado;
    const repository = {
      provider: row.provider,
      host: row.host,
      id: row.id,
      owner: row.owner,
      name: row.name,
      webUrl: row.webUrl,
      ...(row.cloneUrl ? { cloneUrl: row.cloneUrl } : {}),
    };
    try {
      const listed = await reader.listPullRequests(identity(row));
      const reviews = await options.listReviews();
      const have = new Set(listed.map((item) => item.number));
      const extras: ProviderPullRequestMetadata[] = [];
      for (const number of savedNumbersFor(reviews, row)) {
        if (have.has(number)) continue;
        try {
          extras.push(
            await reader.getPullRequest({
              provider: row.provider,
              host: row.host,
              repository: { id: row.id, owner: row.owner, name: row.name },
              number,
            }),
          );
        } catch (err) {
          if (isNotFound(err)) continue;
          throw err;
        }
      }
      await options.replaceCatalog({
        origin: row.origin,
        repository,
        syncedAt: at,
        attemptedAt: at,
        pullRequests: [...listed, ...extras].map(toCatalogPr),
      });
    } catch (err) {
      await options.replaceCatalog({
        origin: row.origin,
        repository,
        error: refreshErrorMessage(err, row.provider),
        attemptedAt: at,
        pullRequests: [],
      });
    }
  }

  async function run(reason: CatalogRefreshReason): Promise<CatalogRefreshResult> {
    if (inflight) return inflight;
    const now = nowFn();
    if (reason === "focus" && lastAttempt !== undefined && now - lastAttempt < staleMs) {
      return { skipped: true };
    }
    lastAttempt = now;
    const at = new Date(now).toISOString();
    inflight = (async () => {
      const { repositories } = await options.listRepositories();
      await Promise.all(repositories.map((row) => runOne(row, at)));
      return { skipped: false as const };
    })().finally(() => {
      inflight = undefined;
    });
    return inflight;
  }

  return {
    refresh: (input) => run(input?.reason ?? "manual"),
  };
}

function identity(row: ConfiguredRepositoryRecord): ProviderRepositoryIdentity {
  const value: ProviderRepositoryIdentity = {
    provider: row.provider,
    host: row.host,
    id: row.id,
    owner: row.owner,
    name: row.name,
    webUrl: row.webUrl,
  };
  if (row.cloneUrl) value.cloneUrl = row.cloneUrl;
  return value;
}

function toCatalogPr(row: ProviderPullRequestMetadata): CatalogPullRequest {
  return {
    provider: row.provider,
    host: row.host,
    repository: {
      id: row.repository.id,
      owner: row.repository.owner,
      name: row.repository.name,
      webUrl: row.repository.webUrl,
    },
    number: row.number,
    title: row.title,
    webUrl: row.webUrl,
    sourceRef: row.sourceRef,
    targetRef: row.targetRef,
    sourceCommit: row.sourceCommit,
    targetCommit: row.targetCommit,
    isDraft: row.isDraft,
    status: row.status,
    author: row.author,
    isReviewer: row.isReviewer,
    isAuthor: row.isAuthor,
    updatedAt: row.updatedAt,
  };
}

function savedNumbersFor(listed: ListReviewsOutput, row: ConfiguredRepositoryRecord): number[] {
  const prefix = `${row.provider}:${row.host}:${row.id}:`;
  const numbers: number[] = [];
  for (const review of listed.reviews) {
    const pr = review.pullRequest;
    if (pr && pr.host === row.host && pr.repository.id === row.id) {
      numbers.push(pr.number);
      continue;
    }
    if (review.syncKey?.startsWith(prefix)) {
      const parsed = Number(review.syncKey.slice(prefix.length));
      if (Number.isInteger(parsed) && parsed > 0) numbers.push(parsed);
    }
  }
  return [...new Set(numbers)];
}

function isNotFound(err: unknown): boolean {
  return (
    (err instanceof ProviderError && err.code === "not-found") ||
    (err instanceof GithubProviderError && err.code === "not-found")
  );
}

function refreshErrorMessage(err: unknown, provider: ConfiguredRepositoryRecord["provider"]): string {
  if (err instanceof ProviderError || err instanceof GithubProviderError) return err.message;
  const message = err instanceof Error && err.message.trim() ? err.message : "Authentication failed";
  if (/github|azure devops/i.test(message)) return message;
  return `${provider === "github" ? "GitHub" : "Azure DevOps"} ${message}`;
}
