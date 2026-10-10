// Reel 2 take: open the library, search for the lesson, open the worksheet, scroll it.
// Teacher «سلمى» (fictional), demo account — nothing here is sent anywhere.
const { launch, APP } = require('./common.cjs');
const { Recorder, Pointer, sleep } = require('./rec.cjs');
(async () => {
  const { browser, ctx, page } = await launch({ dsf: 2, forceScale: 2, storageState: 'state/r2.json' });
  await page.goto(APP + '/', { waitUntil: 'networkidle' });
  await sleep(2500);
  const rec = new Recorder(page, 'takes/_frames_r2', { maxW: 780, maxH: 1688 });
  await rec.start();
  const ptr = new Pointer(page, rec);
  const mark = l => rec.log('mark', { label: l });

  mark('home'); await sleep(900);
  await ptr.tapOn(page.getByText('المكتبة', { exact: true }).last(), 700); mark('tap_library');
  await sleep(1800); mark('library_shown');
  await ptr.tapOn(page.locator('input').first(), 650); mark('tap_search');
  await sleep(350);
  await page.keyboard.type('تركيب الاقترانات', { delay: 120 }); mark('typed');
  await sleep(1700); mark('results');
  await ptr.tapOn(page.getByText('افتح', { exact: true }).first(), 650); mark('tap_open');
  await sleep(2200); mark('opened');
  await sleep(900);
  await ptr.scroll(330, 1500, 195, 520); mark('scrolled_q'); await sleep(1100);
  await ptr.scroll(620, 1900, 195, 520); mark('scrolled_more'); await sleep(900);
  await ptr.scroll(900, 2200, 195, 520); mark('scrolled_key'); await sleep(1300);
  await ptr.scroll(700, 1800, 195, 520); mark('scrolled_figs'); await sleep(3800);
  console.log(await rec.stop('r2_library'));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
