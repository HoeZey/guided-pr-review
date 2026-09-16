import type { FileChange } from "../../shared/contracts/guide.ts";
import type { GitProviderKind } from "../providers/ports.ts";

export type GitCacheIdentity = {
  provider: GitProviderKind;
  host: string;
  repositoryId: string;
};

export type GitProcessRequest = {
  argv: readonly string[];
  cwd?: string;
  env?: Readonly<Record<string, string>>;
  timeoutMs: number;
  maxOutputBytes: number;
};

export type GitProcessResult = {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  commandMissing: boolean;
};

export type GitProcessRunner = {
  run: (request: GitProcessRequest) => Promise<GitProcessResult>;
};

export type GitCacheFs = {
  mkdirp: (path: string) => Promise<void>;
  rmrf: (path: string) => Promise<void>;
  exists: (path: string) => Promise<boolean>;
};

export type GitOperationErrorKind =
  | "empty-diff"
  | "missing-commit"
  | "fetch-failure"
  | "corrupt";

export class GitOperationError extends Error {
  readonly kind: GitOperationErrorKind;
  readonly identity: GitCacheIdentity;

  constructor(kind: GitOperationErrorKind, identity: GitCacheIdentity, message: string) {
    super(message);
    this.name = "GitOperationError";
    this.kind = kind;
    this.identity = identity;
  }
}

/** Bare-cache identity and exact-commit fetch. Implementation lands in PRD 07. */
export type ManagedGitCache = {
  ensureBare: (identity: GitCacheIdentity) => Promise<void>;
  fetchCommits: (
    identity: GitCacheIdentity,
    commits: readonly string[],
    options?: { cloneUrl: string },
  ) => Promise<void>;
};

/** Three-dot unified diff from a managed cache. Implementation lands in PRD 07. */
export type GitDiff = {
  unifiedThreeDot: (input: {
    identity: GitCacheIdentity;
    sourceCommit: string;
    targetCommit: string;
  }) => Promise<FileChange[]>;
};
