import { ConnectionList, type ConnectionView } from "../../shared/contracts/connections.ts";
import type { CredentialResult, CredentialSource } from "../auth/ports.ts";
import type { GitProviderKind } from "../providers/ports.ts";

const TARGETS = [
  { provider: "azure-devops" as const, host: "dev.azure.com" },
  { provider: "github" as const, host: "github.com" },
];

export type ConnectionService = {
  list: () => Promise<ConnectionList>;
  retry: (input?: unknown) => Promise<ConnectionList>;
};

export function toConnectionView(result: CredentialResult): ConnectionView {
  if (result.status === "connected") {
    return {
      provider: result.identity.provider,
      host: result.identity.host,
      status: "connected",
      login: result.identity.login,
    };
  }
  return {
    provider: result.provider,
    host: result.host,
    status: result.status,
    recovery: result.recovery,
  };
}

export function createConnectionService(credentials: CredentialSource): ConnectionService {
  async function list(): Promise<ConnectionList> {
    const connections = await Promise.all(
      TARGETS.map(async (target) => {
        try {
          return toConnectionView(await credentials.getAccessToken(target));
        } catch {
          return {
            provider: target.provider,
            host: target.host,
            status: "malformed" as const,
            recovery: recoveryFor(target.provider),
          };
        }
      }),
    );
    return ConnectionList.parse({ connections });
  }

  return {
    list,
    retry: () => list(),
  };
}

function recoveryFor(provider: GitProviderKind): string {
  return provider === "github" ? "gh auth login" : "az login";
}
