import { expect, test } from "@playwright/test";
import { insertSavedMaterial, resetRateLimits, shareCodeOf } from "../helpers/db";
import { pinLocale, signUpAndVerify } from "../helpers/journey";

/**
 * A teacher shares a saved quiz by link, and the link works for the two people
 * it is for (spec docs/superpowers/specs/2026-11-20-material-share-link-design.md):
 *
 *   the owner taps «Share a link» → someone with no account opens /m/CODE and
 *   sees the paper without its answers → a teacher opens it and sees the
 *   answers, and saves a copy to their own files.
 *
 * What it guards that the API tests cannot: that /m/CODE is reachable without
 * signing in (PUBLIC_ROUTES), that the page renders the material, and that the
 * answer never reaches a visitor's screen. As in teacher-to-student, it asserts
 * "did it arrive", not copy.
 */

const ANSWER = "SECRET-ANSWER-42";
const QUIZ = {
  title: "Share link quiz",
  duration: 10,
  totalPoints: 2,
  questions: [
    { id: "q1", type: "short_answer", text: "What is two plus forty?", correctAnswer: ANSWER, points: 2, explanation: "" },
  ],
};

test("a shared quiz opens for a visitor without its answers, and for a teacher with them", async ({ browser }) => {
  await resetRateLimits();
  const email = `e2e-share-${Date.now()}@example.com`;

  const teacherCtx = await browser.newContext();
  await pinLocale(teacherCtx);
  const teacher = await teacherCtx.newPage();

  await test.step("a teacher signs up", async () => {
    await signUpAndVerify(teacher, email);
    await expect(teacher).toHaveURL(/setup-subjects/);
    await teacher.getByText("Grade 10", { exact: true }).click();
    await teacher.getByText("Mathematics", { exact: true }).click();
    await teacher.getByText("Show my curriculum", { exact: true }).click();
    await expect(teacher).not.toHaveURL(/setup-subjects/);
  });

  const id = await insertSavedMaterial(email, { type: "quiz", title: QUIZ.title, content: QUIZ });
  let code = "";

  await test.step("the owner shares it by link", async () => {
    await teacher.goto(`/workspace/view?id=${id}`);
    await expect(teacher.getByText(ANSWER)).toBeVisible();
    await teacher.getByText("Export", { exact: true }).click();
    await teacher.getByText("Share a link", { exact: true }).click();
    await expect.poll(() => shareCodeOf(id), { timeout: 30_000 }).toMatch(/^[A-Z2-9]{8}$/);
    code = (await shareCodeOf(id))!;
    await expect(teacher.getByText("Shared by link", { exact: true })).toBeVisible();
  });

  await test.step("someone with no account opens the link: the paper, no answer", async () => {
    const visitorCtx = await browser.newContext();
    await pinLocale(visitorCtx);
    const visitor = await visitorCtx.newPage();
    await visitor.goto(`/m/${code}`);
    await expect(visitor).toHaveURL(new RegExp(`/m/${code}$`), { timeout: 10_000 });
    await expect(visitor.getByText("What is two plus forty?")).toBeVisible({ timeout: 30_000 });
    await expect(visitor.getByText("Sign up free as a teacher", { exact: true })).toBeVisible();
    await expect(visitor.getByText(ANSWER)).toHaveCount(0);
    await visitorCtx.close();
  });

  await test.step("a teacher opens it with the answers and saves a copy", async () => {
    await teacher.goto(`/m/${code}`);
    await expect(teacher.getByText(ANSWER)).toBeVisible({ timeout: 30_000 });
    await teacher.getByText("Save to my files", { exact: true }).click();
    await expect(teacher).toHaveURL(/\/workspace\/view\?id=[0-9a-f-]{36}/, { timeout: 30_000 });
    expect(new URL(teacher.url()).searchParams.get("id")).not.toBe(id);
    await expect(teacher.getByText(ANSWER)).toBeVisible();
  });

  await test.step("a stopped link no longer opens", async () => {
    await teacher.goto(`/workspace/view?id=${id}`);
    await teacher.getByText("Stop sharing", { exact: true }).click();
    await expect.poll(() => shareCodeOf(id), { timeout: 30_000 }).toBeNull();
    await teacher.goto(`/m/${code}`);
    await expect(teacher.getByText(/no longer works/)).toBeVisible({ timeout: 30_000 });
  });

  await teacherCtx.close();
});
