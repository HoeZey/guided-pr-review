import { GuideV1 } from "../../shared/contracts/guide.ts";
import type { ListReviewsOutput } from "../../shared/contracts/persistence.ts";
import type { StoredOutcome } from "../../shared/contracts/outcomes.ts";
import type { ChapteringAdapter } from "../chaptering/ports.ts";
import type { GitHostAdapter } from "../providers/ports.ts";
import type { ActionRepository, ReviewRepository } from "../repositories/ports.ts";

export type ReviewService = {
  list: () => Promise<ListReviewsOutput>;
  get: (id: string) => Promise<{ guide: GuideV1; outcomes: StoredOutcome[] }>;
  add: (input: unknown) => Promise<{ id: string }>;
  addFromTool: (body: unknown) => Promise<{ id: string }>;
  upsert: (input: unknown) => Promise<{ id: string }>;
  upsertFromTool: (body: unknown) => Promise<{ id: string }>;
  remove: (id: string) => Promise<{ ok: true }>;
  setActive: (id: string) => Promise<{ activeId: string }>;
  seedIfEmpty: (guide: GuideV1) => Promise<void>;
  completeOpen: (
    id: string,
    host: GitHostAdapter,
    chaptering?: ChapteringAdapter,
  ) => Promise<{ reviewId: string }>;
  completeUpdateDiff: (
    id: string,
    host: GitHostAdapter,
    chaptering?: ChapteringAdapter,
  ) => Promise<{ reviewId: string }>;
};

function stripHeads(ref: string): string {
  return ref.replace(/^refs\/heads\//i, "");
}

function unchapteredGuide(fetched: {
  title: string;
  files: GuideV1["chapters"][number]["files"];
  source: NonNullable<GuideV1["source"]>;
}): GuideV1 {
  return GuideV1.parse({
    version: 1,
    title: fetched.title,
    base: fetched.source.targetCommit,
    head: fetched.source.sourceCommit,
    range: `${stripHeads(fetched.source.targetRef)}...${stripHeads(fetched.source.sourceRef)}`,
    repo: fetched.source.repository.name,
    unchaptered: true,
    chapters: [
      {
        id: "unchaptered",
        kind: "core",
        title: fetched.title,
        why: "Raw diff until a reading-order guide is generated.",
        files: fetched.files,
      },
    ],
    source: fetched.source,
  });
}

export function createReviewService(
  repos: ReviewRepository & Pick<ActionRepository, "completeAction">,
): ReviewService {
  async function completeHostDiffAction(
    id: string,
    kind: "open" | "update-diff",
    host: GitHostAdapter,
  ): Promise<{ reviewId: string }> {
    const listed = await repos.listReviews();
    const action = listed.actions.find((row) => row.id === id);
    if (!action || action.kind !== kind) {
      throw Object.assign(new Error(`unknown action ${id}`), { status: 404 });
    }
    const failCode = kind === "open" ? "open-failed" : "update-failed";
    try {
      const fetched = await host.fetchOpen(action.target);
      const { id: reviewId } = await repos.upsertReview(unchapteredGuide(fetched));
      await repos.completeAction({ id, status: "succeeded", reviewId });
      return { reviewId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await repos
        .completeAction({
          id,
          status: "failed",
          error: { code: failCode, message },
        })
        .catch(() => undefined);
      throw err;
    }
  }

  return {
    list: () => repos.listReviews(),
    get: (id) => repos.getReview(id),
    add: (input) => repos.addReview(input),
    addFromTool: (body) => repos.addReviewFromTool(body),
    upsert: (input) => repos.upsertReview(input),
    upsertFromTool: (body) => repos.upsertReviewFromTool(body),
    remove: (id) => repos.removeReview(id),
    setActive: (id) => repos.setActive(id),
    seedIfEmpty: (guide) => repos.seedIfEmpty(guide),
    completeOpen: (id, host, _chaptering) => completeHostDiffAction(id, "open", host),
    completeUpdateDiff: (id, host, _chaptering) =>
      completeHostDiffAction(id, "update-diff", host),
  };
}
