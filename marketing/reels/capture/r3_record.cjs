// Reel 3 take: classes overview -> add a class -> add its students -> back to the overview -> open the class.
// Fictional teacher «سلمى», first-name-only fictional students; the local demo DB only.
const { launch, APP } = require('./common.cjs');
const { Recorder, Pointer, sleep } = require('./rec.cjs');
const S = require('./seed.cjs');
(async () => {
  S.sql("delete from class_groups where name='العاشر رياضيات أ'");          // re-runnable
  const { browser, ctx, page } = await launch({ dsf: 2, forceScale: 2, storageState: 'state/r3.json' });
  await page.goto(APP + '/classes', { waitUntil: 'networkidle' });
  await sleep(2500);
  const rec = new Recorder(page, 'takes/_frames_r3', { maxW: 780, maxH: 1688 });
  await rec.start();
  const ptr = new Pointer(page, rec);
  const mark = l => rec.log('mark', { label: l });
  const name = 'العاشر رياضيات أ';

  mark('overview'); await sleep(1300);
  await ptr.move(210, 300, 600); await sleep(250);          // over the first class card
  await ptr.move(210, 372, 500); await sleep(450);          // over the second
  mark('value_done');
  await ptr.tapOn(page.getByText('شعبة جديدة', { exact: true }).last(), 800); mark('tap_new');
  await sleep(900);
  await ptr.tapOn(page.locator('input').first(), 600); mark('tap_name'); await sleep(250);
  await page.keyboard.type(name, { delay: 70 }); mark('typed_name'); await sleep(450);
  await ptr.tapOn(page.getByText('الكيمياء', { exact: true }).last(), 600); mark('chip_off'); await sleep(500);
  await ptr.tapOn(page.getByText('أنشئ الشعبة', { exact: true }), 600); mark('created');
  await sleep(1100);
  await ptr.tapOn(page.getByText('أضف طلبةً', { exact: true }).first(), 600); mark('tap_add'); await sleep(700);
  await ptr.tapOn(page.locator('textarea').first(), 500); await sleep(250);
  await page.keyboard.type('لمى\nآدم\nجود\nنور', { delay: 55 }); mark('typed_students'); await sleep(500);
  await ptr.tapOn(page.getByText('أضف إلى الشعبة', { exact: true }), 600); mark('added');
  await sleep(1300);
  await ptr.tap(358, 24, 700); mark('back');
  await sleep(1300); mark('overview_new');
  await ptr.tapOn(page.getByText(name, { exact: true }).first(), 700); mark('open');
  await sleep(1800); mark('opened');
  await ptr.scroll(260, 1400, 195, 520); mark('scrolled'); await sleep(1500);
  console.log(await rec.stop('r3_classes'));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
