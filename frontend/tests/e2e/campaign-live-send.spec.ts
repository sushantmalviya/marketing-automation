import { test, expect } from "@playwright/test";
import * as path from "path";
import * as fs from "fs";

test.describe("Real User Campaign Flow E2E", () => {
  test("complete end-to-end campaign creation, audience selection, template assignment, and Send Now", async ({ page }) => {
    test.setTimeout(120000);

    const screenshotsDir = path.resolve(__dirname, "../../playwright-screenshots");
    if (!fs.existsSync(screenshotsDir)) {
      fs.mkdirSync(screenshotsDir, { recursive: true });
    }

    const consoleLogs: string[] = [];
    const consoleErrors: string[] = [];
    const networkRequests: { url: string; method: string; status?: number; payload?: any; response?: any }[] = [];

    page.on("console", (msg) => {
      if (msg.type() === "error") {
        consoleErrors.push(msg.text());
      } else {
        consoleLogs.push(msg.text());
      }
    });

    page.on("request", (req) => {
      if (req.url().includes("/api/")) {
        let postData: any = null;
        try {
          postData = req.postDataJSON();
        } catch {
          postData = req.postData();
        }
        networkRequests.push({
          url: req.url(),
          method: req.method(),
          payload: postData,
        });
      }
    });

    page.on("response", async (res) => {
      if (res.url().includes("/api/")) {
        const item = networkRequests.find((r) => r.url === res.url() && !r.status);
        if (item) {
          item.status = res.status();
          try {
            item.response = await res.json();
          } catch {
            // ignore non-json
          }
        }
      }
    });

    // 1. Open login page
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // 2. Login with explicit response wait
    await expect(page.getByRole("heading", { name: "Welcome Back" })).toBeVisible({ timeout: 10000 });
    await page.fill('input[type="email"]', "harshshivhare762@gmail.com");
    await page.fill('input[type="password"]', "harshshivhare762@gmail.com");
    
    const [loginRes] = await Promise.all([
      page.waitForResponse((res) => res.url().includes("/api/auth/login/"), { timeout: 30000 }),
      page.click('button[type="submit"]'),
    ]);
    expect(loginRes.status()).toBe(200);

    // Wait for user redirect or navigate directly to /user/campaigns
    await page.waitForTimeout(1000);

    // 3. Navigate to Campaigns
    await page.goto("/user/campaigns");
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Campaigns" })).toBeVisible({ timeout: 10000 });

    // Screenshot 1: Before campaign creation
    await page.screenshot({ path: path.join(screenshotsDir, "screenshot-1-before-create.png") });

    // 4. Click Create Campaign
    await page.getByRole("button", { name: "Create Campaign" }).click();
    await expect(page.getByRole("heading", { name: "Campaign Details" })).toBeVisible({ timeout: 5000 });

    // 5. Fill Campaign Details
    const campaignName = `Playwright Real WA Flow ${Date.now()}`;
    await page.fill('input[placeholder="Enter campaign name"]', campaignName);

    // 6. Select Audience "test"
    const audienceSelect = page.locator("select").filter({ hasText: "Select Audience Group" });
    await expect(audienceSelect).toBeVisible();
    
    // Select option with value "56"
    await audienceSelect.selectOption("56");

    // Screenshot 2: Audience selected
    await page.screenshot({ path: path.join(screenshotsDir, "screenshot-2-audience-selected.png") });

    // 7. Select WhatsApp Channel
    const whatsappButton = page.getByRole("button", { name: "WhatsApp" });
    await expect(whatsappButton).toBeVisible();
    await whatsappButton.click();

    // 8. Click Next -> Step 2 (WhatsApp Template)
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { name: /WhatsApp Template/i })).toBeVisible({ timeout: 5000 });

    // 9. Open "My Templates" picker modal
    await page.getByRole("button", { name: "My Templates" }).click();
    await expect(page.getByRole("heading", { name: "Select a Template" })).toBeVisible({ timeout: 5000 });
    
    // Wait for template cards to render and click Use This Template
    const useTemplateButton = page.getByRole("button", { name: "Use This Template" }).first();
    await expect(useTemplateButton).toBeVisible({ timeout: 10000 });
    await useTemplateButton.click();

    // Wait for modal to close
    await expect(page.getByRole("heading", { name: "Select a Template" })).not.toBeVisible({ timeout: 5000 });
    await page.waitForTimeout(500);

    // Screenshot 3: Template Selected
    await page.screenshot({ path: path.join(screenshotsDir, "screenshot-3-template-selected.png") });

    // 10. Click Next -> Step 3 (Preview)
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByRole("heading", { name: "Campaign Summary" })).toBeVisible({ timeout: 5000 });

    // Verify Audience is "test" and Total Recipients is "1"
    const recipientCountEl = page.locator('div.min-w-0', { has: page.locator('p', { hasText: "Total Recipients" }) }).locator('p.text-sm');
    await expect(recipientCountEl).toHaveText("1");

    // Screenshot 4: Preview Summary
    await page.screenshot({ path: path.join(screenshotsDir, "screenshot-4-preview-summary.png") });

    // 11. Save Campaign as Draft
    await page.getByRole("button", { name: "Save as Draft" }).click();

    // Wait for redirect to campaign list
    await expect(page.getByRole("heading", { name: "Campaigns" })).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // 12. Find the newly created campaign row in the table
    const campaignRow = page.locator("tr", { hasText: campaignName });
    await expect(campaignRow).toBeVisible({ timeout: 10000 });

    // 13. Click View (Eye icon) button on this campaign row
    const viewButton = campaignRow.locator('button[aria-label="View"]');
    await viewButton.click();

    // 14. Campaign Details Modal opens
    await expect(page.getByRole("heading", { name: "Campaign Details" })).toBeVisible({ timeout: 5000 });
    await expect(page.locator("p", { hasText: campaignName })).toBeVisible();

    // 15. Click "Send Now" button inside the modal
    const sendNowButton = page.locator('button', { hasText: "Send Now" });
    await expect(sendNowButton).toBeVisible();
    await sendNowButton.click();

    // Wait for background sending to complete
    await page.waitForTimeout(8000);

    // Screenshot 5: Send Now Result
    await page.screenshot({ path: path.join(screenshotsDir, "screenshot-5-send-now-result.png") });

    // Save summary log
    const logData = {
      campaignName,
      consoleErrors,
      networkRequests: networkRequests.map((r) => ({
        url: r.url,
        method: r.method,
        status: r.status,
        payload: r.payload,
        response: r.response,
      })),
    };

    fs.writeFileSync(
      path.join(screenshotsDir, "e2e-run-log.json"),
      JSON.stringify(logData, null, 2),
      "utf-8"
    );
  });
});
