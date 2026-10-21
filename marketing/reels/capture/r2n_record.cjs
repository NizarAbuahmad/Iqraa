// Reel 2 (re-recorded, new sheet): library -> search the lesson -> open the worksheet -> walk its sections.
// Demo account on a throwaway local DB. The sheet is the regenerated «تركيب الاقترانات» manifest entry.
const { launch, APP } = require('./common.cjs');
const { Recorder, Pointer } = require('./rec.cjs');
const { find, scroller, scrollTo, sleep } = require('./sheetnav.cjs');

(async () => {
  const { browser, page } = await launch({ dsf: 2, forceScale: 2, storageState: 'state/r2.json' });
  await page.goto(APP + '/', { waitUntil: 'networkidle' });
  await sleep(2500);
  const rec = new Recorder(page, 'takes/_frames_r2n', { maxW: 780, maxH: 1688 });
  await rec.start();
  const ptr = new Pointer(page, rec);
  const mark = l => rec.log('mark', { label: l });

  mark('home'); await sleep(800);
  await ptr.tapOn(page.getByText('المكتبة', { exact: true }).last(), 700); mark('tap_library');
  await sleep(1500); mark('library_shown');
  await ptr.tapOn(page.locator('input').first(), 600); mark('tap_search');
  await sleep(300);
  await page.keyboard.type('تركيب الاقترانات', { delay: 110 }); mark('typed');
  await sleep(1500); mark('results');
  await ptr.tapOn(page.getByText('افتح', { exact: true }).first(), 650); mark('tap_open');
  await sleep(2000); mark('opened');
  await sleep(700);

  // absolute positions of the section headings (scrollTop is 0 here)
  const abs = await find(page, [
    ['worked', 'مثال محلول'], ['half', 'مثال نكمله'], ['easy', /^أ\) تمارين تمهيدية/], ['mid', /^ب\) تمارين صفية/], ['key', 'مفتاح الإجابات'],
  ]);
  console.log('abs', JSON.stringify(abs));
  const y = k => abs[k][0].y;
  const stops = [['worked', 120, 2600], ['half', 120, 2300], ['easy', 120, 2500], ['key', 120, 3200]];
  for (const [k, off, hold] of stops) {
    await scrollTo(page, Math.max(0, y(k) - off), 1300); mark('at_' + k);
    const st = await scroller(page); rec.log('rects', { name: k, scrollTop: st, ...await find(page, [['h', k === 'worked' ? 'مثال محلول' : k === 'half' ? 'مثال نكمله' : k === 'easy' ? /^أ\) تمارين تمهيدية/ : 'مفتاح الإجابات']]) });
    await sleep(hold);
  }
  console.log(await rec.stop('r2n_library'));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
