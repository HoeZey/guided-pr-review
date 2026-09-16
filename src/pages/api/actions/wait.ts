import type { APIRoute } from "astro";
import { waitForAction } from "../../../lib/server/repositories/json/store.ts";
import { ensureSeed } from "../../../seed.ts";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  await ensureSeed();
  let payload: unknown = {};
  try {
    const text = await request.text();
    if (text.trim()) payload = JSON.parse(text);
  } catch {
    return Response.json({ error: "invalid JSON" }, { status: 400 });
  }
  try {
    return Response.json({ action: await waitForAction(payload) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status: 400 });
  }
};
