import { expect, test } from "vitest";
import { render } from "svelte/server";
import { FAKE_REVIEW_OK } from "$lib/shared/shell-fakes";
import ReviewPage from "./+page.svelte";

test("review page SSR includes fake review chrome", () => {
  const { body } = render(ReviewPage, { props: { data: FAKE_REVIEW_OK } });
  expect(body).toContain('data-view="review"');
  expect(body).toContain("<h1>Fake review</h1>");
  expect(body).not.toContain("Loading…");
});
