import type { APIRoute } from "astro";
import {
  addReviewFromTool,
  listReviews,
  upsertReviewFromTool,
} from "../../store.ts";
import { ensureSeed } from "../../seed.ts";

export const prerender = false;

export const GET: APIRoute = async () => {
  await ensureSeed();
  const body = await listReviews();
  return Response.json(body);
};

export const POST: APIRoute = async ({ request }) => {
  await ensureSeed();
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  try {
    const result = await addReviewFromTool(payload);
    return Response.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 400 });
  }
};

export const PUT: APIRoute = async ({ request }) => {
  await ensureSeed();
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  try {
    const result = await upsertReviewFromTool(payload);
    return Response.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 400 });
  }
};

