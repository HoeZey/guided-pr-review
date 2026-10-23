import type { CatalogRepository } from "../repositories/ports.ts";

export type CatalogService = {
  replace: (input: unknown) => Promise<{ ok: true }>;
};

export function createCatalogService(repos: CatalogRepository): CatalogService {
  return {
    replace: (input) => repos.replaceCatalog(input),
  };
}
