import { FAKE_HOME_OK } from "$lib/shared/shell-fakes";
import type { HomePageData } from "$lib/shared/page-data";

export function load(): HomePageData {
  return FAKE_HOME_OK;
}
