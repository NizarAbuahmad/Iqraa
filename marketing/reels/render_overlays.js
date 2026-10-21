// Renders each element of overlays.html to a transparent PNG with Chromium.
// Arabic must be shaped by a browser, never by ffmpeg drawtext (see ../tutorial/README.md).
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path = require('path');

// every .o element in overlays.html; ids starting with 'end' are opaque full-frame cards
let IDS;

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(
    () => chromium.launch());
  const page = await browser.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(__dirname, 'overlays.html'));
  await page.evaluate(() => document.fonts.ready);
  const fonts = await page.evaluate(() => ({
    cairo: document.fonts.check('900 40px Cairo'), almarai: document.fonts.check('700 40px Almarai'),
  }));
  console.log('fonts loaded:', JSON.stringify(fonts));
  if (!fonts.cairo || !fonts.almarai) throw new Error('brand fonts did not load');
  IDS = await page.evaluate(() => [...document.querySelectorAll('.o')].map(e => e.id));
  for (const id of IDS) {
    await page.evaluate((keep) => document.querySelectorAll('.o').forEach(e => { e.style.display = e.id === keep ? '' : 'none'; }), id);
    const el = await page.$('#' + id);
    const out = path.join(__dirname, 'overlays', id + '.png');
    await el.screenshot({ path: out, omitBackground: !id.startsWith('end') });
    const box = await el.boundingBox();
    console.log(id, Math.round(box.width) + 'x' + Math.round(box.height));
  }
  await browser.close();
})();
