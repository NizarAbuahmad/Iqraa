/**
 * An activity for a unit, a semester or the whole book is a revision session.
 *
 * Every format keeps its own structure (the blueprints are not touched); what
 * changes is where its content comes from — the concepts, rules, outcomes and
 * bank items of the units in scope — and the topic it names: the scope's
 * revision phrase, never the picker's label grounded to one lesson.
 *
 * A unit "is in" an activity when the activity's text holds a concept, rule,
 * outcome or term definition that only that unit's lessons have, or a bank
 * item the probe saw drawn from it.
 *
 * `buildOfflineActivity` has no simulated latency, so nothing here waits.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { activityVariantKey, buildOfflineActivity, nextActivityVariant, type RevisionProbe } from '../ai/generators.ts';
import type { ActivityOutput, AIRequest } from '../ai/AIService.ts';
import { activityRevisionRewords } from '../ai/revisionWording.ts';
import { buildScopeRequest } from '../wideScopeRequest.ts';
import { revisionPhrase } from '../revisionScope.ts';
import { lessonsInScope, scopeLabel, unitsInScope, type ScopeSelection } from '../scopeSelection.ts';
import { getLessonById } from '../knowledgeBase.ts';
import { parseCoverage } from '../../../api-server/src/lib/coverage.ts';
import { revisionClauseAr } from '../../../api-server/src/lib/revision.ts';

const FORMATS = ['individual', 'group', 'discussion', 'hands-on', 'game', 'warmup'] as const;
type Format = typeof FORMATS[number];
const SUBJECT: Record<string, string> = { mathematics: 'Mathematics', chemistry: 'Chemistry', history: 'History', arabic: 'Arabic' };

const mathSem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'mathematics', semester: 1 };
const chemSem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'chemistry', semester: 1 };
const histSem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'history', semester: 1 };
const book10: ScopeSelection = { kind: 'book', gradeId: 'grade-10', subjectId: 'mathematics' };
const book9: ScopeSelection = { kind: 'book', gradeId: 'grade-9', subjectId: 'mathematics' };
// A book whose lessons list no key concepts and have no bank: the jigsaw and the game fall back to
// «define / give an example of <the phrase>», which is where the scope phrase reads worst.
const arabicBook: ScopeSelection = { kind: 'book', gradeId: 'grade-10', subjectId: 'arabic' };
const arabicSem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'arabic', semester: 1 };
const arabicUnit: ScopeSelection = { kind: 'unit', gradeId: 'grade-10', subjectId: 'arabic', unitId: 'kbu-arabic-s1-nccd-u1' };
const circle: ScopeSelection = { kind: 'unit', gradeId: 'grade-10', subjectId: 'mathematics', unitId: 'kbu-math-s1-nccd-u2' };

/** The form fields a format needs: a warm-up is the 'warmup' variant of a short activity. */
const formatFields = (format: Format): Partial<AIRequest> => (format === 'warmup'
  ? { activityType: 'group', activityVariant: 'warmup', duration: 8 }
  : { activityType: format, duration: 30 });

function wideReq(sel: ScopeSelection, format: Format, lang: 'ar' | 'en' = 'ar', extra: Partial<AIRequest> = {}): AIRequest {
  const wide = buildScopeRequest(sel, lang);
  assert.ok(wide, `probe: ${sel.kind} ${sel.subjectId} should ground`);
  return {
    grade: 'الصف العاشر', subject: SUBJECT[sel.subjectId]!, topic: scopeLabel(sel, lang),
    language: lang === 'ar' ? 'arabic' : 'english',
    ...formatFields(format), ...wide.fields, ...extra,
  } as AIRequest;
}

const textOf = (a: ActivityOutput): string => [
  a.title, a.objective, a.groupSize, ...a.materials,
  ...a.steps.flatMap(s => [s.title, s.description]),
  ...a.teacherTips, a.differentiation, a.assessment,
].join('\n');

function unitsIn(a: ActivityOutput, sel: ScopeSelection, probe: RevisionProbe): Set<string> {
  const owners = new Map<string, Set<string>>();
  for (const lesson of lessonsInScope(sel)) {
    const kb = getLessonById(lesson.id);
    if (!kb) continue;
    for (const raw of [...kb.keyConceptsAr, ...(kb.rulesAr ?? []), ...kb.objectives, ...kb.keyTerms.map(t => t.definitionAr)]) {
      const s = raw?.trim();
      if (!s || s.length < 4) continue;
      const set = owners.get(s) ?? new Set<string>();
      set.add(kb.unitId);
      owners.set(s, set);
    }
  }
  const text = textOf(a);
  const units = new Set<string>();
  for (const [s, us] of owners) if (us.size === 1 && text.includes(s)) units.add([...us][0]!);
  for (const d of probe.drawn) if (text.includes(d.text)) units.add(d.unitId);
  return units;
}

const fresh = (): RevisionProbe => ({ drawn: [] });

/**
 * The one-lesson sentences the blueprints hold, written out here on purpose, NOT
 * read from `activityRevisionRewords`: if the table loses an entry, its sentence
 * survives into the wide output and this list catches it. `{p}` is the scope's
 * phrase. A test below pins the list to the table so it cannot go stale.
 */
const LESSON_SHAPED: Record<'ar' | 'en', string[]> = {
  ar: [
    'من درس «{p}»',
    'عن {p} من الحصة السابقة',
    'ما أهم ما تعلّمته عن {p} في الحصة السابقة؟',
    'قبل الدخول في {p}',
    'واليوم سنستخدمه لـ {p}',
    'اربط بدرس اليوم',
    'ستبدأ الدرس الجديد',
    // A revision closes the session, not «the lesson».
    'غلق الدرس',
    // The hands-on card sort.
    'أو مثال من الدرس.',
    'بالطريقة التي يناسبها الدرس',
    // «Define the whole book» is no task: the jigsaw cards and the game's questions.
    'عرّف {p} بكلماتك',
    'أعطِ مثالًا يوضّح {p}',
    'اذكر خطأً شائعًا في {p}',
    'اربط {p} بموقف حياتي',
    'قارن {p} بفكرة قريبة منه، وبيّن أين يختلفان',
    'ما الشرط الذي يجب أن يتحقق حتى تصحّ فكرة {p}؟',
    'لخّص {p} في ثلاث جمل لزميل لم يحضر الحصة',
    'عرّف {p}',
    'أعطِ مثالًا على {p}',
    'ما الخطأ الشائع في {p}؟',
    'ما الفرق بين {p} وفكرة قريبة منه؟',
    'متى لا تصحّ فكرة {p}؟',
    'اشرح {p} لطالب أصغر منك سنًّا.',
  ],
  en: [
    'from the “{p}” lesson',
    'about {p} from last lesson',
    'learned about {p} last lesson?',
    'before {p} begins',
    'today we use it for {p}.',
    'example from the lesson on each card',
    'in the way the lesson calls for',
    'it is the content of the lesson',
    'Define {p} in your own words',
    'Give a worked example of {p}',
    'Name one common error in {p}',
    'Link {p} to a real situation',
    'Compare {p} with a nearby idea and say where they differ',
    'What must be true for {p} to hold?',
    'Summarise {p} in three sentences for a classmate who was absent',
    'Define {p}',
    'Give an example of {p}',
    'What is a common error in {p}?',
    'How does {p} differ from a nearby idea?',
    'When does {p} not hold?',
    'Explain {p} to a younger student.',
  ],
};
const lessonShaped = (phrase: string, lang: 'ar' | 'en') => LESSON_SHAPED[lang].map(t => t.split('{p}').join(phrase));
/** Every version of an activity: the jigsaw's and the game's pools are longer than four. */
const VERSIONS = [0, 1, 2, 3, 4, 5, 6, 7];

describe('offline activity — a wide scope is a revision session', () => {
  it('every format names the revision phrase, never the label, and keeps its structure', () => {
    const phrase = revisionPhrase(mathSem1, 'ar');
    for (const f of FORMATS) {
      const a = buildOfflineActivity(wideReq(mathSem1, f));
      assert.ok(a.title.startsWith(`${phrase} – `), `${f}: ${a.title}`);
      // Mutation caught: leaving `topic = req.topic` on the wide path.
      assert.ok(!textOf(a).includes(scopeLabel(mathSem1, 'ar')), `${f} spliced the label`);
      assert.equal(a.activityType, f);
      assert.equal(a.steps.reduce((s, x) => s + x.durationMin, 0), a.totalDuration, f);
    }
  });

  it('the multi-item formats draw from two units or more in one activity', () => {
    for (const f of ['individual', 'group', 'game', 'warmup'] as const) {
      const probe = fresh();
      const units = unitsIn(buildOfflineActivity(wideReq(mathSem1, f), 0, probe), mathSem1, probe);
      // Mutation caught: drawing every item from the first unit (startUnit 0 for
      // the warm-up, or a per-lesson batch) — the warm-up's recall prompt and
      // its check then name the same unit.
      assert.ok(units.size >= 2, `${f}: ${[...units].join(', ')}`);
    }
  });

  it('discussion and hands-on build on one item, and each Regenerate moves to another unit', () => {
    const n = unitsInScope(mathSem1).length;
    for (const f of ['discussion', 'hands-on'] as const) {
      const seen = new Set<string>();
      for (let v = 0; v < n; v++) {
        const probe = fresh();
        const units = unitsIn(buildOfflineActivity(wideReq(mathSem1, f), v, probe), mathSem1, probe);
        assert.ok(units.size >= 1, `${f} v${v} names no unit of the scope`);
        units.forEach(u => seen.add(u));
      }
      // Mutation caught: a fixed start unit for the items (ignoring `variant`).
      assert.ok(seen.size >= 2, `${f}: every version is about ${[...seen].join(', ')}`);
    }
  });

  it('maths items come from the scope\'s lessons, one unit after another', () => {
    const probe = fresh();
    const a = buildOfflineActivity(wideReq(mathSem1, 'group'), 0, probe);
    const inScope = new Set(lessonsInScope(mathSem1).map(l => l.id));
    assert.equal(probe.drawn.length, 4, 'the jigsaw takes four items');
    for (const d of probe.drawn) {
      assert.ok(inScope.has(d.lessonId), `foreign lesson ${d.lessonId}`);
      assert.ok(textOf(a).includes(d.text), 'a drawn item is not on the activity');
    }
    assert.ok(new Set(probe.drawn.map(d => d.unitId)).size >= 3);
  });

  it('a chemistry scope stays chemistry, even when the screen sends the maths subject name', () => {
    const chem = new Set(lessonsInScope(chemSem1).map(l => l.id));
    for (const subject of ['Chemistry', 'Mathematics']) {
      const probe = fresh();
      const a = buildOfflineActivity(wideReq(chemSem1, 'hands-on', 'ar', { subject }), 0, probe);
      assert.ok(probe.drawn.length >= 1, `${subject}: no chemistry item`);
      for (const d of probe.drawn) assert.ok(chem.has(d.lessonId), `${subject}: ${d.lessonId}`);
      // The build-a-model branch — not the protractor (geometry) or the card tiles (maths).
      assert.ok(a.materials.some(m => m.includes('كرات وعيدان')), `${subject}: ${a.materials.join(' | ')}`);
      assert.ok(!a.materials.some(m => m.includes('منقلة')), subject);
    }
  });

  it('a scope with no bank still makes every format, with no items and no error', () => {
    for (const f of FORMATS) {
      const probe = fresh();
      const a = buildOfflineActivity(wideReq(histSem1, f), 0, probe);
      assert.equal(probe.drawn.length, 0, f);
      assert.ok(a.steps.length >= 3, f);
      assert.ok(unitsIn(a, histSem1, probe).size >= 1, `${f} names no unit`);
    }
  });

  it('the one-lesson sentences are reworded for a revision, in both languages', () => {
    for (const lang of ['ar', 'en'] as const) {
      const phrase = revisionPhrase(histSem1, lang);
      const table = activityRevisionRewords(phrase, lang);
      // Live: a lesson request whose topic happens to BE the phrase (no scope, so
      // no rewording) prints every entry somewhere. A dead entry fails here.
      let before = '';
      for (const f of FORMATS) {
        for (const v of VERSIONS) {
          before += textOf(buildOfflineActivity({
            grade: 'الصف العاشر', subject: 'History', topic: phrase,
            language: lang === 'ar' ? 'arabic' : 'english', ...formatFields(f),
          } as AIRequest, v)) + '\n';
        }
      }
      // The hands-on tips («it is the content of the lesson») sit in the measure / cards / model
      // branches, which a bank-less history topic never reaches: real maths and chemistry lessons do.
      for (const sel of [mathSem1, chemSem1]) {
        for (const l of lessonsInScope(sel).filter((_, i) => i % 4 === 0)) {
          for (const v of [0, 1]) {
            before += textOf(buildOfflineActivity({
              grade: 'الصف العاشر', subject: SUBJECT[sel.subjectId]!, topic: lang === 'ar' ? l.titleAr : l.titleEn, lessonId: l.id,
              language: lang === 'ar' ? 'arabic' : 'english', ...formatFields('hands-on'),
            } as AIRequest, v)) + '\n';
          }
        }
      }
      for (const [from] of table) assert.ok(before.includes(from), `${lang}: dead entry «${from}»`);
      // Applied: no wide activity keeps one. Mutation caught: dropping the
      // `reviseWording` call (the hands-on sort task keeps «من درس «…»»).
      for (const f of FORMATS) {
        for (const v of VERSIONS) {
          const t = textOf(buildOfflineActivity(wideReq(histSem1, f, lang), v));
          for (const [from] of table) assert.ok(!t.includes(from), `${lang} ${f} v${v}: «${from}»`);
          assert.ok(!t.includes(scopeLabel(histSem1, lang)), `${lang} ${f} v${v} spliced the label`);
        }
      }
    }
  });
});

describe('offline activity — no sentence that claims one lesson survives a wide scope', () => {
  // Scopes of every kind, with and without a bank, so the phrase takes all its shapes
  // («موضوعات الكتاب كله», «موضوعات الفصل الأول», «موضوعات وحدة «…»»).
  const SCOPES: ScopeSelection[] = [histSem1, mathSem1, chemSem1, book10, circle, arabicBook, arabicSem1, arabicUnit];

  it('the forbidden list and the table cover each other, so neither goes stale', () => {
    for (const lang of ['ar', 'en'] as const) {
      const phrase = revisionPhrase(histSem1, lang);
      const listed = new Set(lessonShaped(phrase, lang));
      const tabled = new Set(activityRevisionRewords(phrase, lang).map(([from]) => from));
      for (const from of tabled) assert.ok(listed.has(from), `${lang}: «${from}» is in the table, not the list`);
      for (const bad of listed) assert.ok(tabled.has(bad), `${lang}: «${bad}» is in the list, not the table`);
    }
  });

  it('no format, version or scope kind prints one, in either language', () => {
    for (const sel of SCOPES) {
      for (const lang of ['ar', 'en'] as const) {
        const phrase = revisionPhrase(sel, lang);
        const bad = lessonShaped(phrase, lang);
        for (const f of FORMATS) {
          for (const v of VERSIONS) {
            const t = textOf(buildOfflineActivity(wideReq(sel, f, lang), v));
            // Mutation caught: removing ANY entry of the table. The list is the
            // test's own, so a missing entry cannot hide by leaving the list too.
            for (const b of bad) assert.ok(!t.includes(b), `${sel.kind} ${sel.subjectId} ${lang} ${f} v${v}: «${b}»`);
          }
        }
      }
    }
  });

  it('a revision closes the session, asks "one idea of the scope" and sorts cards of "them"', () => {
    // The sentences that took the place of the lesson-shaped ones are in the output,
    // so the test cannot pass by the sentences having vanished from the formats.
    const seen = { ar: '', en: '' };
    for (const lang of ['ar', 'en'] as const) {
      for (const f of FORMATS) {
        for (const v of VERSIONS) {
          for (const sel of [histSem1, arabicSem1, mathSem1, chemSem1]) seen[lang] += textOf(buildOfflineActivity(wideReq(sel, f, lang), v)) + '\n';
        }
      }
    }
    assert.ok(seen.ar.includes('غلق الحصة'), 'individual: the closing');
    assert.ok(seen.ar.includes('اختر مفهومًا من موضوعات الفصل الأول وعرّفه بكلماتك'), 'jigsaw: define');
    assert.ok(seen.ar.includes('اختر فكرة من موضوعات الفصل الأول وأعطِ مثالًا عليها'), 'game: example');
    assert.ok(seen.ar.includes('أو مثال منها.'), 'hands-on: the cards');
    assert.ok(seen.en.includes('Pick one concept from Semester 1 topics and define it in your own words'), 'jigsaw: define');
    assert.ok(seen.en.includes('Pick one idea from Semester 1 topics and give an example of it'), 'game: example');
    assert.ok(seen.en.includes('example from them on each card'), 'hands-on: the cards');
    assert.ok(seen.en.includes('it is the content of the session'), 'hands-on: the tip');
  });

  it('a lesson keeps its own sentences', () => {
    // The same lesson request, no scope: the table does not touch it.
    const req = { grade: 'الصف العاشر', subject: 'History', topic: 'الدولة الأموية', language: 'arabic', ...formatFields('individual') } as AIRequest;
    assert.ok(textOf(buildOfflineActivity(req, 0)).includes('غلق الدرس'));
  });
});

describe('offline activity — a lesson is unchanged', () => {
  it('a lesson request with a lesson table but no scope is built exactly as without one', () => {
    const coverage = buildScopeRequest(mathSem1, 'ar')!.fields.coverage;
    const lesson = { grade: 'الصف العاشر', subject: 'English', topic: 'الكتابة: تدوينة', language: 'arabic', lessonId: 'kbl-eng-s1-nccd-u2_l7' } as const;
    for (const f of FORMATS) {
      for (const v of [0, 3]) {
        const req = { ...lesson, ...formatFields(f) } as AIRequest;
        // Mutation caught: keying the revision branch on `coverage` instead of `scope`.
        assert.deepEqual(buildOfflineActivity({ ...req, coverage }, v), buildOfflineActivity(req, v), `${f} v${v}`);
      }
    }
  });
});

describe('nextActivityVariant — a wide scope keys its own counter', () => {
  it('a lesson\'s key is what it always was', () => {
    const req = { grade: 'x', subject: 'English', topic: 'الكتابة: تدوينة', language: 'arabic', lessonId: 'kbl-eng-s1-nccd-u2_l7', activityType: 'game' } as AIRequest;
    assert.equal(activityVariantKey(req), 'arabic|game|kbl-eng-s1-nccd-u2_l7|الكتابة: تدوينة');
    assert.equal(activityVariantKey({ ...req, activityVariant: 'warmup' }), 'arabic|warmup|kbl-eng-s1-nccd-u2_l7|الكتابة: تدوينة');
  });

  it('two grades\' «الكتاب كاملًا» do not share a regenerate counter', () => {
    const g10 = wideReq(book10, 'game');
    const g9 = wideReq(book9, 'game');
    assert.equal(g10.topic, g9.topic, 'probe: the two books share a label — the trap');
    assert.equal(activityVariantKey(g10), `arabic|game||${g10.topic}|book:grade-10:mathematics`);
    assert.equal(nextActivityVariant(g10), 0);
    assert.equal(nextActivityVariant({ ...g10, regenerate: true }), 1);
    assert.equal(nextActivityVariant({ ...g10, regenerate: true }), 2);
    // Mutation caught: leaving the scope key out — grade 9 would continue at 3.
    assert.equal(nextActivityVariant({ ...g9, regenerate: true }), 1, 'grade 9 continued grade 10\'s count');
  });
});

describe('the live clause lists every lesson the offline activity drew from', () => {
  it('for a unit whose lessons all have a bank', () => {
    const req = wideReq(circle, 'group');
    const probe = fresh();
    buildOfflineActivity(req, 0, probe);
    const body = req as unknown as Record<string, unknown>;
    const table = parseCoverage(body);
    assert.ok(table, 'the server reads no lesson table from this request');
    const clause = revisionClauseAr(body, 'activity');
    assert.notEqual(clause, '');
    assert.equal(probe.drawn.length, 4);
    for (const d of probe.drawn) {
      const row = table.lessons.find(l => l.id === d.lessonId);
      assert.ok(row, `${d.lessonId} is not in the table the server reads`);
      assert.ok(clause.includes(row.title), `the live clause does not list «${row.title}»`);
    }
  });
});

describe('offline activity — an English paper holds no Arabic outcome or concept', () => {
  const ARABIC = /[؀-ۿ]/;
  /** The Arabic text a lesson's objectives and key concepts hold: what `objectives` once filled an English paper with. */
  const arabicSource = (sel: ScopeSelection): string[] => lessonsInScope(sel)
    .flatMap(l => [...l.objectives, ...l.keyConceptsAr])
    .map(t => t.trim()).filter(t => t.length > 4);

  it('a history scope, which has no bank, is Arabic-free in every format (as the lesson path is)', () => {
    // Probe: the lesson path in English, for each history lesson of the scope.
    const lessonArabic = lessonsInScope(histSem1).flatMap(l => FORMATS.map(f => {
      const a = buildOfflineActivity({
        grade: 'Grade 10', subject: 'History', topic: l.titleEn, lessonId: l.id, language: 'english', ...formatFields(f),
      } as AIRequest);
      return ARABIC.test(textOf(a));
    }));
    assert.ok(lessonArabic.every(x => !x), 'probe: the lesson path prints Arabic in English for history');
    for (const sel of [histSem1, { kind: 'book', gradeId: 'grade-10', subjectId: 'history' } as ScopeSelection]) {
      for (const format of FORMATS) {
        const text = textOf(buildOfflineActivity(wideReq(sel, format, 'en')));
        // Mutation caught: `objectives` read from the Arabic concepts in an English paper.
        assert.ok(!ARABIC.test(text), `${sel.kind} ${format}: ${text.match(/[^\n]*[؀-ۿ][^\n]*/)?.[0]}`);
      }
    }
  });

  it('no scope puts one of its Arabic outcomes or concepts into an English paper', () => {
    for (const sel of [histSem1, mathSem1, chemSem1, circle]) {
      const source = arabicSource(sel);
      assert.ok(source.length > 0, `probe: ${sel.subjectId} has Arabic outcomes`);
      for (const format of FORMATS) {
        const text = textOf(buildOfflineActivity(wideReq(sel, format, 'en')));
        for (const t of source) assert.ok(!text.includes(t), `${sel.kind} ${sel.subjectId} ${format}: «${t}»`);
      }
    }
  });
});
