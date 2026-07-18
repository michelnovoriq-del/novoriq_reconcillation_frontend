import { expect, test } from "@playwright/test";

const fileId = "11111111-1111-4111-8111-111111111111";

test("manual amount mapping sends net_amount in normalize request", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("novoriq_token", "mapping-test-token"));
  await page.route("**/account/bootstrap", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      user: { id: "user-1", email: "owner@example.com", full_name: "Owner", email_verified: true, role: "owner" },
      organization: { id: "org-1", name: "Test Organization" },
      subscription: { plan_code: "free", plan_name: "Free Forever", status: "active", billing_provider: null, current_period_end: null },
      usage: { reconciliation_runs_used: 0, reconciliation_runs_limit: 2, remaining_reconciliation_runs: 2, files_uploaded: 1, rows_processed: 0, reset_at: "2026-08-01T00:00:00Z" },
      entitlements: { max_files_per_run: 2, max_rows_per_file: 2500, max_users: 1, max_client_workspaces: 1, detailed_retention_days: 7 },
      billing: { membership_linked: false, whop_status: null, pending_action: false },
    }),
  }));
  await page.route(`**/files/${fileId}/preview`, (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      file_id: fileId,
      columns: ["payment_date", "payment_id", "gross_amount", "net_amount"],
      sample_rows: [{ payment_date: "2026-07-01", payment_id: "PAY-001", gross_amount: "24.92", net_amount: "24.37" }],
    }),
  }));
  let normalizePayload: unknown;
  await page.route(`**/files/${fileId}/normalize`, async (route) => {
    normalizePayload = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ uploaded_file_id: fileId, status: "normalized", total_rows: 1, valid_rows: 1, rejected_rows: 0, rejected_examples: [], message: "Normalized 1 row." }),
    });
  });

  await page.goto(`/files/${fileId}/map`);
  await expect(page.getByText("Suggested preset: Payment Export Test File")).toBeVisible();
  await expect(page.locator("select").nth(1)).toHaveValue("net_amount");
  const selects = page.locator("select");
  await selects.nth(0).selectOption("payment_date");
  await selects.nth(1).selectOption("net_amount");
  await selects.nth(2).selectOption("payment_id");
  await page.getByRole("button", { name: "Normalize records" }).click();

  await expect(page.getByText("Records normalized")).toBeVisible();
  expect(normalizePayload).toMatchObject({
    date: "payment_date",
    amount: "net_amount",
    reference: "payment_id",
  });
});

test("gross amount selection shows a non-blocking bank reconciliation warning", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("novoriq_token", "mapping-test-token"));
  await page.route("**/account/bootstrap", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
    user: { id: "user-1", email: "owner@example.com", full_name: "Owner", email_verified: true, role: "owner" }, organization: { id: "org-1", name: "Test" },
    subscription: { plan_code: "free", plan_name: "Free", status: "active", billing_provider: null, current_period_end: null }, usage: { reconciliation_runs_used: 0, reconciliation_runs_limit: 2, remaining_reconciliation_runs: 2, files_uploaded: 1, rows_processed: 0, reset_at: "2026-08-01T00:00:00Z" }, entitlements: { max_files_per_run: 2, max_rows_per_file: 2500, max_users: 1, max_client_workspaces: 1, detailed_retention_days: 7 }, billing: { membership_linked: false, whop_status: null, pending_action: false }
  }) }));
  await page.route(`**/files/${fileId}/preview`, (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ file_id: fileId, columns: ["payout_date", "payout_reference", "gross_amount", "net_amount", "processor", "customer_name", "currency"], sample_rows: [] }) }));

  await page.goto(`/files/${fileId}/map`);
  await page.locator("select").nth(1).selectOption("gross_amount");
  await expect(page.getByText(/Gross amount is before fees/)).toBeVisible();
  await expect(page.getByRole("button", { name: "Normalize records" })).toBeEnabled();
});
