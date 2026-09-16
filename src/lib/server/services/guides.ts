import { filesForDiff } from "../../shared/domain/guide-view.ts";
import type { ChapteringAdapter } from "../chaptering/ports.ts";
import type { ActionRepository, ReviewRepository } from "../repositories/ports.ts";

export type GuideHandoffService = {
  completeGenerateGuide: (
    id: string,
    chaptering: ChapteringAdapter,
  ) => Promise<{ reviewId: string }>;
};

export function createGuideHandoffService(
  repos: ReviewRepository & Pick<ActionRepository, "completeAction">,
): GuideHandoffService {
  return {
    async completeGenerateGuide(id, chaptering) {
      const listed = await repos.listReviews();
      const action = listed.actions.find((row) => row.id === id);
      if (!action || action.kind !== "generate-guide") {
        throw Object.assign(new Error(`unknown action ${id}`), { status: 404 });
      }
      try {
        const { guide } = await repos.getReview(action.reviewId);
        if (!guide.unchaptered) {
          throw new Error("Generate guide is only for an unchaptered review");
        }
        if (!guide.source) {
          throw new Error("review has no pull-request source");
        }
        const chaptered = await chaptering.chapter({
          title: guide.title,
          files: filesForDiff(guide),
          source: guide.source,
        });
        const { id: reviewId } = await repos.upsertReview({
          ...chaptered,
          source: guide.source,
          unchaptered: undefined,
        });
        await repos.completeAction({ id, status: "succeeded", reviewId });
        return { reviewId };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await repos
          .completeAction({
            id,
            status: "failed",
            error: { code: "generate-guide-failed", message },
          })
          .catch(() => undefined);
        throw err;
      }
    },
  };
}
