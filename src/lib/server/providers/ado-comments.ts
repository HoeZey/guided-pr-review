import {
  CommentMessage,
  CommentThread,
  type CommentAnchor,
  type CommentMessage as CommentMessageValue,
  type CommentThread as CommentThreadValue,
  type CommentThreadStatus,
  type CreateCommentAnchor,
} from "../../shared/contracts/comments.ts";
import {
  isAzureDevOpsHost,
  type AzureDevOpsProviderContext,
  type PullRequestSource,
} from "../../shared/contracts/provenance.ts";
import type { CredentialIdentity, CredentialSource } from "../auth/ports.ts";
import { createAdoRestAdapter } from "./ado-rest.ts";
import { CommentError, type CommentProvider } from "./comments.ts";
import { ProviderError, type ProviderErrorCode } from "./errors.ts";

const API_VERSION = "7.1";

type ParsedIdentity = {
  host: string;
  organization: string;
  project: string;
};

type ParsedSource = {
  parsed: ParsedIdentity;
  repoId: string;
  number: number;
  context: AzureDevOpsProviderContext;
};

export function createAdoCommentAdapter(options: {
  credentials: CredentialSource;
  fetch?: typeof fetch;
}): CommentProvider {
  const fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);

  async function session(source: PullRequestSource): Promise<{
    parsed: ParsedSource;
    token: string;
  }> {
    const parsed = parseSource(source);
    const cred = await options.credentials.getAccessToken({
      provider: "azure-devops",
      host: parsed.parsed.host,
    });
    if (cred.status !== "connected" || !cred.token) throw fail("auth", parsed.parsed.host);
    return { parsed, token: cred.token };
  }

  async function readHostCommentContext(source: PullRequestSource): Promise<AzureDevOpsProviderContext> {
    const reader = createAdoRestAdapter({ credentials: options.credentials, fetch: fetchFn });
    if (!reader.getCommentContext) throw fail("unavailable", source.host || "dev.azure.com");
    return reader.getCommentContext({
      provider: "azure-devops",
      host: source.host,
      repository: {
        id: source.repository.id,
        owner: source.repository.owner,
        name: source.repository.name,
      },
      number: source.number,
    });
  }

  return {
    async list(input) {
      const { parsed, token } = await session(input.provenance);
      // ponytail: one threads list payload; page if a PR can exceed a single ADO response.
      const payload = await adoRequest(fetchFn, threadsUrl(parsed), parsed.parsed.host, token, {
        method: "GET",
        notFound: "not-found",
      });
      const rows = asArray(payload, parsed.parsed.host);
      const threads: CommentThreadValue[] = [];
      for (const row of rows) {
        const thread = normalizeThread(row, input.identity, parsed.parsed.host);
        if (thread) threads.push(thread);
      }
      return threads;
    },

    async createThread(input) {
      const { parsed, token } = await session(input.provenance);
      const context = needsHostCommentContext(parsed.context, input.anchor)
        ? await readHostCommentContext(input.provenance)
        : parsed.context;
      const body = createPayload(input.anchor, input.body, context);
      const payload = await adoRequest(fetchFn, threadsUrl(parsed), parsed.parsed.host, token, {
        method: "POST",
        body,
        notFound: "not-found",
        invalidAnchor: true,
      });
      const thread = normalizeThread(payload, input.identity, parsed.parsed.host);
      if (!thread) throw fail("malformed-response", parsed.parsed.host);
      return thread;
    },

    async reply(input) {
      const { parsed, token } = await session(input.provenance);
      const threadId = resourceId(input.threadId, "thread");
      const raw = await loadThread(fetchFn, parsed, token, threadId);
      const parent = rootCommentId(raw, parsed.parsed.host);
      const payload = await adoRequest(
        fetchFn,
        commentCollectionUrl(parsed, threadId),
        parsed.parsed.host,
        token,
        {
          method: "POST",
          body: { parentCommentId: parent, content: input.body, commentType: 1 },
          notFound: "unknown-thread",
        },
      );
      return normalizeMessage(payload, input.identity, parsed.parsed.host);
    },

    async update(input) {
      const { parsed, token } = await session(input.provenance);
      const ids = await requireCommentInThread(
        fetchFn,
        parsed,
        token,
        input.threadId,
        input.commentId,
      );
      const payload = await adoRequest(
        fetchFn,
        commentItemUrl(parsed, ids.threadId, ids.commentId),
        parsed.parsed.host,
        token,
        {
          method: "PATCH",
          body: { content: input.body },
          notFound: "unknown-comment",
        },
      );
      return normalizeMessage(payload, input.identity, parsed.parsed.host);
    },

    async delete(input) {
      const { parsed, token } = await session(input.provenance);
      const ids = await requireCommentInThread(
        fetchFn,
        parsed,
        token,
        input.threadId,
        input.commentId,
      );
      await adoRequest(
        fetchFn,
        commentItemUrl(parsed, ids.threadId, ids.commentId),
        parsed.parsed.host,
        token,
        {
          method: "DELETE",
          notFound: "unknown-comment",
        },
      );
      return { ok: true as const };
    },
  };
}

async function requireCommentInThread(
  fetchFn: typeof fetch,
  parsed: ParsedSource,
  token: string,
  threadIdRaw: string,
  commentIdRaw: string,
): Promise<{ threadId: number; commentId: number }> {
  const threadId = resourceId(threadIdRaw, "thread");
  const commentId = resourceId(commentIdRaw, "comment");
  const raw = await loadThread(fetchFn, parsed, token, threadId);
  if (!commentExists(raw, commentId)) {
    throw new CommentError("unknown-comment", "comment was not found");
  }
  return { threadId, commentId };
}

async function loadThread(
  fetchFn: typeof fetch,
  parsed: ParsedSource,
  token: string,
  threadId: number,
): Promise<Record<string, unknown>> {
  const payload = await adoRequest(fetchFn, threadUrl(parsed, threadId), parsed.parsed.host, token, {
    method: "GET",
    notFound: "unknown-thread",
  });
  const row = asRecord(payload);
  if (!row) throw fail("malformed-response", parsed.parsed.host);
  return row;
}

function parseSource(source: PullRequestSource): ParsedSource {
  if (source.provider !== "azure-devops" || source.providerContext.kind !== "azure-devops") {
    throw new CommentError("cross-provider", "comment provider does not match review host");
  }
  if (!isAzureDevOpsHost(source.host) || source.repository.id.trim() === "") {
    throw fail("not-found", source.host || "dev.azure.com");
  }
  const owner = parseOwner(source.repository.owner);
  if (!owner) throw fail("not-found", source.host);
  if (!hostMatchesOrg(source.host, owner.organization)) throw fail("not-found", source.host);
  return {
    parsed: {
      host: source.host,
      organization: owner.organization,
      project: owner.project,
    },
    repoId: source.repository.id,
    number: source.number,
    context: source.providerContext,
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

function threadsUrl(source: ParsedSource): URL {
  return gitUrl(
    source.parsed,
    `repositories/${encodeURIComponent(source.repoId)}/pullrequests/${source.number}/threads`,
  );
}

function threadUrl(source: ParsedSource, threadId: number): URL {
  return gitUrl(
    source.parsed,
    `repositories/${encodeURIComponent(source.repoId)}/pullrequests/${source.number}/threads/${threadId}`,
  );
}

function commentCollectionUrl(source: ParsedSource, threadId: number): URL {
  return gitUrl(
    source.parsed,
    `repositories/${encodeURIComponent(source.repoId)}/pullrequests/${source.number}/threads/${threadId}/comments`,
  );
}

function commentItemUrl(source: ParsedSource, threadId: number, commentId: number): URL {
  return gitUrl(
    source.parsed,
    `repositories/${encodeURIComponent(source.repoId)}/pullrequests/${source.number}/threads/${threadId}/comments/${commentId}`,
  );
}

function needsHostCommentContext(
  context: AzureDevOpsProviderContext,
  anchor: CreateCommentAnchor,
): boolean {
  if (anchor.kind === "pr") return false;
  if (context.firstComparingIteration <= 0 || context.secondComparingIteration <= 0) return true;
  const tracking = context.changes[anchor.path]?.changeTrackingId;
  return typeof tracking !== "number";
}

function createPayload(
  anchor: CreateCommentAnchor,
  body: string,
  context: AzureDevOpsProviderContext,
): Record<string, unknown> {
  const comments = [{ parentCommentId: 0, content: body, commentType: 1 }];
  if (anchor.kind === "pr") return { comments, status: 1 };
  const tracking = context.changes[anchor.path]?.changeTrackingId;
  if (typeof tracking !== "number") {
    throw new CommentError("invalid-anchor", "Azure DevOps change tracking is missing for this path");
  }
  const pullRequestThreadContext = {
    changeTrackingId: tracking,
    iterationContext: {
      firstComparingIteration: context.firstComparingIteration,
      secondComparingIteration: context.secondComparingIteration,
    },
  };
  if (anchor.kind === "file") {
    return {
      comments,
      status: 1,
      threadContext: { filePath: adoPath(anchor.path) },
      pullRequestThreadContext,
    };
  }
  const start = anchor.kind === "line" ? anchor.line : anchor.startLine;
  const end = anchor.kind === "line" ? anchor.line : anchor.endLine;
  return {
    comments,
    status: 1,
    threadContext: {
      filePath: adoPath(anchor.path),
      rightFileStart: { line: start, offset: 1 },
      rightFileEnd: { line: end, offset: 1 },
    },
    pullRequestThreadContext,
  };
}

function adoPath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

function resourceId(value: string, kind: "thread" | "comment"): number {
  if (!/^[1-9][0-9]*$/.test(value)) {
    throw new CommentError(
      kind === "thread" ? "unknown-thread" : "unknown-comment",
      kind === "thread" ? "comment thread was not found" : "comment was not found",
    );
  }
  return Number(value);
}

function rootCommentId(thread: Record<string, unknown>, host: string): number {
  const comments = Array.isArray(thread.comments) ? thread.comments : [];
  const rows = comments.map(asRecord).filter((row): row is Record<string, unknown> => Boolean(row));
  const root = rows.find((row) => row.parentCommentId === 0 || row.parentCommentId === undefined) ?? rows[0];
  const id = positiveId(root?.id);
  if (id === undefined) throw fail("malformed-response", host);
  return id;
}

function commentExists(thread: Record<string, unknown>, commentId: number): boolean {
  const comments = Array.isArray(thread.comments) ? thread.comments : [];
  return comments.some((row) => positiveId(asRecord(row)?.id) === commentId);
}

function normalizeThread(
  payload: unknown,
  identity: CredentialIdentity,
  host: string,
): CommentThreadValue | undefined {
  const row = asRecord(payload);
  const id = row ? positiveId(row.id) : undefined;
  if (!row || id === undefined) return undefined;
  const comments = Array.isArray(row.comments) ? row.comments : [];
  const messages: CommentMessageValue[] = [];
  for (const item of comments) {
    const message = readMessage(item, identity);
    if (message) messages.push(message);
  }
  if (messages.length === 0) return undefined;
  const anchor = normalizeAnchor(row.threadContext);
  try {
    return CommentThread.parse({
      id: String(id),
      provider: "azure-devops",
      status: threadStatus(row.status),
      outdated: anchor.kind === "stale",
      anchor,
      messages,
    });
  } catch {
    throw fail("malformed-response", host);
  }
}

function normalizeMessage(
  payload: unknown,
  identity: CredentialIdentity,
  host: string,
): CommentMessageValue {
  const message = readMessage(payload, identity);
  if (!message) throw fail("malformed-response", host);
  try {
    return CommentMessage.parse(message);
  } catch {
    throw fail("malformed-response", host);
  }
}

function readMessage(payload: unknown, identity: CredentialIdentity): CommentMessageValue | undefined {
  const row = asRecord(payload);
  const id = row ? positiveId(row.id) : undefined;
  if (!row || id === undefined || !isTextComment(row.commentType)) return undefined;
  const authorRow = asRecord(row.author);
  const unique = authorRow ? asText(authorRow.uniqueName) : undefined;
  const display = authorRow ? asText(authorRow.displayName) : undefined;
  if (!unique && !display) return undefined;
  const owned = sameText(unique, identity.login) || (!unique && sameText(display, identity.login));
  const createdAt = asText(row.publishedDate);
  const updatedAt = asText(row.lastContentUpdatedDate) ?? asText(row.lastUpdatedDate) ?? createdAt;
  if (!createdAt || !updatedAt) return undefined;
  const message: CommentMessageValue = {
    id: String(id),
    author: { login: owned ? identity.login : (unique ?? display)! },
    body: typeof row.content === "string" ? row.content : "",
    createdAt,
    updatedAt,
    ownedByCurrentUser: owned,
  };
  if (row.isDeleted === true) message.deleted = true;
  return message;
}

function isTextComment(value: unknown): boolean {
  return value === undefined || value === "text" || value === 1;
}

function normalizeAnchor(threadContext: unknown): CommentAnchor {
  const ctx = asRecord(threadContext);
  if (!ctx) return { kind: "pr" };
  const path = filePath(ctx.filePath);
  const rightStart = linePos(ctx.rightFileStart);
  const rightEnd = linePos(ctx.rightFileEnd);
  const hasRight = hasPosition(ctx.rightFileStart) || hasPosition(ctx.rightFileEnd);
  const hasLeft = hasPosition(ctx.leftFileStart) || hasPosition(ctx.leftFileEnd);

  if (hasRight) {
    if (rightStart === undefined || !path || (rightEnd !== undefined && rightEnd < rightStart)) {
      return path
        ? { kind: "stale", reason: "unmappable", path }
        : { kind: "stale", reason: "unmappable" };
    }
    const end = rightEnd ?? rightStart;
    if (end === rightStart) return { kind: "line", path, side: "current", line: rightStart };
    return { kind: "range", path, side: "current", startLine: rightStart, endLine: end };
  }

  if (hasLeft) {
    return path
      ? { kind: "stale", reason: "deleted-line", path }
      : { kind: "stale", reason: "deleted-line" };
  }

  if (!path) return { kind: "pr" };
  return { kind: "file", path };
}

function threadStatus(value: unknown): CommentThreadStatus {
  if (value === 1 || value === "active" || value === 6 || value === "pending") return "active";
  if (
    value === 2 ||
    value === 3 ||
    value === 4 ||
    value === 5 ||
    value === "fixed" ||
    value === "wontFix" ||
    value === "closed" ||
    value === "byDesign"
  ) {
    return "closed";
  }
  return "unknown";
}

function filePath(value: unknown): string | undefined {
  const text = asText(value);
  if (!text) return undefined;
  const trimmed = text.replace(/^\/+/, "");
  return trimmed || undefined;
}

function hasPosition(value: unknown): boolean {
  return Boolean(asRecord(value));
}

function linePos(value: unknown): number | undefined {
  const row = asRecord(value);
  const line = row?.line;
  if (typeof line === "number" && Number.isInteger(line) && line > 0) return line;
  return undefined;
}

function positiveId(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) return value;
  if (typeof value === "string" && /^[1-9][0-9]*$/.test(value)) return Number(value);
  return undefined;
}

async function adoRequest(
  fetchFn: typeof fetch,
  url: URL,
  host: string,
  token: string,
  options: {
    method: string;
    body?: unknown;
    notFound: "not-found" | "unknown-thread" | "unknown-comment";
    invalidAnchor?: boolean;
  },
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchFn(url, {
      method: options.method,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    });
  } catch {
    throw fail("unavailable", host);
  }
  if (response.status === 401) throw fail("auth", host);
  if (response.status === 403) {
    throw new CommentError("denied", "Azure DevOps denied this comment operation");
  }
  if (response.status === 404) {
    if (options.notFound === "unknown-thread") {
      throw new CommentError("unknown-thread", "comment thread was not found");
    }
    if (options.notFound === "unknown-comment") {
      throw new CommentError("unknown-comment", "comment was not found");
    }
    throw fail("not-found", host);
  }
  if (response.status === 429) {
    const retry = Number(response.headers.get("retry-after"));
    throw fail("rate", host, Number.isFinite(retry) && retry > 0 ? retry : undefined);
  }
  if (options.invalidAnchor && response.status === 400) {
    throw new CommentError("invalid-anchor", "Azure DevOps rejected this comment anchor");
  }
  if (response.status >= 500 || response.status === 408) throw fail("unavailable", host);
  if (!response.ok) throw fail("unavailable", host);
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text.trim()) {
    if (options.method === "DELETE") return undefined;
    throw fail("malformed-response", host);
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw fail("malformed-response", host);
  }
}

function asArray(payload: unknown, host: string): unknown[] {
  if (!payload || typeof payload !== "object") throw fail("malformed-response", host);
  const value = (payload as { value?: unknown }).value;
  if (!Array.isArray(value)) throw fail("malformed-response", host);
  return value;
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

function fail(code: ProviderErrorCode, host: string, retryAfterSec?: number): ProviderError {
  return new ProviderError({ code, provider: "azure-devops", host, retryAfterSec });
}
