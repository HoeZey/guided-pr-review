import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { GuideV1 } from "./contracts.ts";
import {
  addReview,
  getReview,
  listReviews,
  removeReview,
  resetStoreCache,
  setActive,
} from "./store.ts";

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
              lines: [
                { type: "added", content: "x = 1", newLine: 1 },
              ],
            },
          ],
        },
      ],
    },
  ],
});

async function withStore(fn: () => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "gpr-"));
  const prev = process.env.GUIDED_PR_REVIEW_DATA;
  process.env.GUIDED_PR_REVIEW_DATA = dir;
  resetStoreCache();
  try {
    await fn();
  } finally {
    resetStoreCache();
    if (prev === undefined) delete process.env.GUIDED_PR_REVIEW_DATA;
    else process.env.GUIDED_PR_REVIEW_DATA = prev;
    await rm(dir, { recursive: true, force: true });
  }
}

test("rejects invalid guide", async () => {
  await withStore(async () => {
    await assert.rejects(() => addReview({ version: 1, title: "x" }));
  });
});

test("add list set_active remove", async () => {
  await withStore(async () => {
    const a = await addReview(sample);
    const second = GuideV1.parse({ ...sample, title: "Two", range: "main...two" });
    const b = await addReview(second);
    let listed = await listReviews();
    assert.equal(listed.reviews.length, 2);
    assert.equal(listed.activeId, b.id);
    await setActive(a.id);
    listed = await listReviews();
    assert.equal(listed.activeId, a.id);
    const got = await getReview(a.id);
    assert.equal(got.guide.title, "One");
    await removeReview(a.id);
    listed = await listReviews();
    assert.equal(listed.reviews.length, 1);
    assert.equal(listed.activeId, b.id);
    await removeReview(b.id);
    listed = await listReviews();
    assert.equal(listed.reviews.length, 0);
    assert.equal(listed.activeId, null);
  });
});
