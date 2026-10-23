import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { plantVerificationCode, resetRateLimits } from "../helpers/db";

/**
 * The journey a teacher actually takes, end to end, against the real API and
 * a real Postgres:
 *
 *   sign up → verify email → pick subjects → create a class → add students →
 *   generate an exam → publish it → a student (no account) opens the link and
 *   hands it in → the teacher sees the attempt.
 *
 * It exists because every unit test can pass while this is broken — a route
 * that 503s, a screen that never renders, a gate that bounces a new user.
 * Assertions are deliberately about "did it arrive", not about wording or
 * scores, so copy edits do not break it.
 *
 * The shareable "quiz" is an Evaluation (`/evaluations/new`), not the
 * ai-tools quiz — that one can only be exported, never sent to students.
 */

const PASSWORD = "E2e-Pass1234";
const CODE = "123456";
const STUDENTS = ["Student One", "Student Two"];

// The app defaults to Arabic and shows an intro carousel on first launch; pin
// both so selectors can be written once, in English.
async function pinLocale(ctx: BrowserContext) {
  await ctx.addInitScript(() => {
    localStorage.setItem("@iqra_language", "en");
    localStorage.setItem("@iqra_intro_seen_v1", "1");
  });
}

async function signUpAndVerify(page: Page, email: string) {
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

test("teacher publishes an exam and a student hands it in", async ({ browser }) => {
  await resetRateLimits();
  const email = `e2e-${Date.now()}@example.com`;

  const teacherCtx = await browser.newContext();
  await pinLocale(teacherCtx);
  const teacher = await teacherCtx.newPage();

  await test.step("sign up and verify email", async () => {
    await signUpAndVerify(teacher, email);
    // A brand-new teacher is gated onto subject setup before anything else.
    await expect(teacher).toHaveURL(/setup-subjects/);
  });

  await test.step("pick Grade 10 mathematics", async () => {
    await teacher.getByText("Grade 10", { exact: true }).click();
    await teacher.getByText("Mathematics", { exact: true }).click();
    await teacher.getByText("Show my curriculum", { exact: true }).click();
    await expect(teacher).not.toHaveURL(/setup-subjects/);
  });

  await test.step("create a class", async () => {
    await teacher.goto("/classes");
    // Roster writes are blocked until the teacher confirms the school has parental consent.
    await teacher.getByText("I confirm", { exact: true }).click();
    await teacher.getByRole("button", { name: "New class" }).first().click();
    await teacher.getByPlaceholder("e.g. Grade 10 Math A").fill("E2E Class");
    await teacher.getByText("Create class", { exact: true }).click();
    // Creating a class opens it; the list screen stays mounted underneath, so assert on the route.
    await expect(teacher).toHaveURL(/\/classes\/[0-9a-f-]{36}/);
    await expect(teacher.getByText("No students in this class")).toBeVisible();
  });

  await test.step("add students", async () => {
    await teacher.getByRole("button", { name: "Add students" }).first().click();
    // Real keystrokes: a multiline React Native Web input ignores a bare fill() — the
    // button below stays disabled because the app never saw a change event.
    const names = teacher.getByPlaceholder("One name per line, or separated by commas");
    await names.click();
    await names.pressSequentially(STUDENTS.join(", "));
    await teacher.getByText("Add to class", { exact: true }).click();
    for (const name of STUDENTS) await expect(teacher.getByText(name).first()).toBeVisible();
  });

  await test.step("open the exam builder", async () => {
    // A slow first request leaves this screen on "Could not load the evaluation" with no
    // retry button, so reloading is what a person would do. A endpoint that is actually
    // broken still fails: toPass gives up after two minutes.
    await expect(async () => {
      await teacher.goto("/evaluations/new");
      // Books are listed by Arabic title only, even in the English UI: grade 10 maths, semester 1.
      await teacher.getByText(/الرياضيات.*العاشر.*الأول/).first().click({ timeout: 25_000 });
    }).toPass({ timeout: 120_000 });
    // First lesson of the first unit. A lesson that the offline maths bank can write questions for.
    await teacher.getByText("حل نظام مكوَّن من معادلة خطية ومعادلة تربيعية", { exact: true }).click();
    // Multiple choice only: it is the one type that is marked automatically. Short answer
    // is selected by default and waits for the teacher, which would leave the attempt ungraded.
    await teacher.getByText("Short answer", { exact: true }).click();
  });

  await test.step("generate questions", async () => {
    await teacher.getByText("Create and generate questions", { exact: true }).click();
    // Generation is a server call (45 s client timeout); the app then opens the exam.
    await expect(teacher).toHaveURL(/\/evaluations\/[0-9a-f-]{36}/, { timeout: 60_000 });
    await expect(teacher.getByText("Publish evaluation").first()).toBeVisible();
  });

  await test.step("publish", async () => {
    await teacher.getByText("Publish evaluation", { exact: true }).first().click();
    // The in-app confirm dialog reuses the title as its confirm button's text.
    await teacher.getByRole("alert").getByText("Publish evaluation").last().click();
    await expect(teacher.getByText("Student link")).toBeVisible({ timeout: 30_000 });
  });

  await test.step("attach it to the class", async () => {
    // Students pick their name from the class roster, so the exam needs a class.
    await teacher.getByText("Attach it to a class now", { exact: true }).click();
    await teacher.getByText("E2E Class").last().click();
    // Six characters from an alphabet without 0/O/1/I/L — and not the whole sentence around it.
    await expect(teacher.getByText(/^[A-HJKMN-Z2-9]{6}$/)).toBeVisible({ timeout: 30_000 });
  });
  const code = (await teacher.getByText(/^[A-HJKMN-Z2-9]{6}$/).innerText()).trim();

  // A second browser with no session: the student never signs in.
  const studentCtx = await browser.newContext();
  await pinLocale(studentCtx);
  const student = await studentCtx.newPage();
  let questions: { body: { options: { text: string }[] } }[] = [];

  await test.step("student opens the link and picks their name", async () => {
    await student.goto(`/take/${code}`);
    await expect(student.getByText(STUDENTS[0]!, { exact: true })).toBeVisible({ timeout: 60_000 });
    await student.getByText(STUDENTS[0]!, { exact: true }).click();
    const claimed = student.waitForResponse((r) => /\/take\/[^/]+\/claim$/.test(r.url()));
    await student.getByText("Yes, start", { exact: true }).click();
    questions = (await (await claimed).json()).questions;
    expect(questions.length).toBeGreaterThan(0);
  });

  await test.step("student answers every question", async () => {
    for (const [i, q] of questions.entries()) {
      await expect(student.getByText(`Question ${i + 1} of ${questions.length}`)).toBeVisible({ timeout: 30_000 });
      // The bank draws different options each run, so read them from the API; the screen
      // wraps parts of them in invisible bidi marks, which the pattern tolerates.
      const option = q.body.options[0].text as string;
      const bidi = "[\\u2066-\\u2069]*";
      await student
        .getByText(new RegExp([...option].map((ch) => ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join(bidi)))
        .first()
        .click();
      await student.getByText(i === questions.length - 1 ? "Review" : "Next", { exact: true }).click();
    }
    await expect(student.getByText("You have answered every question.")).toBeVisible();
  });

  await test.step("student hands it in", async () => {
    await student.getByText("Hand in", { exact: true }).click();
    await expect(student.getByText("Handed in", { exact: true })).toBeVisible({ timeout: 60_000 });
  });

  await test.step("teacher sees the attempt", async () => {
    await teacher.getByText("Results dashboard", { exact: true }).click();
    // The attempt arrived and was marked. Not asserting a score: the test picks the
    // first option of each question, which is not necessarily the right one.
    await expect(teacher.getByText("1 of 1 students marked")).toBeVisible({ timeout: 60_000 });
    await expect(teacher.getByText(STUDENTS[0]!, { exact: true })).toBeVisible();
  });

  await teacherCtx.close();
  await studentCtx.close();
});
