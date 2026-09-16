import { afterEach, expect, test, vi } from "vitest";
import { fetchJson } from "./fetch";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("fetchJson returns JSON when the response is ok", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      statusText: "OK",
      json: async () => ({ id: "r1" }),
    }),
  );
  await expect(fetchJson<{ id: string }>("/api/reviews/r1")).resolves.toEqual({ id: "r1" });
});

test("fetchJson maps a failed response to Error from body.error or statusText", async () => {
  for (const [body, statusText, message] of [
    [{ error: "review not found" }, "Bad Request", "review not found"],
    [{}, "Internal Server Error", "Internal Server Error"],
  ] as const) {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        statusText,
        json: async () => body,
      }),
    );
    await expect(fetchJson("/api/reviews")).rejects.toThrow(message);
  }
});
