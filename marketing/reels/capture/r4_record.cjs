// Reel 4 take: the الرسائل inbox -> the two ways to write (group / new message) -> a reminder to the class group
// -> a message to a parent. DEMO ENVIRONMENT ONLY: a throwaway local database, fictional accounts, no real users.
const { launch, APP } = require('./common.cjs');
const { Recorder, Pointer, sleep } = require('./rec.cjs');
const S = require('./seed.cjs');
const CLASS_MSG = 'صباح الخير 🌷 تذكير: حضّروا كتاب العلوم لحصة بكرا.';
const PARENT_MSG = 'مساء الخير، نشاط القراءة لهذا الأسبوع موجود في الصف. شكرًا لمتابعتكم.';
(async () => {
  // re-runnable: clear any messages / direct threads from an earlier take (the class group itself stays)
  S.sql("delete from chat_messages");
  S.sql("delete from chat_threads where type <> 'class_group'");
  const { browser, ctx, page } = await launch({ dsf: 2, forceScale: 2, storageState: 'state/r4.json' });
  await page.goto(APP + '/notifications', { waitUntil: 'networkidle' });
  await sleep(2500);
  const rec = new Recorder(page, 'takes/_frames_r4', { maxW: 780, maxH: 1688 });
  await rec.start();
  const ptr = new Pointer(page, rec);
  const mark = l => rec.log('mark', { label: l });

  mark('inbox'); await sleep(1500);
  await ptr.move(300, 130, 700); await sleep(350);                       // toward the two buttons
  await ptr.tapOn(page.getByText('رسالة جديدة', { exact: true }).first(), 650); mark('tap_new');
  await sleep(1800); mark('picker');
  await ptr.tap(26, 402, 700); mark('picker_closed');                    // close the sheet: ×
  await sleep(700);
  await ptr.tapOn(page.getByText('الثامن علوم أ').first(), 650); mark('tap_group');
  await sleep(1400); mark('thread');
  await ptr.tapOn(page.locator('input, textarea').last(), 600); await sleep(250); mark('tap_composer');
  await page.keyboard.type(CLASS_MSG, { delay: 42 }); mark('typed_class'); await sleep(700);
  await ptr.tap(44, 809, 650); mark('sent_class');                       // the send arrow
  await sleep(1700);
  await ptr.tap(356, 30, 700); mark('back');                             // back to the inbox
  await sleep(1300); mark('inbox2');
  await ptr.tapOn(page.getByText('رسالة جديدة', { exact: true }).first(), 650); mark('tap_new2');
  await sleep(1500);
  await ptr.tap(65, 465, 700); mark('tap_parent');                       // «راسل» beside منى الحداد
  await sleep(1500); mark('parent_thread');
  await ptr.tapOn(page.locator('input, textarea').last(), 600); await sleep(250);
  await page.keyboard.type(PARENT_MSG, { delay: 34 }); mark('typed_parent'); await sleep(700);
  await ptr.tap(44, 809, 650); mark('sent_parent');
  await sleep(2600); mark('end');
  console.log(await rec.stop('r4_messages'));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
