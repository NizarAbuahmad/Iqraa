// Renders every cover in covers.html at its exact pixel size, once clean and
// once with the safe-zone guides drawn on, into out/.
//
//   node marketing/social-covers/build.mjs
//
// Fails if any cover's copy or logo spills outside its content box, which is
// placed inside that platform's safe zone and clear of its avoid zones.
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const brand = readFileSync(join(here, '../../artifacts/mobile/constants/brandMark.ts'), 'utf8');
const wordmark = brand.match(/WORDMARK_PATH =\s*'([^']+)'/)[1];
const out = join(here, 'out');
mkdirSync(out, { recursive: true });

const FILES = {
  facebook: 'iqrra-facebook-cover-1640x624',
  youtube: 'iqrra-youtube-banner-2560x1440',
  linkedin_company: 'iqrra-linkedin-company-2256x382',
  linkedin_profile: 'iqrra-linkedin-profile-1584x396',
};

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
await page.addInitScript((d) => { window.WORDMARK_PATH = d; }, wordmark);
const url = pathToFileURL(join(here, 'covers.html')).href;

let failed = false;
for (const [name, file] of Object.entries(FILES)) {
  for (const guides of [false, true]) {
    await page.goto(`${url}?c=${name}&guides=${guides ? 1 : 0}`);
    await page.evaluate(() => document.fonts.ready);
    const { w, h, spill } = await page.evaluate((n) => {
      const s = window.SPECS[n];
      const box = document.querySelector('.content').getBoundingClientRect();
      const spill = [...document.querySelectorAll('.content svg, .content .tag, .content .sub, .content .meta, .content .cta, .content .en')]
        .map((e) => [e.className.baseVal ?? e.className, e.getBoundingClientRect()])
        .filter(([, r]) => r.left < box.left - 0.5 || r.right > box.right + 0.5 || r.top < box.top - 0.5 || r.bottom > box.bottom + 0.5)
        .map(([k, r]) => `${k || 'logo'} ${Math.round(r.left)},${Math.round(r.top)}–${Math.round(r.right)},${Math.round(r.bottom)}`);
      return { w: s.w, h: s.h, spill };
    }, name);
    if (spill.length) { failed = true; console.error(`${name}: outside content box: ${spill.join('; ')}`); }
    await page.setViewportSize({ width: w, height: h });
    const path = join(out, `${file}${guides ? '-guides' : ''}.png`);
    await page.locator('#cover').screenshot({ path });
    console.log(path);
  }
}
await browser.close();
if (failed) process.exit(1);
