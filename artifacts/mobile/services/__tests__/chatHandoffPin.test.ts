/**
 * The lesson page hands chat a lesson and a document; these hold that the
 * hand-off survives the trip.
 *
 * The bug this file exists for: tapping a file in مكتبة الدرس opened chat, and
 * chat answered about whatever lesson it had already selected — by default the
 * seeded demo lesson, تركيب الاقترانات. The lesson id was passed the whole
 * time and used only to draw an "open lesson" chip.
 *
 * Fixtures are derived, not hardcoded: the bank is regenerated from manifests
 * and a pinned id written down here would rot into a silently-skipped test.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { askAboutLessonHandoff, askAboutResourceHandoff, buildLessonShelf } from '../lessonShelf.ts';
import {
  displayTitle,
  formatSupportResourcesBlock,
  pinnedResourceNote,
  searchSupportResources,
  type SupportResource,
} from '../mathSupportResources.ts';
import {
  DEFAULT_ACTIVE_LESSON_ID,
  buildCurrentLessonView,
  pinLesson,
  seedDefaultLessonMemory,
  softPinIfUnpinned,
} from '../lessonCopilot.ts';
import { emptyChatSessionMemory, buildTeachingAssistantReply } from '../ai/teachingAssistant.ts';
import { KB_LESSONS, getBookForLesson, getLessonById } from '../knowledgeBase.ts';

/** A lesson with unit-scoped shelf items, for the given subject. */
function shelfFor(subjectId: string) {
  for (const l of KB_LESSONS) {
    if (getBookForLesson(l)?.subjectId !== subjectId) continue;
    const shelf = buildLessonShelf(l.id);
    if (shelf && shelf.unit.length) {
      const items = shelf.unit.flatMap(g => g.items);
      if (items.length >= 2) return { lesson: l, shelf, items };
    }
  }
  throw new Error(`no ${subjectId} lesson with a unit shelf`);
}

const math = shelfFor('mathematics');
const chem = shelfFor('chemistry');

describe('the hand-off carries the lesson and the file', () => {
  it('names the shelf lesson, not the message it was built from', () => {
    for (const r of math.items) {
      const h = askAboutResourceHandoff(r, math.shelf, 'ar');
      assert.equal(h.lessonId, math.shelf.lessonId);
      assert.equal(h.resourceId, r.id);
    }
  });

  it('quotes the title the row shows, not the filename', () => {
    // The teacher's own message used to read «بالاستفادة من «… أ. أحمد المصري.pdf»».
    for (const r of math.items) {
      const h = askAboutResourceHandoff(r, math.shelf, 'ar');
      assert.ok(!h.initialMessage.includes('.pdf'), h.initialMessage);
      assert.ok(h.initialMessage.includes(displayTitle(r)), h.initialMessage);
    }
  });

  it('the lesson button carries a lesson and no document', () => {
    const h = askAboutLessonHandoff(math.lesson.id, 'الدائرة', 'ar');
    assert.equal(h.lessonId, math.lesson.id);
    assert.equal(h.resourceId, undefined);
    assert.ok(h.initialMessage.includes('الدائرة'));
  });
});

describe('the pinned document leads the support pack', () => {
  const lesson = math.lesson;

  it('is first even when the wording would have ranked it nowhere', () => {
    // The message is deliberately not about this file: without the pin the
    // ranking is a keyword race against every sibling on the shelf.
    let checked = 0;
    for (const r of math.items) {
      const hits = searchSupportResources({ query: 'اشرح الدرس', lesson, limit: 4, pinnedResourceId: r.id });
      assert.equal(hits[0]?.id, r.id, `${r.id} did not lead`);
      checked++;
    }
    assert.ok(checked > 0);
  });

  it('survives a kinds filter that would have excluded it', () => {
    // The hand-off message quotes the file's own title, so a worksheet titled
    // «… اختبار …» infers a quiz intent and was filtered out of its own answer.
    const ws = math.items.find(r => r.kind === 'worksheet');
    assert.ok(ws, 'expected a worksheet on the maths shelf');
    const hits = searchSupportResources({
      query: 'اختبار',
      lesson,
      limit: 4,
      kinds: ['question-bank', 'exam', 'answer-key'] as const,
      pinnedResourceId: ws.id,
    });
    assert.equal(hits[0]?.id, ws.id);
  });

  it('does not smuggle another subject in', () => {
    // The pin must not become a door past the subject gate — the rule that
    // stopped a financial-literacy query coming back with mathematics files.
    const hits = searchSupportResources({
      query: 'اشرح الدرس',
      lesson,
      limit: 4,
      pinnedResourceId: chem.items[0]!.id,
    });
    assert.ok(!hits.some(h => h.subjectId !== 'mathematics'), JSON.stringify(hits.map(h => h.id)));
  });

  it('is a no-op for an id nothing knows', () => {
    const withPin = searchSupportResources({ query: 'الدائرة', lesson, limit: 4, pinnedResourceId: 'no-such-resource' });
    const without = searchSupportResources({ query: 'الدائرة', lesson, limit: 4 });
    assert.deepEqual(withPin.map(r => r.id), without.map(r => r.id));
  });

  it('respects the limit and repeats nothing', () => {
    const hits = searchSupportResources({ query: 'ورقة عمل', lesson, limit: 3, pinnedResourceId: math.items[0]!.id });
    assert.ok(hits.length <= 3);
    assert.equal(new Set(hits.map(r => r.id)).size, hits.length);
  });
});

describe('the block says the PDF was not read', () => {
  const pack: SupportResource[] = searchSupportResources({
    query: 'اشرح الدرس',
    lesson: math.lesson,
    limit: 3,
    pinnedResourceId: math.items[0]!.id,
  });

  it('marks the opened file and refuses to imply its contents', () => {
    const block = formatSupportResourcesBlock(pack, 'ar', math.items[0]!.id);
    assert.ok(block.includes('الملف الذي فتحه المعلم'), block);
    assert.ok(block.includes('محتوى الـ PDF غير محمّل'), block);
  });

  it('is unchanged when no file was opened', () => {
    // A warning on every reply is a warning nobody reads.
    const before = formatSupportResourcesBlock(pack, 'ar');
    assert.ok(!before.includes('محتوى الـ PDF غير محمّل'));
    assert.ok(!before.includes('الملف الذي فتحه المعلم'));
  });
});

describe('the reply a teacher actually reads', () => {
  // DEMO_MODE is on by default and this — not `buildResponse` — writes that
  // reply, so a pin threaded only through the remote path would be invisible
  // in the shipped build. Driven with the real hand-off message rather than an
  // invented one: a synthetic query lands on the pedagogical-clarification
  // branch, which returns before the support pack is built and would have made
  // this test pass or fail for reasons unrelated to the pin.
  const run = (r: SupportResource) =>
    buildTeachingAssistantReply({
      query: askAboutResourceHandoff(r, math.shelf, 'ar').initialMessage,
      lessons: [math.lesson],
      lang: 'ar',
      mode: 'teacher',
      pinnedResourceId: r.id,
    }).text;

  it('names the opened file', () => {
    for (const r of math.items) {
      assert.ok(run(r).includes(displayTitle(r)), `${r.id} unnamed`);
    }
  });

  it('says the PDF itself was not read', () => {
    assert.ok(run(math.items[0]!).includes('محتوى الـ PDF غير محمّل'));
  });

  it('leads the pack with the opened file, not a sibling', () => {
    for (const r of math.items) {
      const text = run(r);
      const marked = text.split('\n').find(l => l.includes('الملف الذي فتحه المعلم'));
      assert.ok(marked?.includes(displayTitle(r)), `${r.id}: ${marked}`);
    }
  });
});

describe('the lesson card follows the deep link', () => {
  it('names the deep-linked lesson, not the seeded default', () => {
    const lesson = getLessonById(chem.lesson.id)!;
    const memory = pinLesson(seedDefaultLessonMemory(emptyChatSessionMemory()), lesson, 'hard');
    const view = buildCurrentLessonView(memory, [], 'ar');
    assert.equal(view?.lessonId, lesson.id);
    assert.notEqual(view?.lessonId, DEFAULT_ACTIVE_LESSON_ID);
  });

  it('a restored home pick does not evict a hard pin', () => {
    // The saved pick loads asynchronously and used to soft-pin unconditionally,
    // so it could land after the deep-link pin and replace it.
    const deepLinked = getLessonById(chem.lesson.id)!;
    const homePick = getLessonById(DEFAULT_ACTIVE_LESSON_ID)!;
    const hard = pinLesson(seedDefaultLessonMemory(emptyChatSessionMemory()), deepLinked, 'hard');
    assert.equal(softPinIfUnpinned(hard, homePick).activeLessonId, deepLinked.id);
  });

  it('but still restores when nothing is hard-pinned', () => {
    const soft = seedDefaultLessonMemory(emptyChatSessionMemory());
    const target = getLessonById(chem.lesson.id)!;
    assert.equal(softPinIfUnpinned(soft, target).activeLessonId, target.id);
  });
});

describe('the generation branch still names the file', () => {
  // Most shelf messages quote the file's own title, so «ورقة عمل …» routes the
  // ask to generation — a branch that emits no support pack. Measured: 83 of
  // the 139 unit-scoped shelf rows land there. Without this line the document
  // the teacher opened is never mentioned, which reads as though it was used.
  it('names the opened file and denies drawing on it', () => {
    const r = math.items[0]!;
    const note = pinnedResourceNote(r.id, 'ar');
    assert.ok(note.includes(displayTitle(r)), note);
    assert.ok(note.includes('غير محمّل'), note);
    assert.ok(note.includes('ليس مأخوذًا منه'), note);
  });

  it('says the same in English', () => {
    const note = pinnedResourceNote(math.items[0]!.id, 'en');
    assert.ok(note.includes('not loaded'), note);
    assert.ok(note.includes('not drawn from it'), note);
  });

  it('is empty when no file was opened, so ordinary replies gain nothing', () => {
    assert.equal(pinnedResourceNote(null, 'ar'), '');
    assert.equal(pinnedResourceNote(undefined, 'ar'), '');
    assert.equal(pinnedResourceNote('no-such-resource', 'ar'), '');
  });
});
