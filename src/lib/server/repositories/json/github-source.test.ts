import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { GuideV1 } from "../../../shared/contracts/guide.ts";
import {
  addReview,
  listReviews,
  resetJsonStoreCache,
  upsertReview,
} from "./store.ts";

const SHA_A = "1111111111111111111111111111111111111111";
const SHA_B = "2222222222222222222222222222222222222222";

const sample = GuideV1.parse({
  version: 1,
  title: "One",
  base: SHA_B,
  head: SHA_A,
  range: "develop...feature/review-me",
  chapters: [
    {
      id: "core",
      kind: "core",
      title: "Core",
      why: "The behavior change.",
      files: [{ path: "a.py", stub: true, reason: "placeholder" }],
    },
  ],
});

function githubSource(number = 42) {
  return {
    kind: "pull-request" as const,
    provider: "github" as const,
    host: "github.com",
    repository: {
      id: "1296269",
      owner: "octocat",
      name: "Hello-World",
      webUrl: "https://github.com/octocat/Hello-World",
    },
    number,
    webUrl: `https://github.com/octocat/Hello-World/pull/${number}`,
    sourceRef: "refs/heads/feature/review-me",
    targetRef: "refs/heads/develop",
    sourceCommit: SHA_A,
    targetCommit: SHA_B,
    providerContext: { kind: "github" as const },
  };
}

async function withStore(fn: () => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "gpr-07-07-gh-"));
  const prev = process.env.GUIDED_PR_REVIEW_DATA;
  process.env.GUIDED_PR_REVIEW_DATA = dir;
  resetJsonStoreCache();
  try {
    await fn();
  } finally {
    resetJsonStoreCache();
    if (prev === undefined) delete process.env.GUIDED_PR_REVIEW_DATA;
    else process.env.GUIDED_PR_REVIEW_DATA = prev;
    await rm(dir, { recursive: true, force: true });
  }
}

test("GitHub provenance upserts by stable key and adopts a matching local range", async () => {
  await withStore(async () => {
    const local = await addReview(
      GuideV1.parse({ ...sample, repo: "Hello-World", range: "develop...feature/review-me" }),
    );
    const first = await upsertReview(
      GuideV1.parse({ ...sample, title: "PR 42", repo: "Hello-World", source: githubSource() }),
    );
    assert.equal(first.id, local.id);
    const second = await upsertReview(
      GuideV1.parse({ ...sample, title: "PR 42 again", repo: "Hello-World", source: githubSource() }),
    );
    assert.equal(second.id, first.id);
    const listed = await listReviews();
    assert.equal(listed.reviews.length, 1);
    assert.equal(listed.reviews[0].syncKey, "github:github.com:1296269:42");
    assert.equal(listed.reviews[0].pullRequest?.provider, "github");
    assert.equal(listed.reviews[0].sourceCommit, SHA_A);
  });
});
