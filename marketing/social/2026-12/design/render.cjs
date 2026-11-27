// Renders every .page in posts.html to ../out/<id>.png with Chrome, so Arabic is
// shaped and ordered by a browser. Usage: node design/render.cjs [id-prefix]
const path = require('path');
const { chromium } = require('playwright');

(async () => {
  const only = process.argv[2] || '';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 2000 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(__dirname, 'posts.html'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  const ids = await page.$$eval('.page', (els) => els.map((e) => e.id));
  for (const id of ids) {
    if (only && !id.startsWith(only)) continue;
    await page.locator('#' + id).screenshot({ path: path.join(__dirname, '..', 'out', id + '.png') });
    console.log('out/' + id + '.png');
  }
  await browser.close();
})();
