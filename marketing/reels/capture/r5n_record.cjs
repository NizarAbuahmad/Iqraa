// Reel 5 (re-recorded, new sheet): «سؤال الحصة». The question is item 1 of «أ) تمارين تمهيدية (سهل)»:
//   إذا كان f(x) = x² − 1، أوجد f(3).      key: 8, with three lines of working.
// A short-answer item, on purpose: the multiple-choice item next to it has a stem whose Arabic «و» reads as a
// "9" beside Latin maths, and 9 is one of its options. The key is a `bank` key (computed with the question, not
// proved by the verifier) — the reel never calls it «verified».
const { launch, APP } = require('./common.cjs');
const { Recorder } = require('./rec.cjs');
const { find, scroller, scrollTo, sleep } = require('./sheetnav.cjs');

const Q = /^إذا كان f\(x\) = x² − 1، أوجد f\(3\)\./;
const S1 = /نعوّض x = 3 في f\(x\) = x² − 1/, S2 = /f\(3\) = 3² − 1 = 9 − 1/, S3 = /إذن f\(3\) = 8/;

(async () => {
  const { browser, page } = await launch({ dsf: 2, forceScale: 2, storageState: 'state/r2.json' });
  await page.goto(APP + '/', { waitUntil: 'networkidle' }); await sleep(2000);
  await page.getByText('المكتبة', { exact: true }).last().click(); await sleep(2000);          // off camera: reach the sheet
  await page.locator('input').first().fill('تركيب الاقترانات'); await sleep(1200);
  await page.getByText('افتح', { exact: true }).first().click(); await sleep(2800);
  const abs = await find(page, [['q', Q], ['head', 'مفتاح الإجابات'], ['s1', S1], ['s2', S2], ['s3', S3], ['eight', '8']]);
  console.log('abs', JSON.stringify(abs));
  const rec = new Recorder(page, 'takes/_frames_r5n', { maxW: 780, maxH: 1688 });
  await rec.start();
  const mark = l => rec.log('mark', { label: l });
  mark('sheet_top'); await sleep(700);
  await scrollTo(page, Math.max(0, abs.q[0].y - 330), 1500); mark('question');
  rec.log('rects', { name: 'question', scrollTop: await scroller(page), ...await find(page, [['q', Q]]) });
  await sleep(7000); mark('question_hold_end');                                               // read + think + countdown
  await scrollTo(page, abs.head[0].y - 190, 1800); mark('key');
  const k = await find(page, [['head', 'مفتاح الإجابات'], ['s1', S1], ['s2', S2], ['s3', S3], ['eight', '8']]);
  rec.log('rects', { name: 'key', scrollTop: await scroller(page), ...k }); console.log('key view', JSON.stringify(k));
  await sleep(5200); mark('end');
  console.log(await rec.stop('r5n_quiz'));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
