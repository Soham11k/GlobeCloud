import { test, expect } from "@playwright/test";

test("landing page loads", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/GlobeCloud/i);
});

test("welcome page loads", async ({ page }) => {
  await page.goto("/welcome");
  await expect(page.getByRole("heading", { name: /globecloud console/i })).toBeVisible({ timeout: 15000 });
});

test("login page loads", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible({ timeout: 15000 });
});

test("console overview loads", async ({ page }) => {
  await page.goto("/app");
  await expect(page.getByRole("heading", { name: /overview/i })).toBeVisible({ timeout: 15000 });
});

test("settings billing page is reachable", async ({ page }) => {
  await page.goto("/app/settings/billing");
  await expect(page.getByRole("heading", { name: /billing/i })).toBeVisible({ timeout: 15000 });
});

test("mobile nav drawer opens", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 667 });
  await page.goto("/app");
  await page.getByRole("button", { name: /open navigation/i }).click();
  await expect(page.getByRole("heading", { name: /globecloud/i })).toBeVisible();
  await expect(page.getByText(/team/i).first()).toBeVisible();
});
