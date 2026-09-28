import { isGitHubHost } from "../../../shared/contracts/provenance.ts";
import type { CredentialSource } from "../../auth/ports.ts";
import type {
  ProviderPullRequestMetadata,
  ProviderPullRequestReader,
  ProviderRepositoryIdentity,
  ProviderRepositoryReader,
} from "../ports.ts";

export const GITHUB_API_VERSION = "2026-03-10";
const API_ORIGIN = "https://api.github.com";
const SHA = /^[0-9a-f]{40}$/i;
const USER_AGENT = "guided-pr-review";

export type GithubProviderErrorCode =
  | "unauthorized"
  | "rate-limited"
  | "not-found"
  | "malformed"
  | "unavailable"
  | "credential"
  | "identity";

export class GithubProviderError extends Error {
  readonly code: GithubProviderErrorCode;

  constructor(code: GithubProviderErrorCode, message: string) {
    super(message);
    this.name = "GithubProviderError";
    this.code = code;
  }
}

export function createGithubProvider(options: {
  credentials: CredentialSource;
  fetch?: typeof fetch;
}): ProviderRepositoryReader & ProviderPullRequestReader {
  const http = options.fetch ?? fetch;

  async function tokenFor(host: string): Promise<{ token: string; login: string }> {
    if (!isGitHubHost(host)) {
      throw new GithubProviderError("identity", "GitHub repository host is not github.com");
    }
    const result = await options.credentials.getAccessToken({ provider: "github", host });
    if (result.status !== "connected") {
      throw new GithubProviderError("credential", "GitHub CLI identity is not connected");
    }
    return { token: result.token, login: result.identity.login };
  }

  async function githubGet(url: string, token: string): Promise<{ body: unknown; headers: Headers }> {
    const response = await http(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
        "User-Agent": USER_AGENT,
      },
    });
    const text = await response.text();
    let body: unknown;
    if (text.trim()) {
      try {
        body = JSON.parse(text);
      } catch {
        throw new GithubProviderError("malformed", "GitHub returned a malformed payload");
      }
    }
    throwHttp(response.status, response.headers, body);
    return { body, headers: response.headers };
  }

  return {
    async getRepository(input) {
      if (input.provider !== "github") {
        throw new GithubProviderError("identity", "GitHub adapter does not read this provider");
      }
      const { token } = await tokenFor(input.host);
      const owner = input.owner.trim();
      const name = input.name.trim();
      if (!owner || !name) {
        throw new GithubProviderError("identity", "GitHub owner and repository name are required");
      }
      const { body } = await githubGet(
        `${API_ORIGIN}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}`,
        token,
      );
      const repository = readRepository(body, input.host);
      if (!repository) {
        throw new GithubProviderError("malformed", "GitHub repository payload is missing identity");
      }
      return repository;
    },

    async listPullRequests(repository) {
      if (repository.provider !== "github") {
        throw new GithubProviderError("identity", "GitHub adapter does not read this provider");
      }
      const { token, login } = await tokenFor(repository.host);
      const listed: ProviderPullRequestMetadata[] = [];
      let url: string | undefined =
        `${API_ORIGIN}/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.name)}/pulls?state=open&per_page=100`;
      const seen = new Set<string>();
      while (url) {
        if (seen.has(url)) break;
        seen.add(url);
        const { body, headers } = await githubGet(url, token);
        if (!Array.isArray(body)) {
          throw new GithubProviderError("malformed", "GitHub pull request list is not an array");
        }
        for (const row of body) {
          const meta = readPullRequest(row, repository, login);
          if (meta) listed.push(meta);
        }
        url = nextGithubLink(headers.get("link"));
      }
      return listed;
    },

    async getPullRequest(input) {
      if (input.provider !== "github") {
        throw new GithubProviderError("identity", "GitHub adapter does not read this provider");
      }
      const { token, login } = await tokenFor(input.host);
      const { body } = await githubGet(
        `${API_ORIGIN}/repos/${encodeURIComponent(input.repository.owner)}/${encodeURIComponent(input.repository.name)}/pulls/${input.number}`,
        token,
      );
      const repository: ProviderRepositoryIdentity = {
        provider: "github",
        host: input.host,
        id: input.repository.id,
        owner: input.repository.owner,
        name: input.repository.name,
        webUrl: `https://github.com/${input.repository.owner}/${input.repository.name}`,
      };
      const meta = readPullRequest(body, repository, login);
      if (!meta) {
        throw new GithubProviderError("malformed", "GitHub pull request payload is missing required fields");
      }
      return meta;
    },
  };
}

function throwHttp(status: number, headers: Headers, body: unknown): void {
  if (status >= 200 && status < 300) return;
  const remaining = headers.get("x-ratelimit-remaining");
  const message = githubMessage(body);
  if (status === 401) {
    throw new GithubProviderError("unauthorized", "GitHub authentication failed");
  }
  if (
    status === 429 ||
    (status === 403 && (remaining === "0" || /rate limit/i.test(message)))
  ) {
    throw new GithubProviderError("rate-limited", "GitHub rate limit exceeded");
  }
  if (status === 403) {
    throw new GithubProviderError("unauthorized", "GitHub authentication failed");
  }
  if (status === 404) {
    throw new GithubProviderError("not-found", "GitHub repository or pull request was not found");
  }
  if (status >= 500) {
    throw new GithubProviderError("unavailable", "GitHub is unavailable");
  }
  throw new GithubProviderError("malformed", "GitHub returned an unexpected response");
}

function githubMessage(body: unknown): string {
  if (!body || typeof body !== "object" || !("message" in body)) return "";
  return typeof body.message === "string" ? body.message : "";
}

function nextGithubLink(header: string | null): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(",")) {
    const match = part.match(/<([^>]+)>\s*;\s*rel="?next"?/i);
    if (!match) continue;
    try {
      const url = new URL(match[1]);
      if (url.protocol === "https:" && url.hostname === "api.github.com") return url.toString();
    } catch {
      continue;
    }
  }
  return undefined;
}

function readRepository(body: unknown, host: string): ProviderRepositoryIdentity | undefined {
  if (!body || typeof body !== "object") return undefined;
  const row = body as {
    id?: unknown;
    name?: unknown;
    html_url?: unknown;
    clone_url?: unknown;
    owner?: { login?: unknown };
  };
  const id = typeof row.id === "number" ? String(row.id) : typeof row.id === "string" ? row.id : "";
  const name = asText(row.name);
  const owner = asText(row.owner?.login);
  const webUrl = asText(row.html_url);
  if (!id || !name || !owner || !webUrl) return undefined;
  const cloneUrl = asText(row.clone_url);
  return {
    provider: "github",
    host,
    id,
    owner,
    name,
    webUrl,
    ...(cloneUrl ? { cloneUrl } : {}),
  };
}

function readPullRequest(
  body: unknown,
  repository: ProviderRepositoryIdentity,
  login: string,
): ProviderPullRequestMetadata | undefined {
  if (!body || typeof body !== "object") return undefined;
  const row = body as {
    number?: unknown;
    title?: unknown;
    body?: unknown;
    html_url?: unknown;
    state?: unknown;
    draft?: unknown;
    merged?: unknown;
    merged_at?: unknown;
    updated_at?: unknown;
    user?: { login?: unknown } | null;
    requested_reviewers?: unknown;
    head?: { ref?: unknown; sha?: unknown } | null;
    base?: { ref?: unknown; sha?: unknown } | null;
  };
  const number = typeof row.number === "number" && Number.isInteger(row.number) && row.number > 0
    ? row.number
    : undefined;
  const title = asText(row.title);
  const description = asText(row.body);
  const webUrl = asText(row.html_url);
  const sourceRef = asText(row.head?.ref);
  const targetRef = asText(row.base?.ref);
  const sourceCommit = asSha(row.head?.sha);
  const targetCommit = asSha(row.base?.sha);
  const author = asText(row.user?.login);
  const updatedAt = asText(row.updated_at);
  if (
    !number ||
    !title ||
    !webUrl ||
    !sourceRef ||
    !targetRef ||
    !sourceCommit ||
    !targetCommit ||
    !author ||
    !updatedAt
  ) {
    return undefined;
  }
  const status = pullStatus(row.state, row.merged, row.merged_at);
  if (!status) return undefined;
  const reviewers = Array.isArray(row.requested_reviewers) ? row.requested_reviewers : [];
  return {
    provider: "github",
    host: repository.host,
    repository,
    number,
    title,
    ...(description ? { description } : {}),
    webUrl,
    sourceRef,
    targetRef,
    sourceCommit,
    targetCommit,
    isDraft: row.draft === true,
    status,
    author,
    isReviewer: reviewers.some((entry) => sameLogin(asText((entry as { login?: unknown })?.login), login)),
    isAuthor: sameLogin(author, login),
    updatedAt,
  };
}

function pullStatus(
  state: unknown,
  merged: unknown,
  mergedAt: unknown,
): ProviderPullRequestMetadata["status"] | undefined {
  if (merged === true || asText(mergedAt)) return "completed";
  if (state === "open") return "active";
  if (state === "closed") return "closed";
  return undefined;
}

function asSha(value: unknown): string | undefined {
  return typeof value === "string" && SHA.test(value) ? value : undefined;
}

function asText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function sameLogin(left: string | undefined, right: string): boolean {
  return Boolean(left && left.toLowerCase() === right.toLowerCase());
}
