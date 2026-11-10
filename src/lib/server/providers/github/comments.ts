import {
  CommentMessage,
  CommentThread,
  type CommentAnchor,
  type CommentMessage as CommentMessageValue,
  type CommentThread as CommentThreadValue,
  type CreateCommentAnchor,
} from "../../../shared/contracts/comments.ts";
import { isGitHubHost, type PullRequestSource } from "../../../shared/contracts/provenance.ts";
import type { CredentialSource } from "../../auth/ports.ts";
import { CommentError, type CommentProvider } from "../comments.ts";
import { GITHUB_API_VERSION, GithubProviderError } from "./rest.ts";

const API_ORIGIN = "https://api.github.com";
const USER_AGENT = "guided-pr-review";

export function createGithubCommentProvider(options: {
  credentials: CredentialSource;
  fetch?: typeof fetch;
}): CommentProvider {
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

  async function githubRequest(
    url: string,
    token: string,
    init: { method?: string; body?: unknown } = {},
  ): Promise<{ body: unknown; headers: Headers }> {
    const method = init.method ?? "GET";
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": GITHUB_API_VERSION,
      "User-Agent": USER_AGENT,
    };
    let payload: string | undefined;
    if (init.body !== undefined) {
      headers["Content-Type"] = "application/json";
      payload = JSON.stringify(init.body);
    }
    const response = await http(url, { method, headers, body: payload });
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

  async function paginate(startUrl: string, token: string): Promise<unknown[]> {
    const rows: unknown[] = [];
    let url: string | undefined = startUrl;
    const seen = new Set<string>();
    while (url) {
      if (seen.has(url)) break;
      seen.add(url);
      const { body, headers } = await githubRequest(url, token);
      if (!Array.isArray(body)) {
        throw new GithubProviderError("malformed", "GitHub comment list is not an array");
      }
      rows.push(...body);
      url = nextGithubLink(headers.get("link"));
    }
    return rows;
  }

  async function session(provenance: PullRequestSource): Promise<{
    token: string;
    owner: string;
    name: string;
    number: number;
  }> {
    requireGithub(provenance);
    const owner = provenance.repository.owner.trim();
    const name = provenance.repository.name.trim();
    if (!owner || !name) {
      throw new GithubProviderError("identity", "GitHub owner and repository name are required");
    }
    const { token } = await tokenFor(provenance.host);
    return { token, owner, name, number: provenance.number };
  }

  function commentsUrl(owner: string, name: string, number: number, family: "pulls" | "issues"): string {
    return `${API_ORIGIN}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/${family}/${number}/comments?per_page=100`;
  }

  return {
    async list(input) {
      const { token, owner, name, number } = await session(input.provenance);
      const currentLogin = input.identity.login;
      const [reviewRows, issueRows] = await Promise.all([
        paginate(commentsUrl(owner, name, number, "pulls"), token),
        paginate(commentsUrl(owner, name, number, "issues"), token),
      ]);
      return [
        ...groupReviewThreads(reviewRows, currentLogin),
        ...issueRows.flatMap((row) => {
          const thread = issueThread(row, currentLogin);
          return thread ? [thread] : [];
        }),
      ];
    },

    async createThread(input) {
      // ponytail: GitHub REST has no client operation field; 08-05 reconciles by content, anchor, and time.
      void input.clientOperationId;
      const { token, owner, name, number } = await session(input.provenance);
      const currentLogin = input.identity.login;
      if (input.anchor.kind === "pr") {
        const { body } = await githubRequest(
          `${API_ORIGIN}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/issues/${number}/comments`,
          token,
          { method: "POST", body: { body: input.body } },
        );
        const thread = issueThread(body, currentLogin);
        if (!thread) {
          throw new GithubProviderError("malformed", "GitHub issue comment payload is missing required fields");
        }
        return thread;
      }
      const { body } = await githubRequest(
        `${API_ORIGIN}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls/${number}/comments`,
        token,
        { method: "POST", body: reviewCreateBody(input.anchor, input.body, input.provenance.sourceCommit) },
      );
      const parsed = readReviewComment(body, currentLogin);
      if (!parsed) {
        throw new GithubProviderError("malformed", "GitHub review comment payload is missing required fields");
      }
      return reviewThread(parsed.githubId, [parsed], parsed);
    },

    async reply(input) {
      void input.clientOperationId;
      const resource = parseResourceId(input.threadId);
      if (!resource || resource.kind !== "review") {
        throw new CommentError("unknown-thread", "GitHub review thread was not found");
      }
      const { token, owner, name, number } = await session(input.provenance);
      const { body } = await githubRequest(
        `${API_ORIGIN}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/pulls/${number}/comments/${resource.id}/replies`,
        token,
        { method: "POST", body: { body: input.body } },
      );
      const parsed = readReviewComment(body, input.identity.login);
      if (!parsed) {
        throw new GithubProviderError("malformed", "GitHub review comment payload is missing required fields");
      }
      return parsed.message;
    },

    async update(input) {
      const target = mutationTarget(input.threadId, input.commentId);
      const { token, owner, name } = await session(input.provenance);
      const family = target.kind === "review" ? "pulls" : "issues";
      const { body } = await githubRequest(
        `${API_ORIGIN}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/${family}/comments/${target.id}`,
        token,
        { method: "PATCH", body: { body: input.body } },
      );
      if (target.kind === "review") {
        const parsed = readReviewComment(body, input.identity.login);
        if (!parsed) {
          throw new GithubProviderError("malformed", "GitHub review comment payload is missing required fields");
        }
        return parsed.message;
      }
      const message = issueMessage(body, input.identity.login);
      if (!message) {
        throw new GithubProviderError("malformed", "GitHub issue comment payload is missing required fields");
      }
      return message;
    },

    async delete(input) {
      const target = mutationTarget(input.threadId, input.commentId);
      const { token, owner, name } = await session(input.provenance);
      const family = target.kind === "review" ? "pulls" : "issues";
      await githubRequest(
        `${API_ORIGIN}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(name)}/${family}/comments/${target.id}`,
        token,
        { method: "DELETE" },
      );
      return { ok: true as const };
    },
  };
}

function requireGithub(provenance: PullRequestSource): void {
  if (provenance.provider !== "github") {
    throw new CommentError("cross-provider", "comment provider does not match review host");
  }
}

function throwHttp(status: number, headers: Headers, body: unknown): void {
  if (status >= 200 && status < 300) return;
  const remaining = headers.get("x-ratelimit-remaining");
  const message = githubMessage(body);
  if (status === 401) {
    throw new GithubProviderError("unauthorized", "GitHub authentication failed");
  }
  if (status === 429 || (status === 403 && (remaining === "0" || /rate limit/i.test(message)))) {
    throw new GithubProviderError("rate-limited", "GitHub rate limit exceeded");
  }
  if (status === 403) {
    throw new CommentError("denied", "GitHub permission was denied");
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

function reviewCreateBody(anchor: CreateCommentAnchor, body: string, commitId: string): Record<string, unknown> {
  if (anchor.kind === "file") {
    return { body, commit_id: commitId, path: anchor.path, subject_type: "file" };
  }
  if (anchor.kind === "range" && anchor.startLine < anchor.endLine) {
    return {
      body,
      commit_id: commitId,
      path: anchor.path,
      start_line: anchor.startLine,
      start_side: "RIGHT",
      line: anchor.endLine,
      side: "RIGHT",
    };
  }
  if (anchor.kind === "line" || anchor.kind === "range") {
    const line = anchor.kind === "line" ? anchor.line : anchor.startLine;
    return { body, commit_id: commitId, path: anchor.path, line, side: "RIGHT" };
  }
  throw new CommentError("invalid-anchor", "GitHub review comments cannot use this anchor");
}

type ResourceKind = "review" | "issue";

function parseResourceId(value: string): { kind: ResourceKind; id: string } | undefined {
  const match = /^(review|issue):(\d+)$/.exec(value);
  if (!match) return undefined;
  return { kind: match[1] as ResourceKind, id: match[2] };
}

function mutationTarget(threadId: string, commentId: string): { kind: ResourceKind; id: string } {
  const thread = parseResourceId(threadId);
  const comment = parseResourceId(commentId);
  if (!thread) throw new CommentError("unknown-thread", "GitHub comment thread was not found");
  if (!comment || comment.kind !== thread.kind) {
    throw new CommentError("unknown-comment", "GitHub comment was not found");
  }
  if (thread.kind === "issue" && thread.id !== comment.id) {
    throw new CommentError("unknown-comment", "GitHub comment was not found");
  }
  return comment;
}

type ParsedReview = {
  githubId: string;
  inReplyTo?: string;
  anchor: CommentAnchor;
  outdated: boolean;
  message: CommentMessageValue;
};

function groupReviewThreads(rows: unknown[], login: string): CommentThreadValue[] {
  const parsed: ParsedReview[] = [];
  for (const row of rows) {
    const item = readReviewComment(row, login);
    if (!item) continue;
    parsed.push(item);
  }
  const buckets = new Map<string, ParsedReview[]>();
  for (const item of parsed) {
    const root = item.inReplyTo ?? item.githubId;
    const bucket = buckets.get(root) ?? [];
    bucket.push(item);
    buckets.set(root, bucket);
  }
  const threads: CommentThreadValue[] = [];
  for (const [root, items] of buckets) {
    items.sort(compareParsed);
    const head = items.find((item) => item.githubId === root) ?? items[0];
    if (!head) continue;
    threads.push(reviewThread(root, items, head));
  }
  return threads;
}

function reviewThread(rootId: string, items: ParsedReview[], head: ParsedReview): CommentThreadValue {
  return CommentThread.parse({
    id: `review:${rootId}`,
    provider: "github",
    status: "active",
    outdated: head.outdated,
    anchor: head.anchor,
    messages: items.map((item) => item.message),
  });
}

function readReviewComment(body: unknown, login: string): ParsedReview | undefined {
  if (!body || typeof body !== "object") return undefined;
  const row = body as {
    id?: unknown;
    in_reply_to_id?: unknown;
    user?: { login?: unknown } | null;
    body?: unknown;
    created_at?: unknown;
    updated_at?: unknown;
    path?: unknown;
    subject_type?: unknown;
    side?: unknown;
    start_side?: unknown;
    line?: unknown;
    start_line?: unknown;
    original_line?: unknown;
    original_position?: unknown;
    position?: unknown;
  };
  const githubId = githubNumericId(row.id);
  const message = commentMessage("review", githubId, row, login);
  if (!githubId || !message) return undefined;
  const inReplyTo = githubNumericId(row.in_reply_to_id);
  const { anchor, outdated } = reviewAnchor(row);
  return { githubId, ...(inReplyTo ? { inReplyTo } : {}), anchor, outdated, message };
}

function reviewAnchor(row: {
  path?: unknown;
  subject_type?: unknown;
  side?: unknown;
  start_side?: unknown;
  line?: unknown;
  start_line?: unknown;
  original_line?: unknown;
  original_position?: unknown;
}): { anchor: CommentAnchor; outdated: boolean } {
  const path = asText(row.path);
  if (row.subject_type === "file") {
    if (!path) return { anchor: { kind: "stale", reason: "unmappable" }, outdated: true };
    return { anchor: { kind: "file", path }, outdated: false };
  }
  const side = row.side === "LEFT" ? "LEFT" : "RIGHT";
  const startSide =
    row.start_side === "LEFT" ? "LEFT" : row.start_side === "RIGHT" ? "RIGHT" : side;
  if (side === "LEFT" || startSide === "LEFT") {
    return {
      anchor: path ? { kind: "stale", reason: "deleted-line", path } : { kind: "stale", reason: "deleted-line" },
      outdated: true,
    };
  }
  const line = positiveInt(row.line);
  const startLine = positiveInt(row.start_line);
  if (line && startLine && startLine < line && path) {
    return {
      anchor: { kind: "range", path, side: "current", startLine, endLine: line },
      outdated: false,
    };
  }
  if (line && path) {
    return { anchor: { kind: "line", path, side: "current", line }, outdated: false };
  }
  const originalLine = positiveInt(row.original_line);
  if (originalLine || row.original_position != null) {
    return {
      anchor: {
        kind: "stale",
        reason: "outdated",
        ...(path ? { path } : {}),
        ...(originalLine ? { line: originalLine } : {}),
      },
      outdated: true,
    };
  }
  return {
    anchor: path ? { kind: "stale", reason: "unmappable", path } : { kind: "stale", reason: "unmappable" },
    outdated: true,
  };
}

function issueThread(body: unknown, login: string): CommentThreadValue | undefined {
  const message = issueMessage(body, login);
  if (!message) return undefined;
  return CommentThread.parse({
    id: message.id,
    provider: "github",
    status: "active",
    outdated: false,
    anchor: { kind: "pr" },
    messages: [message],
  });
}

function issueMessage(body: unknown, login: string): CommentMessageValue | undefined {
  if (!body || typeof body !== "object") return undefined;
  const row = body as {
    id?: unknown;
    user?: { login?: unknown } | null;
    body?: unknown;
    created_at?: unknown;
    updated_at?: unknown;
  };
  return commentMessage("issue", githubNumericId(row.id), row, login);
}

function commentMessage(
  kind: ResourceKind,
  githubId: string | undefined,
  row: { user?: { login?: unknown } | null; body?: unknown; created_at?: unknown; updated_at?: unknown },
  login: string,
): CommentMessageValue | undefined {
  if (!githubId) return undefined;
  const author = asText(row.user?.login) ?? (row.user === null ? "ghost" : undefined);
  const createdAt = asText(row.created_at);
  const updatedAt = asText(row.updated_at) ?? createdAt;
  if (!author || typeof row.body !== "string" || !createdAt || !updatedAt) return undefined;
  return CommentMessage.parse({
    id: `${kind}:${githubId}`,
    author: { login: author },
    body: row.body,
    createdAt,
    updatedAt,
    ownedByCurrentUser: sameLogin(author, login),
  });
}

function githubNumericId(value: unknown): string | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return String(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return value;
  return undefined;
}

function positiveInt(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : undefined;
}

function asText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function sameLogin(left: string | undefined, right: string): boolean {
  return Boolean(left && left.toLowerCase() === right.toLowerCase());
}

function compareParsed(left: ParsedReview, right: ParsedReview): number {
  if (left.message.createdAt !== right.message.createdAt) {
    return left.message.createdAt < right.message.createdAt ? -1 : 1;
  }
  return left.message.id < right.message.id ? -1 : left.message.id > right.message.id ? 1 : 0;
}
