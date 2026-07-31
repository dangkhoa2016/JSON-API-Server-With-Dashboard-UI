import { test, expect, type Page } from "@playwright/test";

const getRateLimitRow = (page: Page) =>
  page
    .getByRole("heading", { name: "Rate Limit Max" })
    .locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]');

test.describe("Admin Flow", () => {
  test("guest can view home page health badges", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "API Endpoints" })).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "SQLite Database" }),
    ).toBeVisible({ timeout: 15000 });
  });

  test("guest sees login dialog on Settings page", async ({ page }) => {
    await page.goto("/admin/settings");
    await page.getByRole("button", { name: "Login" }).click();

    const dialog = page.locator('[data-slot="dialog-content"]');
    await expect(dialog.getByRole("heading", { name: "Admin Login" })).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Login" })).toBeVisible();
  });

  test("admin can login, enter settings edit mode, and logout", async ({ page }) => {
    await page.goto("/admin/settings");
    await page.getByRole("button", { name: "Login" }).click();

    const dialog = page.locator('[data-slot="dialog-content"]');
    await dialog.getByPlaceholder("Enter username").fill("admin");
    await dialog.getByPlaceholder("Enter password").fill("admin123");
    await dialog.getByRole("button", { name: "Login" }).click();

    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Logout" })).toBeVisible();

    const editBtn = page.locator('button[title="Edit"]').first();
    await editBtn.waitFor({ state: "visible", timeout: 10000 });
    await editBtn.click();
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();

    await page.getByRole("button", { name: "Logout" }).click();
    await expect(page.getByText("You are viewing settings as a guest")).toBeVisible();
  });

  test("admin setting edits persist after a page reload", async ({ page }) => {
    await page.goto("/admin/settings");
    await page.getByRole("button", { name: "Login" }).click();

    const dialog = page.locator('[data-slot="dialog-content"]');
    await dialog.getByPlaceholder("Enter username").fill("admin");
    await dialog.getByPlaceholder("Enter password").fill("admin123");
    await dialog.getByRole("button", { name: "Login" }).click();

    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();

    const row = getRateLimitRow(page);
    const originalValue =
      (await row.locator("code").first().textContent())?.trim() ?? "";
    expect(originalValue).toMatch(/^\d+$/);
    const testValue = originalValue === "250" ? "251" : "250";

    try {
      await row.getByTitle("Edit").click();
      await page.locator('[data-edit-key="RATE_LIMIT_MAX_REQUESTS"]').fill(testValue);
      await row.getByRole("button", { name: "Save" }).click();
      await expect(row.getByText(testValue, { exact: true })).toBeVisible();

      await page.reload();
      await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
      await expect(
        getRateLimitRow(page).getByText(testValue, { exact: true }),
      ).toBeVisible();
    } finally {
      const cleanupRow = getRateLimitRow(page);
      await cleanupRow.getByTitle("Edit").click();
      await page
        .locator('[data-edit-key="RATE_LIMIT_MAX_REQUESTS"]')
        .fill(originalValue);
      await cleanupRow.getByRole("button", { name: "Save" }).click();
      await expect(
        cleanupRow.getByText(originalValue, { exact: true }),
      ).toBeVisible();
    }
  });
});
