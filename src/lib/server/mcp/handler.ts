import { zodToJsonSchema } from "zod-to-json-schema";
import { tools } from "../../shared/contracts/tools.ts";
import type { AppServices } from "../services/app.ts";

const PROTOCOL = "2024-11-05";

function schema(zodSchema: unknown): Record<string, unknown> {
  return zodToJsonSchema(zodSchema as never, { target: "openApi3" }) as Record<
    string,
    unknown
  >;
}

const TOOL_DEFS = [
  {
    name: "list_reviews",
    description:
      "List saved guided reviews, the active id, configured repositories, catalog snapshots, in-flight actions, and whether the waiting agent is connected.",
    inputSchema: schema(tools.list_reviews.input),
  },
  {
    name: "replace_catalog",
    description:
      "Replace the pull-request catalog snapshot for one repository. Includes the current origin repository in configuration. Never deletes saved reviews.",
    inputSchema: schema(tools.replace_catalog.input),
  },
  {
    name: "queue_action",
    description:
      "Queue a Generate guide action for an unchaptered review. Dedupes an in-flight Generate guide for the same review.",
    inputSchema: schema(tools.queue_action.input),
  },
  {
    name: "wait_for_action",
    description:
      "Long-poll until a queued browser action is claimed, or until timeoutMs. Heartbeats the waiting agent. Returns null when idle.",
    inputSchema: schema(tools.wait_for_action.input),
  },
  {
    name: "complete_action",
    description:
      "Mark a claimed Generate guide action succeeded or failed. Succeeded Generate guide requires reviewId. Failed requires a structured error.",
    inputSchema: schema(tools.complete_action.input),
  },
  {
    name: "add_review",
    description: "Add a Guide v1 payload as a new snapshot and make it active.",
    inputSchema: schema(tools.add_review.input),
  },
  {
    name: "upsert_review",
    description:
      "Upsert a pull-request Guide v1 by provider, host, repository, and PR number.",
    inputSchema: schema(tools.upsert_review.input),
  },
  {
    name: "publish_review_outcome",
    description:
      "Append a CodeReviewOutcome v1 run to a review. Never overwrites an older run.",
    inputSchema: schema(tools.publish_review_outcome.input),
  },
  {
    name: "remove_review",
    description: "Remove a review by id.",
    inputSchema: schema(tools.remove_review.input),
  },
  {
    name: "get_review",
    description: "Get the Guide v1 payload and outcome history for a review id.",
    inputSchema: schema(tools.get_review.input),
  },
  {
    name: "set_active",
    description: "Set which review the UI should show.",
    inputSchema: schema(tools.set_active.input),
  },
];

type Rpc = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: unknown;
};

function ok(id: Rpc["id"], result: unknown) {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

function fail(id: Rpc["id"], code: number, message: string) {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}

export function createMcpHandler(services: AppServices) {
  async function callTool(
    name: string,
    args: Record<string, unknown> | undefined,
  ): Promise<unknown> {
    switch (name) {
      case "list_reviews":
        tools.list_reviews.input.parse(args ?? {});
        return services.reviews.list();
      case "replace_catalog": {
        const input = tools.replace_catalog.input.parse(args);
        return services.catalog.replace(input);
      }
      case "queue_action": {
        const input = tools.queue_action.input.parse(args);
        return services.actions.queue(input);
      }
      case "wait_for_action": {
        const input = tools.wait_for_action.input.parse(args ?? {});
        return { action: await services.actions.wait(input) };
      }
      case "complete_action": {
        const input = tools.complete_action.input.parse(args);
        return services.actions.complete(input);
      }
      case "add_review": {
        const input = tools.add_review.input.parse(args);
        return services.reviews.addFromTool(input);
      }
      case "upsert_review": {
        const input = tools.upsert_review.input.parse(args);
        return services.reviews.upsertFromTool(input);
      }
      case "publish_review_outcome": {
        const input = tools.publish_review_outcome.input.parse(args);
        return services.outcomes.publish(input.reviewId, input.outcome);
      }
      case "remove_review": {
        const input = tools.remove_review.input.parse(args);
        return services.reviews.remove(input.id);
      }
      case "get_review": {
        const input = tools.get_review.input.parse(args);
        return services.reviews.get(input.id);
      }
      case "set_active": {
        const input = tools.set_active.input.parse(args);
        return services.reviews.setActive(input.id);
      }
      default:
        throw Object.assign(new Error(`unknown tool ${name}`), { rpc: -32601 });
    }
  }

  async function handleMcpJson(body: unknown): Promise<unknown> {
    const msg = (body ?? {}) as Rpc;
    const id = msg.id ?? null;
    const method = msg.method ?? "";
    try {
      switch (method) {
        case "initialize":
          return ok(id, {
            protocolVersion: PROTOCOL,
            capabilities: { tools: {} },
            serverInfo: { name: "guided-pr-review", version: "0.1.0" },
          });
        case "notifications/initialized":
        case "notifications/cancelled":
          return null;
        case "ping":
          return ok(id, {});
        case "tools/list":
          return ok(id, { tools: TOOL_DEFS });
        case "tools/call": {
          const params = (msg.params ?? {}) as {
            name?: string;
            arguments?: Record<string, unknown>;
          };
          const result = await callTool(params.name ?? "", params.arguments);
          return ok(id, {
            content: [{ type: "text", text: JSON.stringify(result) }],
            structuredContent: result,
          });
        }
        default:
          return fail(id, -32601, `unknown method ${method}`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const code = (err as { rpc?: number }).rpc ?? -32000;
      return fail(id, code, message);
    }
  }

  async function handleMcpRequest(request: Request): Promise<Response> {
    if (request.method === "GET") {
      return new Response("guided-pr-review MCP. POST JSON-RPC to this URL.\n", {
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
    if (request.method !== "POST") {
      return new Response("method not allowed", { status: 405 });
    }
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json(
        { jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } },
        { status: 400 },
      );
    }
    const result = await handleMcpJson(body);
    if (result === null) return new Response(null, { status: 204 });
    return Response.json(result);
  }

  return { handleMcpJson, handleMcpRequest };
}
