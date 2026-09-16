import type { APIRoute } from "astro";
import { publishReviewOutcome } from "../../../../lib/server/repositories/json/store.ts";
import { ensureSeed } from "../../../../seed.ts";

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
  const outcome =
    payload && typeof payload === "object" && "outcome" in payload
      ? (payload as { outcome: unknown }).outcome
      : payload;
  try {
    const result = await publishReviewOutcome(id, outcome);
    return Response.json(result, { status: 201 });
  } catch (err) {
    const status = (err as { status?: number }).status ?? 400;
    const message = err instanceof Error ? err.message : String(err);
    return Response.json({ error: message }, { status });
  }
};
