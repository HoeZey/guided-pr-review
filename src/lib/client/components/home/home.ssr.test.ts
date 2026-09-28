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
  expect(body).not.toContain("Open from host");
  expect(body).not.toContain("data-queue-open");
  expect(body).toContain("braidteam/BRAID / braid-connection-designer");
  expect(body).toContain("develop ← feature/review-me");
  expect(body).toContain("main ← feature/one");
  expect(body).toContain("Last synced 2026-09-14 12:00 UTC");
  expect(body).toContain("braidteam/BRAID / other-repo: Azure DevOps returned 401");
  expect(body).toContain('data-guide-book="green"');
  expect(body).toContain('data-guide-book="yellow"');
  expect(body).toContain('data-guide-book="grey"');
  expect(body).toContain('data-archive-status="Merged"');
  expect(body).toContain('data-archive-status="Closed"');
  expect(body).not.toContain("No guide");
  expect(body).not.toContain("Update Diff");
  expect(body).not.toContain("Open saved");
  expect(body).not.toContain("Generate guide");
  expect(body).toContain("Refresh");
  expect(body).toContain('data-open-repo-menu="github"');
  expect(body).toContain('data-open-repo-menu="azure-devops"');
  expect(body).toContain('data-ado-organization');
  expect(body).not.toContain("Search repositories");
  expect(body).not.toContain("Repository URL");
  expect(body).not.toContain("Add repository");
  expect(body).toContain('href="' + reviewPath("saved-current") + '"');
  expect(body).toContain('href="' + reviewPath("saved-outdated") + '"');
  expect(body).toContain('href="' + reviewPath("saved-local") + '"');
  expect(body).toContain("home-group is-archived");
  expect(body).not.toContain("Loading…");
  expect(body).not.toContain("Closed unguided");
});

test("SSR Home does not card an unsaved catalog pull request", () => {
  const waiting = render(AppShell, { props: { data: HOME_FIXTURE_WAITING } }).body;
  expect(waiting).not.toContain("Waiting");
  expect(waiting).not.toContain("data-queue-open");
  expect(waiting).not.toContain("Open from host");

  const disconnected = render(AppShell, { props: { data: HOME_FIXTURE_DISCONNECTED } }).body;
  expect(disconnected).not.toContain("Open from host");
  expect(disconnected).not.toContain("data-queue-open");
  expect(disconnected).not.toContain("skill must be running to open a pull request");
  expect(disconnected).toContain("Refresh");
});
