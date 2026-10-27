import { expect, type BrowserContext, type Page } from "@playwright/test";
import { plantVerificationCode } from "./db";

/** Steps the specs share: getting a fresh teacher account into the app. */

const PASSWORD = "E2e-Pass1234";
const CODE = "123456";

/**
 * The app defaults to Arabic and shows an intro carousel on first launch; pin
 * both so selectors can be written once, in English.
 *
 * A fresh account is also walked through the app by a first-run tour, whose dim
 * layer blocks clicks, and its per-account flag cannot be pre-seeded (the user id
 * does not exist yet). So the device-wide switch turns it off unless a spec is
 * about the tour (`tour: true`). Checked 2026-10-26: the teacher-to-student
 * journey also passes without the switch, because it leaves Today by a reload
 * before the tour's 700 ms wait is up — the switch is for the day a slower
 * runner, or a step that clicks on Today, would otherwise race it.
 */
export async function pinLocale(ctx: BrowserContext, { tour = false }: { tour?: boolean } = {}) {
  await ctx.addInitScript((tourOn) => {
    localStorage.setItem("@iqra_language", "en");
    localStorage.setItem("@iqra_intro_seen_v1", "1");
    if (!tourOn) localStorage.setItem("@iqra_tour_off_v1", "1");
  }, tour);
}

export async function signUpAndVerify(page: Page, email: string) {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login/);
  await page.getByText("Create account", { exact: true }).first().click();

  await page.getByPlaceholder("Ahmad").fill("Test");
  await page.getByPlaceholder("Al-Rashidi").fill("Teacher");
  await page.getByPlaceholder("name@email.com").fill(email);
  await page.getByPlaceholder("Minimum 8 characters").fill(PASSWORD);
  await page.getByPlaceholder("Re-enter your password").fill(PASSWORD);
  // The row holds links to the terms and privacy pages; its centre is a link, so click the box.
  await page.getByRole("checkbox").click({ position: { x: 8, y: 8 } });
  await page.getByRole("button", { name: "Create account" }).click();

  // The verify screen appears once the register request returns, and only then
  // does a code exist to plant. Password hashing makes this the slowest request
  // of the journey (15 s on a loaded machine), so give it room.
  await expect(page.getByPlaceholder("000000")).toBeVisible({ timeout: 60_000 });
  await plantVerificationCode(email, CODE);
  await page.getByPlaceholder("000000").fill(CODE);
  await page.getByRole("button", { name: "Verify email" }).click();
}
