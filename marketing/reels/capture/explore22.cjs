const { launch, APP } = require('./common.cjs');
const { sleep } = require('./rec.cjs');
(async () => {
  const { browser, ctx, page } = await launch({ dsf: 2, forceScale: 2, storageState: 'state/r2.json' });
  await page.goto(APP + '/', { waitUntil: 'networkidle' }); await sleep(2000);
  await page.getByText('المكتبة', { exact: true }).last().click(); await sleep(2000);
  await page.locator('input').first().fill('تركيب الاقترانات'); await sleep(1200);
  await page.getByText('افتح', { exact: true }).first().click(); await sleep(2500);
  // find the second (MCQ) composition question
  const info = await page.evaluate(() => {
    const out = [];
    const all = [...document.querySelectorAll('div,span')];
    for (const e of all) {
      if (e.children.length) continue;
      const t = (e.textContent || '').trim();
      if (/\(f∘g\)\(2\)/.test(t) || ['5','4','3','9'].includes(t) || /^6\.$/.test(t) || t === 'مفتاح الإجابات') {
        const r = e.getBoundingClientRect();
        out.push([t.slice(0, 40), Math.round(r.x), Math.round(r.y + window.scrollY), Math.round(r.width), Math.round(r.height)]);
      }
    }
    return out;
  });
  console.log(JSON.stringify(info));
  const sc = await page.evaluate(() => { const els=[...document.querySelectorAll('*')].filter(e=>e.scrollHeight>e.clientHeight+50&&getComputedStyle(e).overflowY!=='visible'); return els.map(e=>[e.tagName,e.className.slice(0,30),e.scrollHeight,e.clientHeight]); });
  console.log(JSON.stringify(sc));
  await browser.close();
})();
