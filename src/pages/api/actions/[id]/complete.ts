import type { APIRoute } from "astro";
import { completeAction } from "../../../../lib/server/repositories/json/store.ts";
import { ensureSeed } from "../../../../lib/server/seed.ts";

export const prerender = false;

export const POST: APIRoute = async ({ params, request }) => {
  await ensureSeed();
  const id = params.id;
  if (!id) return Response.json({ error: "missing id" }, { status: 400 });
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  const body =
    payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  try {
    return Response.json(await completeAction({ ...body, id }));
  } catch (err) {
    const status = (err as { status?: number }).status ?? 400;
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status });
  }
};
