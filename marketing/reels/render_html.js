// Renders every .o element of an HTML file to a transparent PNG (ids starting with "end" / "bg" are opaque).
//   node render_html.js <file.html> <out dir> <viewport w> <viewport h>
const { chromium } = require('/opt/node-tools/node_modules/playwright');
const path = require('path'), fs = require('fs');
const [file, outDir, w, h] = process.argv.slice(2);
(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }).catch(() => chromium.launch());
  const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.resolve(file));
  await page.evaluate(() => document.fonts.ready);
  const f = await page.evaluate(() => ({ cairo: document.fonts.check('900 40px Cairo'), almarai: document.fonts.check('800 40px Almarai') }));
  if (!f.cairo || !f.almarai) throw new Error('brand fonts did not load');
  fs.mkdirSync(outDir, { recursive: true });
  const ids = await page.evaluate(() => [...document.querySelectorAll('.o')].map(e => e.id));
  for (const id of ids) {
    await page.evaluate(keep => document.querySelectorAll('.o').forEach(e => { e.style.display = e.id === keep ? '' : 'none'; }), id);
    const el = await page.$('#' + id);
    await el.screenshot({ path: path.join(outDir, id + '.png'), omitBackground: !/^(end|bg)/.test(id) });
    const b = await el.boundingBox();
    console.log(id, Math.round(b.width) + 'x' + Math.round(b.height));
  }
  await browser.close();
})();
