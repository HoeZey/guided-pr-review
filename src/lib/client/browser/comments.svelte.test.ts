import { afterEach, expect, test, vi } from "vitest";
import { commentsApi } from "./comments";

afterEach(() => {
  vi.unstubAllGlobals();
});

test("commentsApi calls same-origin review paths and never a git-host URL", async () => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ threads: [] }),
  });
  vi.stubGlobal("fetch", fetchMock);

  await commentsApi.list("r1");
  await commentsApi.createThread("r1", {
    anchor: { kind: "pr" },
    body: "hi",
    clientOperationId: "cop_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  });
  const abort = new AbortController();
  await commentsApi.reply(
    "r1",
    "t1",
    { body: "also", clientOperationId: "cop_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" },
    { signal: abort.signal },
  );

  const urls = fetchMock.mock.calls.map((call) => String(call[0]));
  expect(urls).toEqual([
    "/api/reviews/r1/comments",
    "/api/reviews/r1/comments",
    "/api/reviews/r1/comments/t1/replies",
  ]);
  expect(urls.join(" ")).not.toMatch(/github\.com|dev\.azure\.com/);
  const createInit = fetchMock.mock.calls[1]?.[1] as RequestInit;
  expect(JSON.parse(String(createInit.body))).toEqual({
    anchor: { kind: "pr" },
    body: "hi",
    clientOperationId: "cop_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  });
  const replyInit = fetchMock.mock.calls[2]?.[1] as RequestInit;
  expect(replyInit.signal).toBe(abort.signal);
});
