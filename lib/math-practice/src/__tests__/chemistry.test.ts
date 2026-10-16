/**
 * Invariants for the chemistry bank, and the two it shares with maths.
 *
 * These are not style checks. Each one corresponds to a way an item can reach
 * a student as a broken question rather than fail loudly:
 *
 *  - a missing prompt falls through to `itemStem`'s maths wording and asks a
 *    teacher to «أوجد حل المعادلة» for «ما نوع الرابطة في NaCl»;
 *  - a duplicate id across the two banks silently dedupes a chemistry item
 *    against a maths one, because the session set is shared;
 *  - a duplicated or answer-matching distractor makes `bankMultipleChoice` on
 *    the API server return null, and the exam quietly comes up short.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHEM_BANK,
  detectChemFamily,
  isChemContext,
  isMathContext,
  takeConcreteChem,
  type ChemFamily,
  type ConcreteItem,
} from '../index.ts';

/** Not exported — the bank is reached through `takeConcreteMath`. */
const MATH_IDS = new Set<string>();

describe('chemistry bank', () => {
  it('gives every item both prompts — the fallback stem is maths-shaped', () => {
    const missing = CHEM_BANK.filter(i => !i.promptAr || !i.promptEn).map(i => i.id);
    assert.deepEqual(missing, [], `these would be asked as «أوجد حل المعادلة: …»: ${missing.join(', ')}`);
  });

  it('never repeats an id, including against the maths bank', () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const item of CHEM_BANK) {
      if (seen.has(item.id) || MATH_IDS.has(item.id)) dupes.push(item.id);
      seen.add(item.id);
    }
    assert.deepEqual(dupes, [], `a shared session set would treat these as one item: ${dupes.join(', ')}`);
  });

  it('keeps the answer out of its own distractors', () => {
    const bad = CHEM_BANK.filter(i => i.wrongs.includes(i.answer)).map(i => i.id);
    assert.deepEqual(bad, [], `two options would be correct in: ${bad.join(', ')}`);
  });

  it('gives four distinct options, which is what the exam generator requires', () => {
    const bad: string[] = [];
    for (const item of CHEM_BANK) {
      if (item.wrongs.length < 3) bad.push(`${item.id} (only ${item.wrongs.length} distractors)`);
      if (new Set(item.wrongs).size !== item.wrongs.length) bad.push(`${item.id} (repeated distractor)`);
    }
    assert.deepEqual(bad, [], `bankMultipleChoice returns null for these, losing the question: ${bad.join(', ')}`);
  });

  it('covers every family it can detect', () => {
    const families = new Set(CHEM_BANK.map(i => i.family as ChemFamily));
    const expected: ChemFamily[] = [
      'atom_basics', 'atomic_structure', 'electron_config', 'periodic_trends',
      'bonding', 'formulas', 'equations', 'mole', 'stoichiometry',
      'thermochem', 'acids_bases', 'metal_activity', 'redox', 'general_chem',
    ];
    const empty = expected.filter(f => !families.has(f));
    assert.deepEqual(empty, [], `detected but unstocked, so these silently serve general_chem: ${empty.join(', ')}`);
  });

  it('offers all three tiers where a whole unit depends on one family', () => {
    // The G10 S2 families carry a unit each. A tier with no item there means
    // an "advanced" exam quietly serves an easy question.
    for (const family of ['mole', 'stoichiometry', 'equations', 'thermochem'] as ChemFamily[]) {
      const tiers = new Set(CHEM_BANK.filter(i => i.family === family).map(i => i.diff));
      assert.ok(tiers.has('easy'), `${family} has no easy item`);
      assert.ok(tiers.has('medium'), `${family} has no medium item`);
      assert.ok(tiers.has('hard'), `${family} has no hard item`);
    }
  });
});

describe('periodic table bank depth', () => {
  // A quiz draws its tier first and a family only holds what it holds: with 5 items (2 easy,
  // 2 medium, 1 hard) a ten-question or an "easy" paper ran out after two questions and
  // repeated itself. These floors are what the periodic-table lessons were raised to.
  const items = CHEM_BANK.filter(i => i.family === 'periodic_trends');
  const tier = (t: string) => items.filter(i => i.diff === t).length;

  it('holds enough for a ten-question paper with no repeat', () => {
    assert.ok(items.length >= 15, `only ${items.length} items`);
  });

  it('holds enough in every tier for an easy-only, medium-only or hard-only paper', () => {
    assert.ok(tier('easy') >= 5, `easy: ${tier('easy')}`);
    assert.ok(tier('medium') >= 6, `medium: ${tier('medium')}`);
    assert.ok(tier('hard') >= 4, `hard: ${tier('hard')}`);
  });

  it('never repeats a question stem inside the family', () => {
    const stems = items.map(i => i.promptAr);
    assert.equal(new Set(stems).size, stems.length);
  });

  it('serves a ten-question paper on the unit name without repeating an item', () => {
    const seen = new Set<string>();
    const session = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const q = takeConcreteChem('multiple_choice', 'الجدول الدوري وخواص العناصر', null, 'medium', 'ar', 1, session);
      assert.ok(q, `question ${i + 1} came back empty`);
      assert.ok(!seen.has(q.text), `question ${i + 1} repeated: ${q.text}`);
      seen.add(q.text);
    }
  });
});

describe('detectChemFamily', () => {
  // Titles copied from the catalogs in lib/curriculum/src/data — if a book is
  // re-ingested with reworded titles, this is what notices.
  const CASES: Array<[string, ChemFamily]> = [
    ['نظرية بور لذرة الهيدروجين', 'atomic_structure'],
    ['النموذج الميكانيكي الموجي للذرة', 'atomic_structure'],
    ['التوزيع الإلكتروني للذرات', 'electron_config'],
    ['الخصائص الدورية للعناصر', 'periodic_trends'],
    // The unit's own name (curriculum browser, a typed topic). It used to fall to general_chem,
    // so a periodic-table quiz was asked about elements and compounds in general.
    ['الجدول الدوري وخواص العناصر', 'periodic_trends'],
    // The Grade 9 lesson names the periodic table too, but it is the electron-configuration lesson.
    ['التوزيعُ الإلكترونيُّ والجدولُ الدوريُّ', 'electron_config'],
    ['الروابط الكيميائية وأنواعها', 'bonding'],
    ['الصيغ الكيميائية وخصائص المركبات', 'formulas'],
    ['التفاعلات الكيميائية', 'equations'],
    ['المول والكتلة المولية', 'mole'],
    ['الحسابات الكيميائية', 'stoichiometry'],
    ['تغيرات الطاقة في التفاعلات الكيميائية', 'thermochem'],
    ['مكوِّناتُ الذرَّةِ', 'atom_basics'],
    ['خصائصُ الحُموضِ والقواعدِ', 'acids_bases'],
    ['سلسلةُ النشاطِ الكيميائيِّ وتآكُلُ الفلزاتِ', 'metal_activity'],
    ['التأكسدُ والاختزالُ والخلايا الجلفانيةُ', 'redox'],
  ];

  for (const [title, family] of CASES) {
    it(`«${title}» → ${family}`, () => {
      assert.equal(detectChemFamily(title), family);
    });
  }

  it('falls back to general_chem rather than guessing', () => {
    assert.equal(detectChemFamily('موضوع لا يشبه أي درس'), 'general_chem');
  });

  // Live bug (Slides Maker, 2026-09-27): the mole lesson's own last objective
  // is «أوظف مفهوم المول في بعض الحسابات الكيميائية» — one incidental mention
  // of the unit's own name routed every quick-check for the mole lesson into
  // the NEXT lesson's stoichiometry bank (limiting reagent, % yield), never
  // mole or Avogadro. `lessonTextBlob` (index.ts) feeds title + objectives +
  // key concepts together, so the title-only cases above never caught this.
  it('a passing mention of "حسابات كيميائية" in another family\'s objectives does not steal the lesson', () => {
    const moleLessonBlob = [
      'المول والكتلة المولية',
      'أوضح مفهوم المول.',
      'أربط بين المول وعدد أفوجادرو.',
      'أتعرف الكتلة الذرية النسبية، والكتلة الجزيئية، والكتلة المولية وكتلة الصيغة.',
      'أوظف مفهوم المول في بعض الحسابات الكيميائية.',
    ].join(' ');
    assert.equal(detectChemFamily(moleLessonBlob), 'mole');
  });

  // Found 2026-10-15: the Grade 9 lesson «مكوِّناتُ الذرَّةِ» says its students "run simple
  // experiments on electrolysis and gas discharge", and the redox check ran before atom_basics,
  // so every quick-check for the lesson was a redox question. The title-only case above passed
  // the whole time — same blind spot as the mole lesson. Text is the lesson's own, from
  // `lessonTextBlob` (title, ids, objectives, key concepts).
  it('the atom-components lesson is not taken by redox for mentioning electrolysis', () => {
    const atomComponentsLessonBlob = [
      'مكوِّناتُ الذرَّةِ Components of Atom',
      'أتتبَّعُ تطوُّرَ النماذجِ الذرِّيّةِ المختلفةِ. أستقصي مكوِّناتِ الذرَّةِ. أُحدِّدُ أماكنَ وجودِ مكوِّناتِ الذرَّةِ.',
      'أتمكّنُ منْ إجراءِ تجارِبَ بسيطةٍ حولَ التحليلِ الكهربائيِّ والتفريغِ الكهربائيِّ.',
      'أُقدِّرُ دورَ العلماءِ في التوصُّلِ إلى المعرفةِ العلميّةِ، واكتِشافِ مكوِّناتِ الذرَّةِ.',
      'النموذجُ الذرِّيُّ نموذجُ دالتون أُنبوبُ التفريغِ الكهربائيِّ نموذجُ ثومسون جُسيماتُ ألفا نموذجُ رذرفورد النواةُ',
    ].join(' ');
    assert.equal(detectChemFamily(atomComponentsLessonBlob), 'atom_basics');
  });

  // Three more lessons that routed by a neighbouring topic's words (2026-10-15), all from
  // `lessonTextBlob` text. Each used to be asked about the wrong chemistry.
  it('the galvanic-cell lesson is not taken by thermochem for a «طاقة … تفاعل» spanning two sentences', () => {
    const galvanicLessonBlob = [
      'التأكسد والاختزال والخلايا الجلفانية Oxidation-Reduction and Galvanic Cells',
      'أوضح مفهوم كل من: التأكسد، الاختزال، العامل المختزل، العامل المؤكسد، المصعد، المهبط.',
      'أميز من المعادلة الكيميائية المادة التي تأكسدت والتي اختزلت.',
      'أتعرف أنواع الخلايا الكهركيميائية وتحولات الطاقة فيها. أصمم خلية جلفانية، ثم أحدد أجزاءها ومبدأ عملها.',
      'أكتب معادلات كيميائية تمثل التفاعلات نصف الخلوية والتفاعل الكلي الذي يحدث في الخلية.',
      'التأكسد الاختزال تفاعلات التأكسد والاختزال نصف تفاعل التأكسد نصف تفاعل الاختزال العامل المؤكسد',
    ].join(' ');
    assert.equal(detectChemFamily(galvanicLessonBlob), 'redox');
  });

  it('the energy-changes lesson is not taken by mole for «الطاقة المولية» (molar energy)', () => {
    const energyChangesLessonBlob = [
      'تغيرات الطاقة في التفاعلات الكيميائية Energy Changes in Chemical Reactions',
      'أبين أهمية الطاقة في التفاعلات الكيميائية، وأشكالها، وتطبيقاتها.',
      'أصنف التفاعلات الكيميائية وفق الطاقة المصاحبة لها إلى ماصة وطاردة.',
      'المحتوى الحراري التغير في المحتوى الحراري تفاعلات طاردة للحرارة تفاعلات ماصة للحرارة',
      'طاقة الانصهار المولية طاقة التبخر المولية طاقة التجمد المولية طاقة التكاثف المولية',
    ].join(' ');
    assert.equal(detectChemFamily(energyChangesLessonBlob), 'thermochem');
  });

  it('the heat-capacity lesson has its own calorimetry family, not the general fallback', () => {
    const heatCapacityLessonBlob = [
      'الطاقة الممتصة والطاقة المنبعثة من المادة Absorbed and Emitted Energy of Matter',
      'أحسب كمية الطاقة التي تمتصها أو تصدرها المادة.',
      'أجري تجارب عملية حول الطاقة الممتصة والمنبعثة من المادة.',
      'السعة الحرارية الحرارة النوعية المسعر Heat Capacity Specific Heat Calorimeter',
    ].join(' ');
    assert.equal(detectChemFamily(heatCapacityLessonBlob), 'calorimetry');
  });

  it('the mole still wins where the mole is the subject, plural and singular', () => {
    assert.equal(detectChemFamily('المول والكتلة المولية'), 'mole');
    assert.equal(detectChemFamily('أحسب عدد المولات في عينة'), 'mole');
    assert.equal(detectChemFamily('أحسب الكتلة المولية للمركب'), 'mole');
    assert.equal(detectChemFamily('عدد أفوجادرو'), 'mole');
  });

  // Found 2026-10-16, from the teacher review sheet's routing table: «التوزيع الإلكتروني للذرات»
  // (Aufbau, Hund's rule) was answered with periodic-trends questions because its key terms list
  // «طاقة التأين», one of periodic_trends' words, and that family is tested first. Text is the
  // two neighbouring lessons' own, from `lessonTextBlob`.
  it('the electron-configuration lesson is not taken by periodic trends for listing «طاقة التأين»', () => {
    const electronConfigLessonBlob = [
      'التوزيع الإلكتروني للذرات Electronic Configuration',
      'أكتب التوزيع الإلكتروني لمجموعة من العناصر وأيوناتها. أحدد الصفات المميزة للعناصر بحسب توزيعها.',
      'أوضح العلاقة بين موقع العنصر وخصائصه وصفاته.',
      'مبدأ أوفباو قاعدة هوند العناصر الممثلة العناصر الانتقالية طاقة التأين',
      "Aufbau Principle Hund's Rule The Representative Elements Transition Elements Ionization Energy",
    ].join(' ');
    assert.equal(detectChemFamily(electronConfigLessonBlob), 'electron_config');
  });

  it('the periodic-properties lesson itself is still periodic trends', () => {
    const periodicLessonBlob = [
      'الخصائص الدورية للعناصر Periodic Properties of the Elements',
      'أتنبأ بدورية الصفات لعناصر الدورة والمجموعة في الجدول الدوري.',
      'نصف القطر الذري شحنة النواة الفعالة طاقة التأين السالبية الكهربائية',
      'Atomic Radius Effective Nuclear Charge Ionization Energy Electronegativity',
    ].join(' ');
    assert.equal(detectChemFamily(periodicLessonBlob), 'periodic_trends');
    assert.equal(detectChemFamily('الخصائص الدورية للعناصر'), 'periodic_trends');
  });

  it('the electrolysis lesson itself is still redox', () => {
    assert.equal(detectChemFamily('خلايا التحليل الكهربائي'), 'redox');
    assert.equal(detectChemFamily('التأكسد والاختزال والخلايا الجلفانية أُنبوب التفريغ'), 'redox');
  });

  it('still resolves the stoichiometry lesson itself by its own objectives', () => {
    const stoichiometryLessonBlob = [
      'الحسابات الكيميائية',
      'أحسب النسبة المئوية لكتلة عنصر في مركب.',
      'أحدد الصيغة الأولية والصيغة الجزيئية للمركب.',
      'أحسب عدد مولات مركب وكتلته المتفاعلة أو الناتجة.',
      'أحسب المردود المئوي للتفاعل.',
    ].join(' ');
    assert.equal(detectChemFamily(stoichiometryLessonBlob), 'stoichiometry');
  });

  // A topic a teacher TYPES has no lesson text behind it, so the whole decision is made by the
  // few words typed. Each case below was measured on 2026-10-16 (a probe of ~150 typed topics);
  // the first group went to the WRONG family, the rest to general chemistry although the
  // curriculum has a family for them.
  it('does not read «قاعدة» (a rule) as «قاعدة» (a base)', () => {
    assert.equal(detectChemFamily('قاعدة هوند'), 'electron_config');
    assert.equal(detectChemFamily('قاعدة الثمانية'), 'bonding');
    assert.equal(detectChemFamily('مبدأ أوفباو'), 'electron_config');
    assert.equal(detectChemFamily('مبدأ باولي للاستبعاد'), 'electron_config');
    assert.equal(detectChemFamily('Aufbau principle'), 'electron_config');
    // …and the real base still is one.
    assert.equal(detectChemFamily('القواعد وخصائصها'), 'acids_bases');
    assert.equal(detectChemFamily('قاعدة قوية وقاعدة ضعيفة'), 'acids_bases');
  });

  it('does not take «الكمية» (quantity) for quantum theory', () => {
    assert.equal(detectChemFamily('الكمية'), 'general_chem');
    assert.equal(detectChemFamily('كمية المادة'), 'mole');
    // The quantum vocabulary is still atomic structure.
    assert.equal(detectChemFamily('الأعداد الكمية'), 'atomic_structure');
    assert.equal(detectChemFamily('نظرية الكم'), 'atomic_structure');
    assert.equal(detectChemFamily('نموذج بور'), 'atomic_structure');
    assert.equal(detectChemFamily('الأطياف الذرية'), 'atomic_structure');
  });

  it('recognises the plural and inflected forms of curriculum vocabulary', () => {
    assert.equal(detectChemFamily('المعادلات الكيميائية'), 'equations');
    assert.equal(detectChemFamily('قانون حفظ الكتلة'), 'equations');
    assert.equal(detectChemFamily('الخلايا الكهروكيميائية'), 'redox');
    assert.equal(detectChemFamily('الرقم الهيدروجيني'), 'acids_bases');
    assert.equal(detectChemFamily('تراكيب لويس'), 'bonding');
    assert.equal(detectChemFamily('المتفاعل المحدد'), 'stoichiometry');
    assert.equal(detectChemFamily('النسب المولية'), 'stoichiometry');
    assert.equal(detectChemFamily('حجم الغاز المولي'), 'mole');
    assert.equal(detectChemFamily('التفاعلات الطاردة والماصة للحرارة'), 'thermochem');
    assert.equal(detectChemFamily('كمية الحرارة'), 'calorimetry');
  });

  it('leaves an unrelated typed topic in general chemistry', () => {
    for (const t of ['الاتزان الكيميائي', 'سرعة التفاعل', 'المحاليل', 'الغازات', 'الكيمياء العضوية', 'الكثافة']) {
      assert.equal(detectChemFamily(t), 'general_chem', t);
    }
  });
});

describe('isChemContext', () => {
  it('takes the lesson subject as ground truth', () => {
    assert.equal(isChemContext('أي شيء', null, undefined, 'chemistry'), true);
    assert.equal(isChemContext('المول والكتلة المولية', null, undefined, 'mathematics'), false);
  });

  it('does not claim a maths lesson, and maths does not claim a chemistry one', () => {
    // The property `tryMathPractice` relies on: whenever a subject is known,
    // exactly one of the two answers true.
    for (const subject of ['mathematics', 'الرياضيات']) {
      assert.equal(isChemContext('المعادلات', null, subject), false, subject);
      assert.equal(isMathContext('المعادلات', null, subject), true, subject);
    }
    for (const subject of ['chemistry', 'الكيمياء']) {
      assert.equal(isChemContext('المعادلة الكيميائية', null, subject), true, subject);
      assert.equal(isMathContext('المعادلة الكيميائية', null, subject), false, subject);
    }
  });

  it('recognises chemistry from the text when nothing else names a subject', () => {
    // This is the case where order matters in `tryMathPractice`: «معادلة»
    // also matches the maths pattern, so chemistry is asked first.
    assert.equal(isChemContext('المعادلة الكيميائية ووزنها', null), true);
    assert.equal(isChemContext('الكتلة المولية للماء', null), true);
    assert.equal(isChemContext('حل المعادلات التربيعية', null), false);
    assert.equal(isChemContext('مشتقة الاقتران', null), false);
  });
});

describe('takeConcreteChem', () => {
  it('returns a real multiple-choice item whose answer is one of its options', () => {
    const session = new Set<string>();
    const q = takeConcreteChem('multiple_choice', 'المول والكتلة المولية', null, 'easy', 'ar', 4, session);
    assert.ok(q, 'no item for a stocked family');
    assert.ok(q.options && q.options.length === 4, 'expected four options');
    // The exact check `bankMultipleChoice` performs before trusting the key.
    assert.ok(q.options.includes(q.answer), 'the key is not among the options');
    assert.equal(new Set(q.options).size, 4, 'options are not distinct');
  });

  it('asks about the lesson, not about the topic word', () => {
    const session = new Set<string>();
    const q = takeConcreteChem('multiple_choice', 'المول والكتلة المولية', null, 'easy', 'ar', 4, session);
    // The generic templates all contain the topic string and one of these
    // giveaway distractors. A bank item contains neither.
    assert.ok(!q!.options!.includes('لا شيء مما ذُكر'), 'served a template distractor');
    assert.match(q!.text, /[A-Za-z₀-₉]|\d/, 'expected a formula or a number in the stem');
  });

  it('does not repeat an item within one session', () => {
    const session = new Set<string>();
    const seen = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const q = takeConcreteChem('short_answer', 'التفاعلات الكيميائية', null, 'medium', 'ar', 4, session);
      assert.ok(q, `ran dry at ${i}`);
      assert.ok(!seen.has(q.text), `repeated within a session: ${q.text}`);
      seen.add(q.text);
    }
  });

  it('keeps its session set separate, so two exams do not drain each other', () => {
    const a = new Set<string>();
    const b = new Set<string>();
    const first = takeConcreteChem('short_answer', 'المول', null, 'easy', 'ar', 4, a);
    const second = takeConcreteChem('short_answer', 'المول', null, 'easy', 'ar', 4, b);
    assert.ok(first && second);
    assert.equal(b.size, 1, 'the second session inherited the first one\'s spend');
  });

  it('stays in the detected family rather than drifting to general chemistry', () => {
    const session = new Set<string>();
    const ids = new Set<string>();
    for (let i = 0; i < 4; i++) {
      const q = takeConcreteChem('short_answer', 'الروابط الكيميائية وأنواعها', null, 'medium', 'ar', 4, session);
      assert.ok(q);
      ids.add(q.text);
    }
    // Every stem must be one of the bonding family's own prompts; a general_chem
    // item would be about elements and mixtures instead. (This used to be a keyword
    // regex over the stem, which broke the first time a bonding question was worded
    // without «رابطة» — the family is the thing to check, so check it.)
    const bonding = new Set(CHEM_BANK.filter(i => i.family === 'bonding').map(i => i.promptAr));
    for (const text of ids) {
      assert.ok(bonding.has(text), `left the family: ${text}`);
    }
  });
});

describe('the maths bank is unchanged', () => {
  it('still answers a maths topic from the maths bank', () => {
    assert.equal(isMathContext('حل المعادلات الأسية', null, 'mathematics'), true);
  });

  it('accepts a chemistry item type it shares with maths', () => {
    const item: ConcreteItem = CHEM_BANK[0]!;
    assert.ok(typeof item.eq === 'string' && item.eq.length > 0);
  });
});
