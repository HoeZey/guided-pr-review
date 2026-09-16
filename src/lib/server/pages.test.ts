import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { GuideV1 } from "../shared/contracts/guide.ts";
import { projectHomeOverview } from "../shared/domain/overview.ts";
import { loadHomePage, loadReviewPage } from "./pages.ts";
import { jsonRepositories, resetJsonStoreCache } from "./repositories/json/store.ts";
import { createAppServices } from "./services/app.ts";

const SHA_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const SHA_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

const sampleGuide = GuideV1.parse({
  version: 1,
  title: "One",
  base: SHA_A,
  head: SHA_B,
  range: "main...feature/one",
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

async function withStore(fn: () => Promise<void>): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "gpr-06-05-pages-"));
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

function assertNoSecrets(data: unknown): void {
  const json = JSON.stringify(data);
  assert.equal(json.includes("reviews.json"), false);
  assert.equal(json.includes("GUIDED_PR_REVIEW_DATA"), false);
  assert.equal(json.includes(process.env.GUIDED_PR_REVIEW_DATA ?? "no-data-dir"), false);
  assert.equal(Object.prototype.hasOwnProperty.call(data as object, "version"), false);
}

test("SSR home and review page data come from services without a Store v1 dump", async () => {
  await withStore(async () => {
    const services = createAppServices(jsonRepositories);
    const empty = await loadHomePage(services);
    assert.equal(empty.kind, "home");
    assert.equal(empty.status, "ok");
    assert.deepEqual(empty.reviews, []);
    assert.deepEqual(empty.catalog, []);
    assert.deepEqual(empty.actions, []);
    assert.equal(empty.activeId, null);
    assert.equal(empty.agentConnected, false);
    assertNoSecrets(empty);

    const { id } = await services.reviews.addFromTool({ guide: sampleGuide });
    await services.outcomes.publish(id, {
      version: 1,
      base: SHA_A,
      head: SHA_B,
      standards: { findings: [] },
      spec: { findings: [] },
    });
    await services.catalog.replace({
      origin: true,
      repository: {
        provider: "azure-devops",
        host: "dev.azure.com",
        id: "repo-1",
        owner: "braidteam/BRAID",
        name: "braid-connection-designer",
        webUrl: "https://dev.azure.com/braidteam/BRAID/_git/braid-connection-designer",
      },
      syncedAt: "2026-09-14T12:00:00.000Z",
      pullRequests: [],
    });

    const home = await loadHomePage(services);
    assert.equal(home.reviews[0].id, id);
    assert.equal(home.reviews[0].title, "One");
    assert.equal(home.reviews[0].base, SHA_A);
    assert.equal(home.reviews[0].head, SHA_B);
    assert.equal(home.reviews[0].range, "main...feature/one");
    assert.equal(home.catalog.length, 1);
    assert.equal(home.activeId, id);
    const overview = projectHomeOverview(home.reviews, home.catalog);
    assert.deepEqual(
      overview.groups.map((group) => group.id),
      ["local-ranges"],
    );
    assert.equal(overview.groups[0].cards[0].id, id);
    assertNoSecrets(home);

    const review = await loadReviewPage(services, id);
    assert.equal(review.kind, "review");
    if (review.kind !== "review") return;
    assert.equal(review.status, "ok");
    assert.equal(review.reviewId, id);
    assert.equal(review.title, "One");
    assert.equal(review.guide?.title, "One");
    assert.equal(review.outcomes.length, 1);
    assert.equal(review.catalog.length, 1);
    assert.equal(review.tab, "guide");
    assert.equal(review.activeId, id);
    assertNoSecrets(review);

    const cookieTab = await loadReviewPage(services, id, "review");
    assert.equal(cookieTab.kind, "review");
    if (cookieTab.kind === "review") assert.equal(cookieTab.tab, "review");

    const leftoverComments = await loadReviewPage(services, id, "comments");
    assert.equal(leftoverComments.kind, "review");
    if (leftoverComments.kind === "review") assert.equal(leftoverComments.tab, "discussion");

    const unknown = await loadReviewPage(services, "missing");
    assert.equal(unknown.kind, "home");
    if (unknown.kind !== "home") return;
    assert.equal(unknown.reviews[0].id, id);
    assertNoSecrets(unknown);
  });
});
