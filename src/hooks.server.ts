import type { Handle } from "@sveltejs/kit";
import { appServices } from "$lib/server/runtime";
import { createCatalogStartupLatch } from "$lib/server/services/catalog-refresh";

const awaitStartup = createCatalogStartupLatch(() =>
  appServices.catalogRefresh.refresh({ reason: "startup" }),
);

export const handle: Handle = async ({ event, resolve }) => {
  await awaitStartup();
  return resolve(event);
};
