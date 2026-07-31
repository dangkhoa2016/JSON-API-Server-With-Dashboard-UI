import { test, expect } from "@playwright/test";

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

  test("admin can login, edit settings, and logout", async ({ page }) => {
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
});
