import { createMcpHandler } from "./mcp/handler.ts";
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

function invalidJson(): Response {
  return Response.json({ error: "invalid JSON" }, { status: 400 });
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
