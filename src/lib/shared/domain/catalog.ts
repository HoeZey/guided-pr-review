import type {
  CatalogPullRequest,
  CatalogSnapshot,
  ConfiguredRepository,
} from "../contracts/catalog.ts";
import type { ReviewRecord } from "../contracts/persistence.ts";
import { adoptLocalsFromCatalog } from "./reviews.ts";

export type CatalogReplacementInput = {
  origin: boolean;
  repository: {
    provider: ConfiguredRepository["provider"];
    host: string;
    id: string;
    owner: string;
    name: string;
    webUrl: string;
  };
  syncedAt?: string;
  error?: string;
  pullRequests: CatalogPullRequest[];
};

export function repositoryKey(repository: {
  provider: string;
  host: string;
  id: string;
}): string {
  return `${repository.provider}:${repository.host}:${repository.id}`;
}

export function snapshotKey(snapshot: CatalogSnapshot): string {
  return repositoryKey({
    provider: snapshot.provider,
    host: snapshot.host,
    id: snapshot.repository.id,
  });
}

export function applyCatalogReplacement(
  repositories: ConfiguredRepository[],
  catalog: CatalogSnapshot[],
  reviews: ReviewRecord[],
  parsed: CatalogReplacementInput,
): {
  repositories: ConfiguredRepository[];
  catalog: CatalogSnapshot[];
  reviews: ReviewRecord[];
} {
  const key = repositoryKey(parsed.repository);
  const configured: ConfiguredRepository = {
    ...parsed.repository,
    origin: parsed.origin,
  };
  let nextRepos = repositories.filter((repository) => repositoryKey(repository) !== key);
  if (parsed.origin) {
    nextRepos = nextRepos.map((repository) => ({
      ...repository,
      origin: false,
    }));
  }
  nextRepos.push(configured);
  const previous = catalog.find((snapshot) => snapshotKey(snapshot) === key);
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
  const nextCatalog = catalog.filter((entry) => snapshotKey(entry) !== key);
  nextCatalog.push(snapshot);
  const nextReviews = reviews.map((review) => ({
    ...review,
    guide: review.guide,
    outcomes: [...review.outcomes],
  }));
  if (!parsed.error) adoptLocalsFromCatalog(nextReviews, snapshot.pullRequests);
  return { repositories: nextRepos, catalog: nextCatalog, reviews: nextReviews };
}
