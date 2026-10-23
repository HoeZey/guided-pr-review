import { appServices } from "$lib/server/runtime";
import { loadHomePage } from "$lib/server/pages";
import { ensureSeed } from "$lib/server/seed";
import type { HomePageData } from "$lib/shared/page-data";

export async function load(): Promise<HomePageData> {
  await ensureSeed();
  return loadHomePage(appServices);
}
