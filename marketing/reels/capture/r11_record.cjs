// Reel 11 take: «الحصة التفاعلية» — Tools tab -> the activity catalogue (7 activities) -> «تحقق سريع» -> set it up
// (lesson, group, goal) -> «جهّز النشاط» -> «النشاط جاهز للعرض». Demo account; the content is demo-mode (the app says so).
const { launch, APP } = require('./common.cjs');
const { Recorder, Pointer } = require('./rec.cjs');
const { find, scroller, scrollTo, sleep } = require('./sheetnav.cjs');

const vis = (page, t) => page.locator(`text="${t}" >> visible=true`).first();

async function goto(page, u) {
  for (let i = 0; i < 3; i++) { try { await page.goto(APP + u, { waitUntil: 'load', timeout: 30000 }); return; } catch (e) { if (i === 2) throw e; } }
}
let PAGE;
(async () => {
  const { browser, page } = await launch({ dsf: 2, forceScale: 2, storageState: 'state/r2.json' });
  PAGE = page;
  await goto(page, '/'); await sleep(3000);
  const rec = new Recorder(page, 'takes/_frames_r11', { maxW: 780, maxH: 1688 });
  await rec.start();
  const ptr = new Pointer(page, rec);
  const mark = l => rec.log('mark', { label: l });

  mark('home'); await sleep(700);
  await ptr.tapOn(vis(page, 'الأدوات'), 650); mark('tap_tools'); await sleep(1500);
  await ptr.tapOn(vis(page, 'الحصة التفاعلية'), 600); mark('tap_classroom'); await sleep(2200);
  mark('catalogue'); await sleep(900);
  await scrollTo(page, 330, 1500); mark('list_a'); await sleep(1300);
  await scrollTo(page, 640, 1500); mark('list_b'); await sleep(1100);
  await scrollTo(page, 0, 1300); await sleep(500);
  await ptr.tapOn(vis(page, 'تحقق سريع'), 700); mark('tap_activity'); await sleep(2200);
  mark('form');
  await sleep(600);
  await ptr.tapOn(vis(page, 'اختر الوحدة'), 600); await sleep(700);
  await page.mouse.move(195, 560); await page.mouse.wheel(0, 220); await sleep(600);
  await ptr.tapOn(vis(page, 'الاقترانات'), 500); mark('unit'); await sleep(1100);
  await ptr.tapOn(page.locator('text="اختر الدرس" >> visible=true').last(), 500); await sleep(700);
  await vis(page, 'تركيب الاقترانات').scrollIntoViewIfNeeded(); await sleep(300);
  await ptr.tapOn(vis(page, 'تركيب الاقترانات'), 500); mark('lesson'); await sleep(800);
  await scrollTo(page, 260, 1000); await sleep(300);
  await ptr.tapOn(vis(page, 'كل الصف'), 500); mark('group'); await sleep(500);
  await ptr.tapOn(vis(page, 'مراجعة'), 500); mark('goal'); await sleep(700);
  await scrollTo(page, 900, 900); await sleep(400);
  await ptr.tapOn(vis(page, 'جهّز النشاط'), 600); mark('tap_prepare');
  await sleep(2500); mark('ready');
  await scrollTo(page, (await scroller(page)) + 330, 1100); mark('ready_scrolled'); await sleep(3200);
  console.log(await rec.stop('r11_interactive'));
  await browser.close();
})().catch(async e => { console.error(e.message.slice(0, 200)); try { await PAGE.screenshot({ path: '/tmp/r11_fail.png' }); } catch (_) {} process.exit(1); });
