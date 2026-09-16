import { afterEach, expect, test } from "vitest";
import { mount, unmount } from "svelte";
import { FAKE_REVIEW_OK } from "$lib/shared/shell-fakes";
import { HOME_PATH } from "$lib/shared/domain/overview";
import { resetReviewSession } from "$lib/client/state/review.svelte";
import ReviewPage from "./+page.svelte";

let mounted: ReturnType<typeof mount> | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  if (mounted) unmount(mounted);
  mounted = null;
  host?.remove();
  host = null;
  resetReviewSession();
});

test("review page renders the shell from fake page data", () => {
  host = document.createElement("div");
  document.body.appendChild(host);
  mounted = mount(ReviewPage, { target: host, props: { data: FAKE_REVIEW_OK } });
  expect(host.querySelector("#app")?.getAttribute("data-view")).toBe("review");
  expect(host.querySelector(".back-link")?.getAttribute("href")).toBe(HOME_PATH);
  expect(host.querySelector("[role='tablist']")).toBeTruthy();
});
