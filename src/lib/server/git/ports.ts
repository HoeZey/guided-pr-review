import type { FileChange } from "../../shared/contracts/guide.ts";
import type { GitProviderKind } from "../providers/ports.ts";

export type GitCacheIdentity = {
  provider: GitProviderKind;
  host: string;
  repositoryId: string;
};

/** Bare-cache identity and exact-commit fetch. Implementation lands in PRD 07. */
export type ManagedGitCache = {
  ensureBare: (identity: GitCacheIdentity) => Promise<void>;
  fetchCommits: (identity: GitCacheIdentity, commits: string[]) => Promise<void>;
};

/** Three-dot unified diff from a managed cache. Implementation lands in PRD 07. */
export type GitDiff = {
  unifiedThreeDot: (input: {
    identity: GitCacheIdentity;
    sourceCommit: string;
    targetCommit: string;
  }) => Promise<FileChange[]>;
};
