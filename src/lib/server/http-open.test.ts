import assert from "node:assert/strict";
import { test } from "node:test";
import { createHttpHandlers } from "./http.ts";
import type { AppServices } from "./services/app.ts";

function unused(name: string) {
  return async () => {
    throw new Error(`unexpected ${name}`);
  };
}

function fakeServices(overrides: {
  openDiff?: AppServices["reviews"]["openDiff"];
  updateDiff?: AppServices["reviews"]["updateDiff"];
  queue?: AppServices["actions"]["queue"];
}): AppServices {
  return {
    reviews: {
      list: unused("list"),
      get: unused("get"),
      add: unused("add"),
      addFromTool: unused("addFromTool"),
      upsert: unused("upsert"),
      upsertFromTool: unused("upsertFromTool"),
      remove: unused("remove"),
      setActive: unused("setActive"),
      chapterReview: unused("chapterReview"),
      seedIfEmpty: unused("seedIfEmpty"),
      openDiff: overrides.openDiff ?? unused("openDiff"),
      updateDiff: overrides.updateDiff ?? unused("updateDiff"),
      openPullRequest: unused("openPullRequest"),
      addLocalReview: unused("addLocalReview"),
    },
    catalog: { replace: unused("replace") },
    catalogRefresh: { refresh: unused("catalogRefresh") },
    actions: {
      queue: overrides.queue ?? unused("queue"),
      wait: unused("wait"),
      complete: unused("complete"),
    },
    outcomes: { publish: unused("publish") },
    connections: {
      list: unused("connections.list"),
      retry: unused("connections.retry"),
    },
    repositories: {
      list: unused("repositories.list"),
      add: unused("repositories.add"),
      remove: unused("repositories.remove"),
      search: unused("repositories.search"),
    },
    comments: {
      list: unused("comments.list"),
      createThread: unused("comments.createThread"),
      reply: unused("comments.reply"),
      update: unused("comments.update"),
      delete: unused("comments.delete"),
    },
  };
}

const target = {
  provider: "github" as const,
  host: "github.com",
  repository: {
    id: "1296269",
    owner: "octocat",
    name: "Hello-World",
    webUrl: "https://github.com/octocat/Hello-World",
  },
  number: 42,
};

test("POST /api/reviews/open completes through the review service and never queues an agent", async () => {
  const seen: string[] = [];
  const http = createHttpHandlers(
    fakeServices({
      openDiff: async (input) => {
        seen.push("open");
        assert.deepEqual(input, target);
        return { reviewId: "r-open", skipped: false };
      },
      queue: async () => {
        seen.push("queue");
        return { id: "nope" };
      },
    }),
  );
  const response = await http.openDiff.POST({
    request: new Request("http://localhost/api/reviews/open", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target }),
    }),
    params: {},
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { reviewId: "r-open", skipped: false });
  assert.deepEqual(seen, ["open"]);
});

test("POST /api/reviews/update-diff completes through the review service and never queues an agent", async () => {
  const seen: string[] = [];
  const http = createHttpHandlers(
    fakeServices({
      updateDiff: async (input) => {
        seen.push("update");
        assert.deepEqual(input, target);
        return { reviewId: "r-update", skipped: true };
      },
      queue: async () => {
        seen.push("queue");
        return { id: "nope" };
      },
    }),
  );
  const response = await http.updateDiff.POST({
    request: new Request("http://localhost/api/reviews/update-diff", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target }),
    }),
    params: {},
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { reviewId: "r-update", skipped: true });
  assert.deepEqual(seen, ["update"]);
});

