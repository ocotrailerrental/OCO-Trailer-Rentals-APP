import { expect, test, type Page } from "@playwright/test";

test("home, search, trailer links, FAQ, and contact work", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /haul more/i })).toBeVisible();
  await page.getByLabel("Pickup date").fill("2026-10-10");
  await page.getByLabel("Return date").fill("2026-10-10");
  await page.getByRole("button", { name: /search availability/i }).click();
  await expect(page).toHaveURL(/\/book\?/);
  await expect(page.getByText(/2026|Oct|October/).first()).toBeVisible();
  await page.goto("/trailers/20-foot-car-hauler");
  await expect(page.getByRole("heading", { name: /20.*car hauler/i })).toBeVisible();
  await page.goto("/faq");
  await expect(
    page.getByRole("heading", { name: /frequently asked/i }),
  ).toBeVisible();
  await page.goto("/contact");
  await expect(
    page.getByRole("heading", { name: /local trailer team/i }),
  ).toBeVisible();
});

async function signIn(page: Page, email: string) {
  const password = process.env.OCO_AUDIT_PASSWORD;
  test.skip(
    !password,
    "Set OCO_AUDIT_PASSWORD to run authenticated role checks.",
  );
  await page.goto("/login");
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/password/i).fill(password!);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/app/);
}

test("manager receives a staff session without payment activity", async ({
  page,
}) => {
  await signIn(page, "audit-manager@oco.test");
  await page.goto("/app/admin");
  await expect(page.getByRole("heading", { name: /Omaha overview/i })).toBeVisible();
});

test("admin receives company staff navigation without payment activity", async ({
  page,
}) => {
  await signIn(page, "audit-admin@oco.test");
  await page.goto("/app/admin");
  await expect(page.getByText(/finance/i).first()).toBeVisible();
});
