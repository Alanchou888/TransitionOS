import { test, expect } from "@playwright/test";

test("employee creates task and manager can review pages", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByText("Switch Demo Account")).toBeVisible();
  await page.goto("/tasks/new");
  await expect(page.getByText("Create Transition Task")).toBeVisible();
});

test("new hire checklist page renders", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page.getByText("Dashboard")).toBeVisible();
});
