import { expect, test } from "vitest";
import { render } from "svelte/server";
import { FAKE_HOME_OK } from "$lib/shared/shell-fakes";
import HomePage from "./+page.svelte";

test("Home page SSR includes fake Home chrome", () => {
  const { body } = render(HomePage, { props: { data: FAKE_HOME_OK } });
  expect(body).toContain('data-view="home"');
  expect(body).toContain("<h1>Home</h1>");
  expect(body).not.toContain("Loading…");
});
