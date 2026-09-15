import assert from "node:assert/strict";
import { test } from "node:test";
import { GuideV1 } from "./guide.ts";

const sample = GuideV1.parse({
  version: 1,
  title: "One",
  base: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  head: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  range: "main...feature/one",
  chapters: [
    {
      id: "core",
      kind: "core",
      title: "Core",
      why: "The behavior change.",
      files: [
        {
          path: "a.py",
          language: "python",
          hunks: [
            {
              lines: [{ type: "added", content: "x = 1", newLine: 1 }],
            },
          ],
        },
      ],
    },
  ],
});

const SOURCE_A = "1111111111111111111111111111111111111111";
const TARGET = "2222222222222222222222222222222222222222";

function prSource(overrides: Record<string, unknown> = {}) {
  return {
    kind: "pull-request",
    provider: "azure-devops",
    host: "dev.azure.com",
    repository: {
      id: "repo-1",
      owner: "braidteam/BRAID",
      name: "braid-connection-designer",
      webUrl: "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer",
    },
    number: 1027,
    webUrl:
      "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer/pullrequest/1027",
    sourceRef: "refs/heads/feature/example",
    targetRef: "refs/heads/develop",
    sourceCommit: SOURCE_A,
    targetCommit: TARGET,
    providerContext: {
      kind: "azure-devops",
      project: "BRAID",
      firstComparingIteration: 0,
      secondComparingIteration: 1,
      changes: {
        "src/example.ts": { changeTrackingId: 1 },
      },
    },
    ...overrides,
  };
}

test("parses valid pull-request provenance", () => {
  const parsed = GuideV1.parse({ ...sample, source: prSource() });
  assert.equal(parsed.source?.kind, "pull-request");
  assert.equal(parsed.source?.number, 1027);
  assert.equal(parsed.source?.providerContext.kind, "azure-devops");
  assert.equal(parsed.source?.providerContext.project, "BRAID");
});

test("rejects ADO-only data outside providerContext", () => {
  assert.throws(() => GuideV1.parse({ ...sample, source: prSource({ project: "BRAID" }) }));
});

test("rejects invalid pull-request provenance", () => {
  assert.throws(() =>
    GuideV1.parse({ ...sample, source: prSource({ sourceCommit: "abc1234" }) }),
  );
});
