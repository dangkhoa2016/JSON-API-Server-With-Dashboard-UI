import { test, expect } from "@playwright/test";

test.describe("Admin Flow", () => {
  test("guest can view home page health badges", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=API")).toBeVisible();
    await expect(page.locator("text=Database")).toBeVisible();
  });

  test("guest sees login dialog on Settings page", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.locator("text=Admin Login")).toBeVisible();
    await expect(page.locator('button:has-text("Login")')).toBeVisible();
  });

  test("admin can login, edit settings, and logout", async ({ page }) => {
    await page.goto("/settings");

    await page.fill('input[name="username"]', "admin");
    await page.fill('input[name="password"]', "admin123");
    await page.click('button:has-text("Login")');

    await expect(page.locator("text=Settings")).toBeVisible();

    const editBtn = page.locator('button:has-text("Edit")').first();
    await editBtn.waitFor({ state: "visible", timeout: 10000 });
    await editBtn.click();

    const saveBtn = page.locator('button:has-text("Save")');
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
    }

    await page.click('button:has-text("Logout")');
    await expect(page.locator("text=Admin Login")).toBeVisible();
  });
});
