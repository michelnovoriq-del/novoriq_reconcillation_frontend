import { expect, test } from "@playwright/test";

test("login links to registration and create account submits exactly once", async ({ page }) => {
  let registrations = 0;
  await page.route("**/account/bootstrap", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      user: { id: "user-e2e", email: "owner@example.com", full_name: "Test Owner", email_verified: false, role: "owner" },
      organization: { id: "org-e2e", name: "Test Organization" },
      subscription: { plan_code: "free", plan_name: "Free Forever", status: "active", billing_provider: null, current_period_end: null },
      usage: { reconciliation_runs_used: 0, reconciliation_runs_limit: 2, remaining_reconciliation_runs: 2, files_uploaded: 0, rows_processed: 0, reset_at: "2026-08-01T00:00:00Z" },
      entitlements: { max_files_per_run: 2, max_rows_per_file: 2500, max_users: 1, max_client_workspaces: 1, detailed_retention_days: 7 },
      billing: { membership_linked: false, whop_status: null, pending_action: false },
    }),
  }));
  await page.route("**/auth/register", async (route) => {
    registrations += 1;
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ access_token: "e2e-token", token_type: "bearer" }),
    });
  });
  await page.goto("/login");
  await page.getByRole("link", { name: "Create a Free Forever workspace." }).click();
  await expect(page).toHaveURL(/\/register$/);
  await page.locator("#full_name").fill("Test Owner");
  await page.locator("#organization_name").fill("Test Organization");
  await page.locator("#email").fill("owner@example.com");
  await page.locator("#password").fill("password123");
  await page.locator("#confirm_password").fill("password123");
  await page.getByRole("checkbox").check();
  const request = page.waitForRequest("**/auth/register");
  await page.getByRole("button", { name: "Create Free Workspace" }).click();
  await request;
  await expect(page).toHaveURL(/\/onboarding$/);
  expect(registrations).toBe(1);
  expect(await page.evaluate(() => localStorage.getItem("novoriq_token"))).toBe("e2e-token");
});

test("registration has the required order, labels, links, and accessible validation", async ({ page }) => {
  await page.goto("/register");
  await expect(page.getByRole("heading", { level: 1, name: "Create your workspace" })).toBeVisible();
  const labels = await page.locator("form label").allTextContents();
  expect(labels.join("|")).toMatch(/Full name[\s\S]*Organization name[\s\S]*Work email[\s\S]*Password[\s\S]*Confirm password[\s\S]*Terms of Service/);
  await expect(page.getByRole("button", { name: "Create Free Workspace" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Terms of Service" })).toHaveAttribute("href", "/terms");
  await expect(page.getByRole("link", { name: "Privacy Policy" })).toHaveAttribute("href", "/privacy");
  await page.getByRole("button", { name: "Create Free Workspace" }).click();
  await expect(page.getByText("Full name is required.")).toBeVisible();
  await expect(page.locator("#full_name")).toBeFocused();
});

test("registration converts a browser network failure to a friendly message", async ({ page }) => {
  await page.route("**/auth/register", (route) => route.abort("failed"));
  await page.goto("/register");
  await page.locator("#full_name").fill("Test Owner");
  await page.locator("#organization_name").fill("Test Organization");
  await page.locator("#email").fill("owner@example.com");
  await page.locator("#password").fill("password123");
  await page.locator("#confirm_password").fill("password123");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create Free Workspace" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Novoriq could not reach the server" })).toBeVisible();
  await expect(page.getByText(/NetworkError|Failed to fetch|AxiosError/)).toHaveCount(0);
});

test("login uses friendly invalid-credentials handling", async ({ page }) => {
  await page.route("**/auth/login", (route) => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ detail: "raw backend detail" }) }));
  await page.goto("/login");
  await expect(page.getByRole("heading", { level: 1, name: "Welcome back" })).toBeVisible();
  await page.locator("#email").fill("owner@example.com");
  await page.locator("#password").fill("wrong-password");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Email or password is incorrect." })).toBeVisible();
});

test("registration does not overflow on a narrow viewport", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/register");
  const dimensions = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.client);
});
