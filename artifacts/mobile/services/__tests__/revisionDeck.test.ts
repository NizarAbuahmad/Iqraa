/**
 * The unit / semester / whole-book deck (`buildRevisionDeck`).
 *
 * A wide deck is one revision session: a round per unit, the generated checks,
 * the plan's connective tissue — and nothing that belongs to a single lesson.
 * Built on real G10 maths units (`revisionUnits`), so the round count tracks the
 * curriculum rather than a fixture.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildLessonDeck, buildRevisionDeck } from '../lessonSlides.ts';
import { LETTER_GLOSS, withoutLetterGlosses } from '../englishText.ts';
import { revisionPhrase, revisionUnits } from '../revisionScope.ts';
import { lessonsInScope, semestersAvailable, type ScopeSelection } from '../scopeSelection.ts';
import { getUnitsForSubjectGrade, KB_BOOKS, KB_LESSONS, KB_UNITS } from '../knowledgeBase.ts';
import type { ActivitySlide, ClassroomActivity, LessonPlanOutput } from '../ai/AIService.ts';

const sem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'mathematics', semester: 1 };
const UNITS = revisionUnits(sem1, 'ar');
const PHRASE = revisionPhrase(sem1, 'ar');

/** A wide plan: first-person-future teacher text, a quoted warm-up question. */
const PLAN: LessonPlanOutput = {
  title: 'مراجعة',
  grade: 'الصف العاشر',
  subject: 'الرياضيات',
  duration: 45,
  objectives: ['أن يستذكر الطالب الفكرة الرئيسة لكل وحدة'],
  materials: ['سبورة'],
  introduction: 'سأعرض على الطلبة الوحدات التي نراجعها، ثم سأسأل: «ما أصعب فكرة مرّت بنا هذا الفصل؟» ولن نتناول اليوم الدروس الأخيرة من كل وحدة.',
  mainActivity: 'جولة لكل وحدة.',
  guidedPractice: 'سأحلّ مع الطلبة سؤالًا من كل وحدة.',
  independentPractice: 'سيحلّ الطلبة سؤالين بمفردهم.',
  closure: 'سأطلب من كل طالب فكرة واحدة من كل وحدة.',
  assessment: 'أسئلة الغلق.',
  differentiation: 'سأعطي المتقدمين سؤالًا يربط وحدتين.',
  homework: 'حلّ سؤالين من كل وحدة.',
};
/** The same plan with no question to lift: its introduction must still reach the teacher. */
const PLAN_NO_QUESTION: LessonPlanOutput = {
  ...PLAN,
  introduction: 'سأعرض على الطلبة الوحدات التي نراجعها، ولن نتناول اليوم الدروس الأخيرة من كل وحدة.',
};

function mcq(n: number): ActivitySlide {
  return {
    slideNumber: n,
    type: 'question',
    title: `سؤال ${n}`,
    content: `سؤال رقم ${n}؟`,
    options: [`أ${n}`, `ب${n}`, `ج${n}`, `د${n}`],
    correctIndex: 1,
    verified: true,
    verifiedBy: 'bank',
    durationSeconds: 45,
  };
}
const FIVE_CHECKS = [mcq(1), mcq(2), mcq(3), mcq(4), mcq(5)];

const deckOf = (plan: LessonPlanOutput | null, checks: ActivitySlide[] = []) =>
  buildRevisionDeck(true, {
    units: UNITS, phrase: PHRASE, plan, checks,
    subject: 'الرياضيات', grade: 'الصف العاشر', includePractice: true,
  });

/** Everything that belongs to ONE lesson and so has no place on a revision deck. */
const LESSON_ONLY_TITLES = ['📖 مفردات الدرس', '📐 القاعدة', 'لنبدأ الشرح', 'من كتاب الطالب', '🎉 ملخص الدرس', 'غلق الدرس'];
function lessonOnlySlides(deck: ClassroomActivity): ActivitySlide[] {
  return deck.slides.filter(s =>
    s.type === 'media'
    || s.type === 'graph'
    || !!s.sideImageUrl
    || LESSON_ONLY_TITLES.some(t => s.title.startsWith(t))
    || /^مثال \d/.test(s.title)
    || s.content.includes('من كتاب التمارين'));
}

const unitDividers = (deck: ClassroomActivity) =>
  deck.slides.filter(s => s.type === 'divider' && UNITS.some(u => u.title === s.title));

describe('buildRevisionDeck — a round per unit', () => {
  it('has one divider per unit, in book order, each followed by that unit\'s ideas', () => {
    assert.ok(UNITS.length >= 2, `semester 1 should have several units, got ${UNITS.length}`);
    const deck = deckOf(PLAN, FIVE_CHECKS);
    assert.deepEqual(unitDividers(deck).map(s => s.title), UNITS.map(u => u.title));
    for (const unit of UNITS) {
      const at = deck.slides.findIndex(s => s.type === 'divider' && s.title === unit.title);
      const ideas = deck.slides[at + 1]!;
      assert.equal(ideas.title, `💡 ${unit.title}`);
      const expected = (unit.outcomes[0] ?? unit.concepts[0] ?? unit.lessons[0]!.title).trim();
      assert.ok(ideas.content.includes(expected), `${unit.title}: ${ideas.content}`);
      assert.ok(ideas.teacher?.expectedAnswer.includes(unit.lessons[0]!.title), 'the teacher panel lists the unit\'s lessons');
    }
  });

  it('a unit scope is one round, not «الجولة 1 من 1»', () => {
    const unitSel: ScopeSelection = {
      kind: 'unit', gradeId: 'grade-10', subjectId: 'mathematics',
      unitId: getUnitsForSubjectGrade('mathematics', 'grade-10')[0]!.id,
    };
    const units = revisionUnits(unitSel, 'ar');
    assert.equal(units.length, 1);
    const deck = buildRevisionDeck(true, { units, phrase: revisionPhrase(unitSel, 'ar'), plan: PLAN });
    const dividers = deck.slides.filter(s => s.type === 'divider');
    assert.equal(dividers.length, 1);
    assert.equal(dividers[0]!.content, 'جولة المراجعة');
  });
});

describe('buildRevisionDeck — nothing that belongs to one lesson', () => {
  it('the detector is not vacuous: a lesson deck trips it', () => {
    const lesson = lessonsInScope(sem1)[0]!;
    const lessonDeck = buildLessonDeck(lesson.titleAr, true, {
      lesson, plan: PLAN, figureUri: () => 'stub://figure',
    });
    assert.ok(lessonOnlySlides(lessonDeck).length > 0);
  });

  it('has no figures slide, no vocabulary / rule / example slide and no exercise-book line', () => {
    assert.deepEqual(lessonOnlySlides(deckOf(PLAN, FIVE_CHECKS)).map(s => s.title), []);
    assert.deepEqual(lessonOnlySlides(deckOf(null)).map(s => s.title), []);
  });

  it('never splices the scope into a lesson-shaped phrase, even with no plan objectives', () => {
    for (const plan of [{ ...PLAN, objectives: [] }, null]) {
      const deck = deckOf(plan);
      const text = JSON.stringify(deck);
      assert.doesNotMatch(text, /درس «|أنهينا درس|ملخص الدرس|مفردات الدرس|غلق الدرس/);
      assert.equal(deck.activityName, `مراجعة ${PHRASE}`);
      assert.equal(deck.learningObjective, plan?.objectives[0] ?? `مراجعة ${PHRASE}`);
    }
  });

  it('in English, too', () => {
    const deck = buildRevisionDeck(false, {
      units: revisionUnits(sem1, 'en'), phrase: revisionPhrase(sem1, 'en'), plan: null,
    });
    assert.equal(deck.slides[0]!.title, `Revision: ${revisionPhrase(sem1, 'en')}`);
    assert.doesNotMatch(JSON.stringify(deck), /Lesson Summary|Key Vocabulary|Teach “|We finished/);
  });
});

describe('buildRevisionDeck — the checks and the plan', () => {
  it('places the generated questions: two mid-session after the rounds, three as the exit ticket', () => {
    const deck = deckOf(PLAN, FIVE_CHECKS);
    const mid = deck.slides.filter(s => s.title.startsWith('✋ تحقّق سريع'));
    const exit = deck.slides.filter(s => s.title.startsWith('🎫 غلق الحصة'));
    assert.deepEqual(mid.map(s => s.content), ['سؤال رقم 1؟', 'سؤال رقم 2؟']);
    assert.deepEqual(exit.map(s => s.content), ['سؤال رقم 3؟', 'سؤال رقم 4؟', 'سؤال رقم 5؟']);
    assert.deepEqual(mid[0]!.options, ['أ1', 'ب1', 'ج1', 'د1']);
    const lastRound = deck.slides.map(s => s.title).lastIndexOf(`💡 ${UNITS[UNITS.length - 1]!.title}`);
    assert.ok(lastRound >= 0 && deck.slides.indexOf(mid[0]!) > lastRound, 'checks follow the last round');
    const summary = deck.slides.findIndex(s => s.type === 'summary');
    assert.ok(deck.slides.indexOf(exit[0]!) > summary, 'the exit ticket follows the summary');
    assert.ok(deck.answerKey.some(k => k.includes('ب1')), 'the answer key is rebuilt from the slides');
  });

  it('projects the scope; the plan\'s introduction (what is left out) goes to the teacher', () => {
    const deck = deckOf(PLAN_NO_QUESTION);
    const scopeSlide = deck.slides[1]!;
    assert.equal(scopeSlide.title, '🗂️ ما نراجعه اليوم');
    for (const u of UNITS) assert.ok(scopeSlide.content.includes(u.title), u.title);
    assert.equal(scopeSlide.teacher?.teachingTips, PLAN_NO_QUESTION.introduction);
    assert.ok(!deck.slides.some(s => s.title === '✨ تمهيد'), 'no question, no warm-up slide');
  });

  it('lifts the plan\'s warm-up question, and then carries the introduction there instead', () => {
    const deck = deckOf(PLAN);
    const warm = deck.slides.find(s => s.title === '✨ تمهيد')!;
    assert.equal(warm.content, 'ما أصعب فكرة مرّت بنا هذا الفصل؟');
    assert.ok(warm.teacher?.teachingTips?.includes(PLAN.introduction));
    assert.equal(deck.slides[1]!.teacher?.teachingTips, undefined);
  });

  it('still makes a numbered deck with a summary when the plan failed and no checks came', () => {
    const deck = deckOf(null);
    assert.deepEqual(deck.slides.map(s => s.slideNumber), deck.slides.map((_, i) => i + 1));
    assert.ok(deck.slides.length >= 2 + UNITS.length * 2 + 1);
    const summary = deck.slides.find(s => s.type === 'summary')!;
    assert.ok(summary.content.startsWith('راجعنا اليوم:'));
    for (const u of UNITS) assert.ok(summary.content.includes(u.title));
  });
});

/** Every book / semester / unit scope the curriculum data holds. */
function allScopes(): ScopeSelection[] {
  const out: ScopeSelection[] = [];
  for (const b of KB_BOOKS) {
    out.push({ kind: 'book', gradeId: b.gradeId, subjectId: b.subjectId });
    for (const semester of semestersAvailable(b.gradeId, b.subjectId)) {
      out.push({ kind: 'semester', gradeId: b.gradeId, subjectId: b.subjectId, semester });
    }
    for (const u of KB_UNITS.filter(x => x.bookId === b.id)) {
      out.push({ kind: 'unit', gradeId: b.gradeId, subjectId: b.subjectId, unitId: u.id });
    }
  }
  return out;
}

/** Arabic LETTERS (not the Quranic marks a few Latin titles carry). */
const ARABIC_LETTER = /[\u0621-\u064A]/;

describe('buildRevisionDeck — English decks carry no Arabic from the data, one-unit decks say "unit"', () => {
  const scopes = allScopes();

  it('the probe is not vacuous: the data does hold Arabic outcomes for English scopes', () => {
    const withArabic = scopes.filter(sel => revisionUnits(sel, 'en')
      .some(u => [...u.outcomes, ...u.concepts, ...u.terms].some(x => ARABIC_LETTER.test(x))));
    assert.ok(withArabic.length > 100, `expected many scopes with Arabic in the English data, got ${withArabic.length}`);
  });

  it('every book, semester and unit in the data builds an English deck with no Arabic letter in it', () => {
    let built = 0;
    const offenders: string[] = [];
    for (const sel of scopes) {
      const units = revisionUnits(sel, 'en');
      if (units.length === 0) continue;
      const deck = buildRevisionDeck(false, { units, phrase: revisionPhrase(sel, 'en'), plan: null });
      built++;
      // A short letter gloss is a grade-1 lesson's NAME («The Letter Baa (ب)»): the one
      // Arabic letter an English deck may carry, in brackets, as the plan allows.
      if (ARABIC_LETTER.test(withoutLetterGlosses(JSON.stringify(deck)))) offenders.push(`${sel.kind}:${sel.subjectId}:${sel.gradeId}`);
      // And every round still has its ideas slide: filtering must not empty a unit.
      assert.equal(deck.slides.filter(s => s.title.startsWith('💡 ')).length, units.length, `${sel.kind} ${sel.subjectId}`);
    }
    assert.ok(built > 500, `expected the whole curriculum, got ${built}`);
    assert.deepEqual(offenders.slice(0, 5), []);
  });

  it('the letter-gloss exception is narrow: one to three letters in brackets, nothing longer', () => {
    assert.ok(LETTER_GLOSS.test('(ب)') && LETTER_GLOSS.test('(ا, ى)'));
    assert.ok(!LETTER_GLOSS.test('(جميل)') && !LETTER_GLOSS.test('(دراسة الجدوى)'));
    // Mutation caught: an exception that waves any bracketed Arabic through the scan.
    assert.ok(ARABIC_LETTER.test(withoutLetterGlosses('Looking good (جميل)')));
    assert.ok(!ARABIC_LETTER.test(withoutLetterGlosses('The Letter Baa (ب)')));
  });

  it('keeps what the data can say in English: a Quranic mark, a letter lesson, a glossed title', () => {
    const unit = {
      unitId: 'u1', title: 'Letters and stops',
      lessons: [
        { id: 'l1', title: 'The Letter Baa (ب)', thin: false },
        { id: 'l2', title: 'Stops ۖ and pauses', thin: false },
        { id: 'l3', title: 'Looking good (جميل)', thin: false },
        { id: 'l4', title: 'الحروف', thin: false },
      ],
      outcomes: ['يتعرف الطالب الحرف'], concepts: ['دراسة الجدوى'], terms: ['Stops ۖ', 'مصطلح (term)'],
    };
    const deck = buildRevisionDeck(false, { units: [unit], phrase: 'Letters', plan: null });
    const ideas = deck.slides.find(s => s.title === '💡 Letters and stops')!;
    // Outcomes and concepts are Arabic only, so the round shows its lesson titles.
    // Mutation caught: the old whole-script test (drops «Stops ۖ and pauses» and «The Letter Baa (ب)»).
    assert.equal(ideas.content, '• The Letter Baa (ب)\n• Stops ۖ and pauses\n• Looking good');
    assert.ok(ideas.teacher?.expectedAnswer?.includes('Stops ۖ and pauses'));
    assert.ok(ideas.teacher?.teachingTips?.includes('Terms worth asking about: Stops ۖ'), String(ideas.teacher?.teachingTips));
    // The Arabic deck is not filtered at all.
    const ar = buildRevisionDeck(true, { units: [unit], phrase: 'x', plan: null });
    assert.ok(ar.slides.find(s => s.title === '💡 Letters and stops')!.content.includes('يتعرف الطالب الحرف'));
  });

  it('the grade-4 Islamic scope that holds «Muhammad ۖ» keeps that lesson in its English deck', () => {
    const lesson = KB_LESSONS.find(l => l.titleEn.includes('\u06D6'))!;
    assert.ok(lesson, 'probe: the data holds a Latin lesson title with a Quranic mark');
    const unit = KB_UNITS.find(u => u.id === lesson.unitId)!;
    const book = KB_BOOKS.find(b => b.id === unit.bookId)!;
    const units = revisionUnits({ kind: 'unit', gradeId: book.gradeId, subjectId: book.subjectId, unitId: unit.id }, 'en');
    const deck = buildRevisionDeck(false, { units, phrase: 'x', plan: null });
    assert.ok(deck.slides.some(s => (s.teacher?.expectedAnswer ?? '').includes(lesson.titleEn)), 'the lesson was dropped from the round');
  });

  it('an English deck leaves out a plan\'s Arabic goals (an offline plan quotes the official outcomes) and keeps its English ones', () => {
    const units = revisionUnits(sem1, 'en');
    const phrase = revisionPhrase(sem1, 'en');
    const arabicGoals = buildRevisionDeck(false, { units, phrase, plan: { ...PLAN, objectives: ['حل نظام معادلتين'] } });
    assert.ok(!arabicGoals.slides.some(s => s.title.includes('Goals')), 'no goals slide made only of Arabic');
    assert.equal(arabicGoals.learningObjective, `Revision: ${phrase}`);
    const mixed = buildRevisionDeck(false, { units, phrase, plan: { ...PLAN, objectives: ['حل نظام معادلتين', 'Recall each unit\'s key idea'] } });
    assert.equal(mixed.slides.find(s => s.title.includes('Goals'))?.content, '• Recall each unit\'s key idea');
  });

  it('a one-unit deck speaks of the unit, never of units, in either language', () => {
    const unitScopes = scopes.filter(s => s.kind === 'unit');
    assert.ok(unitScopes.length > 100);
    for (const sel of unitScopes) {
      for (const lang of ['ar', 'en'] as const) {
        const units = revisionUnits(sel, lang);
        if (units.length !== 1) continue;
        const deck = buildRevisionDeck(lang === 'ar', { units, phrase: revisionPhrase(sel, lang), plan: null });
        const text = JSON.stringify(deck);
        assert.doesNotMatch(text, /الوحدات|الجولة 1 من 1|Round 1 of 1/, `${sel.subjectId} ${lang}`);
      }
    }
  });
});

describe('buildRevisionDeck — the teacher\'s preparation note names only what is on the slides', () => {
  const mentions = (note: string, words: string[]) => words.filter(w => note.includes(w));

  it('a deck with no plan and no checks promises nothing generated', () => {
    for (const isAr of [true, false]) {
      const units = revisionUnits(sem1, isAr ? 'ar' : 'en');
      const deck = buildRevisionDeck(isAr, { units, phrase: PHRASE, plan: null });
      // Mutation caught: the fixed «warm-up, practice, questions» sentence.
      assert.deepEqual(mentions(deck.teacherPreparation, ['التمهيد', 'التدريب', 'الأسئلة', 'warm-up', 'practice', 'questions', 'مولّد', 'generated']), [], deck.teacherPreparation);
      assert.ok(deck.teacherPreparation.length > 20);
    }
  });

  it('names a part exactly when its slide is there', () => {
    const note = (o: Partial<Parameters<typeof buildRevisionDeck>[1]>) =>
      buildRevisionDeck(true, { units: UNITS, phrase: PHRASE, plan: null, ...o }).teacherPreparation;
    // A question warm-up, practice and checks: all three are named (and the goals and homework the plan brings).
    const full = note({ plan: PLAN, checks: FIVE_CHECKS });
    assert.deepEqual(mentions(full, ['الأهداف', 'التمهيد', 'التدريب', 'الأسئلة', 'الواجب']), ['الأهداف', 'التمهيد', 'التدريب', 'الأسئلة', 'الواجب']);
    // No question in the introduction: no warm-up slide, so none promised.
    assert.ok(!note({ plan: PLAN_NO_QUESTION, checks: FIVE_CHECKS }).includes('التمهيد'));
    // Practice switched off: neither its slides nor its promise.
    const noPractice = note({ plan: PLAN, checks: FIVE_CHECKS, includePractice: false });
    assert.ok(!noPractice.includes('التدريب') && !noPractice.includes('الواجب'), noPractice);
    // No checks came: no questions.
    assert.ok(!note({ plan: PLAN }).includes('الأسئلة'));
    // A plan that is only a closure promises no generated slide at all.
    assert.ok(!note({ plan: { ...PLAN, introduction: '', objectives: [], guidedPractice: '', independentPractice: '', homework: '' } }).includes('مولّد'));
  });

  it('says the same in English, joined with commas and «and»', () => {
    const units = revisionUnits(sem1, 'en');
    const en = buildRevisionDeck(false, { units, phrase: 'x', plan: { ...PLAN, objectives: ['Recall each unit'], introduction: 'Ask: "What is hardest?" Then go.' }, checks: FIVE_CHECKS });
    assert.match(en.teacherPreparation, /everything else \(goals, warm-up, questions, practice and homework\) is generated/);
    const one = buildRevisionDeck(false, { units, phrase: 'x', plan: { ...PLAN, objectives: [], guidedPractice: '', independentPractice: '', homework: '', introduction: '' }, checks: [mcq(1)] });
    assert.match(one.teacherPreparation, /everything else \(questions\) is generated/);
  });
});
