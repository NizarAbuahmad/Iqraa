// Reel 10 take: «ألعاب إقرأ» — the public games hub (no login), then the element-symbols game answered
// correctly, question by question, to the result screen. The answer for each question is looked up in the
// game's own data (services/publicGames/elements.ts), so every tap is a correct one.
const fs = require('fs');
const { launch, APP } = require('./common.cjs');
const { Recorder, Pointer } = require('./rec.cjs');
const { sleep } = require('./sheetnav.cjs');

const src = fs.readFileSync(__dirname + '/../../../artifacts/mobile/services/publicGames/elements.ts', 'utf8');
const ELEMENTS = [...src.matchAll(/\{ symbol: '(\w+)', nameAr: '([^']+)'/g)].map(m => ({ symbol: m[1], nameAr: m[2] }));

async function goto(page, u) {
  for (let i = 0; i < 3; i++) { try { await page.goto(APP + u, { waitUntil: 'load', timeout: 30000 }); return; } catch (e) { if (i === 2) throw e; } }
}
const leaves = page => page.evaluate(() => [...document.querySelectorAll('div,span')].filter(e => !e.children.length)
  .map(e => (e.textContent || '').trim()).filter(Boolean));

(async () => {
  const { browser, page } = await launch({ dsf: 2, forceScale: 2, storageState: 'state/r2.json' });
  await goto(page, '/play'); await sleep(2500);
  const rec = new Recorder(page, 'takes/_frames_r10', { maxW: 780, maxH: 1688 });
  await rec.start();
  const ptr = new Pointer(page, rec);
  const mark = l => rec.log('mark', { label: l });

  mark('hub'); await sleep(1700);
  await ptr.tapOn(page.getByText('رموز العناصر', { exact: true }).first(), 650); mark('tap_game');
  await sleep(1300);
  for (let q = 1; q <= 8; q++) {
    mark('q' + q);
    const texts = await leaves(page);
    const asksName = texts.some(t => t.includes('ما اسم هذا العنصر'));
    const el = ELEMENTS.find(e => asksName ? texts.includes(e.symbol) : texts.includes(e.nameAr));
    if (!el) throw new Error('no element found on q' + q + ': ' + texts.slice(0, 20).join('|'));
    const answer = asksName ? el.nameAr : el.symbol;
    console.log('q' + q, asksName ? 'symbol' : 'name', el.symbol, el.nameAr, '->', answer);
    await sleep(q === 1 ? 900 : 350);
    await ptr.tapOn(page.getByText(answer, { exact: true }).last(), q === 1 ? 600 : 380); mark('a' + q);
    await sleep(650);                                              // the ✓ shows
    const next = page.getByText(/^(التالي|النتيجة|إنهاء)$/).last();
    if (await next.count()) { await ptr.tapOn(next, 320); }
    await sleep(q === 8 ? 1200 : 250);
  }
  mark('result'); await sleep(3200);
  console.log(await rec.stop('r10_games'));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
