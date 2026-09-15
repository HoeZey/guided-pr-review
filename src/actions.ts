import {
  GuideV1,
  type FileChange,
  type OpenActionTarget,
  type PullRequestSource,
} from "./contracts.ts";
import { completeAction, listReviews, upsertReview } from "./store.ts";

export type GitHostAdapter = {
  fetchOpen: (target: OpenActionTarget) => Promise<{
    title: string;
    files: FileChange[];
    source: PullRequestSource;
  }>;
};

export type ChapteringAdapter = {
  chapter: (input: {
    title: string;
    files: FileChange[];
    source: PullRequestSource;
  }) => Promise<GuideV1>;
};

function stripHeads(ref: string): string {
  return ref.replace(/^refs\/heads\//i, "");
}

function unchapteredGuide(fetched: {
  title: string;
  files: FileChange[];
  source: PullRequestSource;
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

async function completeHostDiffAction(
  id: string,
  kind: "open" | "update-diff",
  host: GitHostAdapter,
): Promise<{ reviewId: string }> {
  const listed = await listReviews();
  const action = listed.actions.find((row) => row.id === id);
  if (!action || action.kind !== kind || !action.target) {
    throw Object.assign(new Error(`unknown action ${id}`), { status: 404 });
  }
  const failCode = kind === "open" ? "open-failed" : "update-failed";
  try {
    const fetched = await host.fetchOpen(action.target);
    const { id: reviewId } = await upsertReview(unchapteredGuide(fetched));
    await completeAction({ id, status: "succeeded", reviewId });
    return { reviewId };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await completeAction({
      id,
      status: "failed",
      error: { code: failCode, message },
    }).catch(() => undefined);
    throw err;
  }
}

export async function completeOpenAction(
  id: string,
  host: GitHostAdapter,
  _chaptering?: ChapteringAdapter,
): Promise<{ reviewId: string }> {
  return completeHostDiffAction(id, "open", host);
}

export async function completeUpdateDiffAction(
  id: string,
  host: GitHostAdapter,
  _chaptering?: ChapteringAdapter,
): Promise<{ reviewId: string }> {
  return completeHostDiffAction(id, "update-diff", host);
}
