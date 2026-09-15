import type { APIRoute } from "astro";
import { queueAction } from "../../store.ts";
import { ensureSeed } from "../../seed.ts";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  await ensureSeed();
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  try {
    return Response.json(await queueAction(payload), { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 400 });
  }
};
