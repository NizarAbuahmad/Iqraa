/**
 * The pure pieces a revision activity is built from.
 *
 * A wide scope reaches the offline activity as a lesson table. These helpers
 * turn it into what the unchanged blueprints read — one composite lesson whose
 * concepts, rules, outcomes and terms are interleaved across the units — and
 * draw bank items one unit after another. Each test names the mutation it
 * catches.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  drawAcrossUnits, revisionActivityLesson, revisionLessonsByUnit,
  type RevisionDrawLesson, type RevisionLessonGroup,
} from '../ai/activityRevision.ts';
import { reviseWording } from '../ai/revisionWording.ts';
import { getBookForLesson, getLessonById, type KBLesson } from '../knowledgeBase.ts';
import { lessonsInScope, scopeKey, type ScopeSelection } from '../scopeSelection.ts';

const mathSem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'mathematics', semester: 1 };
const histSem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'history', semester: 1 };
const circle: ScopeSelection = { kind: 'unit', gradeId: 'grade-10', subjectId: 'mathematics', unitId: 'kbu-math-s1-nccd-u2' };
const TITLE = { ar: 'موضوعات الفصل الأول', en: 'Semester 1 topics' };

const ids = (sel: ScopeSelection) => lessonsInScope(sel).map(l => l.id);
/** The units of `groups` whose lessons hold `value` in the field `read` returns. */
const ownersOf = (groups: readonly RevisionLessonGroup[], read: (l: KBLesson) => readonly string[], value: string) =>
  groups.filter(g => g.lessons.some(l => read(l).includes(value))).map(g => g.unitId);

describe('revisionLessonsByUnit', () => {
  it('groups the table by unit in book order, dropping unknown and repeated ids', () => {
    const table = ids(mathSem1);
    const groups = revisionLessonsByUnit([...table, table[0]!, 'kbl-does-not-exist']);
    const known = table.map(id => getLessonById(id)).filter((l): l is KBLesson => !!l);
    assert.deepEqual(groups.map(g => g.unitId), [...new Set(known.map(l => l.unitId))]);
    assert.equal(groups.flatMap(g => g.lessons).length, known.length);
    for (const g of groups) for (const l of g.lessons) assert.equal(l.unitId, g.unitId);
  });
});

describe('revisionActivityLesson — the composite a blueprint reads', () => {
  const groups = revisionLessonsByUnit(ids(mathSem1));
  const kb = revisionActivityLesson(groups, scopeKey(mathSem1), { title: TITLE, lang: 'ar' });

  it('is filed under the scope, and under a real unit of its book', () => {
    assert.equal(kb.id, 'scope:sem:grade-10:mathematics:1');
    assert.equal(kb.unitId, groups[0]!.unitId);
    // Mutation caught: an empty unitId — `getBookForLesson` would then find no
    // subject, and the hands-on format and `isMathContext` would fall back to
    // the screen's subject NAME (CLAUDE.md: generators branch on it).
    assert.equal(getBookForLesson(kb)?.subjectId, 'mathematics');
    assert.equal(kb.titleAr, TITLE.ar);
    assert.equal(kb.titleEn, TITLE.en);
  });

  it('its first concepts, rules and outcomes come one per unit', () => {
    assert.ok(groups.length >= 3, 'probe: semester 1 has several units');
    const fields: Array<[string, readonly string[], (l: KBLesson) => readonly string[]]> = [
      ['keyConceptsAr', kb.keyConceptsAr, l => l.keyConceptsAr],
      ['rulesAr', kb.rulesAr ?? [], l => l.rulesAr ?? []],
      ['objectives', kb.objectives, l => l.objectives],
    ];
    for (const [name, list, read] of fields) {
      const lead = list.slice(0, groups.length);
      // Mutation caught: concatenating unit by unit instead of interleaving puts
      // the first unit's entries first, and every one-concept slot names it.
      const owners = new Set(lead.flatMap(v => ownersOf(groups, read, v)));
      assert.equal(owners.size, groups.length, `${name}: ${lead.join(' | ')}`);
    }
  });

  it('its terms start at the unit it is told', () => {
    const terms = (l: KBLesson) => l.keyTerms.map(t => t.ar);
    const shifted = revisionActivityLesson(groups, scopeKey(mathSem1), { title: TITLE, lang: 'ar', termsStartUnit: 1 });
    assert.deepEqual(ownersOf(groups, terms, kb.keyTerms[0]!.ar), [groups[0]!.unitId]);
    assert.deepEqual(ownersOf(groups, terms, shifted.keyTerms[0]!.ar), [groups[1]!.unitId]);
  });

  it('a lesson whose book lists no outcomes is represented by its key concepts', () => {
    const hist = revisionLessonsByUnit(ids(histSem1));
    assert.ok(hist.every(g => g.lessons.every(l => l.objectives.length === 0)), 'probe: the history book lists no outcomes');
    const h = revisionActivityLesson(hist, scopeKey(histSem1), { title: TITLE, lang: 'ar' });
    assert.ok(h.objectives.length >= 2, `${h.objectives.length}`);
    for (const o of h.objectives) assert.ok(hist.some(g => g.lessons.some(l => l.keyConceptsAr.includes(o))), o);
    assert.equal(new Set(h.objectives.flatMap(o => ownersOf(hist, l => l.keyConceptsAr, o))).size, hist.length);
  });

  it('an English paper\'s objectives are English key concepts, never the Arabic outcomes', () => {
    // Mutation caught: dropping the `lang === 'en'` branch hands an English
    // quick check and warm-up «Explain in your own words: الإمبراطوريّةُ…».
    for (const sel of [histSem1, mathSem1]) {
      const g = revisionLessonsByUnit(ids(sel));
      const en = revisionActivityLesson(g, scopeKey(sel), { title: TITLE, lang: 'en' });
      assert.ok(en.objectives.length >= 2, `${sel.subjectId}: ${en.objectives.length}`);
      for (const o of en.objectives) {
        assert.ok(!/[\u0600-\u06FF]/.test(o), o);
        assert.ok(g.some(x => x.lessons.some(l => l.keyConceptsEn.includes(o))), o);
      }
    }
  });

  it('a single unit still offers enough to fill a jigsaw', () => {
    const one = revisionActivityLesson(revisionLessonsByUnit(ids(circle)), scopeKey(circle), { title: TITLE, lang: 'ar' });
    // Mutation caught: a fixed two entries per unit — a one-unit revision would
    // then have two concepts, and the jigsaw pads its four parts with
    // phrase-shaped fillers.
    assert.ok(one.keyConceptsAr.length >= 4, `${one.keyConceptsAr.length}`);
  });
});

describe('drawAcrossUnits', () => {
  const fake = (unit: string, n: number): RevisionDrawLesson[] =>
    Array.from({ length: n }, (_, i) => ({ id: `${unit}-l${i}`, unitId: unit, topic: `${unit}-l${i}`, kb: {} as KBLesson }));

  it('takes one unit after another from the start unit, and a unit\'s next lesson on its next turn', () => {
    assert.deepEqual(
      drawAcrossUnits([fake('A', 2), fake('B', 1), fake('C', 2)], 5, 1, l => l.id),
      ['B-l0', 'C-l0', 'A-l0', 'B-l0', 'C-l1'],
    );
  });

  it('passes over a unit with no bank', () => {
    assert.deepEqual(drawAcrossUnits([fake('A', 1), [], fake('C', 1)], 3, 1, l => l.id), ['C-l0', 'A-l0', 'C-l0']);
  });

  it('tells the take which item it is drawing, for its tier', () => {
    const seen: number[] = [];
    drawAcrossUnits([fake('A', 3)], 3, 0, (_l, i) => { seen.push(i); return i; });
    assert.deepEqual(seen, [0, 1, 2]);
  });

  it('skips a lesson whose bank answers nothing, and stops rather than loop', () => {
    let calls = 0;
    assert.deepEqual(drawAcrossUnits([fake('A', 1), fake('B', 1)], 3, 0, () => { calls++; return null; }), []);
    assert.ok(calls <= 6, `${calls} calls`);
    assert.deepEqual(drawAcrossUnits([fake('A', 2)], 2, 0, l => (l.id === 'A-l0' ? null : l.id)), ['A-l1', 'A-l1']);
  });

  it('draws nothing from nothing', () => {
    assert.deepEqual(drawAcrossUnits([], 3, 0, l => l.id), []);
    assert.deepEqual(drawAcrossUnits([[], []], 3, 0, l => l.id), []);
  });
});

describe('reviseWording', () => {
  it('rewrites every string inside, in table order, and copies the rest', () => {
    const value = { a: 'x من درس «P» y من درس «P»', b: ['من درس «P»', 3], c: { d: null, e: true } };
    assert.deepEqual(
      reviseWording(value, [['من درس «P»', 'من P'], ['من P', 'عن P']]),
      { a: 'x عن P y عن P', b: ['عن P', 3], c: { d: null, e: true } },
    );
  });
});
