import type {
  ClientOperationId,
  CommentMessage,
  CommentThread,
  CreateCommentAnchor,
} from "../../shared/contracts/comments.ts";
import type { PullRequestSource } from "../../shared/contracts/provenance.ts";
import type { CredentialIdentity } from "../auth/ports.ts";

export type CommentErrorCode =
  | "unknown-review"
  | "no-host-provenance"
  | "invalid-anchor"
  | "unknown-path"
  | "anchor-outside-diff"
  | "foreign-origin"
  | "foreign-target"
  | "not-owned"
  | "invalid-operation-id"
  | "operation-id-as-resource"
  | "unknown-thread"
  | "unknown-comment"
  | "auth"
  | "rate"
  | "unavailable"
  | "not-found"
  | "denied"
  | "malformed"
  | "cross-provider";

const STATUS: Record<CommentErrorCode, number> = {
  "unknown-review": 404,
  "no-host-provenance": 400,
  "invalid-anchor": 400,
  "unknown-path": 400,
  "anchor-outside-diff": 400,
  "foreign-origin": 403,
  "foreign-target": 400,
  "not-owned": 403,
  "invalid-operation-id": 400,
  "operation-id-as-resource": 400,
  "unknown-thread": 404,
  "unknown-comment": 404,
  auth: 401,
  rate: 429,
  unavailable: 503,
  "not-found": 404,
  denied: 403,
  malformed: 400,
  "cross-provider": 400,
};

export class CommentError extends Error {
  readonly code: CommentErrorCode;
  readonly status: number;

  constructor(code: CommentErrorCode, message: string) {
    super(message);
    this.name = "CommentError";
    this.code = code;
    this.status = STATUS[code];
  }
}

export type CommentProviderListInput = {
  provenance: PullRequestSource;
  identity: CredentialIdentity;
};

export type CommentProviderCreateInput = {
  provenance: PullRequestSource;
  identity: CredentialIdentity;
  anchor: CreateCommentAnchor;
  body: string;
  clientOperationId: ClientOperationId;
};

export type CommentProviderReplyInput = {
  provenance: PullRequestSource;
  identity: CredentialIdentity;
  threadId: string;
  body: string;
  clientOperationId: ClientOperationId;
};

export type CommentProviderUpdateInput = {
  provenance: PullRequestSource;
  identity: CredentialIdentity;
  threadId: string;
  commentId: string;
  body: string;
};

export type CommentProviderDeleteInput = {
  provenance: PullRequestSource;
  identity: CredentialIdentity;
  threadId: string;
  commentId: string;
};

export type CommentProvider = {
  list: (input: CommentProviderListInput) => Promise<CommentThread[]>;
  createThread: (input: CommentProviderCreateInput) => Promise<CommentThread>;
  reply: (input: CommentProviderReplyInput) => Promise<CommentMessage>;
  update: (input: CommentProviderUpdateInput) => Promise<CommentMessage>;
  delete: (input: CommentProviderDeleteInput) => Promise<{ ok: true }>;
};
