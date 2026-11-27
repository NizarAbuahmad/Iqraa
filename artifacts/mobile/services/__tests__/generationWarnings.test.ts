/**
 * A generated exam's warnings are worded by the app, in the teacher's language.
 *
 * Seen 2026-11-27 on a local build: an Arabic teacher who created a 5-question
 * evaluation read «Produced 3 of 5 requested questions» and «Competency … has
 * only 1 question…» on its page — English sentences the API wrote, carried
 * through the `?warnings=` URL param as they were. The API now also sends each
 * warning as a code and its parameters (`warningCodes`, one for one with
 * `warnings`), the URL carries those, and `services/i18n.ts` words them.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GENERATION_WARNING_CODES, type GenerationWarning, type GenerationWarningCode } from '@workspace/exam-paper';
import {
  decodeNotices,
  encodeNotices,
  generationNotices,
  wordNotice,
  wordNotices,
  type GenNotice,
} from '../generationWarnings.ts';

/** One warning per code, with the parameters a real paper gives it. */
const SAMPLES: { [C in GenerationWarningCode]: Extract<GenerationWarning, { code: C }> } = {
  objectives_uncovered: { code: 'objectives_uncovered', params: { count: 2, ids: ['o2', 'o3'] } },
  competency_single: { code: 'competency_single', params: { competency: 'critical_thinking' } },
  competency_missing: { code: 'competency_missing', params: { competency: 'application' } },
  true_false_one_sided: { code: 'true_false_one_sided', params: { count: 5, total: 6, value: true } },
  choice_position_bunched: { code: 'choice_position_bunched', params: { count: 4, total: 6, position: 1 } },
  same_ask: { code: 'same_ask', params: { count: 3, total: 10, example: 'حلّ المعادلة بالتحليل' } },
  keys_unlinked: { code: 'keys_unlinked', params: { count: 2 } },
  verifier_unreachable: { code: 'verifier_unreachable', params: {} },
  keys_contradicted: {
    code: 'keys_contradicted',
    params: { questions: [2, 5], details: [{ question: 2, derived: '6x', key: '3x^2 - 4' }, { question: 5, derived: '4', key: '5' }] },
  },
  no_objectives: { code: 'no_objectives', params: {} },
  no_type_producible: { code: 'no_type_producible', params: {} },
  types_skipped: { code: 'types_skipped', params: { types: ['matching', 'multiple_choice'] } },
  library_holds: { code: 'library_holds', params: { questionBanks: 2, pastPapers: 1, answerKeys: 0, referenceOnly: 1, documents: 4 } },
  shortfall: { code: 'shortfall', params: { made: 3, requested: 5 } },
  restatements_skipped: { code: 'restatements_skipped', params: { count: 2 } },
  model_discarded: { code: 'model_discarded', params: { count: 1 } },
  first_grade_types_dropped: { code: 'first_grade_types_dropped', params: { used: ['multiple_choice', 'true_false'], dropped: ['short_answer'] } },
  grounded_on: { code: 'grounded_on', params: { sources: [{ title: 'الرياضيات - الصف العاشر', page: 42 }] } },
  not_grounded: { code: 'not_grounded', params: {} },
  model_surplus_trimmed: { code: 'model_surplus_trimmed', params: { trimmed: 2, asked: 10 } },
  book_items_drawn: { code: 'book_items_drawn', params: { count: 3 } },
  book_items_short: { code: 'book_items_short', params: { drawn: 1, planned: 3 } },
  surplus_trimmed: { code: 'surplus_trimmed', params: { surplus: 1, requested: 15 } },
  no_key_checked: { code: 'no_key_checked', params: {} },
  marks_shared_short: { code: 'marks_shared_short', params: { written: 3, requested: 5, marks: 20, target: 20 } },
  marks_total_unreachable: { code: 'marks_total_unreachable', params: { target: 20, questions: 4, kept: 18 } },
};

const word = (w: GenerationWarning, lang: 'ar' | 'en') => wordNotice({ warning: w }, lang);

describe('every warning code', () => {
  it('has a sample here (a new code needs one, and its words in i18n.ts)', () => {
    assert.deepEqual(Object.keys(SAMPLES).sort(), [...GENERATION_WARNING_CODES].sort());
  });

  for (const code of GENERATION_WARNING_CODES) {
    it(`${code}: is Arabic in Arabic and English in English`, () => {
      const ar = word(SAMPLES[code], 'ar');
      const en = word(SAMPLES[code], 'en');
      assert.ok(ar && en, `${code} was not worded`);
      assert.match(ar!, /[ء-ي]/, `no Arabic in ${code}: ${ar}`);
      assert.doesNotMatch(ar!, /[A-Za-z]{4,}/, `English left in ${code}: ${ar}`);
      // Arabic digits in the Arabic, as the API's own Arabic sentences had them.
      assert.doesNotMatch(ar!, /[0-9]/, `Latin digit in ${code}: ${ar}`);
      assert.match(en!, /[A-Za-z]{4,}/, `no English in ${code}: ${en}`);
      for (const text of [ar!, en!]) {
        assert.doesNotMatch(text, /genWarn|undefined|NaN|\[object/, `${code} leaked: ${text}`);
      }
    });
  }
});

describe('the warnings seen on 2026-11-27', () => {
  it('read in Arabic, with the numbers and the competency by name', () => {
    assert.equal(word(SAMPLES.shortfall, 'ar'), 'كُتب من الأسئلة ٣ من أصل ٥ طلبتها.');
    assert.equal(word(SAMPLES.shortfall, 'en'), 'Produced 3 of 5 requested questions.');
    assert.match(word(SAMPLES.competency_single, 'ar')!, /«التفكير الناقد»/);
    assert.match(word(SAMPLES.competency_single, 'en')!, /Critical thinking/);
  });

  it('name question types by the picker’s names and options by the paper’s letter', () => {
    assert.match(word(SAMPLES.types_skipped, 'ar')!, /«توصيل» و«اختيار متعدد»/);
    assert.match(word(SAMPLES.choice_position_bunched, 'ar')!, /«ب»/);
    assert.match(word(SAMPLES.choice_position_bunched, 'en')!, /option B/);
  });

  it('keep the verifier’s arithmetic in English and the question numbers in both', () => {
    assert.match(word(SAMPLES.keys_contradicted, 'ar')!, /الأسئلة ٢ و٥/);
    assert.match(word(SAMPLES.keys_contradicted, 'en')!, /questions 2 and 5.*Question 2: the verifier derived "6x" where the key says "3x\^2 - 4"/);
  });
});

describe('generationNotices', () => {
  const shortfall = SAMPLES.shortfall;

  it('takes the code where the API sent one, and the sentences where it did not', () => {
    const notices = generationNotices({
      warnings: ['Produced 3 of 5 requested questions.', 'Something new'],
      warningsAr: ['كُتب…', 'شيء جديد'],
      warningCodes: [shortfall, null],
    });
    assert.deepEqual(notices, [{ warning: shortfall }, { en: 'Something new', ar: 'شيء جديد' }]);
    assert.deepEqual(wordNotices(notices, 'ar'), ['كُتب من الأسئلة ٣ من أصل ٥ طلبتها.', 'شيء جديد']);
    assert.deepEqual(wordNotices(notices, 'en'), ['Produced 3 of 5 requested questions.', 'Something new']);
  });

  it('falls back to sentences for a code this build does not know', () => {
    const notices = generationNotices({ warnings: ['New thing'], warningsAr: ['جديد'], warningCodes: [{ code: 'from_the_future', params: {} }] });
    assert.deepEqual(notices, [{ en: 'New thing', ar: 'جديد' }]);
  });

  it('trusts no list that does not line up with the English one', () => {
    assert.deepEqual(
      generationNotices({ warnings: ['A', 'B'], warningsAr: ['أ'], warningCodes: [shortfall] }),
      [{ en: 'A' }, { en: 'B' }],
    );
  });

  it('is empty when there is nothing to say', () => {
    assert.deepEqual(generationNotices({}), []);
  });

  it('shows the English sentence when an older API sent no Arabic', () => {
    assert.deepEqual(wordNotices(generationNotices({ warnings: ['A'] }), 'ar'), ['A']);
  });
});

describe('a coded warning with malformed parameters', () => {
  it('is dropped rather than printed with holes in it', () => {
    const bad = { code: 'shortfall', params: { made: 'three', requested: 5 } } as unknown as GenerationWarning;
    assert.equal(wordNotice({ warning: bad }, 'ar'), null);
    assert.deepEqual(wordNotices([{ warning: bad }, { warning: SAMPLES.no_objectives }], 'en'), [
      'No learning objectives were chosen, so nothing could be generated.',
    ]);
  });

  it('shows an unknown competency or type id as it is', () => {
    const w: GenerationWarning = { code: 'competency_missing', params: { competency: 'creativity' } };
    assert.match(word(w, 'en')!, /"creativity"/);
  });
});

describe('the route param', () => {
  it('carries codes and parameters, not sentences, and comes back the same', () => {
    const notices: GenNotice[] = [{ warning: SAMPLES.shortfall }, { warning: SAMPLES.same_ask }, { en: 'X', ar: 'س' }];
    const param = encodeNotices(notices);
    assert.doesNotMatch(param, /Produced|كُتب من/);
    assert.deepEqual(decodeNotices(param), notices);
  });

  it('is empty for no notices, and reads nothing from garbage or the old sentence format', () => {
    assert.equal(encodeNotices([]), '');
    assert.deepEqual(decodeNotices(undefined), []);
    assert.deepEqual(decodeNotices('Produced 3 of 5 requested questions.\nCompetency "x" has only 1 question'), []);
    assert.deepEqual(decodeNotices('{"warning":1}'), []);
    assert.deepEqual(
      decodeNotices(JSON.stringify([{ warning: { code: 'nope', params: {} } }, { en: 5 }, null, { en: 'ok' }])),
      [{ en: 'ok' }],
    );
  });
});
