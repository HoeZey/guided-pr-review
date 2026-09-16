import { createHttpHandlers } from "./http.ts";
import { createMcpHandler } from "./mcp/handler.ts";
import { jsonRepositories } from "./repositories/json/store.ts";
import { ensureSeed } from "./seed.ts";
import { createAppServices } from "./services/app.ts";

export const appServices = createAppServices(jsonRepositories);

const mcp = createMcpHandler(appServices);

export const handleMcpJson = mcp.handleMcpJson;
export const handleMcpRequest = mcp.handleMcpRequest;
export const httpHandlers = createHttpHandlers(appServices, ensureSeed);
