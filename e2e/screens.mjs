// e2e/screens.mjs
// Screenshots the corners and the library on the built web bundle, phone and
// desktop, light and dark, with a fake teacher session and every /api call
// stubbed. For looking at, not diffing: the point is a human eye on the hues
// on real screens before a PR. Run `node serve.mjs` first (port 8098), then
// `OUT=/tmp/shots node screens.mjs`.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = process.env.OUT ?? './screens-out';
const BASE = process.env.BASE ?? 'http://localhost:8098';
mkdirSync(OUT, { recursive: true });

const teacher = {
  id: 'u-teacher', firstName: 'سارة', lastName: 'الخطيب', name: 'سارة الخطيب', email: 't@example.com',
  role: 'teacher', preferredLanguage: 'ar', avatarUrl: null, createdAt: '2026-01-01T00:00:00Z',
  gradeIds: ['grade-10'], subjectIds: ['mathematics'],
};

const ROUTES = [
  ['library', '/curriculum/resources'],
  ['math-hub', '/curriculum/math'],
  ['math-grapher', '/curriculum/math/grapher'],
  ['lab-hub', '/curriculum/lab'],
  ['quran-hub', '/curriculum/quran'],
  ['english-hub', '/curriculum/english?grade=1'],
  ['play-hub', '/play'],
];
const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: 'desktop', width: 1366, height: 860, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
];

let browser;
try { browser = await chromium.launch(); }
catch { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }

for (const colorScheme of ['light', 'dark']) {
  for (const vp of VIEWPORTS) {
    for (const [name, path] of ROUTES) {
      const { name: _vpName, width, height, ...device } = vp;
      const ctx = await browser.newContext({ ...device, viewport: { width, height }, locale: 'ar-JO', colorScheme });
      await ctx.addInitScript((who) => {
        localStorage.setItem('@iqra_language', 'ar');
        localStorage.setItem('@iqra_intro_seen_v1', '1');
        localStorage.setItem('iqra_access_token', 'fake');
        localStorage.setItem('iqra_refresh_token', 'fake');
        localStorage.setItem('@iqra_user_snapshot_v1', JSON.stringify(who));
      }, teacher);
      await ctx.route('**/api/**', (route) => {
        const p = new URL(route.request().url()).pathname.replace(/^\/api/, '');
        // /library is a list too (resources.tsx maps it) though its path does not end in s
        const body = p === '/auth/me' ? teacher : (/s$/.test(p) || p === '/library') ? [] : {};
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      });
      const page = await ctx.newPage();
      try {
        await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 });
        // AppSplash stays >= MIN_VISIBLE_MS (800), fades FADE_OUT_MS (280), then unmounts
        const splash = page.locator('[role="progressbar"][aria-label="Iqrra"]');
        await splash.waitFor({ state: 'attached', timeout: 3000 }).catch(() => {});
        await splash.waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(500);
        const stuck = (await splash.count()) > 0;
        await page.screenshot({ path: `${OUT}/${colorScheme}-${vp.name}-${name}.png` });
        console.log(`${colorScheme} ${vp.name} ${name}${stuck ? ' SPLASH' : ''}`);
      } catch (e) {
        console.log(`${colorScheme} ${vp.name} ${name} FAILED ${String(e.message).slice(0, 80)}`);
      }
      await ctx.close();
    }
  }
}
await browser.close();
