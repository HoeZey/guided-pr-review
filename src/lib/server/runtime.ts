import { createCliCredentialSource } from "./auth/cli-credentials.ts";
import { createProcessCommandRunner } from "./auth/command-runner.ts";
import { createHttpHandlers } from "./http.ts";
import { createMcpHandler } from "./mcp/handler.ts";
import { createAdoRestAdapter } from "./providers/ado-rest.ts";
import { createGithubProvider } from "./providers/github/rest.ts";
import { configuredRepositoriesCollectionPresent } from "./repositories/json/file.ts";
import { jsonConfiguredRepositories, jsonRepositories } from "./repositories/json/store.ts";
import { ensureSeed } from "./seed.ts";
import { createAppServices } from "./services/app.ts";
import { readGitOriginUrl } from "./services/configured-repositories.ts";

const runner = createProcessCommandRunner();
const credentials = createCliCredentialSource({ runner });

export const appServices = createAppServices(jsonRepositories, {
  credentials,
  configured: jsonConfiguredRepositories,
  collectionPresent: async () => configuredRepositoriesCollectionPresent(),
  originRemoteUrl: () => readGitOriginUrl(runner),
  readers: {
    ado: createAdoRestAdapter({ credentials }),
    github: createGithubProvider({ credentials }),
  },
});

const mcp = createMcpHandler(appServices);

export const handleMcpJson = mcp.handleMcpJson;
export const handleMcpRequest = mcp.handleMcpRequest;
export const httpHandlers = createHttpHandlers(appServices, ensureSeed);
