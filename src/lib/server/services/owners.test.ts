import assert from "node:assert/strict";
import { test } from "node:test";
import type { StoredAction } from "../../shared/contracts/catalog.ts";
import type { AppRepositories } from "../repositories/ports.ts";
import { createActionService } from "./actions.ts";
import { createCatalogService } from "./catalog.ts";
import { createOutcomeService } from "./outcomes.ts";
import { createReviewService } from "./reviews.ts";

function unused(name: string) {
  return async () => {
    throw new Error(`unexpected ${name}`);
  };
}

function repos(overrides: Partial<AppRepositories>): AppRepositories {
  return {
    listReviews: unused("listReviews"),
    getReview: unused("getReview"),
    addReview: unused("addReview"),
    addReviewFromTool: unused("addReviewFromTool"),
    upsertReview: unused("upsertReview"),
    upsertReviewFromTool: unused("upsertReviewFromTool"),
    removeReview: unused("removeReview"),
    setActive: unused("setActive"),
    seedIfEmpty: unused("seedIfEmpty"),
    replaceCatalog: unused("replaceCatalog"),
    queueAction: unused("queueAction"),
    waitForAction: unused("waitForAction"),
    completeAction: unused("completeAction"),
    publishReviewOutcome: unused("publishReviewOutcome"),
    ...overrides,
  };
}

test("catalog, action, outcome, and review commands use injected repository ports", async () => {
  const claimed: StoredAction = {
    id: "a1",
    kind: "refresh",
    status: "claimed",
    queuedAt: "t",
    claimedAt: "t",
  };
  const catalogInput = { origin: true };
  const queueInput = { kind: "refresh" };
  const completeInput = { id: "a1", status: "succeeded" };
  const outcome = { id: "run-1" };
  const seen: string[] = [];
  const injected = repos({
    listReviews: async () => {
      seen.push("list");
      return {
        reviews: [],
        activeId: null,
        repositories: [],
        catalog: [],
        actions: [],
        agentConnected: false,
      };
    },
    replaceCatalog: async (input) => {
      seen.push("catalog");
      assert.equal(input, catalogInput);
      return { ok: true as const };
    },
    queueAction: async (input) => {
      seen.push("queue");
      assert.equal(input, queueInput);
      return { id: "a1" };
    },
    waitForAction: async (input) => {
      seen.push("wait");
      assert.deepEqual(input, { timeoutMs: 0 });
      return claimed;
    },
    completeAction: async (input) => {
      seen.push("complete");
      assert.equal(input, completeInput);
      return { ok: true as const };
    },
    publishReviewOutcome: async (reviewId, published) => {
      seen.push("outcome");
      assert.equal(reviewId, "r1");
      assert.equal(published, outcome);
      return { id: "o1" };
    },
  });
  const catalog = createCatalogService(injected);
  const actions = createActionService(injected);
  const outcomes = createOutcomeService(injected);
  const reviews = createReviewService(injected);

  assert.deepEqual(await catalog.replace(catalogInput), { ok: true });
  assert.deepEqual(await actions.queue(queueInput), { id: "a1" });
  assert.equal(await actions.wait({ timeoutMs: 0 }), claimed);
  assert.deepEqual(await actions.complete(completeInput), { ok: true });
  assert.deepEqual(await outcomes.publish("r1", outcome), { id: "o1" });
  assert.equal((await reviews.list()).agentConnected, false);
  assert.deepEqual(seen, ["catalog", "queue", "wait", "complete", "outcome", "list"]);
});
