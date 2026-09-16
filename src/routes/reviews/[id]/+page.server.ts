import { redirect } from "@sveltejs/kit";
import { appServices } from "$lib/server/runtime";
import { loadReviewPage } from "$lib/server/pages";
import { ensureSeed } from "$lib/server/seed";
import { HOME_PATH } from "$lib/shared/domain/overview";
import { TAB_COOKIE, type ReviewPageData } from "$lib/shared/page-data";

export async function load({
  params,
  cookies,
}: {
  params: { id: string };
  cookies: { get: (name: string) => string | undefined };
}): Promise<ReviewPageData> {
  await ensureSeed();
  const data = await loadReviewPage(appServices, params.id, cookies.get(TAB_COOKIE));
  if (data.kind === "home") redirect(307, HOME_PATH);
  return data;
}
