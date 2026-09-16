import { expect, test } from "vitest";
import { render } from "svelte/server";
import { HOME_FIXTURE } from "$lib/shared/home-fakes";
import { FAKE_HOME_OK } from "$lib/shared/shell-fakes";
import { reviewPath } from "$lib/shared/domain/overview";
import HomePage from "./+page.svelte";

test("Home page SSR includes fake Home chrome", () => {
  const { body } = render(HomePage, { props: { data: FAKE_HOME_OK } });
  expect(body).toContain('data-view="home"');
  expect(body).toContain("<h1>Home</h1>");
  expect(body).not.toContain("Loading…");
});

test("GET / page SSR includes projected Home content before client JavaScript", () => {
  const { body } = render(HomePage, { props: { data: HOME_FIXTURE } });
  expect(body).toContain("Review requests");
  expect(body).toContain("Local ranges");
  expect(body).toContain("Last synced 2026-09-14 12:00 UTC");
  expect(body).toContain(reviewPath("saved-current"));
  expect(body).not.toContain("Loading…");
});

