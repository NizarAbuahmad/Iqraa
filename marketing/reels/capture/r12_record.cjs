// Reel 12 take: «المنهاج» — Library tab -> «المنهاج» -> الرياضيات -> الفصل الثاني -> الاقترانات -> «تركيب الاقترانات»
// -> the lesson page (actions, book figures with page numbers, objectives). A teacher-uploaded file card on that page
// carries a real person's name; it is blurred in the take.
const { launch, APP } = require('./common.cjs');
const { Recorder, Pointer } = require('./rec.cjs');
const { find, scroller, scrollTo, sleep } = require('./sheetnav.cjs');

async function goto(page, u) {
  for (let i = 0; i < 3; i++) { try { await page.goto(APP + u, { waitUntil: 'load', timeout: 30000 }); return; } catch (e) { if (i === 2) throw e; } }
}
(async () => {
  const { browser, page } = await launch({ dsf: 2, forceScale: 2, storageState: 'state/r2.json' });
  await goto(page, '/'); await sleep(3000);
  const rec = new Recorder(page, 'takes/_frames_r12', { maxW: 780, maxH: 1688 });
  await rec.start();
  const ptr = new Pointer(page, rec);
  const mark = l => rec.log('mark', { label: l });

  mark('home'); await sleep(700);
  await ptr.tapOn(page.getByText('المكتبة', { exact: true }).last(), 650); mark('tap_library'); await sleep(1700);
  await ptr.tapOn(page.getByText('المنهاج', { exact: true }).first(), 650); mark('tap_curriculum'); await sleep(2200);
  mark('browse'); await sleep(900);
  await ptr.tapOn(page.getByText('الرياضيات', { exact: true }).last(), 650); mark('tap_subject'); await sleep(1900);
  await ptr.tapOn(page.getByText('الفصل الثاني', { exact: true }).last(), 600); mark('tap_semester'); await sleep(1900);
  await ptr.tapOn(page.getByText('الاقترانات', { exact: true }).last(), 600); mark('tap_unit'); await sleep(1900);
  await ptr.tapOn(page.getByText('تركيب الاقترانات', { exact: true }).last(), 600); mark('tap_lesson'); await sleep(2400);
  // privacy: blur the uploader's name wherever it is rendered
  await page.evaluate(() => { for (const e of document.querySelectorAll('div,span')) if (!e.children.length && /الخمايسة/.test(e.textContent || '')) e.style.filter = 'blur(7px)'; });
  mark('lesson'); await sleep(1800);
  const abs = await find(page, [['book', 'من الكتاب المدرسي'], ['goals', 'الأهداف التعليمية']]);
  console.log('abs', JSON.stringify(abs));
  await scrollTo(page, abs.book[0].y - 120, 1500); mark('book'); await sleep(2600);
  await scrollTo(page, abs.goals[0].y - 120, 1500); mark('goals'); await sleep(3000);
  console.log(await rec.stop('r12_curriculum'));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
