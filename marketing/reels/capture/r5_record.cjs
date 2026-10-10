// Reel 5 take («سؤال الحصة»): the library worksheet «تركيب الاقترانات» -> its multiple-choice question
// (f(x)=x², g(x)=x+1, find (f∘g)(2)) held on screen -> scroll to «مفتاح الإجابات» and hold on row 6.
// Demo account on a throwaway local DB. The key is a `bank` key (computed with the question, not
// proved by the verifier) — the reel never calls it «verified».
const { launch, APP } = require('./common.cjs');
const { Recorder, Pointer, sleep } = require('./rec.cjs');

async function rects(page) {
  return page.evaluate(() => {
    const leaves = [...document.querySelectorAll('div,span')].filter(e => !e.children.length)
      .map(e => ({ t: (e.textContent || '').trim(), r: e.getBoundingClientRect() }));
    const R = o => o && { x: o.r.x, y: o.r.y, w: o.r.width, h: o.r.height };
    const q = leaves.find(l => /^إذا كان f\(x\) = x² − 1، أوجد f\(3\)\.$/.test(l.t));          // the MCQ stem
    const opts = q ? leaves.filter(l => ['8', '9', '2', '−1'].includes(l.t) && l.r.y > q.r.y && l.r.y < q.r.y + 130) : [];
    const head = leaves.find(l => l.t === 'مفتاح الإجابات');
    const two = head && leaves.find(l => l.t === '2.' && l.r.x > 300 && l.r.y > head.r.y && l.r.height < 30);   // key row 2 (global numbering)
    const keyEight = two && leaves.find(l => l.t === '8' && Math.abs(l.r.y - two.r.y) < 6);
    return { q: R(q), opts: opts.map(o => ({ t: o.t, ...R(o) })), two: R(two), keyEight: R(keyEight), head: R(head) };
  });
}
async function scrollTo(page, rec, target, ms) {
  const cur = await page.evaluate(() => { const e = [...document.querySelectorAll('*')].find(x => x.scrollHeight > x.clientHeight + 50 && getComputedStyle(x).overflowY !== 'visible'); return e ? e.scrollTop : 0; });
  const dy = target - cur, steps = Math.round(ms / 16); let done = 0;
  await page.mouse.move(195, 480);
  for (let i = 1; i <= steps; i++) {
    const k = i / steps, e = k * k * (3 - 2 * k), want = dy * e, d = want - done; done = want;
    await page.mouse.wheel(0, d); await sleep(16);
  }
}
(async () => {
  const { browser, ctx, page } = await launch({ dsf: 2, forceScale: 2, storageState: 'state/r2.json' });
  await page.goto(APP + '/', { waitUntil: 'networkidle' }); await sleep(2000);
  await page.getByText('المكتبة', { exact: true }).last().click(); await sleep(2000);       // off camera: reach the sheet
  await page.locator('input').first().fill('تركيب الاقترانات'); await sleep(1200);
  await page.getByText('افتح', { exact: true }).first().click(); await sleep(2800);
  const rec = new Recorder(page, 'takes/_frames_r5', { maxW: 780, maxH: 1688 });
  await rec.start();
  const mark = l => rec.log('mark', { label: l });
  const abs0 = await rects(page);                       // absolute positions (scrollTop is 0 here)
  console.log('abs', JSON.stringify(abs0));
  mark('sheet_top'); await sleep(900);
  await scrollTo(page, rec, Math.max(0, abs0.q.y - 300), 1500); await sleep(400);
  mark('question');
  const a = await rects(page); rec.log('rects', { name: 'question', ...a }); console.log('question view', JSON.stringify(a));
  await sleep(7200); mark('question_hold_end');                                              // read + think + countdown
  await scrollTo(page, rec, abs0.head.y - 200, 1900); await sleep(400);
  mark('key');
  const b = await rects(page); rec.log('rects', { name: 'key', ...b }); console.log('key view', JSON.stringify(b));
  await sleep(4200); mark('end');
  console.log(await rec.stop('r5_quiz'));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
