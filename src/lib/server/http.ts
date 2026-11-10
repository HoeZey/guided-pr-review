import { OpenActionTarget } from "../shared/contracts/catalog.ts";
import { createMcpHandler } from "./mcp/handler.ts";
import { CommentError } from "./providers/comments.ts";
import type { AppServices } from "./services/app.ts";

export type HttpEvent = {
  request: Request;
  params: Record<string, string | undefined>;
};

async function readJson(request: Request): Promise<unknown> {
  return request.json();
}

async function readJsonAllowEmpty(request: Request): Promise<unknown> {
  const text = await request.text();
  if (!text.trim()) return {};
  return JSON.parse(text);
}

function jsonError(err: unknown, fallback: number): Response {
  const status = (err as { status?: number }).status ?? fallback;
  const message = err instanceof Error ? err.message : String(err);
  return Response.json({ error: message }, { status });
}

function commentJsonError(err: unknown, fallback: number): Response {
  const status = (err as { status?: number }).status ?? fallback;
  const message = err instanceof Error ? err.message : String(err);
  if (err instanceof CommentError) {
    return Response.json({ error: message, code: err.code }, { status });
  }
  return Response.json({ error: message }, { status });
}

function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  if (!origin) return;
  if (origin !== new URL(request.url).origin) {
    throw new CommentError("foreign-origin", "foreign origin is not allowed");
  }
}

function requireParam(
  params: HttpEvent["params"],
  key: "id" | "threadId" | "commentId",
): string {
  const value = params[key];
  if (value) return value;
  if (key === "threadId") throw new CommentError("unknown-thread", "missing threadId");
  if (key === "commentId") throw new CommentError("unknown-comment", "missing commentId");
  throw new CommentError("unknown-review", "missing id");
}

function invalidJson(): Response {
  return Response.json({ error: "invalid JSON" }, { status: 400 });
}

function parseOpenTarget(payload: unknown): OpenActionTarget {
  const raw =
    payload && typeof payload === "object" && "target" in payload
      ? (payload as { target: unknown }).target
      : payload;
  return OpenActionTarget.parse(raw);
}

export function createHttpHandlers(
  services: AppServices,
  seed: () => Promise<void> = async () => undefined,
) {
  const mcp = createMcpHandler(services);

  return {
    reviews: {
      GET: async () => {
        await seed();
        return Response.json(await services.reviews.list());
      },
      POST: async ({ request }: HttpEvent) => {
        await seed();
        let payload: unknown;
        try {
          payload = await readJson(request);
        } catch {
          return invalidJson();
        }
        try {
          return Response.json(await services.reviews.addFromTool(payload), { status: 201 });
        } catch (err) {
          return jsonError(err, 400);
        }
      },
      PUT: async ({ request }: HttpEvent) => {
        await seed();
        let payload: unknown;
        try {
          payload = await readJson(request);
        } catch {
          return invalidJson();
        }
        try {
          return Response.json(await services.reviews.upsertFromTool(payload));
        } catch (err) {
          return jsonError(err, 400);
        }
      },
    },
    review: {
      GET: async ({ params }: HttpEvent) => {
        await seed();
        const id = params.id;
        if (!id) return Response.json({ error: "missing id" }, { status: 400 });
        try {
          return Response.json(await services.reviews.get(id));
        } catch (err) {
          return jsonError(err, 500);
        }
      },
      DELETE: async ({ params }: HttpEvent) => {
        await seed();
        const id = params.id;
        if (!id) return Response.json({ error: "missing id" }, { status: 400 });
        try {
          return Response.json(await services.reviews.remove(id));
        } catch (err) {
          return jsonError(err, 500);
        }
      },
    },
    active: {
      POST: async ({ params }: HttpEvent) => {
        await seed();
        const id = params.id;
        if (!id) return Response.json({ error: "missing id" }, { status: 400 });
        try {
          return Response.json(await services.reviews.setActive(id));
        } catch (err) {
          return jsonError(err, 500);
        }
      },
    },
    outcomes: {
      POST: async ({ params, request }: HttpEvent) => {
        await seed();
        const id = params.id;
        if (!id) return Response.json({ error: "missing id" }, { status: 400 });
        let payload: unknown;
        try {
          payload = await readJson(request);
        } catch {
          return invalidJson();
        }
        const outcome =
          payload && typeof payload === "object" && "outcome" in payload
            ? (payload as { outcome: unknown }).outcome
            : payload;
        try {
          return Response.json(await services.outcomes.publish(id, outcome), { status: 201 });
        } catch (err) {
          return jsonError(err, 400);
        }
      },
    },
    catalog: {
      PUT: async ({ request }: HttpEvent) => {
        await seed();
        let payload: unknown;
        try {
          payload = await readJson(request);
        } catch {
          return invalidJson();
        }
        try {
          return Response.json(await services.catalog.replace(payload));
        } catch (err) {
          return jsonError(err, 400);
        }
      },
      POST: async ({ request }: HttpEvent) => {
        await seed();
        let payload: unknown = {};
        try {
          payload = await readJsonAllowEmpty(request);
        } catch {
          return invalidJson();
        }
        const reason =
          payload &&
          typeof payload === "object" &&
          "reason" in payload &&
          (payload.reason === "startup" || payload.reason === "focus" || payload.reason === "manual")
            ? payload.reason
            : "manual";
        try {
          return Response.json(await services.catalogRefresh.refresh({ reason }));
        } catch (err) {
          return jsonError(err, 500);
        }
      },
    },
    openDiff: {
      POST: async ({ request }: HttpEvent) => {
        await seed();
        let payload: unknown;
        try {
          payload = await readJson(request);
        } catch {
          return invalidJson();
        }
        try {
          return Response.json(await services.reviews.openDiff(parseOpenTarget(payload)));
        } catch (err) {
          return jsonError(err, 400);
        }
      },
    },
    head: {
      GET: async ({ params }: HttpEvent) => {
        await seed();
        const id = params.id;
        if (!id) return Response.json({ error: "missing id" }, { status: 400 });
        try {
          return Response.json(await services.reviews.readHead(id));
        } catch (err) {
          return jsonError(err, 500);
        }
      },
    },
    updateDiff: {
      POST: async ({ request }: HttpEvent) => {
        await seed();
        let payload: unknown;
        try {
          payload = await readJson(request);
        } catch {
          return invalidJson();
        }
        try {
          return Response.json(await services.reviews.updateDiff(parseOpenTarget(payload)));
        } catch (err) {
          return jsonError(err, 400);
        }
      },
    },
    actions: {
      POST: async ({ request }: HttpEvent) => {
        await seed();
        let payload: unknown;
        try {
          payload = await readJson(request);
        } catch {
          return invalidJson();
        }
        try {
          return Response.json(await services.actions.queue(payload), { status: 201 });
        } catch (err) {
          return jsonError(err, 400);
        }
      },
    },
    wait: {
      POST: async ({ request }: HttpEvent) => {
        await seed();
        let payload: unknown = {};
        try {
          payload = await readJsonAllowEmpty(request);
        } catch {
          return invalidJson();
        }
        try {
          return Response.json({ action: await services.actions.wait(payload) });
        } catch (err) {
          return jsonError(err, 400);
        }
      },
    },
    complete: {
      POST: async ({ params, request }: HttpEvent) => {
        await seed();
        const id = params.id;
        if (!id) return Response.json({ error: "missing id" }, { status: 400 });
        let payload: unknown;
        try {
          payload = await readJson(request);
        } catch {
          return invalidJson();
        }
        const body =
          payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
        try {
          return Response.json(await services.actions.complete({ ...body, id }));
        } catch (err) {
          return jsonError(err, 400);
        }
      },
    },
    connections: {
      GET: async () => {
        await seed();
        return Response.json(await services.connections.list());
      },
      POST: async () => {
        await seed();
        return Response.json(await services.connections.retry());
      },
    },
    repositories: {
      GET: async () => {
        await seed();
        return Response.json(await services.repositories.list());
      },
      SEARCH: async ({ request }: HttpEvent) => {
        await seed();
        const params = new URL(request.url).searchParams;
        const query = params.get("q") ?? undefined;
        const organization = params.get("organization") ?? undefined;
        const project = params.get("project") ?? undefined;
        return Response.json(
          await services.repositories.search(
            query,
            organization && project ? { organization, project } : undefined,
          ),
        );
      },
      POST: async ({ request }: HttpEvent) => {
        await seed();
        let payload: unknown;
        try {
          payload = await readJson(request);
        } catch {
          return invalidJson();
        }
        try {
          return Response.json(await services.repositories.add(payload), { status: 201 });
        } catch (err) {
          return jsonError(err, 400);
        }
      },
      DELETE: async ({ params }: HttpEvent) => {
        await seed();
        const id = params.id;
        if (!id) return Response.json({ error: "missing id" }, { status: 400 });
        try {
          return Response.json(await services.repositories.remove(id));
        } catch (err) {
          return jsonError(err, 500);
        }
      },
    },
    comments: {
      GET: async ({ request, params }: HttpEvent) => {
        await seed();
        try {
          assertSameOrigin(request);
          return Response.json(await services.comments.list(requireParam(params, "id")));
        } catch (err) {
          return commentJsonError(err, 500);
        }
      },
      POST: async ({ request, params }: HttpEvent) => {
        await seed();
        let payload: unknown;
        try {
          payload = await readJson(request);
        } catch {
          return invalidJson();
        }
        try {
          assertSameOrigin(request);
          return Response.json(
            await services.comments.createThread(requireParam(params, "id"), payload),
            { status: 201 },
          );
        } catch (err) {
          return commentJsonError(err, 400);
        }
      },
    },
    commentReply: {
      POST: async ({ request, params }: HttpEvent) => {
        await seed();
        let payload: unknown;
        try {
          payload = await readJson(request);
        } catch {
          return invalidJson();
        }
        try {
          assertSameOrigin(request);
          return Response.json(
            await services.comments.reply(
              requireParam(params, "id"),
              requireParam(params, "threadId"),
              payload,
            ),
            { status: 201 },
          );
        } catch (err) {
          return commentJsonError(err, 400);
        }
      },
    },
    comment: {
      PATCH: async ({ request, params }: HttpEvent) => {
        await seed();
        let payload: unknown;
        try {
          payload = await readJson(request);
        } catch {
          return invalidJson();
        }
        try {
          assertSameOrigin(request);
          return Response.json(
            await services.comments.update(
              requireParam(params, "id"),
              requireParam(params, "threadId"),
              requireParam(params, "commentId"),
              payload,
            ),
          );
        } catch (err) {
          return commentJsonError(err, 400);
        }
      },
      DELETE: async ({ request, params }: HttpEvent) => {
        await seed();
        try {
          assertSameOrigin(request);
          return Response.json(
            await services.comments.delete(
              requireParam(params, "id"),
              requireParam(params, "threadId"),
              requireParam(params, "commentId"),
            ),
          );
        } catch (err) {
          return commentJsonError(err, 500);
        }
      },
    },
    mcp: {
      GET: async ({ request }: HttpEvent) => {
        await seed();
        return mcp.handleMcpRequest(request);
      },
      POST: async ({ request }: HttpEvent) => {
        await seed();
        return mcp.handleMcpRequest(request);
      },
    },
  };
}
