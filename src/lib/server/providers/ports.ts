export type GitProviderKind = "azure-devops" | "github";

export type ProviderRepositoryIdentity = {
  provider: GitProviderKind;
  host: string;
  id: string;
  owner: string;
  name: string;
  webUrl: string;
  cloneUrl?: string;
  defaultBranch?: string;
};

export type ProviderPullRequestMetadata = {
  provider: GitProviderKind;
  host: string;
  repository: ProviderRepositoryIdentity;
  number: number;
  title: string;
  webUrl: string;
  sourceRef: string;
  targetRef: string;
  sourceCommit: string;
  targetCommit: string;
  isDraft: boolean;
  status: "active" | "completed" | "abandoned" | "closed";
  author: string;
  isReviewer: boolean;
  isAuthor: boolean;
  updatedAt: string;
};

export type ProviderRepositoryReader = {
  getRepository: (input: {
    provider: GitProviderKind;
    host: string;
    owner: string;
    name: string;
  }) => Promise<ProviderRepositoryIdentity>;
};

export type ProviderPullRequestReader = {
  listPullRequests: (
    repository: ProviderRepositoryIdentity,
  ) => Promise<ProviderPullRequestMetadata[]>;
  getPullRequest: (input: {
    provider: GitProviderKind;
    host: string;
    repository: Pick<ProviderRepositoryIdentity, "id" | "owner" | "name">;
    number: number;
  }) => Promise<ProviderPullRequestMetadata>;
};
