import { expect, test } from "vitest";
import { render } from "svelte/server";
import { MIGRATION_PROOF } from "$lib/shared/migration-proof";
import Page from "./+page.svelte";

test("migration-proof SSR includes the typed message", () => {
  const { body } = render(Page, { props: { data: MIGRATION_PROOF } });
  expect(body).toContain(MIGRATION_PROOF.message);
});
