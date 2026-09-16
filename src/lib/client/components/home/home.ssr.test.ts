import { afterEach, expect, test } from "vitest";
import { render } from "svelte/server";
import {
  HOME_FIXTURE,
  HOME_FIXTURE_DISCONNECTED,
  HOME_FIXTURE_WAITING,
} from "$lib/shared/home-fakes";
import { reviewPath } from "$lib/shared/domain/overview";
import { resetHomeUi } from "$lib/client/state/home.svelte";
import AppShell from "../AppShell.svelte";

afterEach(() => {
  resetHomeUi();
});

test("SSR Home HTML contains projected groups, badges, ranges, and states before JS", () => {
  const { body } = render(AppShell, { props: { data: HOME_FIXTURE } });
  expect(body).toContain("Review requests");
  expect(body).toContain("Authored by me");
  expect(body).toContain("Local ranges");
  expect(body).toContain("Archived");
  expect(body).toContain("Current work");
  expect(body).toContain("Outdated work");
  expect(body).toContain("Archived work");
  expect(body).toContain("Local range");
  expect(body).toContain("Open from host");
  expect(body).toContain("braidteam/BRAID / braid-connection-designer");
  expect(body).toContain("develop ← feature/review-me");
  expect(body).toContain("main ← feature/one");
  expect(body).toContain("Last synced 2026-09-14 12:00 UTC");
  expect(body).toContain("braidteam/BRAID / other-repo: Azure DevOps returned 401");
  expect(body).toContain("Guide");
  expect(body).toContain("No guide");
  expect(body).toContain("Outdated");
  expect(body).toContain("Update Diff");
  expect(body).toContain("Open saved");
  expect(body).toContain("Generate guide");
  expect(body).toContain("Refresh");
  expect(body).toContain("Add repository");
  expect(body).toContain('href="' + reviewPath("saved-current") + '"');
  expect(body).toContain('href="' + reviewPath("saved-local") + '"');
  expect(body).toContain("home-group is-archived");
  expect(body).not.toContain("Loading…");
  expect(body).not.toContain("Closed unguided");
});

test("SSR Home renders waiting and disconnected action states from page data", () => {
  const waiting = render(AppShell, { props: { data: HOME_FIXTURE_WAITING } }).body;
  expect(waiting).toContain("Waiting");
  expect(waiting).not.toContain("data-queue-open");

  const disconnected = render(AppShell, { props: { data: HOME_FIXTURE_DISCONNECTED } }).body;
  expect(disconnected).toContain("skill must be running");
  expect(disconnected).toContain("Refresh");
});
