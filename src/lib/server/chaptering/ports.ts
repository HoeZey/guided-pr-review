import type { FileChange, GuideV1 } from "../../shared/contracts/guide.ts";
import type { PullRequestSource } from "../../shared/contracts/provenance.ts";

export type ChapteringAdapter = {
  chapter: (input: {
    title: string;
    files: FileChange[];
    source: PullRequestSource;
  }) => Promise<GuideV1>;
};
