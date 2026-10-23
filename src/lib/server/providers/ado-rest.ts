import {
  isAzureDevOpsHost,
  type AzureDevOpsProviderContext,
} from "../../shared/contracts/provenance.ts";
import type { CredentialSource } from "../auth/ports.ts";
import { ProviderError, type ProviderErrorCode } from "./errors.ts";
import type {
  GitProviderKind,
  ProviderPullRequestMetadata,
  ProviderPullRequestReader,
  ProviderRepositoryIdentity,
  ProviderRepositoryReader,
} from "./ports.ts";

const API_VERSION = "7.1";
const DEFAULT_PAGE_SIZE = 100;
const MAX_PAGES = 100;
const SHA = /^[0-9a-f]{40}$/i;

export function createAdoRestAdapter(options: {
  credentials: CredentialSource;
  fetch?: typeof fetch;
  pageSize?: number;
}): ProviderRepositoryReader & ProviderPullRequestReader {
  const fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE;

  return {
    async getRepository(input) {
      const parsed = parseIdentity(input);
      const session = await connectedSession(options.credentials, parsed.host);
      const payload = await adoGet(
        fetchFn,
        gitUrl(parsed, `repositories/${encodeURIComponent(parsed.name)}`),
        parsed.host,
        session.token,
      );
      return normalizeRepository(payload, parsed);
    },

    async listPullRequests(repository) {
      const parsed = parseIdentity(repository);
      if (repository.id.trim() === "") throw fail("not-found", parsed.host);
      const session = await connectedSession(options.credentials, parsed.host);
      const rows: ProviderPullRequestMetadata[] = [];
      // ponytail: cap at MAX_PAGES pages; raise if a configured repo can exceed pageSize * MAX_PAGES active PRs.
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const url = gitUrl(parsed, `repositories/${encodeURIComponent(repository.id)}/pullrequests`);
        url.searchParams.set("searchCriteria.status", "active");
        url.searchParams.set("$top", String(pageSize));
        url.searchParams.set("$skip", String(page * pageSize));
        const payload = await adoGet(fetchFn, url, parsed.host, session.token);
        const batch = asArray(payload, parsed.host);
        for (const item of batch) {
          rows.push(normalizePullRequest(item, repository, parsed, session.login));
        }
        if (batch.length < pageSize) break;
      }
      return rows;
    },

    async getPullRequest(input) {
      const parsed = parseIdentity({
        provider: input.provider,
        host: input.host,
        owner: input.repository.owner,
        name: input.repository.name,
      });
      if (input.repository.id.trim() === "") throw fail("not-found", parsed.host);
      const session = await connectedSession(options.credentials, parsed.host);
      const payload = await adoGet(
        fetchFn,
        gitUrl(
          parsed,
          `repositories/${encodeURIComponent(input.repository.id)}/pullrequests/${input.number}`,
        ),
        parsed.host,
        session.token,
      );
      const identity: ProviderRepositoryIdentity = {
        provider: "azure-devops",
        host: parsed.host,
        id: input.repository.id,
        owner: parsed.owner,
        name: parsed.name,
        webUrl: repoWebUrl(parsed),
      };
      return normalizePullRequest(payload, identity, parsed, session.login);
    },

    async getCommentContext(input) {
      const parsed = parseIdentity({
        provider: input.provider,
        host: input.host,
        owner: input.repository.owner,
        name: input.repository.name,
      });
      if (input.repository.id.trim() === "") throw fail("not-found", parsed.host);
      const session = await connectedSession(options.credentials, parsed.host);
      return loadCommentContext(fetchFn, parsed, input.repository.id, input.number, session.token);
    },
  };
}

type ParsedIdentity = {
  provider: GitProviderKind;
  host: string;
  owner: string;
  organization: string;
  project: string;
  name: string;
};

function parseIdentity(input: {
  provider: GitProviderKind;
  host: string;
  owner: string;
  name: string;
}): ParsedIdentity {
  if (input.provider !== "azure-devops" || !isAzureDevOpsHost(input.host) || !input.name.trim()) {
    throw fail("not-found", input.host || "dev.azure.com");
  }
  const owner = parseOwner(input.owner);
  if (!owner) throw fail("not-found", input.host);
  if (!hostMatchesOrg(input.host, owner.organization)) throw fail("not-found", input.host);
  return {
    provider: "azure-devops",
    host: input.host,
    owner: `${owner.organization}/${owner.project}`,
    organization: owner.organization,
    project: owner.project,
    name: input.name,
  };
}

function parseOwner(owner: string): { organization: string; project: string } | undefined {
  const parts = owner.split("/").map((part) => part.trim()).filter(Boolean);
  if (parts.length !== 2) return undefined;
  return { organization: parts[0], project: parts[1] };
}

function hostMatchesOrg(host: string, organization: string): boolean {
  const normalized = host.toLowerCase();
  if (normalized === "dev.azure.com") return true;
  if (!normalized.endsWith(".visualstudio.com")) return false;
  return normalized.slice(0, -".visualstudio.com".length) === organization.toLowerCase();
}

function gitUrl(parsed: ParsedIdentity, extraPath: string): URL {
  const host = parsed.host.toLowerCase();
  const root = host.endsWith(".visualstudio.com")
    ? `https://${host}/${encodeURIComponent(parsed.project)}`
    : `https://${host}/${encodeURIComponent(parsed.organization)}/${encodeURIComponent(parsed.project)}`;
  const url = new URL(`${root}/_apis/git/${extraPath}`);
  url.searchParams.set("api-version", API_VERSION);
  return url;
}

function repoWebUrl(parsed: ParsedIdentity): string {
  const host = parsed.host.toLowerCase();
  if (host.endsWith(".visualstudio.com")) {
    return `https://${host}/${encodeURIComponent(parsed.project)}/_git/${encodeURIComponent(parsed.name)}`;
  }
  return `https://${host}/${encodeURIComponent(parsed.organization)}/${encodeURIComponent(parsed.project)}/_git/${encodeURIComponent(parsed.name)}`;
}

async function connectedSession(
  credentials: CredentialSource,
  host: string,
): Promise<{ token: string; login: string }> {
  const result = await credentials.getAccessToken({ provider: "azure-devops", host });
  if (result.status !== "connected" || !result.token) throw fail("auth", host);
  return { token: result.token, login: result.identity.login };
}

async function adoGet(
  fetchFn: typeof fetch,
  url: URL,
  host: string,
  token: string,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchFn(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
  } catch {
    throw fail("unavailable", host);
  }
  if (response.status === 401 || response.status === 403) throw fail("auth", host);
  if (response.status === 404) throw fail("not-found", host);
  if (response.status === 429) {
    const retry = Number(response.headers.get("retry-after"));
    throw fail("rate", host, Number.isFinite(retry) && retry > 0 ? retry : undefined);
  }
  if (response.status >= 500 || response.status === 408) throw fail("unavailable", host);
  if (!response.ok) throw fail("unavailable", host);
  const text = await response.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw fail("malformed-response", host);
  }
}

function normalizeRepository(payload: unknown, parsed: ParsedIdentity): ProviderRepositoryIdentity {
  if (!payload || typeof payload !== "object") throw fail("malformed-response", parsed.host);
  const row = payload as Record<string, unknown>;
  const id = asText(row.id);
  const name = asText(row.name);
  const project = asRecord(row.project);
  const projectName = project ? asText(project.name) : undefined;
  if (!id || !name || !projectName) throw fail("malformed-response", parsed.host);
  if (!sameText(name, parsed.name) || !sameText(projectName, parsed.project)) {
    throw fail("not-found", parsed.host);
  }
  const identity: ProviderRepositoryIdentity = {
    provider: "azure-devops",
    host: parsed.host,
    id,
    owner: parsed.owner,
    name,
    webUrl: asText(row.webUrl) ?? repoWebUrl({ ...parsed, name }),
  };
  const cloneUrl = asText(row.remoteUrl);
  if (cloneUrl) identity.cloneUrl = cloneUrl;
  const defaultBranch = asText(row.defaultBranch);
  if (defaultBranch) identity.defaultBranch = defaultBranch;
  return identity;
}

function normalizePullRequest(
  payload: unknown,
  repository: ProviderRepositoryIdentity,
  parsed: ParsedIdentity,
  login: string,
): ProviderPullRequestMetadata {
  if (!payload || typeof payload !== "object") throw fail("malformed-response", parsed.host);
  const row = payload as Record<string, unknown>;
  const number = row.pullRequestId;
  if (typeof number !== "number" || !Number.isInteger(number) || number <= 0) {
    throw fail("malformed-response", parsed.host);
  }
  const title = asText(row.title);
  const sourceRef = asText(row.sourceRefName);
  const targetRef = asText(row.targetRefName);
  const status = asStatus(row.status);
  const sourceCommit = commitId(row.lastMergeSourceCommit);
  const targetCommit = commitId(row.lastMergeTargetCommit);
  const createdBy = asRecord(row.createdBy);
  const author = createdBy ? asText(createdBy.displayName) ?? asText(createdBy.uniqueName) : undefined;
  const updatedAt = asText(row.closedDate) ?? asText(row.creationDate);
  if (!title || !sourceRef || !targetRef || !status || !sourceCommit || !targetCommit || !author || !updatedAt) {
    throw fail("malformed-response", parsed.host);
  }
  const webBase = repository.webUrl || repoWebUrl(parsed);
  const description = asText(row.description);
  return {
    provider: "azure-devops",
    host: parsed.host,
    repository: {
      provider: "azure-devops",
      host: parsed.host,
      id: repository.id,
      owner: parsed.owner,
      name: repository.name,
      webUrl: webBase,
    },
    number,
    title,
    ...(description ? { description } : {}),
    webUrl: `${webBase.replace(/\/$/, "")}/pullrequest/${number}`,
    sourceRef,
    targetRef,
    sourceCommit,
    targetCommit,
    isDraft: row.isDraft === true,
    status,
    author,
    // ponytail: uniqueName vs CLI login only; ADO group membership is not expanded. Upgrade: resolve team members if Home misses group-assigned reviews.
    isReviewer: reviewers(row.reviewers, parsed.host).some((reviewer) =>
      sameText(asText(reviewer.uniqueName), login),
    ),
    isAuthor: sameText(createdBy ? asText(createdBy.uniqueName) : undefined, login),
    updatedAt,
  };
}

function asStatus(value: unknown): "active" | "completed" | "abandoned" | undefined {
  if (value === "active" || value === "completed" || value === "abandoned") return value;
  return undefined;
}

function commitId(value: unknown): string | undefined {
  const row = asRecord(value);
  const id = row ? asText(row.commitId) : undefined;
  return id && SHA.test(id) ? id : undefined;
}

function asArray(payload: unknown, host: string): unknown[] {
  if (!payload || typeof payload !== "object") throw fail("malformed-response", host);
  const value = (payload as { value?: unknown }).value;
  if (!Array.isArray(value)) throw fail("malformed-response", host);
  return value;
}

function reviewers(value: unknown, host: string): Record<string, unknown>[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw fail("malformed-response", host);
  return value.map((row) => asRecord(row) ?? {});
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function asText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function sameText(left: string | undefined, right: string | undefined): boolean {
  return Boolean(left && right && left.toLowerCase() === right.toLowerCase());
}

async function loadCommentContext(
  fetchFn: typeof fetch,
  parsed: ParsedIdentity,
  repositoryId: string,
  number: number,
  token: string,
): Promise<AzureDevOpsProviderContext> {
  const empty: AzureDevOpsProviderContext = {
    kind: "azure-devops",
    project: parsed.project,
    firstComparingIteration: 0,
    secondComparingIteration: 0,
    changes: {},
  };
  const iterationsUrl = gitUrl(
    parsed,
    `repositories/${encodeURIComponent(repositoryId)}/pullrequests/${number}/iterations`,
  );
  const iterationPayload = await adoGet(fetchFn, iterationsUrl, parsed.host, token);
  const iterationIds = asArray(iterationPayload, parsed.host)
    .map((row) => asRecord(row)?.id)
    .filter((id): id is number => typeof id === "number" && Number.isInteger(id) && id > 0);
  if (iterationIds.length === 0) return empty;
  const firstComparingIteration = Math.min(...iterationIds);
  const secondComparingIteration = Math.max(...iterationIds);
  const changes: AzureDevOpsProviderContext["changes"] = {};
  // ponytail: page changes; raise MAX_PAGES if one iteration can exceed pageSize * MAX_PAGES files.
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const changesUrl = gitUrl(
      parsed,
      `repositories/${encodeURIComponent(repositoryId)}/pullrequests/${number}/iterations/${secondComparingIteration}/changes`,
    );
    changesUrl.searchParams.set("$top", String(DEFAULT_PAGE_SIZE));
    changesUrl.searchParams.set("$skip", String(page * DEFAULT_PAGE_SIZE));
    const changePayload = await adoGet(fetchFn, changesUrl, parsed.host, token);
    const entries = changeEntries(changePayload, parsed.host);
    for (const entry of entries) {
      const tracking = entry.changeTrackingId;
      const path = itemPath(entry);
      if (typeof tracking !== "number" || !Number.isInteger(tracking) || !path) continue;
      changes[path] = { changeTrackingId: tracking };
    }
    if (entries.length < DEFAULT_PAGE_SIZE) break;
  }
  return {
    kind: "azure-devops",
    project: parsed.project,
    firstComparingIteration,
    secondComparingIteration,
    changes,
  };
}

function changeEntries(payload: unknown, host: string): Record<string, unknown>[] {
  if (!payload || typeof payload !== "object") throw fail("malformed-response", host);
  const row = payload as { changeEntries?: unknown; value?: unknown };
  const raw = row.changeEntries ?? row.value;
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw fail("malformed-response", host);
  return raw.map((item) => asRecord(item) ?? {});
}

function itemPath(entry: Record<string, unknown>): string | undefined {
  const change = asRecord(entry.change);
  const item = change ? asRecord(change.item) : asRecord(entry.item);
  const path = item ? asText(item.path) : undefined;
  if (!path) return undefined;
  return path.replace(/^\/+/, "");
}

function fail(code: ProviderErrorCode, host: string, retryAfterSec?: number): ProviderError {
  return new ProviderError({ code, provider: "azure-devops", host, retryAfterSec });
}
