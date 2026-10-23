import { zodToJsonSchema } from "zod-to-json-schema";
import { tools } from "../../shared/contracts/tools.ts";
import { numberDiff, printNumberedDiff } from "../../shared/domain/numbered-diff.ts";
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
      "List saved guided reviews, the active id, configured repositories, catalog snapshots, and store actions.",
    inputSchema: schema(tools.list_reviews.input),
  },
  {
    name: "replace_catalog",
    description:
      "Replace the pull-request catalog snapshot for one repository. Includes the current origin repository in configuration. Never deletes saved reviews.",
    inputSchema: schema(tools.replace_catalog.input),
  },
  {
    name: "open_pull_request",
    description:
      "Open an Azure DevOps or GitHub pull request URL into a saved review with its diff and intent. Returns id, chaptered, and behind.",
    inputSchema: schema(tools.open_pull_request.input),
  },
  {
    name: "add_local_review",
    description:
      "Save an unchaptered review from a local git work tree range (repoPath, base, head). Does not checkout or fetch.",
    inputSchema: schema(tools.add_local_review.input),
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
    name: "read_diff",
    description:
      "Read a saved review diff as plain text with numbered changed lines. Unknown id is 404; missing diff is 409.",
    inputSchema: schema(tools.read_diff.input),
  },
  {
    name: "chapter_review",
    description:
      "Chapter a saved review by line references. Coverage must be exact; stale sourceCommit is 409.",
    inputSchema: schema(tools.chapter_review.input),
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
      case "open_pull_request": {
        const input = tools.open_pull_request.input.parse(args);
        return services.reviews.openPullRequest(input.url);
      }
      case "add_local_review": {
        const input = tools.add_local_review.input.parse(args);
        return services.reviews.addLocalReview(input);
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
      case "read_diff": {
        const input = tools.read_diff.input.parse(args);
        const review = await services.reviews.get(input.id);
        if (!review.diff) {
          throw Object.assign(
            new Error("review has no saved diff; refresh first"),
            { status: 409, rpc: 409 },
          );
        }
        return printNumberedDiff({
          id: input.id,
          sourceCommit: review.diff.sourceCommit,
          title: review.guide.title,
          ...(review.diff.intent ? { intent: review.diff.intent } : {}),
          files: numberDiff(review.diff.files),
        });
      }
      case "chapter_review": {
        const input = tools.chapter_review.input.parse(args);
        return services.reviews.chapterReview(input);
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
          if (typeof result === "string") {
            return ok(id, {
              content: [{ type: "text", text: result }],
            });
          }
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
      const status = (err as { status?: number }).status;
      const code =
        (err as { rpc?: number }).rpc ??
        (typeof status === "number" ? status : -32000);
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
