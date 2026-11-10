import {
  CreateThreadRequest,
  CommentThreadList,
  ReplyRequest,
  UpdateCommentRequest,
  type CommentAnchor,
  type CommentThread,
  type CommentThreadList as CommentThreadListValue,
  type CreateCommentAnchor,
} from "../../shared/contracts/comments.ts";
import type { GuideV1 } from "../../shared/contracts/guide.ts";
import type { PullRequestSource } from "../../shared/contracts/provenance.ts";
import type { CredentialIdentity, CredentialSource } from "../auth/ports.ts";
import { ProviderError } from "../providers/errors.ts";
import { GithubProviderError } from "../providers/github/rest.ts";
import { CommentError, type CommentProvider } from "../providers/comments.ts";
import type { ReviewRepository } from "../repositories/ports.ts";

export { CommentError, type CommentErrorCode } from "../providers/comments.ts";

export type CommentService = {
  list: (reviewId: string) => Promise<CommentThreadListValue>;
  createThread: (reviewId: string, input: unknown) => Promise<CommentThread>;
  reply: (reviewId: string, threadId: string, input: unknown) => Promise<CommentThread["messages"][number]>;
  update: (
    reviewId: string,
    threadId: string,
    commentId: string,
    input: unknown,
  ) => Promise<CommentThread["messages"][number]>;
  delete: (reviewId: string, threadId: string, commentId: string) => Promise<{ ok: true }>;
};

export function createCommentService(options: {
  reviews: ReviewRepository;
  credentials: CredentialSource;
  providers: { ado: CommentProvider; github: CommentProvider };
}): CommentService {
  async function load(reviewId: string): Promise<{
    guide: GuideV1;
    source: PullRequestSource;
    identity: CredentialIdentity;
  }> {
    let loaded;
    try {
      loaded = await options.reviews.getReview(reviewId);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (status === 404) throw new CommentError("unknown-review", `unknown review ${reviewId}`);
      throw err;
    }
    const source = loaded.guide.source;
    if (!source) {
      throw new CommentError("no-host-provenance", "review has no pull-request host");
    }
    const cred = await options.credentials.getAccessToken({
      provider: source.provider,
      host: source.host,
    });
    if (cred.status !== "connected") {
      throw new CommentError("auth", "git host identity is not connected");
    }
    return { guide: loaded.guide, source, identity: cred.identity };
  }

  function providerFor(source: PullRequestSource): CommentProvider {
    return source.provider === "github" ? options.providers.github : options.providers.ado;
  }

  async function listedThreads(
    source: PullRequestSource,
    identity: CredentialIdentity,
    guide: GuideV1,
  ): Promise<CommentThread[]> {
    const threads = await runProvider(() => providerFor(source).list({ provenance: source, identity }));
    return threads.map((thread) => normalizeListedThread(thread, guide, identity.login));
  }

  async function requireOwned(
    source: PullRequestSource,
    identity: CredentialIdentity,
    guide: GuideV1,
    threadId: string,
    commentId: string,
  ): Promise<void> {
    rejectOperationAsResource(threadId);
    rejectOperationAsResource(commentId);
    const threads = await listedThreads(source, identity, guide);
    const thread = threads.find((row) => row.id === threadId);
    if (!thread) throw new CommentError("unknown-thread", "comment thread was not found");
    const comment = thread.messages.find((row) => row.id === commentId);
    if (!comment) throw new CommentError("unknown-comment", "comment was not found");
    if (!comment.ownedByCurrentUser) {
      throw new CommentError("not-owned", "only the current user can change this comment");
    }
  }

  return {
    async list(reviewId) {
      const { guide, source, identity } = await load(reviewId);
      return CommentThreadList.parse({
        threads: await listedThreads(source, identity, guide),
      });
    },

    async createThread(reviewId, input) {
      const { guide, source, identity } = await load(reviewId);
      const parsed = parseCreate(input);
      assertCreateAnchor(parsed.anchor, guide);
      const thread = await runProvider(() =>
        providerFor(source).createThread({
          provenance: source,
          identity,
          anchor: parsed.anchor,
          body: parsed.body,
          clientOperationId: parsed.clientOperationId,
        }),
      );
      return normalizeListedThread(thread, guide, identity.login);
    },

    async reply(reviewId, threadId, input) {
      const { guide, source, identity } = await load(reviewId);
      rejectOperationAsResource(threadId);
      const parsed = parseReply(input);
      const threads = await listedThreads(source, identity, guide);
      if (!threads.some((row) => row.id === threadId)) {
        throw new CommentError("unknown-thread", "comment thread was not found");
      }
      const message = await runProvider(() =>
        providerFor(source).reply({
          provenance: source,
          identity,
          threadId,
          body: parsed.body,
          clientOperationId: parsed.clientOperationId,
        }),
      );
      return {
        ...message,
        ownedByCurrentUser: message.author.login === identity.login,
      };
    },

    async update(reviewId, threadId, commentId, input) {
      const { guide, source, identity } = await load(reviewId);
      const parsed = parseUpdate(input);
      await requireOwned(source, identity, guide, threadId, commentId);
      const message = await runProvider(() =>
        providerFor(source).update({
          provenance: source,
          identity,
          threadId,
          commentId,
          body: parsed.body,
        }),
      );
      return {
        ...message,
        ownedByCurrentUser: message.author.login === identity.login,
      };
    },

    async delete(reviewId, threadId, commentId) {
      const { guide, source, identity } = await load(reviewId);
      await requireOwned(source, identity, guide, threadId, commentId);
      await runProvider(() =>
        providerFor(source).delete({
          provenance: source,
          identity,
          threadId,
          commentId,
        }),
      );
      return { ok: true as const };
    },
  };
}

const TARGET_KEYS = ["provider", "host", "repository", "number", "webUrl", "url", "cloneUrl"] as const;

function rejectForeignTarget(input: unknown): void {
  if (!input || typeof input !== "object") return;
  for (const key of TARGET_KEYS) {
    if (key in input) {
      throw new CommentError("foreign-target", "browser cannot choose git host identity");
    }
  }
}

function rejectOperationAsResource(id: string): void {
  if (id.startsWith("cop_")) {
    throw new CommentError(
      "operation-id-as-resource",
      "client operation id cannot target a provider resource",
    );
  }
}

function parseCreate(input: unknown): CreateThreadRequest {
  rejectForeignTarget(input);
  const parsed = CreateThreadRequest.safeParse(input);
  if (parsed.success) return parsed.data;
  if (parsed.error.issues.some((issue) => issue.path[0] === "clientOperationId")) {
    throw new CommentError("invalid-operation-id", "invalid client operation id");
  }
  throw new CommentError("invalid-anchor", "invalid comment request");
}

function parseReply(input: unknown): ReplyRequest {
  rejectForeignTarget(input);
  const parsed = ReplyRequest.safeParse(input);
  if (parsed.success) return parsed.data;
  if (parsed.error.issues.some((issue) => issue.path[0] === "clientOperationId")) {
    throw new CommentError("invalid-operation-id", "invalid client operation id");
  }
  throw new CommentError("invalid-anchor", "invalid comment request");
}

function parseUpdate(input: unknown): UpdateCommentRequest {
  rejectForeignTarget(input);
  const parsed = UpdateCommentRequest.safeParse(input);
  if (parsed.success) return parsed.data;
  throw new CommentError("invalid-anchor", "invalid comment request");
}

function assertCreateAnchor(anchor: CreateCommentAnchor, guide: GuideV1): void {
  if (anchor.kind === "pr") return;
  if (!fileExists(guide, anchor.path)) {
    throw new CommentError("unknown-path", "path is not in the current diff");
  }
  if (anchor.kind === "file") return;
  const lines = currentLines(guide, anchor.path);
  if (!lines || lines.size === 0) {
    throw new CommentError("anchor-outside-diff", "anchor is outside the current diff");
  }
  if (anchor.kind === "line") {
    if (!lines.has(anchor.line)) {
      throw new CommentError("anchor-outside-diff", "anchor is outside the current diff");
    }
    return;
  }
  for (let line = anchor.startLine; line <= anchor.endLine; line += 1) {
    if (!lines.has(line)) {
      throw new CommentError("anchor-outside-diff", "anchor is outside the current diff");
    }
  }
}

async function runProvider<T>(op: () => Promise<T>): Promise<T> {
  try {
    return await op();
  } catch (err) {
    throw mapProviderError(err);
  }
}

function mapProviderError(err: unknown): CommentError {
  if (err instanceof CommentError) return err;
  if (err instanceof ProviderError) {
    if (err.code === "auth") return new CommentError("auth", "git host identity is not connected");
    if (err.code === "rate") return new CommentError("rate", "git host rate limit exceeded");
    if (err.code === "unavailable") return new CommentError("unavailable", "git host is unavailable");
    if (err.code === "not-found") return new CommentError("not-found", "git host resource was not found");
    return new CommentError("malformed", "git host returned a malformed response");
  }
  if (err instanceof GithubProviderError) {
    if (err.code === "unauthorized" || err.code === "credential") {
      return new CommentError("auth", "git host identity is not connected");
    }
    if (err.code === "rate-limited") return new CommentError("rate", "git host rate limit exceeded");
    if (err.code === "unavailable") return new CommentError("unavailable", "git host is unavailable");
    if (err.code === "not-found") return new CommentError("not-found", "git host resource was not found");
    return new CommentError("malformed", "git host returned a malformed response");
  }
  return new CommentError("malformed", "comment provider failed");
}

function currentLines(guide: GuideV1, path: string): Set<number> | undefined {
  const files = guide.chapters.flatMap((chapter) => chapter.files).filter((file) => file.path === path);
  if (files.length === 0) return undefined;
  const lines = new Set<number>();
  for (const file of files) {
    for (const hunk of file.hunks ?? []) {
      for (const line of hunk.lines) {
        if (line.newLine !== undefined) lines.add(line.newLine);
      }
    }
  }
  return lines;
}

function fileExists(guide: GuideV1, path: string): boolean {
  return guide.chapters.some((chapter) => chapter.files.some((file) => file.path === path));
}

function normalizeAnchor(anchor: CommentAnchor, guide: GuideV1): CommentAnchor {
  if (anchor.kind === "pr") return anchor;
  if (anchor.kind === "stale") return anchor;
  if (anchor.kind === "file") {
    return fileExists(guide, anchor.path)
      ? anchor
      : { kind: "stale", reason: "unmappable", path: anchor.path };
  }
  const lines = currentLines(guide, anchor.path);
  if (!lines || lines.size === 0) {
    return { kind: "stale", reason: "unmappable", path: anchor.path };
  }
  if (anchor.kind === "line") {
    return lines.has(anchor.line) ? anchor : { kind: "stale", reason: "unmappable", path: anchor.path };
  }
  for (let line = anchor.startLine; line <= anchor.endLine; line += 1) {
    if (!lines.has(line)) return { kind: "stale", reason: "unmappable", path: anchor.path };
  }
  return anchor;
}

function normalizeListedThread(
  thread: CommentThread,
  guide: GuideV1,
  login: string,
): CommentThread {
  const anchor = normalizeAnchor(thread.anchor, guide);
  return {
    ...thread,
    outdated: thread.outdated || anchor.kind === "stale",
    anchor,
    messages: thread.messages.map((row) => ({
      ...row,
      ownedByCurrentUser: row.author.login === login,
    })),
  };
}
