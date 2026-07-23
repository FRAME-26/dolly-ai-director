import { test, expect, type Page } from "@playwright/test";

declare global {
  interface Window {
    __dollyVoice?: { pushTranscript(transcript: string, confidence?: number): void };
  }
}

/** Captures every screen at 1440×900 for visual comparison against Figma. */

async function say(page: Page, transcript: string): Promise<void> {
  await page.waitForFunction(() => window.__dollyVoice !== undefined);
  await page.evaluate((t) => window.__dollyVoice!.pushTranscript(t, 0.9), transcript);
}

async function shoot(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `screenshots/${name}.png` });
}

test("capture all screens", async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto("/?e2e");
  await shoot(page, "01-home");

  await page.getByRole("button", { name: "Start a session" }).click();
  await shoot(page, "02-permissions");

  await page.getByRole("button", { name: "Why does Dolly need this?" }).click();
  await shoot(page, "02b-permissions-why");
  await page.getByRole("dialog").click();

  await page.getByRole("button", { name: "Allow camera & voice" }).click();
  await shoot(page, "03-connect-pairing");
  await expect(page.getByRole("button", { name: "Continue" })).toBeEnabled({
    timeout: 10_000,
  });
  await shoot(page, "03b-connect-both");
  await page.getByRole("button", { name: "Continue" }).click();
  await shoot(page, "04-roles");

  await page.getByRole("button", { name: "I've placed them" }).click();
  await shoot(page, "05-ready");

  await say(page, "dolly action");
  await expect(page.getByText(/ROLLING/)).toBeVisible();
  await page.waitForTimeout(1500);
  await shoot(page, "06-recording");

  await say(page, "dolly hold");
  await expect(page.getByText(/HOLDING/)).toBeVisible();
  await shoot(page, "06b-holding");

  await say(page, "dolly action");
  await say(page, "dolly cut");
  await expect(page.getByText("Dolly is building your cut.")).toBeVisible();
  await shoot(page, "07-building");

  await page.getByRole("button", { name: "View progress" }).click();
  await shoot(page, "07b-building-progress");
  await page.getByRole("button", { name: "Hide progress" }).click();

  await expect(page).toHaveURL(/\/review/, { timeout: 30_000 });
  await expect(page.getByRole("button", { name: "It's good, export it" })).toBeVisible();
  await shoot(page, "08-review");

  await page.getByRole("button", { name: "See raw takes" }).click();
  await shoot(page, "08b-raw-takes");
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByRole("button", { name: "It's good, export it" }).click();
  await shoot(page, "09-export");

  await page.getByRole("button", { name: "Start a new session" }).click();
  await page.getByRole("button", { name: "Past projects" }).click();
  await shoot(page, "10-past-projects");
});
