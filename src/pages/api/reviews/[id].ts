import type { APIRoute } from "astro";
import { getReview, removeReview } from "../../../lib/server/repositories/json/store.ts";
import { ensureSeed } from "../../../lib/server/seed.ts";

export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
  await ensureSeed();
  const id = params.id;
  if (!id) return Response.json({ error: "missing id" }, { status: 400 });
  try {
    return Response.json(await getReview(id));
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status });
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  await ensureSeed();
  const id = params.id;
  if (!id) return Response.json({ error: "missing id" }, { status: 400 });
  try {
    return Response.json(await removeReview(id));
  } catch (err) {
    const status = (err as { status?: number }).status ?? 500;
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status });
  }
};
