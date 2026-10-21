// Helpers for walking the worksheet screen: find text by its position, scroll a heading to a chosen y.
const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Rects (CSS px, current scroll) of the deepest element whose text matches each pattern (strings are exact, RegExps are tested). */
async function find(page, pats) {
  return page.evaluate(src => {
    const pats = src.map(([k, v, f]) => [k, f ? new RegExp(v) : v]);
    const els = [...document.querySelectorAll('div,span,p,h1,h2,h3')];
    const out = {};
    for (const [k, p] of pats) {
      const ok = e => { const t = (e.textContent || '').replace(/\s+/g, ' ').trim(); return p instanceof RegExp ? p.test(t) : t === p; };
      const hits = els.filter(e => ok(e) && ![...e.children].some(ok)).map(e => e.getBoundingClientRect()).filter(r => r.width > 0 && r.height > 0);
      out[k] = hits.map(r => ({ x: +r.x.toFixed(1), y: +r.y.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1) }));
    }
    return out;
  }, pats.map(([k, v]) => [k, v instanceof RegExp ? v.source : v, v instanceof RegExp]));
}

async function scroller(page) {
  return page.evaluate(() => {
    const e = [...document.querySelectorAll('*')].find(x => x.scrollHeight > x.clientHeight + 50 && getComputedStyle(x).overflowY !== 'visible' && x.clientWidth > 300);
    return e ? e.scrollTop : 0;
  });
}

/** Smooth wheel scroll to an absolute scrollTop over `ms`. */
async function scrollTo(page, target, ms) {
  const cur = await scroller(page);
  const dy = target - cur, steps = Math.max(2, Math.round(ms / 16)); let done = 0;
  await page.mouse.move(195, 480);
  for (let i = 1; i <= steps; i++) {
    const k = i / steps, e = k * k * (3 - 2 * k), want = dy * e, d = want - done; done = want;
    await page.mouse.wheel(0, d); await sleep(16);
  }
  await sleep(150);
}

module.exports = { find, scroller, scrollTo, sleep };
