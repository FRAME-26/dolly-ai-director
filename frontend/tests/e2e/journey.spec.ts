import { expect, test, type Page } from "@playwright/test";

declare global {
  interface Window {
    __dollyVoice?: { pushTranscript(transcript: string, confidence?: number): void };
  }
}

/**
 * Full creator journey, driven exactly the way a user would drive it:
 * clicks for the setup screens, voice transcripts (through the real wake-word
 * parser) once the journey goes voice-only.
 */

async function say(page: Page, transcript: string, confidence = 0.9): Promise<void> {
  await page.waitForFunction(() => window.__dollyVoice !== undefined);
  await page.evaluate(
    ([t, c]) => window.__dollyVoice!.pushTranscript(String(t), Number(c)),
    [transcript, confidence] as const,
  );
}

async function walkToReady(page: Page): Promise<void> {
  await page.goto("/?e2e");
  await page.getByRole("button", { name: "Start a session" }).click();
  await expect(page).toHaveURL(/\/permissions/);
  await page.getByRole("button", { name: "Allow camera & voice" }).click();
  await expect(page).toHaveURL(/\/connect/);
  const continueButton = page.getByRole("button", { name: "Continue" });
  await expect(continueButton).toBeDisabled();
  await expect(continueButton).toBeEnabled({ timeout: 10_000 });
  await continueButton.click();
  await expect(page).toHaveURL(/\/roles/);
  await page.getByRole("button", { name: "I've placed them" }).click();
  await expect(page).toHaveURL(/\/ready/);
}

test("complete journey: launch → export, voice-only after placement", async ({ page }) => {
  await walkToReady(page);

  // Voice-only from here. Invalid speech must not move the flow.
  await say(page, "what a lovely day");
  await expect(page).toHaveURL(/\/ready/);
  await say(page, "dolly cut"); // not valid in ready
  await expect(page).toHaveURL(/\/ready/);
  await say(page, "dolly action", 0.2); // low confidence
  await expect(page).toHaveURL(/\/ready/);

  await say(page, "dolly action");
  await expect(page).toHaveURL(/\/recording/);
  await expect(page.getByText(/ROLLING/)).toBeVisible();

  // Recording is voice-only: not a single button.
  await expect(page.locator("main button")).toHaveCount(0);

  await say(page, "dolly again");
  await expect(page.getByText(/MARKED RETAKE/)).toBeVisible();

  await say(page, "dolly hold");
  await expect(page.getByText(/HOLDING/)).toBeVisible();
  await expect(page.locator("main button")).toHaveCount(0);

  await say(page, "dolly action");
  await expect(page.getByText(/ROLLING/)).toBeVisible();

  await say(page, "dolly cut");
  await expect(page).toHaveURL(/\/building/);
  await expect(page.getByText("Dolly is building your cut.")).toBeVisible();

  // Building advances on its own (staged demo pipeline ~12s).
  await expect(page).toHaveURL(/\/review/, { timeout: 30_000 });
  await expect(page.getByText(/DRAFT 1/)).toBeVisible();

  // Raw takes drawer: every take survives.
  await page.getByRole("button", { name: "See raw takes" }).click();
  await expect(page.getByText(/TAKE 01/)).toBeVisible();
  await expect(page.getByText("MARKED RETAKE")).toBeVisible();
  await page.getByRole("button", { name: "Close" }).click();

  // Request changes → new draft returns to review.
  await page.getByRole("button", { name: "Request changes ↺" }).click();
  await page.getByLabel("Feedback for the next draft").fill("Tighter opening.");
  await page.getByRole("button", { name: "Send notes, rebuild" }).click();
  await expect(page).toHaveURL(/\/building/);
  await expect(page).toHaveURL(/\/review/, { timeout: 30_000 });
  await expect(page.getByText(/DRAFT 2/)).toBeVisible();

  await page.getByRole("button", { name: "It's good, export it" }).click();
  await expect(page).toHaveURL(/\/export/);
  await expect(page.getByText("END · VIDEO DELIVERED")).toBeVisible();

  await page.getByRole("button", { name: "Start a new session" }).click();
  await expect(page).toHaveURL(/\/$|\/\?/);
});

test("Dolly Save survives a reload and Past projects restores it", async ({ page }) => {
  await walkToReady(page);
  await say(page, "dolly action");
  await expect(page).toHaveURL(/\/recording/);

  // Hard refresh mid-recording.
  await page.reload();
  await expect(page).toHaveURL(/\/$|\/\?/, { timeout: 10_000 });

  await page.getByRole("button", { name: "Past projects" }).click();
  await expect(page).toHaveURL(/\/projects/);
  const row = page.getByRole("button", { name: /Session ·/ }).first();
  await expect(row).toBeVisible();
  await row.click();

  // Unfinished mid-recording project restores at its latest valid state: Ready.
  await expect(page).toHaveURL(/\/ready/, { timeout: 10_000 });
  await expect(page.getByText("READY · 2 CAMERAS TRACKING")).toBeVisible();
});

test("URL cannot skip the approved flow", async ({ page }) => {
  await page.goto("/?e2e");
  await page.goto("/export");
  await expect(page).toHaveURL(/\/$|\/\?/);
  await page.goto("/recording");
  await expect(page).toHaveURL(/\/$|\/\?/);
});
