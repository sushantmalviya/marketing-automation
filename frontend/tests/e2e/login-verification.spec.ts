import { test, expect } from "@playwright/test";

test.describe("Login Verification E2E", () => {
  test("successful login with harshshivhare762@gmail.com and redirect to dashboard", async ({ page }) => {
    test.setTimeout(30000);

    // 1. Open login page
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // 2. Fill login credentials
    await expect(page.getByRole("heading", { name: "Welcome Back" })).toBeVisible({ timeout: 10000 });
    await page.fill('input[type="email"]', "harshshivhare762@gmail.com");
    await page.fill('input[type="password"]', "harshshivhare762@gmail.com");

    // 3. Submit and wait for auth API response
    const [loginRes] = await Promise.all([
      page.waitForResponse((res) => res.url().includes("/api/auth/login/"), { timeout: 15000 }),
      page.click('button[type="submit"]'),
    ]);

    expect(loginRes.status()).toBe(200);
    const body = await loginRes.json();
    expect(body.success).toBe(true);
    expect(body.data.user.email).toBe("harshshivhare762@gmail.com");

    // 4. Verify successful redirection away from /login
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 15000 });
    expect(page.url()).toMatch(/\/(user|admin)\/dashboard/);
  });
});
