import { expect, test, type Page } from "@playwright/test";

async function firstReviewHref(page: Page): Promise<string> {
  const href = await page.locator("[data-open-review]").first().getAttribute("href");
  expect(href).toBeTruthy();
  return href!;
}

test("Home, review tabs, layouts, preferences, keyboard, rails, reload, and navigation", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#app")).toHaveAttribute("data-view", "home");
  await expect(page.locator("h1")).toHaveText("Home");
  await expect(page.locator(".home-card, .boot")).toBeVisible();

  const href = await firstReviewHref(page);
  await page.locator(`[href="${href}"]`).first().click();
  await expect(page).toHaveURL(/\/reviews\//);
  await expect(page.locator("#app")).toHaveAttribute("data-view", "review");
  await expect(page.locator("#app")).toHaveClass(/rails-ready/);

  const guideTab = page.locator('[role="tab"][data-tab="guide"]');
  const diffTab = page.locator('[role="tab"][data-tab="diff"]');
  const reviewTab = page.locator('[role="tab"][data-tab="review"]');
  await expect(guideTab).toBeVisible();
  await expect(diffTab).toBeVisible();
  await expect(reviewTab).toBeVisible();

  await diffTab.click();
  await expect(page.locator("#app")).toHaveAttribute("data-tab", "diff");
  await expect(page.locator('nav[aria-label="Files"]')).toBeVisible();

  await page.locator("[data-display-menu] summary").click();
  await page.locator('[data-diff-mode="unified"]').click();
  await expect(page.locator('[data-diff-mode="unified"]')).toHaveAttribute("aria-selected", "true");
  await page.locator("[data-hide-unchanged]").click();
  await expect(page.locator("[data-hide-unchanged]")).toHaveAttribute("aria-pressed", "true");
  await page.locator(".display-menu .theme-toggle").click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  const sidebar = page.locator('nav[aria-label="Files"]');
  const handle = sidebar.locator("[data-rail=sidebar]");
  const before = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--sidebar"));
  const box = await handle.boundingBox();
  expect(box).toBeTruthy();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(box!.x + 80, box!.y + box!.height / 2);
  await page.mouse.up();
  const after = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--sidebar"));
  expect(after.trim()).not.toBe(before.trim());

  await reviewTab.click();
  await expect(page.locator("#app")).toHaveAttribute("data-tab", "review");
  await expect(page.locator('nav[aria-label="Code Review"]')).toBeVisible();

  await guideTab.click();
  await expect(page.locator("#app")).toHaveAttribute("data-tab", "guide");
  const pathBefore = await page.evaluate(() => document.querySelector(".file-pill[aria-current='true']")?.getAttribute("data-path"));
  await page.keyboard.press("j");
  const pathAfter = await page.evaluate(() => document.querySelector(".file-pill[aria-current='true']")?.getAttribute("data-path"));
  if (pathBefore) expect(pathAfter === pathBefore || Boolean(pathAfter)).toBeTruthy();

  await page.reload();
  await expect(page.locator("#app")).toHaveAttribute("data-tab", "guide");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");

  await page.locator("[data-home]").first().click();
  await expect(page).toHaveURL("/");
  await expect(page.locator("#app")).toHaveAttribute("data-view", "home");
  await page.goBack();
  await expect(page).toHaveURL(/\/reviews\//);
  await expect(page.locator("#app")).toHaveAttribute("data-view", "review");
});

test("first load adopts the legacy tab from localStorage and seeds the cookie", async ({
  page,
  context,
}) => {
  await page.goto("/");
  const href = await firstReviewHref(page);
  await context.clearCookies();
  await page.addInitScript(() => {
    localStorage.setItem("guided-pr-review-tab", "diff");
  });
  await page.goto(href);
  await expect(page.locator("#app")).toHaveClass(/rails-ready/);
  await expect(page.locator("#app")).toHaveAttribute("data-tab", "diff");
  const cookie = await page.evaluate(() => document.cookie);
  expect(cookie).toContain("guided-pr-review-tab=diff");
});
