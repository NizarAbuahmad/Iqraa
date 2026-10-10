// Shared helpers for driving the local app in a phone-sized browser.
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const APP = 'http://localhost:8081';
const DEMO = { email: 'salma.demo@example.com', password: 'DemoReel2026!' };

async function launch({ dsf = 2, storageState, forceScale = 0 } = {}) {
  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: forceScale ? [`--force-device-scale-factor=${forceScale}`] : [],
  });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, ...(forceScale ? {} : { deviceScaleFactor: dsf }), locale: 'ar-JO', storageState,
  });
  const page = await ctx.newPage();
  return { browser, ctx, page };
}

async function login(page, who = DEMO) {
  await page.goto(APP + '/', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  if (page.url().includes('onboarding')) await page.getByText('تخطي').first().click();
  await page.waitForURL(/login/, { timeout: 15000 });
  await page.locator('input[type=email]').fill(who.email);
  await page.locator('input[type=password]').fill(who.password);
  await page.getByText('تسجيل الدخول', { exact: true }).last().click();
  await page.waitForTimeout(3500);
}

module.exports = { launch, login, APP, DEMO };
