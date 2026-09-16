import { FAKE_REVIEW_OK } from "$lib/shared/shell-fakes";
import type { ReviewPageData } from "$lib/shared/page-data";

export function load({ params }: { params: { id: string } }): ReviewPageData {
  return { ...FAKE_REVIEW_OK, reviewId: params.id };
}
