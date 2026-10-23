import { afterEach, expect, test } from "vitest";
import { mount, tick, unmount } from "svelte";
import { MIGRATION_PROOF } from "$lib/shared/migration-proof";
import Page from "./+page.svelte";

let mounted: ReturnType<typeof mount> | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  if (mounted) unmount(mounted);
  mounted = null;
  host?.remove();
  host = null;
});

test("migration-proof hydrates a click counter from the typed payload", async () => {
  host = document.createElement("div");
  document.body.appendChild(host);
  mounted = mount(Page, {
    target: host,
    props: { data: MIGRATION_PROOF },
  });
  expect(host.querySelector("[data-proof]")?.textContent).toBe(
    MIGRATION_PROOF.message,
  );
  const button = host.querySelector("[data-hydrate]");
  expect(button).toBeInstanceOf(HTMLButtonElement);
  expect(button?.textContent).toBe("0");
  (button as HTMLButtonElement).click();
  await tick();
  expect(button?.textContent).toBe("1");
});
