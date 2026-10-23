export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const body = (await res.json()) as { error?: string; code?: string };
  if (!res.ok) {
    const err = new Error(body.error || res.statusText) as Error & { code?: string };
    if (typeof body.code === "string") err.code = body.code;
    throw err;
  }
  return body as T;
}
