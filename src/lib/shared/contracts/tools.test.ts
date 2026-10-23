import assert from "node:assert/strict";
import { test } from "node:test";
import { tools } from "./tools.ts";

const target = {
  provider: "azure-devops" as const,
  host: "dev.azure.com",
  repository: {
    id: "repo-1",
    owner: "braidteam/BRAID",
    name: "braid-connection-designer",
    webUrl: "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer",
  },
  number: 1101,
};

test("queue_action accepts only Generate guide", () => {
  const ok = tools.queue_action.input.safeParse({
    kind: "generate-guide",
    reviewId: "rev-1",
  });
  assert.equal(ok.success, true);
  for (const input of [
    { kind: "open", target },
    { kind: "update-diff", target },
    { kind: "refresh" },
    { kind: "add-repository" },
  ]) {
    assert.equal(tools.queue_action.input.safeParse(input).success, false, String(input.kind));
  }
});
