import type { GitProviderKind } from "../providers/ports.ts";

export type CredentialStatus =
  | "connected"
  | "command-missing"
  | "login-required"
  | "expired"
  | "denied-scope"
  | "timeout"
  | "malformed";

export type CredentialIdentity = {
  provider: GitProviderKind;
  host: string;
  login: string;
};

export type CredentialSuccess = {
  status: "connected";
  identity: CredentialIdentity;
  token: string;
};

export type CredentialFailure = {
  status: Exclude<CredentialStatus, "connected">;
  provider: GitProviderKind;
  host: string;
  recovery: string;
};

export type CredentialResult = CredentialSuccess | CredentialFailure;

/** CLI-backed token source. Implementations land in PRD 07; no subprocess here. */
export type CredentialSource = {
  getAccessToken: (input: {
    provider: GitProviderKind;
    host: string;
  }) => Promise<CredentialResult>;
};
