import {
  CommentThread,
  type ClientOperationId,
  type CommentMessage,
  type CommentProviderKind,
} from "../../shared/contracts/comments.ts";
import { CommentError, type CommentProvider } from "./comments.ts";

function iso(offsetSec = 0): string {
  return new Date(Date.parse("2026-09-16T10:00:00.000Z") + offsetSec * 1000).toISOString();
}

function ownerLogin(provider: CommentProviderKind): string {
  return provider === "github" ? "octocat" : "ada@contoso.com";
}

function prefix(provider: CommentProviderKind): string {
  return provider === "github" ? "gh" : "ado";
}

function msg(
  provider: CommentProviderKind,
  id: string,
  body: string,
  extra: Partial<CommentMessage> = {},
): CommentMessage {
  const createdAt = extra.createdAt ?? iso();
  return {
    id: `${prefix(provider)}_${id}`,
    author: extra.author ?? { login: ownerLogin(provider) },
    body,
    createdAt,
    updatedAt: extra.updatedAt ?? createdAt,
    ownedByCurrentUser: extra.ownedByCurrentUser ?? true,
    ...(extra.deleted !== undefined ? { deleted: extra.deleted } : {}),
  };
}

export function commentFixtures(provider: CommentProviderKind): CommentThread[] {
  const p = prefix(provider);
  const other = { login: "other-reviewer" };
  return [
    CommentThread.parse({
      id: `${p}_thr_line`,
      provider,
      status: "active",
      outdated: false,
      anchor: { kind: "line", path: "src/a.ts", side: "current", line: 11 },
      messages: [
        msg(provider, "cmt_line", "line note"),
        msg(provider, "cmt_line_reply", "line reply", {
          author: other,
          ownedByCurrentUser: false,
          createdAt: iso(60),
        }),
        msg(provider, "cmt_line_deleted", "removed later", {
          deleted: true,
          createdAt: iso(90),
        }),
      ],
    }),
    CommentThread.parse({
      id: `${p}_thr_range`,
      provider,
      status: "active",
      outdated: false,
      anchor: { kind: "range", path: "src/a.ts", side: "current", startLine: 12, endLine: 13 },
      messages: [
        msg(provider, "cmt_range", "range note", {
          updatedAt: iso(120),
        }),
      ],
    }),
    CommentThread.parse({
      id: `${p}_thr_file`,
      provider,
      status: "active",
      outdated: false,
      anchor: { kind: "file", path: "src/a.ts" },
      messages: [msg(provider, "cmt_file", "file note")],
    }),
    CommentThread.parse({
      id: `${p}_thr_pr`,
      provider,
      status: "closed",
      outdated: false,
      anchor: { kind: "pr" },
      messages: [msg(provider, "cmt_pr", "pr-wide note")],
    }),
    CommentThread.parse({
      id: `${p}_thr_stale`,
      provider,
      status: "active",
      outdated: true,
      anchor: { kind: "stale", reason: "unmappable", path: "src/gone.ts" },
      messages: [msg(provider, "cmt_stale", "cannot map this")],
    }),
  ];
}

export type FakeCommentProvider = CommentProvider & {
  findByClientOperationId: (
    id: ClientOperationId,
  ) => { threadId: string; commentId: string } | undefined;
};

export function createFakeCommentProvider(options: {
  provider: CommentProviderKind;
  threads?: CommentThread[];
}): FakeCommentProvider {
  const threads = (options.threads ?? commentFixtures(options.provider)).map((thread) =>
    structuredClone(thread),
  );
  const operations = new Map<string, { threadId: string; commentId: string }>();
  let next = 1;

  function requireMatch(provenanceProvider: string): void {
    if (provenanceProvider !== options.provider) {
      throw new CommentError("cross-provider", "comment provider does not match review host");
    }
  }

  function threadOrThrow(threadId: string): CommentThread {
    if (threadId.startsWith("cop_")) {
      throw new CommentError("operation-id-as-resource", "client operation id cannot target a provider resource");
    }
    const found = threads.find((thread) => thread.id === threadId);
    if (!found) throw new CommentError("unknown-thread", "comment thread was not found");
    return found;
  }

  function commentOrThrow(thread: CommentThread, commentId: string): CommentMessage {
    if (commentId.startsWith("cop_")) {
      throw new CommentError("operation-id-as-resource", "client operation id cannot target a provider resource");
    }
    const found = thread.messages.find((row) => row.id === commentId);
    if (!found) throw new CommentError("unknown-comment", "comment was not found");
    return found;
  }

  function stamp(thread: CommentThread, login: string): CommentThread {
    return {
      ...thread,
      messages: thread.messages.map((row) => ({
        ...row,
        ownedByCurrentUser: row.author.login === login,
      })),
    };
  }

  return {
    async list(input) {
      requireMatch(input.provenance.provider);
      return threads.map((thread) => stamp(thread, input.identity.login));
    },

    async createThread(input) {
      requireMatch(input.provenance.provider);
      const id = `${prefix(options.provider)}_thr_new_${next}`;
      const commentId = `${prefix(options.provider)}_cmt_new_${next}`;
      next += 1;
      const createdAt = iso(next);
      const thread: CommentThread = {
        id,
        provider: options.provider,
        status: "active",
        outdated: false,
        anchor: input.anchor,
        messages: [
          {
            id: commentId,
            author: { login: input.identity.login },
            body: input.body,
            createdAt,
            updatedAt: createdAt,
            ownedByCurrentUser: true,
          },
        ],
      };
      threads.push(thread);
      operations.set(input.clientOperationId, { threadId: id, commentId });
      return stamp(thread, input.identity.login);
    },

    async reply(input) {
      requireMatch(input.provenance.provider);
      const thread = threadOrThrow(input.threadId);
      const commentId = `${prefix(options.provider)}_cmt_new_${next}`;
      next += 1;
      const createdAt = iso(next);
      const message: CommentMessage = {
        id: commentId,
        author: { login: input.identity.login },
        body: input.body,
        createdAt,
        updatedAt: createdAt,
        ownedByCurrentUser: true,
      };
      thread.messages.push(message);
      operations.set(input.clientOperationId, { threadId: thread.id, commentId });
      return { ...message };
    },

    async update(input) {
      requireMatch(input.provenance.provider);
      const thread = threadOrThrow(input.threadId);
      const comment = commentOrThrow(thread, input.commentId);
      comment.body = input.body;
      comment.updatedAt = iso(next);
      next += 1;
      comment.ownedByCurrentUser = comment.author.login === input.identity.login;
      return { ...comment };
    },

    async delete(input) {
      requireMatch(input.provenance.provider);
      const thread = threadOrThrow(input.threadId);
      const comment = commentOrThrow(thread, input.commentId);
      comment.deleted = true;
      comment.ownedByCurrentUser = comment.author.login === input.identity.login;
      return { ok: true as const };
    },

    findByClientOperationId(id) {
      return operations.get(id);
    },
  };
}
