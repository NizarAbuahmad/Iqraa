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
const SUBJECT: Record<string, string> = { mathematics: 'Mathematics', chemistry: 'Chemistry', history: 'History' };

const mathSem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'mathematics', semester: 1 };
const chemSem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'chemistry', semester: 1 };
const histSem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'history', semester: 1 };
const book10: ScopeSelection = { kind: 'book', gradeId: 'grade-10', subjectId: 'mathematics' };
const book9: ScopeSelection = { kind: 'book', gradeId: 'grade-9', subjectId: 'mathematics' };
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
        for (const v of [0, 1, 2]) {
          before += textOf(buildOfflineActivity({
            grade: 'الصف العاشر', subject: 'History', topic: phrase,
            language: lang === 'ar' ? 'arabic' : 'english', ...formatFields(f),
          } as AIRequest, v)) + '\n';
        }
      }
      for (const [from] of table) assert.ok(before.includes(from), `${lang}: dead entry «${from}»`);
      // Applied: no wide activity keeps one. Mutation caught: dropping the
      // `reviseWording` call (the hands-on sort task keeps «من درس «…»»).
      for (const f of FORMATS) {
        for (const v of [0, 1, 2]) {
          const t = textOf(buildOfflineActivity(wideReq(histSem1, f, lang), v));
          for (const [from] of table) assert.ok(!t.includes(from), `${lang} ${f} v${v}: «${from}»`);
          assert.ok(!t.includes(scopeLabel(histSem1, lang)), `${lang} ${f} v${v} spliced the label`);
        }
      }
    }
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
