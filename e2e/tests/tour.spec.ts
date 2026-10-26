import { expect, test } from "@playwright/test";
import { resetRateLimits } from "../helpers/db";
import { pinLocale, signUpAndVerify } from "../helpers/journey";

/**
 * The first-run tour, as a brand-new teacher meets it, against the real API:
 *
 *   sign up → verify → pick subjects (no tour over that screen) → land on
 *   Today → the tour opens → walk it → it does not come back → Profile →
 *   «Replay the tour» → it does.
 *
 * What the unit tests cannot say is that the tour is only ever drawn over a
 * screen the user has actually arrived at, with the account the server really
 * made. Like the journey spec it asserts "did it arrive": the number of steps,
 * the wording and where the ring sits are pinned by services/__tests__/tour*.
 * (The window here is desktop-sized, so it walks the sidebar flavour.)
 */
test("a new teacher is walked through Today once, and can replay it", async ({ browser }) => {
  await resetRateLimits();
  const email = `e2e-tour-${Date.now()}@example.com`;

  const ctx = await browser.newContext();
  await pinLocale(ctx, { tour: true });
  const page = await ctx.newPage();
  const tour = page.getByRole("dialog");
  const next = tour.getByRole("button", { name: "Next", exact: true });
  const done = tour.getByRole("button", { name: "Done", exact: true });

  await test.step("a new teacher meets subject setup first, with no tour over it", async () => {
    await signUpAndVerify(page, email);
    await expect(page).toHaveURL(/setup-subjects/);
    await expect(tour).toHaveCount(0);
  });

  await test.step("once set up, the tour opens on Today", async () => {
    await page.getByText("Grade 10", { exact: true }).click();
    await page.getByText("Mathematics", { exact: true }).click();
    await page.getByText("Show my curriculum", { exact: true }).click();
    await expect(page).not.toHaveURL(/setup-subjects/);
    await expect(tour.getByText(/^Step 1 of \d+$/)).toBeVisible();
  });

  await test.step("Next walks every step, and the last one says Done", async () => {
    // Bounded: a teacher's tour is six steps; ten means Next never reaches Done.
    for (let i = 0; i < 10 && (await next.count()) > 0; i++) await next.click();
    // The last step is "Step 6 of 6" — a window this size shows the sidebar flavour,
    // six steps. A button that merely says Done would also be there if every middle
    // step had been dropped, so the count has to say all of them were reached.
    await expect(tour.getByText("Step 6 of 6", { exact: true })).toBeVisible();
    await done.click();
    await expect(tour).toHaveCount(0);
  });

  await test.step("a reload does not show it again", async () => {
    await page.reload();
    // The tour waits for the screen to hold still before it starts; give it
    // longer than that, with the app demonstrably loaded.
    await expect(page.getByText("Today", { exact: true }).first()).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(tour).toHaveCount(0);
  });

  await test.step("Profile → Replay the tour opens it again, and Escape closes it", async () => {
    await page.goto("/profile");
    await page.getByText("Replay the tour", { exact: true }).click();
    await expect(tour.getByText(/^Step 1 of \d+$/)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(tour).toHaveCount(0);
  });
});
