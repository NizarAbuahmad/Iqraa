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
  gradeIds: ['grade-10'], subjectIds: ['mathematics'], rosterConsentAt: '2026-01-01T00:00:00Z',
};

// Two classes of different subjects, so the classes list shows its subject-coloured tiles.
const CLASSES = [
  { id: 'c1', name: 'Grade 10 A', nameAr: 'العاشر أ', gradeId: 'grade-10', subjectId: 'mathematics', subjectIds: ['mathematics'], academicYear: '2026', createdAt: '2026-01-01T00:00:00Z', studentCount: 24 },
  { id: 'c2', name: 'Grade 10 B', nameAr: 'العاشر ب', gradeId: 'grade-10', subjectId: 'chemistry', subjectIds: ['chemistry'], academicYear: '2026', createdAt: '2026-01-01T00:00:00Z', studentCount: 18 },
  { id: 'c3', name: 'Grade 9 A', nameAr: 'التاسع أ', gradeId: 'grade-9', subjectId: 'english', subjectIds: ['english'], academicYear: '2026', createdAt: '2026-01-01T00:00:00Z', studentCount: 21 },
];

const ROUTES = [
  ['library', '/curriculum/resources'],
  ['math-hub', '/curriculum/math'],
  ['math-grapher', '/curriculum/math/grapher'],
  ['lab-hub', '/curriculum/lab'],
  ['lab-item', '/curriculum/lab/lab-periodic-table'],
  ['quran-hub', '/curriculum/quran'],
  ['quran-surah', '/curriculum/quran/1'],
  ['english-hub', '/curriculum/english?grade=1'],
  ['english-lesson', '/curriculum/english/kbl-g1-eng-s1-nccd-u0_l1'],
  ['play-hub', '/play'],
  ['play-flags', '/play/flags'],
  ['profile', '/profile'],
  ['today', '/'],
  ['tools', '/ai-tools'],
  ['plans', '/teaching-plans'],
  ['evaluations', '/evaluations'],
  ['settings', '/settings'],
  ['classes', '/classes'],
  ['quiz-tool', '/ai-tools/quiz'],
  ['slides-tool', '/ai-tools/slides'],
];
// ONLY=library,profile shoots a subset. REDUCED=1 emulates prefers-reduced-motion
// and shoots as soon as the splash is gone: with reduced motion nothing may still
// be on its way in, so a card caught half-faded there is a bug.
const ONLY = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;
const REDUCED = process.env.REDUCED === '1';
// SCROLL=900 wheels the page down that many px before the shot, for what sits below the fold.
const SCROLL = Number(process.env.SCROLL ?? 0);
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
      if (ONLY && !ONLY.has(name)) continue;
      const { name: _vpName, width, height, ...device } = vp;
      const ctx = await browser.newContext({
        ...device, viewport: { width, height }, locale: 'ar-JO', colorScheme,
        reducedMotion: REDUCED ? 'reduce' : 'no-preference',
      });
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
        // A few endpoints wrap their list; the rest are bare lists (/…s, /library) or objects.
        const SHAPED = { '/auth/me': teacher, '/schedule': { periods: [], slots: [] }, '/classes': { classes: CLASSES }, '/evaluations': { evaluations: [] }, '/teaching-plans': { plans: [] } };
        const body = p in SHAPED ? SHAPED[p] : (/s$/.test(p) || p === '/library') ? [] : {};
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      });
      const page = await ctx.newPage();
      try {
        await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 });
        // AppSplash stays >= MIN_VISIBLE_MS (800), fades FADE_OUT_MS (280), then unmounts
        const splash = page.locator('[role="progressbar"][aria-label="Iqrra"]');
        await splash.waitFor({ state: 'attached', timeout: 3000 }).catch(() => {});
        await splash.waitFor({ state: 'detached', timeout: 15000 }).catch(() => {});
        // Entrance staggers up to 6 × 40ms + 220ms; 500ms covers it. Reduced motion gets no wait.
        if (!REDUCED) await page.waitForTimeout(500);
        const stuck = (await splash.count()) > 0;
        if (SCROLL) {
          await page.mouse.move(width / 2, height / 2);
          await page.mouse.wheel(0, SCROLL);
          await page.waitForTimeout(400);
        }
        await page.screenshot({ path: `${OUT}/${REDUCED ? 'reduced-' : ''}${colorScheme}-${vp.name}-${name}${SCROLL ? '-scrolled' : ''}.png` });
        console.log(`${colorScheme} ${vp.name} ${name}${stuck ? ' SPLASH' : ''}`);
      } catch (e) {
        console.log(`${colorScheme} ${vp.name} ${name} FAILED ${String(e.message).slice(0, 80)}`);
      }
      await ctx.close();
    }
  }
}
await browser.close();
