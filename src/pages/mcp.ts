import type { APIRoute } from "astro";
import { handleMcpRequest } from "../lib/server/runtime.ts";
import { ensureSeed } from "../lib/server/seed.ts";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  await ensureSeed();
  return handleMcpRequest(request);
};

export const POST: APIRoute = async ({ request }) => {
  await ensureSeed();
  return handleMcpRequest(request);
};
