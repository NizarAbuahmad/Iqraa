/**
 * Slides Maker's three model calls.
 *
 * A lesson deck's bodies must be EXACTLY what the screen built inline before
 * (the shared pool keys on them — a changed body orphans every stored plan and
 * check). A wide deck's plan AND checks carry the scope (the checks call had
 * its own request shape and would otherwise have gone out lesson-shaped, with
 * the scope label for a topic), and the explanation call is not made at all.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getPickerGrades, getPickerSubjects } from '../curriculumData.ts';
import { getLessonsForUnit, getUnitsForSubjectGrade } from '../knowledgeBase.ts';
import {
  buildGeneratorContext, generatorFigureCount, generatorLessonId, generatorUnitId, resolveGeneratorGrounding,
} from '../kbContext.ts';
import { buildLessonTeachingRequest } from '../generatorRequests.ts';
import { regenerationFields } from '../ai/regeneration.ts';
import {
  slidesChecksRequest, slidesLessonFields, slidesPlanRequest, slidesTeachingRequest, type SlidesLessonFields,
} from '../slidesRequests.ts';
import { reopenedGenerationScope } from '../generationScope.ts';
import { buildScopeRequest } from '../wideScopeRequest.ts';
import { revisionPhrase } from '../revisionScope.ts';
import { buildRevisionDeck } from '../lessonSlides.ts';
import { aiService } from '../ai/generators.ts';
import { scopeLabel, type ScopeSelection } from '../scopeSelection.ts';

(aiService as unknown as { delay: () => Promise<void> }).delay = async () => {};

const grade = getPickerGrades().find(g => g.nameAr === 'الصف العاشر')!;
const subject = getPickerSubjects().find(s => s.name === 'Mathematics')!;
const sem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'mathematics', semester: 1 };
const LABEL = 'الفصل الأول كاملًا';

function* grade10MathTopics(): Generator<string> {
  for (const unit of getUnitsForSubjectGrade(subject.id, grade.id)) {
    for (const lesson of getLessonsForUnit(unit.id)) yield lesson.titleAr.trim();
  }
}
const formFor = (topic: string) => ({ gradeName: grade.nameAr, subjectName: subject.name, topic, isAr: true });
const lessonFieldsFor = (topic: string): SlidesLessonFields => ({
  additionalContext: buildGeneratorContext(topic, 'ar'),
  unitId: generatorUnitId(topic, 'ar'),
  lessonId: generatorLessonId(topic, 'ar'),
  bookFigureCount: generatorFigureCount(topic, 'ar'),
});

describe('slides requests — a single lesson is unchanged', () => {
  it('sends exactly the plan and checks bodies slides.tsx built inline', () => {
    let checked = 0;
    for (const topic of grade10MathTopics()) {
      const legacyPlan = {
        grade: grade.nameAr, subject: subject.name, topic, language: 'arabic',
        additionalContext: buildGeneratorContext(topic, 'ar'),
        unitId: generatorUnitId(topic, 'ar'),
        lessonId: generatorLessonId(topic, 'ar'),
        bookFigureCount: generatorFigureCount(topic, 'ar'),
        contextSource: 'curriculum',
      };
      const legacyChecks = {
        grade: grade.nameAr, subject: subject.name, topic,
        activityType: 'quick-check', duration: 10, difficulty: 'standard',
        groupType: 'whole-class', teachingGoal: 'assessment', language: 'arabic',
        numQuestions: 5,
        additionalContext: buildGeneratorContext(topic, 'ar'),
        unitId: generatorUnitId(topic, 'ar'),
        lessonId: generatorLessonId(topic, 'ar'),
        contextSource: 'curriculum',
      };
      const plan = slidesPlanRequest(formFor(topic), lessonFieldsFor(topic), null);
      const checks = slidesChecksRequest(formFor(topic), lessonFieldsFor(topic), null);
      assert.deepStrictEqual(plan, legacyPlan, topic);
      assert.deepStrictEqual(checks, legacyChecks, topic);
      // Key order too: the body is serialised as built.
      assert.equal(JSON.stringify(plan), JSON.stringify(legacyPlan), topic);
      assert.equal(JSON.stringify(checks), JSON.stringify(legacyChecks), topic);
      checked++;
    }
    assert.ok(checked >= 20, `expected a real lesson list, got ${checked}`);
  });

  it('asks for the explanation exactly as before', () => {
    const topic = [...grade10MathTopics()][0]!;
    const grounding = resolveGeneratorGrounding(topic, 'ar');
    const regen = regenerationFields(true, { variantId: 'v1' });
    assert.deepStrictEqual(
      slidesTeachingRequest(formFor(topic), grounding, regen, null),
      buildLessonTeachingRequest({ gradeName: grade.nameAr, subjectName: subject.name, topic, lang: 'ar' }, grounding, regen),
    );
  });
});

describe('slides requests — a wide scope', () => {
  const wide = buildScopeRequest(sem1, 'ar')!;

  it('the plan and the checks both carry the scope, its digest and its lesson table — and no lesson', () => {
    for (const req of [
      slidesPlanRequest(formFor(LABEL), {}, wide.fields),
      slidesChecksRequest(formFor(LABEL), {}, wide.fields),
    ]) {
      assert.deepEqual(req.scope, wide.fields.scope);
      assert.equal(req.additionalContext, wide.fields.additionalContext);
      assert.ok(req.coverage && req.coverage.lessons.length > 0, 'the lesson table travels');
      assert.equal(req.coverage!.slots, undefined, 'a teaching tool sends no slot plan');
      assert.ok('lessonId' in req && req.lessonId === undefined);
      assert.ok('unitId' in req && req.unitId === undefined);
      assert.equal(req.bookFigureCount, 0);
      assert.equal(req.contextSource, 'curriculum');
    }
    const checks = slidesChecksRequest(formFor(LABEL), {}, wide.fields);
    assert.equal(checks.activityType, 'quick-check');
    assert.equal(checks.numQuestions, 5);
  });

  it('the scope fields win over any lesson fields the screen still held (merged last)', () => {
    const stale: SlidesLessonFields = { additionalContext: 'درس آخر', unitId: 'kbu-x', lessonId: 'kbl-x', bookFigureCount: 3 };
    for (const req of [
      slidesPlanRequest(formFor(LABEL), stale, wide.fields),
      slidesChecksRequest(formFor(LABEL), stale, wide.fields),
    ]) {
      assert.equal(req.lessonId, undefined);
      assert.equal(req.unitId, undefined);
      assert.equal(req.additionalContext, wide.fields.additionalContext);
      assert.equal(req.bookFigureCount, 0);
    }
  });

  it('makes no explanation call: it is single-lesson by design', () => {
    const grounding = { lesson: null, grounded: true, score: 0, context: '', ungroundedNote: '' };
    assert.equal(slidesTeachingRequest(formFor(LABEL), grounding, {}, wide.fields), null);
  });

  it('end to end, offline: the wide plan and checks make a deck with a round per unit and its checks', async () => {
    const [plan, checks] = await Promise.all([
      aiService.generateLessonPlan(slidesPlanRequest(formFor(LABEL), {}, wide.fields)),
      aiService.generateClassroomActivity(slidesChecksRequest(formFor(LABEL), {}, wide.fields)).then(a => a.slides),
    ]);
    const deck = buildRevisionDeck(true, {
      units: wide.units, phrase: revisionPhrase(sem1, 'ar'), plan, checks,
      subject: 'الرياضيات', grade: 'الصف العاشر', includePractice: true,
    });
    const rounds = deck.slides.filter(s => s.type === 'divider' && wide.units.some(u => u.title === s.title));
    assert.equal(rounds.length, wide.units.length);
    assert.ok(deck.slides.some(s => s.title.startsWith('✋ تحقّق سريع') || s.title.startsWith('🎫 غلق الحصة')),
      'the offline wide quick-check gave the deck at least one usable check');
    assert.ok(!deck.slides.some(s => s.type === 'media' || !!s.sideImageUrl), 'no book figure');
    assert.doesNotMatch(JSON.stringify(deck), /درس «|لـ ?الفصل الأول كاملًا/);
  });
});

describe('slides requests — the whole offline pipeline over the scopes a teacher can pick', () => {
  const SUBJECTS: Record<string, string> = { mathematics: 'Mathematics', history: 'History', chemistry: 'Chemistry' };
  const scopes: ScopeSelection[] = [];
  for (const subjectId of Object.keys(SUBJECTS)) {
    scopes.push({ kind: 'book', gradeId: 'grade-10', subjectId });
    scopes.push({ kind: 'semester', gradeId: 'grade-10', subjectId, semester: 1 });
    for (const u of getUnitsForSubjectGrade(subjectId, 'grade-10').slice(0, 2)) {
      scopes.push({ kind: 'unit', gradeId: 'grade-10', subjectId, unitId: u.id });
    }
  }
  const LESSON_SHAPED = /درس «|أنهينا درس|ملخص الدرس|مفردات الدرس|غلق الدرس|هذا الدرس|درس اليوم|today's lesson|this lesson|Lesson Summary|Key Vocabulary/i;
  const ARABIC_LETTER = /[\u0621-\u064A]/;

  /** The deck's placed checks: «✋ تحقّق سريع 1», «🎫 غلق الحصة 2», "Quick Check 1", "Exit Ticket 3". */
  const isCheck = (title: string) => /^(✋ |🎫 |Quick Check \d|Exit Ticket \d)/.test(title);

  async function deckFor(sel: ScopeSelection, lang: 'ar' | 'en') {
    const wide = buildScopeRequest(sel, lang);
    assert.ok(wide, `${sel.kind} ${sel.subjectId} should ground`);
    const form = { gradeName: 'Grade 10', subjectName: SUBJECTS[sel.subjectId]!, topic: scopeLabel(sel, lang), isAr: lang === 'ar' };
    const [plan, checks] = await Promise.all([
      aiService.generateLessonPlan(slidesPlanRequest(form, {}, wide.fields)),
      aiService.generateClassroomActivity(slidesChecksRequest(form, {}, wide.fields)).then(a => a.slides),
    ]);
    const deck = buildRevisionDeck(lang === 'ar', {
      units: wide.units, phrase: revisionPhrase(sel, lang), plan, checks, includePractice: true,
    });
    return { deck, wide };
  }

  it('a round per unit, at least one check, and nothing lesson-shaped — in both languages, book / semester / unit', async () => {
    for (const sel of scopes) {
      for (const lang of ['ar', 'en'] as const) {
        const { deck, wide } = await deckFor(sel, lang);
        const where = `${sel.kind} ${sel.subjectId} ${lang}`;
        const rounds = deck.slides.filter(s => s.type === 'divider' && wide.units.some(u => u.title === s.title));
        assert.equal(rounds.length, wide.units.length, where);
        assert.ok(deck.slides.some(s => isCheck(s.title)), `${where}: no check reached the deck`);
        assert.ok(!deck.slides.some(s => s.type === 'media' || !!s.sideImageUrl || s.type === 'graph'), where);
        assert.doesNotMatch(JSON.stringify(deck), LESSON_SHAPED, where);
      }
    }
  });

  it('an English deck has no Arabic letter in anything the deck builds; history, which has no bank, has none at all', async () => {
    for (const sel of scopes) {
      const { deck } = await deckFor(sel, 'en');
      const where = `${sel.kind} ${sel.subjectId}`;
      if (sel.subjectId === 'history') {
        assert.doesNotMatch(JSON.stringify(deck), ARABIC_LETTER, where);
        continue;
      }
      // Maths and chemistry checks come from banks that carry Arabic answers — the
      // lesson path's quick check prints the same ones (`activityWideScope.test.ts`).
      // They are placed as generated; everything else on the deck is the deck's own.
      const own = deck.slides.filter(s => !isCheck(s.title));
      assert.doesNotMatch(JSON.stringify({ ...deck, slides: own, answerKey: [] }), ARABIC_LETTER, where);
    }
  });
});

// A Grade 1 English teacher found «شرائح الدرس» doing nothing (2026-10-15).
// Every Grade 1 English lesson is titled "Vocabulary & Grammar" or "Listening &
// Speaking", and the screen re-found its lesson from that title: 19 of 19 decks
// were built from a Grade 3, 4 or 9 lesson and saved under that lesson's id, so
// the Grade 1 lesson never showed a deck. The tapped lesson's id is carried now.
describe('slides lesson fields — the lesson the teacher picked, not its title', () => {
  const g1English = getUnitsForSubjectGrade('english', 'grade-1').flatMap(u => getLessonsForUnit(u.id));

  it('builds the same fields as before from a grounding the title alone finds', () => {
    let checked = 0;
    for (const topic of grade10MathTopics()) {
      assert.deepEqual(slidesLessonFields(resolveGeneratorGrounding(topic, 'ar')), lessonFieldsFor(topic), topic);
      checked += 1;
    }
    assert.ok(checked > 20, `only ${checked} topics`);
  });

  it('anchors every Grade 1 English lesson to itself when its id is carried', () => {
    assert.ok(g1English.length >= 19, `${g1English.length} lessons`);
    const scope = { gradeId: 'grade-1', subjectId: 'english' };
    let titleWouldDrift = 0;
    for (const lesson of g1English) {
      const fields = slidesLessonFields(resolveGeneratorGrounding(lesson.titleEn, 'en', { lessonId: lesson.id, scope }));
      assert.equal(fields.lessonId, lesson.id);
      assert.match(fields.additionalContext ?? '', /📚 Lesson:/);
      if (generatorLessonId(lesson.titleEn, 'en') !== lesson.id) titleWouldDrift += 1;
    }
    // The trap this guards: the title alone lands somewhere else.
    assert.ok(titleWouldDrift >= 19, `${titleWouldDrift}`);
  });

  it('reopens a saved deck on the lesson it was saved for', () => {
    const lesson = g1English.find(l => l.id.endsWith('-u2_l1'))!;
    const gradeIdx = getPickerGrades().findIndex(g => g.id === 'grade-1');
    const subjectIdx = getPickerSubjects().findIndex(s => s.id === 'english');
    assert.equal(reopenedGenerationScope({ gradeIdx, subjectIdx }, lesson.titleEn, 'en', lesson.id)?.lesson?.id, lesson.id);
  });
});
