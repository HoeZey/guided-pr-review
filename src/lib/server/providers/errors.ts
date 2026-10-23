import type { GitProviderKind } from "./ports.ts";

export type ProviderErrorCode =
  | "auth"
  | "rate"
  | "unavailable"
  | "malformed-response"
  | "not-found";

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly provider: GitProviderKind;
  readonly host: string;
  readonly retryAfterSec?: number;

  constructor(input: {
    code: ProviderErrorCode;
    provider: GitProviderKind;
    host: string;
    retryAfterSec?: number;
  }) {
    super(messageFor(input.code));
    this.name = "ProviderError";
    this.code = input.code;
    this.provider = input.provider;
    this.host = input.host;
    if (input.retryAfterSec !== undefined) this.retryAfterSec = input.retryAfterSec;
  }
}

function messageFor(code: ProviderErrorCode): string {
  switch (code) {
    case "auth":
      return "Azure DevOps authentication failed";
    case "rate":
      return "Azure DevOps rate limit exceeded";
    case "unavailable":
      return "Azure DevOps is unavailable";
    case "malformed-response":
      return "Azure DevOps returned a malformed response";
    case "not-found":
      return "Azure DevOps repository or pull request was not found";
  }
}
