import type { CatalogPullRequest } from "../contracts/catalog.ts";
import { GuideV1 } from "../contracts/guide.ts";
import type { ListReviewsOutput, ReviewRecord } from "../contracts/persistence.ts";
import {
  PullRequestSource,
  pullRequestSyncKey,
} from "../contracts/provenance.ts";

export const AGENT_CONNECTED_MS = 35_000;

const TICKET_RE = /\b[A-Z][A-Z0-9]+-\d+\b/i;
const SHA_RE = /^[0-9a-f]{40}$/i;

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

export function findLocalReviewToAdopt(
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

export function adoptLocalsFromCatalog(
  reviews: ReviewRecord[],
  pullRequests: CatalogPullRequest[],
): void {
  for (const item of pullRequests) {
    if (item.provider !== "azure-devops") continue;
    // ponytail: GitHub catalog rows skip local adoption until Open Diff owns GitHub PullRequestSource.
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

export function reviewSummary(record: ReviewRecord): ListReviewsOutput["reviews"][number] {
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
