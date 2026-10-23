import type { Handle } from "@sveltejs/kit";
import { appServices } from "./lib/server/runtime";
import { createCatalogStartupHandle } from "./lib/server/services/catalog-refresh";

export const handle: Handle = createCatalogStartupHandle(() =>
  appServices.catalogRefresh.refresh({ reason: "startup" }),
);
