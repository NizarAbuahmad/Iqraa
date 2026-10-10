// Non-recorded: log in through the real UI and complete the first-run grade/subject setup,
// then save the browser session so the recording starts from the app, already signed in.
const { launch, APP } = require('./common.cjs');
const { sleep } = require('./rec.cjs');
(async () => {
  const [email, name, grade, ...subjects] = process.argv.slice(2);
  const { browser, ctx, page } = await launch({ dsf: 2 });
  await page.goto(APP + '/', { waitUntil: 'networkidle' });
  await sleep(1200);
  if (page.url().includes('onboarding')) await page.getByText('تخطي').first().click();
  await page.waitForURL(/login/, { timeout: 15000 });
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill('DemoReel2026!');
  await page.getByText('تسجيل الدخول', { exact: true }).last().click();
  await page.waitForURL(/setup-subjects/, { timeout: 20000 });
  await sleep(1200);
  await page.getByText(grade, { exact: true }).first().click(); await sleep(500);
  for (const s of subjects) { await page.getByText(s, { exact: true }).first().click(); await sleep(250); }
  await page.getByText('متابعة', { exact: true }).last().click();
  await sleep(3500);
  console.log(name, '->', page.url());
  await ctx.storageState({ path: `state/${name}.json` });
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
