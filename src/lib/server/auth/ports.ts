import type { GitProviderKind } from "../providers/ports.ts";

export type CredentialStatus =
  | "connected"
  | "command-missing"
  | "login-required"
  | "expired"
  | "denied-scope"
  | "timeout"
  | "malformed";

export type CommandRunRequest = {
  argv: readonly string[];
  timeoutMs: number;
  maxOutputBytes: number;
};

export type CommandRunResult = {
  code: number | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  commandMissing: boolean;
};

export type CommandRunner = {
  run: (request: CommandRunRequest) => Promise<CommandRunResult>;
};

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

/** CLI-backed token source. Tokens stay inside this server seam. */
export type CredentialSource = {
  getAccessToken: (input: {
    provider: GitProviderKind;
    host: string;
  }) => Promise<CredentialResult>;
};
