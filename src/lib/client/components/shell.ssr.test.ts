import { expect, test } from "vitest";
import { render } from "svelte/server";
import {
  FAKE_HOME_ERROR,
  FAKE_HOME_LOADING,
  FAKE_HOME_OK,
  FAKE_REVIEW_OK,
  FAKE_UNCHAPTERED_REVIEW,
} from "$lib/shared/shell-fakes";
import { HOME_PATH, reviewPath } from "$lib/shared/domain/overview";
import { parseStoredTab } from "$lib/shared/page-data";
import AppShell from "./AppShell.svelte";

test("Home shell SSR uses preference defaults and fake links", () => {
  const { body } = render(AppShell, { props: { data: FAKE_HOME_OK } });
  expect(body).toContain('id="app"');
  expect(body).toContain('data-view="home"');
  expect(body).toContain("<h1>Home</h1>");
  expect(body).toContain(`href="${HOME_PATH}"`);
  expect(body).toContain(reviewPath(FAKE_HOME_OK.reviews[0].id));
  expect(body).not.toContain('data-tab=');
});

test("review shell SSR matches landing tab defaults", () => {
  const chaptered = render(AppShell, { props: { data: FAKE_REVIEW_OK } }).body;
  expect(chaptered).toContain('data-view="review"');
  expect(chaptered).toContain('data-tab="guide"');
  expect(chaptered).toContain("<h1>Fake review</h1>");
  expect(chaptered).toContain('aria-selected="true"');
  expect(chaptered).toContain("Guide");
  expect(chaptered).toContain('data-tab="discussion"');
  expect(chaptered).toContain("Discussion");

  const unchaptered = render(AppShell, { props: { data: FAKE_UNCHAPTERED_REVIEW } }).body;
  expect(unchaptered).toContain('data-tab="diff"');
  expect(unchaptered).toContain('aria-label="Files"');
  expect(unchaptered).toContain("src/app.ts");

  const cookieTab = render(AppShell, {
    props: { data: { ...FAKE_REVIEW_OK, tab: parseStoredTab("review") ?? "guide" } },
  }).body;
  expect(cookieTab).toContain('data-tab="guide"');
  expect(cookieTab).not.toContain("No code-review outcome");
});

test("SSR loading and error markup uses the existing boot and err classes", () => {
  expect(render(AppShell, { props: { data: FAKE_HOME_LOADING } }).body).toContain("Loading…");
  expect(render(AppShell, { props: { data: FAKE_HOME_ERROR } }).body).toContain("Failed to load Home");
});
