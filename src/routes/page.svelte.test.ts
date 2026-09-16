import { afterEach, expect, test } from "vitest";
import { mount, unmount } from "svelte";
import { FAKE_HOME_OK } from "$lib/shared/shell-fakes";
import { reviewPath } from "$lib/shared/domain/overview";
import { resetHomeUi } from "$lib/client/state/home.svelte";
import { resetReviewSession } from "$lib/client/state/review.svelte";
import HomePage from "./+page.svelte";

let mounted: ReturnType<typeof mount> | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  if (mounted) unmount(mounted);
  mounted = null;
  host?.remove();
  host = null;
  resetReviewSession();
  resetHomeUi();
});

test("Home page renders the shell from fake page data", () => {
  host = document.createElement("div");
  document.body.appendChild(host);
  mounted = mount(HomePage, { target: host, props: { data: FAKE_HOME_OK } });
  expect(host.querySelector("#app")?.getAttribute("data-view")).toBe("home");
  expect(host.querySelector("[data-open-review]")?.getAttribute("href")).toBe(
    reviewPath("fake-review"),
  );
});
