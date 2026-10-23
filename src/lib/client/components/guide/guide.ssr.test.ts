import { expect, test } from "vitest";
import { render } from "svelte/server";
import GuideView from "./GuideView.svelte";
import { GUIDE_CHAPTERED, GUIDE_UNCHAPTERED } from "./fixture";

test("chaptered Guide SSR includes order, why, progress, pills, hunks, and selected file", () => {
  const { body } = render(GuideView, {
    props: { guide: GUIDE_CHAPTERED },
  });
  const coreAt = body.indexOf('id="section-core"');
  const testsAt = body.indexOf('id="section-tests"');
  const omittedAt = body.indexOf('id="section-__omitted__"');
  expect(coreAt).toBeGreaterThan(-1);
  expect(testsAt).toBeGreaterThan(coreAt);
  expect(omittedAt).toBeGreaterThan(testsAt);
  expect(body).toContain("<strong>output</strong>");
  expect(body).toContain("Cover the pin.");
  expect(body).toContain("01 / 03");
  expect(body).toContain("maps.py");
  expect(body).toContain("maps_test.py");
  expect(body).toContain('data-path="src/maps.py"');
  expect(body).toContain('aria-current="true"');
  expect(body).toContain("maps = list_maps(model.workflow_id)");
  expect(body).toContain('class="file stage"');
  expect(body).toContain("guide-toc");
  expect(body).not.toContain("Ask your coding agent to generate a reading-order guide.");
});

test("omitted Guide SSR lists paths without a fake file walkthrough", () => {
  const { body } = render(GuideView, {
    props: { guide: GUIDE_CHAPTERED },
  });
  expect(body).toContain("Not shown as diffs.");
  expect(body).toContain("docs/diagram.png");
  expect(body).toContain("binary · chart");
  expect(body).toContain("Binary or unreadable paths.");
  expect(body).not.toContain('data-path="docs/diagram.png"');
});

test("unchaptered Guide SSR shows coding-agent copy and never a walkthrough", () => {
  const { body } = render(GuideView, {
    props: { guide: GUIDE_UNCHAPTERED },
  });
  expect(body).toContain("<h2>No guide</h2>");
  expect(body).toContain("Ask your coding agent to generate a reading-order guide.");
  expect(body).not.toContain("Generate guide");
  expect(body).not.toContain("data-queue-generate");
  expect(body).not.toContain('id="section-unchaptered"');
  expect(body).not.toContain("Raw diff until a reading-order guide is generated.");
  expect(body).not.toContain('class="guide-section"');
});
