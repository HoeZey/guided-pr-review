import { expect, test } from "vitest";
import { render } from "svelte/server";
import { FAKE_REVIEW_OK, FAKE_UNCHAPTERED_REVIEW } from "$lib/shared/shell-fakes";
import ReviewPage from "./+page.svelte";

test("review page SSR includes fake review chrome", () => {
  const { body } = render(ReviewPage, { props: { data: FAKE_REVIEW_OK } });
  expect(body).toContain('data-view="review"');
  expect(body).toContain("<h1>Fake review</h1>");
  expect(body).not.toContain("Loading…");
});

test("initial review SSR contains readable Guide when Guide is the default view", () => {
  const { body } = render(ReviewPage, { props: { data: FAKE_REVIEW_OK } });
  expect(body).toContain('data-tab="guide"');
  expect(body).toContain("The behavior change.");
  expect(body).toContain('id="section-core"');
  expect(body).toContain("src/app.ts");

  const unchaptered = render(ReviewPage, { props: { data: FAKE_UNCHAPTERED_REVIEW } }).body;
  expect(unchaptered).toContain('data-tab="diff"');
  expect(unchaptered).toContain("Generate a reading-order guide when you want one.");
  expect(unchaptered).not.toContain("The behavior change.");
});
