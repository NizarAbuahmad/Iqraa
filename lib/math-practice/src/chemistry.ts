/**
 * Concrete chemistry practice — the bank the quiz/worksheet/exam generators
 * fall back to instead of subject-blind templates.
 *
 * Why this exists: `isMathContext` is deliberately subject-authoritative, so a
 * chemistry lesson correctly answers `false` and every chemistry question then
 * came out of the generic template list in `generators.ts` — «أيّ مما يلي
 * يُعرِّف {الموضوع} بشكل صحيح؟» with «لا شيء مما ذُكر» as a distractor. That is
 * the whole of "the exams feel generic" for chemistry: a question that names
 * the topic but asks nothing about it, and whose wrong options a student can
 * eliminate without knowing any chemistry.
 *
 * Items here are solvable and their answers are known by construction, which
 * is the same property the maths bank has and the only property that makes a
 * self-marking exam possible (see `mockGenerator.ts`). Distractors are real
 * misconceptions — the off-by-one electron count, the unbalanced coefficient,
 * the forgotten subscript in a molar mass — so a wrong answer tells a teacher
 * *which* mistake was made.
 *
 * Coverage follows the Jordanian catalogs actually in the repo:
 *   grade 10 S1  بنية الذرة · التوزيع الإلكتروني والدورية · الروابط والصيغ
 *   grade 10 S2  التفاعلات والحسابات الكيميائية · الطاقة الكيميائية
 *   grade 9      مكونات الذرة · الحموض والقواعد · نشاط الفلزات · التأكسد والاختزال
 *
 * Every item carries `promptAr`/`promptEn`. `itemStem`'s no-prompt fallback is
 * maths-shaped («أوجد حل المعادلة…»), which would be wrong on all of these —
 * `chemistry.test.ts` pins that none are missing.
 */
import type { ConcreteItem, KBLesson } from './index.ts';
// Value import from `./subjects.ts`, not `./index.ts`: index imports the bank
// from this file, so importing a value back would close a cycle.
import { subjectIdFromName } from './subjects.ts';

export type ChemFamily =
  | 'atom_basics'
  | 'atomic_structure'
  | 'electron_config'
  | 'periodic_trends'
  | 'bonding'
  | 'formulas'
  | 'equations'
  | 'mole'
  | 'stoichiometry'
  | 'thermochem'
  | 'acids_bases'
  | 'metal_activity'
  | 'redox'
  | 'general_chem';

/**
 * Last-resort text heuristic, used only for a free-text topic with no lesson
 * picked and no subject passed. Deliberately narrower than the maths one:
 * «تفاعل» and «طاقة» appear in physics and biology lessons too, so this asks
 * for vocabulary that is chemistry and nothing else.
 */
const CHEM_TEXT_RE =
  /كيميا|chemistr|kbl-chem|kbu-chem|kb-chem|ذرَّة|الذرة|إلكترون|نيوترون|بروتون|مول\b|الكتلة المولية|تكافؤ|أيون|تأكسد|اختزال|حمض|حموض|قاعدة كيميائية|قلوي|جدول دوري|رابطة أيونية|رابطة تساهمية|صيغة كيميائية|معادلة كيميائية|molar mass|mole\b|stoichiometr|electron config|periodic table|covalent|ionic bond|oxidation|redox|acid|alkali/i;

/**
 * Is this generation for a chemistry lesson?
 *
 * Same precedence as `isMathContext`, for the same reason: the lesson's own
 * subject id is ground truth, the caller's `subject` string is the fallback
 * for an ungrounded topic, and the text heuristic only runs when neither says
 * anything. A maths lesson on «المعادلات» must not answer true here just
 * because a chemical equation is also a معادلة. The guessed-lesson limitation
 * documented on `isMathContext` applies here too.
 */
export function isChemContext(
  topic: string,
  kb: KBLesson | null,
  subject?: string,
  lessonSubjectId?: string,
  textBlob?: string,
): boolean {
  if (lessonSubjectId) return lessonSubjectId === 'chemistry';

  const named = subjectIdFromName(subject);
  if (named) return named === 'chemistry';

  return CHEM_TEXT_RE.test(bare(textBlob ?? topic));
}

/**
 * Arabic diacritics, plus the tatweel.
 *
 * The grade 9 catalogs are fully vowelled — «مكوِّناتُ الذرَّةِ»، «سلسلةُ
 * النشاطِ الكيميائيِّ» — because they were transcribed from books that print
 * the harakat. A pattern written in bare Arabic matches none of it, and every
 * grade 9 lesson silently fell to `general_chem`. Normalising here rather than
 * writing each pattern twice, and rather than normalising the catalogs, which
 * would throw away text the reader is meant to see.
 */
const DIACRITICS = /[ً-ٟـٰ]/g;

function bare(text: string): string {
  return text.replace(DIACRITICS, '');
}

/** Which corner of the chemistry curriculum this lesson sits in. */
export function detectChemFamily(raw: string): ChemFamily {
  const blob = bare(raw);
  // Grade 10 S2 first: its families are the most specific, and «تفاعل» in a
  // stoichiometry lesson must not be caught by the general equations branch.
  //
  // Only the unambiguous stoichiometry vocabulary goes here — limiting
  // reagent, percent yield, mole ratio. The generic "حسابات كيميائية"
  // ("chemical calculations") phrase used to sit in this same branch, and it
  // is the unit's own name («التفاعلات والحسابات الكيميائية»): the mole
  // lesson's own objectives close with «أوظف مفهوم المول في بعض الحسابات
  // الكيميائية», so that one incidental mention routed every quick-check for
  // the mole lesson into the NEXT lesson's stoichiometry bank — limiting
  // reagent and % yield, never mole/Avogadro. That generic phrase is checked
  // last below, only once every more specific family (mole included) has had
  // its chance to claim the lesson first.
  if (/المردود|الكاشف المحدد|stoichiometr|limiting reagent|mole ratio|نسب مولية/i.test(blob)) return 'stoichiometry';
  if (/المول|الكتلة المولية|أفوجادرو|molar mass|avogadro|\bmole\b/i.test(blob)) return 'mole';
  if (/طاقة.*تفاعل|تفاعل.*طاقة|ماص للطاقة|طارد للطاقة|المحتوى الحراري|إنثالبي|enthalpy|exotherm|endotherm|heat of reaction/i.test(blob)) return 'thermochem';
  if (/معادلة كيميائية|وزن المعادل|موازنة|التفاعلات الكيميائية|chemical equation|balanc|reaction type/i.test(blob)) return 'equations';

  // Grade 10 S1
  if (/الصيغ الكيميائية|الصيغة الكيميائية|تسمية المركب|chemical formula|nomenclature/i.test(blob)) return 'formulas';
  if (/رابطة|روابط|تساهمي|أيونية|فلزية|bond|covalent|ionic|metallic/i.test(blob)) return 'bonding';
  if (/الخصائص الدورية|نصف القطر|طاقة التأين|الكهروسالبية|periodic (trend|propert)|atomic radius|ionization|electronegativ/i.test(blob)) return 'periodic_trends';
  if (/التوزيع الإلكتروني|المستويات الفرعية|أوربيتال|electron config|orbital|subshell/i.test(blob)) return 'electron_config';
  // The unit's own name, «الجدول الدوري وخواص العناصر». Checked after electron_config on purpose:
  // the Grade 9 lesson «التوزيع الإلكتروني والجدول الدوري» names the table too but is that lesson.
  // Deliberately narrow — «الجدول الدوري» alone appears in other lessons' objectives.
  if (/الجدول الدوري وخواص|خواص العناصر|periodic table and (element )?propert/i.test(blob)) return 'periodic_trends';
  if (/نظرية بور|الطيف الذري|الميكانيكي الموجي|الكم|bohr|spectrum|quantum|wave mechanical/i.test(blob)) return 'atomic_structure';

  // Grade 9
  // The lesson's own name, ahead of redox on purpose: its objectives say students "run simple
  // experiments on electrolysis and gas discharge", which the redox pattern below would take as
  // an electrolysis lesson. Deliberately narrow — only the name of the lesson, not its topic words.
  if (/مكونات الذرة|components of (the )?atom\b/i.test(blob)) return 'atom_basics';
  if (/تأكسد|اختزال|جلفاني|التحليل الكهربائي|خلية|redox|oxidation|reduction|galvanic|electroly/i.test(blob)) return 'redox';
  if (/نشاط الفلزات|سلسلة النشاط|تآكل|صدأ|activity series|corrosion|rust/i.test(blob)) return 'metal_activity';
  if (/حمض|حموض|قاعدة|قواعد|أملاح|تعادل|قلوي|acid|base|alkali|neutralis|neutraliz|\bpH\b/i.test(blob)) return 'acids_bases';
  if (/مكونات الذرة|العدد الذري|العدد الكتلي|نظائر|بروتون|نيوترون|atomic number|mass number|isotope|proton|neutron/i.test(blob)) return 'atom_basics';

  // The generic "chemical calculations" phrase, last: it is the unit's own
  // name and the weakest signal of the lot, so it only decides a lesson no
  // sharper family above has already claimed — which is exactly the bare
  // lesson title «الحسابات الكيميائية» itself.
  if (/(ال)?حسابات (ال)?كيميائية/i.test(blob)) return 'stoichiometry';

  return 'general_chem';
}

/**
 * The bank.
 *
 * Atomic masses are the rounded values the Jordanian books print (H 1, C 12,
 * N 14, O 16, Na 23, Mg 24, S 32, Cl 35.5, Ca 40, Fe 56, Cu 64), so a student
 * checking against their own periodic table gets the same number.
 */
export const CHEM_BANK: ConcreteItem[] = [
  // ── مكونات الذرة (grade 9) ──
  {
    id: 'ch-ab-e1', family: 'atom_basics', diff: 'easy', eq: 'Na: Z = 11, A = 23',
    answer: '11 بروتونًا و12 نيوترونًا', wrongs: ['11 بروتونًا و23 نيوترونًا', '23 بروتونًا و11 نيوترونًا', '12 بروتونًا و11 نيوترونًا'],
    promptAr: 'ذرة الصوديوم عددها الذري 11 وعددها الكتلي 23. كم بروتونًا وكم نيوترونًا فيها؟',
    promptEn: 'A sodium atom has atomic number 11 and mass number 23. How many protons and neutrons does it have?',
  },
  {
    id: 'ch-ab-e2', family: 'atom_basics', diff: 'easy', eq: 'Cl: Z = 17, A = 35',
    answer: '18 نيوترونًا', wrongs: ['17 نيوترونًا', '35 نيوترونًا', '52 نيوترونًا'],
    promptAr: 'ذرة كلور عددها الذري 17 وعددها الكتلي 35. كم نيوترونًا فيها؟',
    promptEn: 'A chlorine atom has atomic number 17 and mass number 35. How many neutrons does it have?',
  },
  {
    id: 'ch-ab-m1', family: 'atom_basics', diff: 'medium', eq: 'O²⁻: Z = 8',
    answer: '8 بروتونات و10 إلكترونات', wrongs: ['8 بروتونات و8 إلكترونات', '10 بروتونات و8 إلكترونات', '8 بروتونات و6 إلكترونات'],
    promptAr: 'أيون الأكسيد O²⁻ عدده الذري 8. كم بروتونًا وكم إلكترونًا فيه؟',
    promptEn: 'The oxide ion O²⁻ has atomic number 8. How many protons and electrons does it have?',
  },
  {
    id: 'ch-ab-m2', family: 'atom_basics', diff: 'medium', eq: '¹²C / ¹⁴C',
    answer: 'العدد الذري نفسه والعدد الكتلي مختلف', wrongs: ['العدد الكتلي نفسه والعدد الذري مختلف', 'عدد الإلكترونات مختلف والشحنة مختلفة', 'كلاهما مختلف'],
    promptAr: 'ما الذي يشترك فيه نظيرا الكربون ¹²C و¹⁴C وما الذي يختلفان فيه؟',
    promptEn: 'What do the carbon isotopes ¹²C and ¹⁴C share, and what differs?',
  },
  {
    id: 'ch-ab-h1', family: 'atom_basics', diff: 'hard', eq: 'X: p = 20, n = 20',
    answer: 'العدد الذري 20 والعدد الكتلي 40', wrongs: ['العدد الذري 40 والعدد الكتلي 20', 'العدد الذري 20 والعدد الكتلي 20', 'العدد الذري 40 والعدد الكتلي 40'],
    promptAr: 'ذرة فيها 20 بروتونًا و20 نيوترونًا. ما عددها الذري وعددها الكتلي؟',
    promptEn: 'An atom has 20 protons and 20 neutrons. What are its atomic number and mass number?',
  },

  // ── بنية الذرة: بور والنموذج الموجي (grade 10 S1) ──
  {
    id: 'ch-as-e1', family: 'atomic_structure', diff: 'easy', eq: 'n = 1 → n = 3',
    answer: 'يمتص طاقة', wrongs: ['ينبعث منه طاقة', 'لا يتغير محتواه من الطاقة', 'يفقد إلكترونًا'],
    promptAr: 'ينتقل إلكترون في ذرة الهيدروجين من المستوى n = 1 إلى المستوى n = 3. هل يمتص طاقة أم ينبعث منه طاقة؟',
    promptEn: 'An electron in a hydrogen atom moves from n = 1 to n = 3. Does it absorb or emit energy?',
  },
  {
    id: 'ch-as-e2', family: 'atomic_structure', diff: 'easy', eq: 'n = 3',
    answer: '18 إلكترونًا', wrongs: ['9 إلكترونات', '6 إلكترونات', '32 إلكترونًا'],
    promptAr: 'ما أكبر عدد من الإلكترونات يتسع له مستوى الطاقة الثالث (n = 3)؟ استعمل القاعدة 2n².',
    promptEn: 'What is the maximum number of electrons in energy level n = 3? Use the rule 2n².',
  },
  {
    id: 'ch-as-m1', family: 'atomic_structure', diff: 'medium', eq: 'E = −13.6/n² eV, n = 2',
    answer: '−3.4 eV', wrongs: ['−6.8 eV', '−13.6 eV', '−1.51 eV'],
    promptAr: 'طاقة الإلكترون في ذرة الهيدروجين تُعطى بالعلاقة E = −13.6/n² إلكترون فولت. أوجد طاقة المستوى n = 2.',
    promptEn: 'The electron energy in hydrogen is E = −13.6/n² eV. Find the energy of level n = 2.',
  },
  {
    id: 'ch-as-m2', family: 'atomic_structure', diff: 'medium', eq: 'الطيف الخطي',
    answer: 'أن طاقة الإلكترون مكمّاة في مستويات محددة', wrongs: ['أن الإلكترون يدور في مدار بيضوي', 'أن الذرة متعادلة كهربائيًا', 'أن النواة تحتوي على نيوترونات'],
    promptAr: 'ظهور طيف الهيدروجين على صورة خطوط منفصلة لا طيفًا متصلًا. على أيّ شيء يدل ذلك؟',
    promptEn: "Hydrogen's spectrum appears as separate lines rather than a continuous band. What does that show?",
  },
  {
    id: 'ch-as-h1', family: 'atomic_structure', diff: 'hard', eq: 'المستوى الفرعي p',
    answer: '3 أوربيتالات تتسع لـ6 إلكترونات', wrongs: ['أوربيتال واحد يتسع لإلكترونين', '5 أوربيتالات تتسع لـ10 إلكترونات', '3 أوربيتالات تتسع لـ3 إلكترونات'],
    promptAr: 'كم أوربيتالًا في المستوى الفرعي p، وكم إلكترونًا يتسع له؟',
    promptEn: 'How many orbitals are in a p subshell, and how many electrons does it hold?',
  },

  // ── التوزيع الإلكتروني ──
  {
    id: 'ch-ec-e1', family: 'electron_config', diff: 'easy', eq: 'Mg: Z = 12',
    answer: '1s² 2s² 2p⁶ 3s²', wrongs: ['1s² 2s² 2p⁶ 3s¹', '1s² 2s² 2p⁶ 3s² 3p²', '1s² 2s² 2p⁸ 3s²'],
    promptAr: 'اكتب التوزيع الإلكتروني لذرة المغنيسيوم (Z = 12).',
    promptEn: 'Write the electron configuration of a magnesium atom (Z = 12).',
  },
  {
    id: 'ch-ec-e2', family: 'electron_config', diff: 'easy', eq: 'Cl: Z = 17',
    answer: '1s² 2s² 2p⁶ 3s² 3p⁵', wrongs: ['1s² 2s² 2p⁶ 3s² 3p⁶', '1s² 2s² 2p⁶ 3s² 3p⁴', '1s² 2s² 2p⁵ 3s² 3p⁶'],
    promptAr: 'اكتب التوزيع الإلكتروني لذرة الكلور (Z = 17).',
    promptEn: 'Write the electron configuration of a chlorine atom (Z = 17).',
  },
  {
    id: 'ch-ec-m1', family: 'electron_config', diff: 'medium', eq: 'P: Z = 15',
    answer: '5 إلكترونات', wrongs: ['3 إلكترونات', '15 إلكترونًا', '8 إلكترونات'],
    promptAr: 'كم إلكترون تكافؤ في ذرة الفوسفور (Z = 15)؟',
    promptEn: 'How many valence electrons does a phosphorus atom (Z = 15) have?',
  },
  {
    id: 'ch-ec-m2', family: 'electron_config', diff: 'medium', eq: 'Ca: Z = 20',
    answer: '1s² 2s² 2p⁶ 3s² 3p⁶ 4s²', wrongs: ['1s² 2s² 2p⁶ 3s² 3p⁶ 3d²', '1s² 2s² 2p⁶ 3s² 3p⁸', '1s² 2s² 2p⁶ 3s² 3p⁶ 4s¹'],
    promptAr: 'اكتب التوزيع الإلكتروني لذرة الكالسيوم (Z = 20).',
    promptEn: 'Write the electron configuration of a calcium atom (Z = 20).',
  },
  {
    id: 'ch-ec-h1', family: 'electron_config', diff: 'hard', eq: 'Fe²⁺ من Fe (Z = 26)',
    answer: 'يفقد إلكتروني 4s أولًا', wrongs: ['يفقد إلكتروني 3d أولًا', 'يفقد إلكترونًا من 4s وآخر من 3d', 'يكتسب إلكترونين في 3d'],
    promptAr: 'عند تكوّن الأيون Fe²⁺ من ذرة الحديد (Z = 26)، من أيّ مستوى فرعي يفقد الإلكترونين؟',
    promptEn: 'When Fe²⁺ forms from an iron atom (Z = 26), which subshell loses the two electrons?',
  },

  // ── الخصائص الدورية ──
  {
    id: 'ch-pt-e1', family: 'periodic_trends', diff: 'easy', eq: 'Na, Mg, Al, Si',
    answer: 'Na', wrongs: ['Si', 'Al', 'Mg'],
    promptAr: 'أيّ العناصر الآتية أكبر نصف قطر ذري: Na، Mg، Al، Si؟ (جميعها في الدورة الثالثة)',
    promptEn: 'Which has the largest atomic radius: Na, Mg, Al, Si? (all in period 3)',
  },
  {
    id: 'ch-pt-e2', family: 'periodic_trends', diff: 'easy', eq: 'عبر الدورة من اليسار إلى اليمين',
    answer: 'يقل نصف القطر الذري', wrongs: ['يزداد نصف القطر الذري', 'لا يتغير نصف القطر الذري', 'يزداد ثم يقل'],
    promptAr: 'كيف يتغير نصف القطر الذري عند التحرك عبر الدورة من اليسار إلى اليمين؟',
    promptEn: 'How does atomic radius change moving left to right across a period?',
  },
  {
    id: 'ch-pt-m1', family: 'periodic_trends', diff: 'medium', eq: 'Na و Mg',
    answer: 'Mg، لأن شحنة نواته أكبر ونصف قطره أصغر', wrongs: ['Na، لأن إلكترون تكافؤه واحد', 'متساويان في طاقة التأين', 'Na، لأن كتلته أصغر'],
    promptAr: 'أيّهما أكبر في طاقة التأين الأولى: Na أم Mg؟ ولماذا؟',
    promptEn: 'Which has the higher first ionization energy, Na or Mg, and why?',
  },
  {
    id: 'ch-pt-m2', family: 'periodic_trends', diff: 'medium', eq: 'أعلى كهروسالبية',
    answer: 'الفلور F', wrongs: ['الأكسجين O', 'السيزيوم Cs', 'الكلور Cl'],
    promptAr: 'أيّ العناصر أعلى كهروسالبية في الجدول الدوري؟',
    promptEn: 'Which element has the highest electronegativity in the periodic table?',
  },
  {
    id: 'ch-pt-h1', family: 'periodic_trends', diff: 'hard', eq: 'Na و Na⁺',
    answer: 'Na⁺ أصغر، لفقده مستوى الطاقة الخارجي', wrongs: ['Na⁺ أكبر، لزيادة شحنته الموجبة', 'متساويان، لأن النواة لم تتغير', 'Na⁺ أكبر، لأن التنافر بين الإلكترونات يقل'],
    promptAr: 'قارن بين نصف قطر ذرة الصوديوم Na ونصف قطر أيونها Na⁺، مع التعليل.',
    promptEn: 'Compare the radius of a sodium atom Na with its ion Na⁺, and explain.',
  },
  // Added 2026-10-15: the family held five items (two easy, two medium, one hard), so a
  // ten-question or single-tier paper on the periodic-table lessons ran dry and repeated.
  // Each distractor is a real misconception, and `wrongs[0]` is the most tempting one —
  // the true/false form offers it as the proposed (false) answer.
  {
    id: 'ch-pt-e3', family: 'periodic_trends', diff: 'easy', eq: 'الفلزات القلوية (المجموعة الأولى)',
    answer: 'إلكترون واحد', wrongs: ['إلكترونان', 'سبعة إلكترونات', 'ثمانية إلكترونات'],
    promptAr: 'كم إلكترون تكافؤ في ذرة أيّ عنصر من الفلزات القلوية (المجموعة الأولى)؟',
    promptEn: 'How many valence electrons does an atom of an alkali metal (group 1) have?',
  },
  {
    id: 'ch-pt-e4', family: 'periodic_trends', diff: 'easy', eq: '1s² 2s² 2p⁶ 3s² 3p⁴',
    answer: 'الدورة الثالثة', wrongs: ['الدورة الرابعة', 'الدورة الثانية', 'الدورة السادسة'],
    promptAr: 'عنصر توزيعه الإلكتروني 1s² 2s² 2p⁶ 3s² 3p⁴. في أيّ دورة من الجدول الدوري يقع؟',
    promptEn: 'An element has the electron configuration 1s² 2s² 2p⁶ 3s² 3p⁴. Which period of the periodic table is it in?',
  },
  {
    id: 'ch-pt-e5', family: 'periodic_trends', diff: 'easy', eq: 'Na, Cl, Ar, Mg',
    answer: 'Ar', wrongs: ['Cl', 'Na', 'Mg'],
    promptAr: 'أيّ العناصر الآتية من الغازات النبيلة: Na، Cl، Ar، Mg؟',
    promptEn: 'Which of these elements is a noble gas: Na, Cl, Ar, Mg?',
  },
  {
    id: 'ch-pt-m3', family: 'periodic_trends', diff: 'medium', eq: 'Li و K (المجموعة نفسها)',
    answer: 'K، لأن له مستويات طاقة أكثر', wrongs: ['Li، لأن شحنة نواته أصغر', 'Li، لأن له مستويات طاقة أكثر', 'متساويان، لأنهما في المجموعة نفسها'],
    promptAr: 'أيّهما أكبر نصف قطر ذري: الليثيوم Li أم البوتاسيوم K؟ ولماذا؟',
    promptEn: 'Which has the larger atomic radius, lithium Li or potassium K, and why?',
  },
  {
    id: 'ch-pt-m4', family: 'periodic_trends', diff: 'medium', eq: 'طاقة التأين الأولى عند النزول في مجموعة',
    answer: 'تقل، لأن الإلكترون الخارجي أبعد عن النواة', wrongs: ['تزداد، لأن عدد البروتونات أكبر', 'لا تتغير، لأن عدد إلكترونات التكافؤ ثابت', 'تزداد، لأن نصف القطر أكبر'],
    promptAr: 'كيف تتغير طاقة التأين الأولى عند النزول في المجموعة الواحدة من الجدول الدوري؟ ولماذا؟',
    promptEn: 'How does first ionization energy change moving down a group of the periodic table, and why?',
  },
  {
    id: 'ch-pt-m5', family: 'periodic_trends', diff: 'medium', eq: 'Cl و Na',
    answer: 'Cl، لأنه لافلز يميل إلى جذب الإلكترونات', wrongs: ['Na، لأنه يفقد إلكترونه بسهولة', 'Na، لأن نصف قطره أكبر', 'متساويان، لأنهما في الدورة نفسها'],
    promptAr: 'أيّهما أعلى كهروسالبية: الكلور Cl أم الصوديوم Na؟ ولماذا؟',
    promptEn: 'Which has the higher electronegativity, chlorine Cl or sodium Na, and why?',
  },
  {
    id: 'ch-pt-m6', family: 'periodic_trends', diff: 'medium', eq: 'Na, Mg, Al, Cl',
    answer: 'Cl', wrongs: ['Na', 'Mg', 'Al'],
    promptAr: 'أيّ العناصر الآتية أعلى طاقة تأين أولى: Na، Mg، Al، Cl؟ (جميعها في الدورة الثالثة)',
    promptEn: 'Which has the highest first ionization energy: Na, Mg, Al, Cl? (all in period 3)',
  },
  {
    id: 'ch-pt-h2', family: 'periodic_trends', diff: 'hard', eq: 'Cl و Cl⁻',
    answer: 'Cl⁻ أكبر، لزيادة التنافر بين الإلكترونات مع بقاء شحنة النواة', wrongs: ['Cl⁻ أصغر، لفقده مستوى الطاقة الخارجي', 'متساويان، لأن النواة لم تتغير', 'Cl⁻ أصغر، لزيادة جذب النواة للإلكترونات'],
    promptAr: 'قارن بين نصف قطر ذرة الكلور Cl ونصف قطر أيونها Cl⁻، مع التعليل.',
    promptEn: 'Compare the radius of a chlorine atom Cl with its ion Cl⁻, and explain.',
  },
  {
    id: 'ch-pt-h3', family: 'periodic_trends', diff: 'hard', eq: 'Na⁺, Mg²⁺, Al³⁺',
    answer: 'Na⁺، لأن شحنته النووية أقل', wrongs: ['Al³⁺، لأن شحنته أكبر', 'Mg²⁺، لأنه في الوسط', 'متساوية، لأن لها عدد الإلكترونات نفسه'],
    promptAr: 'الأيونات Na⁺ وMg²⁺ وAl³⁺ لها عدد الإلكترونات نفسه. أيّها أكبر نصف قطر؟ ولماذا؟',
    promptEn: 'The ions Na⁺, Mg²⁺ and Al³⁺ have the same number of electrons. Which has the largest radius, and why?',
  },
  {
    id: 'ch-pt-h4', family: 'periodic_trends', diff: 'hard', eq: 'طاقة التأين عبر الدورة',
    answer: 'لزيادة الشحنة النووية الفعالة ونقص نصف القطر', wrongs: ['لزيادة نصف القطر الذري', 'لزيادة عدد مستويات الطاقة', 'لزيادة عدد النيوترونات'],
    promptAr: 'لماذا تزداد طاقة التأين الأولى عمومًا عند الانتقال عبر الدورة من اليسار إلى اليمين؟',
    promptEn: 'Why does first ionization energy generally increase from left to right across a period?',
  },

  // ── الروابط الكيميائية ──
  {
    id: 'ch-bd-e1', family: 'bonding', diff: 'easy', eq: 'NaCl',
    answer: 'رابطة أيونية', wrongs: ['رابطة تساهمية قطبية', 'رابطة تساهمية نقية', 'رابطة فلزية'],
    promptAr: 'ما نوع الرابطة في مركب كلوريد الصوديوم NaCl؟',
    promptEn: 'What type of bond is in sodium chloride, NaCl?',
  },
  {
    id: 'ch-bd-e2', family: 'bonding', diff: 'easy', eq: 'Cl₂',
    answer: 'رابطة تساهمية نقية', wrongs: ['رابطة أيونية', 'رابطة تساهمية قطبية', 'رابطة هيدروجينية'],
    promptAr: 'ما نوع الرابطة بين ذرتي الكلور في جزيء Cl₂؟',
    promptEn: 'What type of bond joins the two chlorine atoms in Cl₂?',
  },
  {
    id: 'ch-bd-m1', family: 'bonding', diff: 'medium', eq: 'H₂O',
    answer: 'تساهمية قطبية، لاختلاف الكهروسالبية بين O وH', wrongs: ['أيونية، لأن الأكسجين يكتسب إلكترونين', 'تساهمية نقية، لأن الذرتين لافلزتان', 'فلزية، لأن الإلكترونات حرة الحركة'],
    promptAr: 'ما نوع الرابطة في جزيء الماء H₂O؟ علّل إجابتك.',
    promptEn: 'What type of bond is in a water molecule, H₂O? Justify your answer.',
  },
  {
    id: 'ch-bd-m2', family: 'bonding', diff: 'medium', eq: 'فلز + لافلز',
    answer: 'ينتقل الإلكترون من الفلز إلى اللافلز فتتكوّن أيونات', wrongs: ['تتشارك الذرتان في زوج إلكتروني', 'ينتقل الإلكترون من اللافلز إلى الفلز', 'لا تتكوّن رابطة بينهما'],
    promptAr: 'صف ما يحدث للإلكترونات عند اتحاد فلز مع لافلز.',
    promptEn: 'Describe what happens to the electrons when a metal combines with a non-metal.',
  },
  {
    id: 'ch-bd-h1', family: 'bonding', diff: 'hard', eq: 'NaCl مقابل HCl',
    answer: 'NaCl أيوني بدرجة انصهار عالية وHCl تساهمي قطبي', wrongs: ['كلاهما أيوني ودرجتا انصهارهما متقاربتان', 'NaCl تساهمي وHCl أيوني', 'كلاهما تساهمي نقي'],
    promptAr: 'وازن بين NaCl وHCl من حيث نوع الرابطة ودرجة الانصهار.',
    promptEn: 'Contrast NaCl and HCl in terms of bond type and melting point.',
  },

  // ── الصيغ الكيميائية ──
  {
    id: 'ch-fm-e1', family: 'formulas', diff: 'easy', eq: 'Ca²⁺ + Cl⁻',
    answer: 'CaCl₂', wrongs: ['CaCl', 'Ca₂Cl', 'Ca₂Cl₃'],
    promptAr: 'اكتب الصيغة الكيميائية للمركب المتكوّن من Ca²⁺ وCl⁻.',
    promptEn: 'Write the chemical formula of the compound formed from Ca²⁺ and Cl⁻.',
  },
  {
    id: 'ch-fm-e2', family: 'formulas', diff: 'easy', eq: 'Na₂SO₄',
    answer: 'كبريتات الصوديوم', wrongs: ['كبريتيد الصوديوم', 'كبريتيت الصوديوم', 'كبريتات الصودا'],
    promptAr: 'ما اسم المركب Na₂SO₄؟',
    promptEn: 'What is the name of the compound Na₂SO₄?',
  },
  {
    id: 'ch-fm-m1', family: 'formulas', diff: 'medium', eq: 'Al³⁺ + O²⁻',
    answer: 'Al₂O₃', wrongs: ['AlO', 'Al₃O₂', 'AlO₂'],
    promptAr: 'اكتب الصيغة الكيميائية لأكسيد الألمنيوم المتكوّن من Al³⁺ وO²⁻.',
    promptEn: 'Write the formula of the aluminium oxide formed from Al³⁺ and O²⁻.',
  },
  {
    id: 'ch-fm-m2', family: 'formulas', diff: 'medium', eq: 'Mg²⁺ + N³⁻',
    answer: 'Mg₃N₂', wrongs: ['Mg₂N₃', 'MgN', 'Mg₂N'],
    promptAr: 'اكتب الصيغة الكيميائية لنيتريد المغنيسيوم المتكوّن من Mg²⁺ وN³⁻.',
    promptEn: 'Write the formula of the magnesium nitride formed from Mg²⁺ and N³⁻.',
  },
  {
    id: 'ch-fm-h1', family: 'formulas', diff: 'hard', eq: 'Ca(NO₃)₂',
    answer: 'ذرة كالسيوم وذرتا نيتروجين وست ذرات أكسجين', wrongs: ['ذرة كالسيوم وذرة نيتروجين وثلاث ذرات أكسجين', 'ذرتا كالسيوم وذرتا نيتروجين وثلاث ذرات أكسجين', 'ذرة كالسيوم وذرتا نيتروجين وثلاث ذرات أكسجين'],
    promptAr: 'كم ذرة من كل عنصر في وحدة الصيغة Ca(NO₃)₂؟',
    promptEn: 'How many atoms of each element are in one formula unit of Ca(NO₃)₂?',
  },

  // ── التفاعلات ووزن المعادلات ──
  {
    id: 'ch-eq-e1', family: 'equations', diff: 'easy', eq: 'H₂ + O₂ → H₂O',
    answer: '2H₂ + O₂ → 2H₂O', wrongs: ['H₂ + O₂ → H₂O', 'H₂ + 2O₂ → 2H₂O', '2H₂ + 2O₂ → 2H₂O'],
    promptAr: 'وازن المعادلة الآتية: H₂ + O₂ → H₂O',
    promptEn: 'Balance the equation: H₂ + O₂ → H₂O',
  },
  {
    id: 'ch-eq-e2', family: 'equations', diff: 'easy', eq: 'CH₄ + O₂ → CO₂ + H₂O',
    answer: 'CH₄ + 2O₂ → CO₂ + 2H₂O', wrongs: ['CH₄ + O₂ → CO₂ + H₂O', 'CH₄ + 2O₂ → CO₂ + H₂O', '2CH₄ + 2O₂ → 2CO₂ + 2H₂O'],
    promptAr: 'وازن معادلة احتراق الميثان: CH₄ + O₂ → CO₂ + H₂O',
    promptEn: 'Balance the combustion of methane: CH₄ + O₂ → CO₂ + H₂O',
  },
  {
    id: 'ch-eq-m1', family: 'equations', diff: 'medium', eq: 'N₂ + H₂ → NH₃',
    answer: 'N₂ + 3H₂ → 2NH₃', wrongs: ['N₂ + H₂ → NH₃', 'N₂ + 2H₂ → 2NH₃', '2N₂ + 3H₂ → 2NH₃'],
    promptAr: 'وازن المعادلة الآتية: N₂ + H₂ → NH₃',
    promptEn: 'Balance the equation: N₂ + H₂ → NH₃',
  },
  {
    id: 'ch-eq-m2', family: 'equations', diff: 'medium', eq: 'CaCO₃ → CaO + CO₂',
    answer: 'تفاعل تحلل', wrongs: ['تفاعل اتحاد', 'تفاعل إحلال بسيط', 'تفاعل تعادل'],
    promptAr: 'ما نوع التفاعل الآتي: CaCO₃ → CaO + CO₂؟',
    promptEn: 'What type of reaction is CaCO₃ → CaO + CO₂?',
  },
  {
    id: 'ch-eq-h1', family: 'equations', diff: 'hard', eq: 'Fe + O₂ → Fe₂O₃',
    answer: '4Fe + 3O₂ → 2Fe₂O₃', wrongs: ['2Fe + 3O₂ → Fe₂O₃', '2Fe + O₂ → Fe₂O₃', '4Fe + 6O₂ → 2Fe₂O₃'],
    promptAr: 'وازن المعادلة الآتية: Fe + O₂ → Fe₂O₃',
    promptEn: 'Balance the equation: Fe + O₂ → Fe₂O₃',
  },
  {
    id: 'ch-eq-h2', family: 'equations', diff: 'hard', eq: 'قانون حفظ الكتلة',
    answer: 'لأن الذرات لا تفنى ولا تُستحدث، فعددها محفوظ في الطرفين', wrongs: ['لأن عدد الجزيئات يجب أن يتساوى في الطرفين', 'لأن الكتلة المولية ثابتة لكل مركب', 'لأن الطاقة محفوظة في التفاعل'],
    promptAr: 'لماذا يجب وزن المعادلة الكيميائية؟ اربط إجابتك بقانون حفظ الكتلة.',
    promptEn: 'Why must a chemical equation be balanced? Relate your answer to conservation of mass.',
  },

  // ── المول والكتلة المولية ──
  {
    id: 'ch-ml-e1', family: 'mole', diff: 'easy', eq: 'H₂O',
    answer: '18 g/mol', wrongs: ['17 g/mol', '20 g/mol', '34 g/mol'],
    promptAr: 'أوجد الكتلة المولية للماء H₂O. (H = 1، O = 16)',
    promptEn: 'Find the molar mass of water, H₂O. (H = 1, O = 16)',
  },
  {
    id: 'ch-ml-e2', family: 'mole', diff: 'easy', eq: 'CO₂',
    answer: '44 g/mol', wrongs: ['28 g/mol', '46 g/mol', '32 g/mol'],
    promptAr: 'أوجد الكتلة المولية لثاني أكسيد الكربون CO₂. (C = 12، O = 16)',
    promptEn: 'Find the molar mass of carbon dioxide, CO₂. (C = 12, O = 16)',
  },
  {
    id: 'ch-ml-m1', family: 'mole', diff: 'medium', eq: 'm = 36 g H₂O',
    answer: '2 mol', wrongs: ['1 mol', '18 mol', '0.5 mol'],
    promptAr: 'كم مولًا في 36 g من الماء H₂O؟ (الكتلة المولية 18 g/mol)',
    promptEn: 'How many moles are in 36 g of water? (molar mass 18 g/mol)',
  },
  {
    id: 'ch-ml-m2', family: 'mole', diff: 'medium', eq: 'NaCl',
    answer: '58.5 g/mol', wrongs: ['48.5 g/mol', '58.5 g', '23 g/mol'],
    promptAr: 'أوجد الكتلة المولية لكلوريد الصوديوم NaCl. (Na = 23، Cl = 35.5)',
    promptEn: 'Find the molar mass of sodium chloride, NaCl. (Na = 23, Cl = 35.5)',
  },
  {
    id: 'ch-ml-m3', family: 'mole', diff: 'medium', eq: 'n = 0.5 mol CO₂',
    answer: '22 g', wrongs: ['44 g', '88 g', '11 g'],
    promptAr: 'ما كتلة 0.5 mol من CO₂؟ (الكتلة المولية 44 g/mol)',
    promptEn: 'What is the mass of 0.5 mol of CO₂? (molar mass 44 g/mol)',
  },
  {
    id: 'ch-ml-h1', family: 'mole', diff: 'hard', eq: 'Ca(OH)₂',
    answer: '74 g/mol', wrongs: ['57 g/mol', '58 g/mol', '90 g/mol'],
    promptAr: 'أوجد الكتلة المولية لهيدروكسيد الكالسيوم Ca(OH)₂. (Ca = 40، O = 16، H = 1)',
    promptEn: 'Find the molar mass of calcium hydroxide, Ca(OH)₂. (Ca = 40, O = 16, H = 1)',
  },
  {
    id: 'ch-ml-h2', family: 'mole', diff: 'hard', eq: 'n = 2 mol',
    answer: '1.204 × 10²⁴ جسيمًا', wrongs: ['6.02 × 10²³ جسيمًا', '3.01 × 10²³ جسيمًا', '12.04 × 10²³ مولًا'],
    promptAr: 'كم جسيمًا في 2 mol من مادة؟ (عدد أفوجادرو 6.02 × 10²³)',
    promptEn: 'How many particles are in 2 mol of a substance? (Avogadro 6.02 × 10²³)',
  },

  // ── الحسابات الكيميائية ──
  {
    id: 'ch-st-e1', family: 'stoichiometry', diff: 'easy', eq: '2H₂ + O₂ → 2H₂O',
    answer: '2 mol', wrongs: ['1 mol', '4 mol', '0.5 mol'],
    promptAr: 'في التفاعل 2H₂ + O₂ → 2H₂O، كم مولًا من H₂O ينتج من 2 mol من H₂؟',
    promptEn: 'In 2H₂ + O₂ → 2H₂O, how many moles of H₂O are produced from 2 mol of H₂?',
  },
  {
    id: 'ch-st-m1', family: 'stoichiometry', diff: 'medium', eq: 'N₂ + 3H₂ → 2NH₃',
    answer: '2 mol', wrongs: ['3 mol', '1 mol', '6 mol'],
    promptAr: 'في التفاعل N₂ + 3H₂ → 2NH₃، كم مولًا من NH₃ ينتج من 3 mol من H₂؟',
    promptEn: 'In N₂ + 3H₂ → 2NH₃, how many moles of NH₃ come from 3 mol of H₂?',
  },
  {
    id: 'ch-st-m2', family: 'stoichiometry', diff: 'medium', eq: 'CH₄ + 2O₂ → CO₂ + 2H₂O',
    answer: '4 mol', wrongs: ['2 mol', '1 mol', '8 mol'],
    promptAr: 'في التفاعل CH₄ + 2O₂ → CO₂ + 2H₂O، كم مولًا من O₂ يلزم لاحتراق 2 mol من CH₄؟',
    promptEn: 'In CH₄ + 2O₂ → CO₂ + 2H₂O, how many moles of O₂ are needed to burn 2 mol of CH₄?',
  },
  {
    id: 'ch-st-h1', family: 'stoichiometry', diff: 'hard', eq: 'CaCO₃ → CaO + CO₂',
    answer: '44 g', wrongs: ['100 g', '56 g', '22 g'],
    promptAr: 'يتحلل 100 g من CaCO₃ حسب المعادلة CaCO₃ → CaO + CO₂. ما كتلة CO₂ الناتجة؟ (الكتلة المولية لـCaCO₃ = 100 g/mol، ولـCO₂ = 44 g/mol)',
    promptEn: 'Decomposing 100 g of CaCO₃ by CaCO₃ → CaO + CO₂, what mass of CO₂ forms? (CaCO₃ = 100 g/mol, CO₂ = 44 g/mol)',
  },
  {
    id: 'ch-st-h2', family: 'stoichiometry', diff: 'hard', eq: '2H₂ + O₂ → 2H₂O، 4 mol H₂ مع 1 mol O₂',
    answer: 'O₂ هو الكاشف المحدد وينتج 2 mol من H₂O', wrongs: ['H₂ هو الكاشف المحدد وينتج 4 mol من H₂O', 'كلاهما ينفد معًا وينتج 4 mol من H₂O', 'O₂ هو الكاشف المحدد وينتج 4 mol من H₂O'],
    promptAr: 'تفاعل 4 mol من H₂ مع 1 mol من O₂ حسب 2H₂ + O₂ → 2H₂O. أيّ المادتين الكاشف المحدد، وكم مولًا من الماء ينتج؟',
    promptEn: '4 mol H₂ reacts with 1 mol O₂ by 2H₂ + O₂ → 2H₂O. Which is limiting, and how much water forms?',
  },

  // ── الطاقة الكيميائية ──
  {
    id: 'ch-th-e1', family: 'thermochem', diff: 'easy', eq: 'ΔH < 0',
    answer: 'تفاعل طارد للطاقة', wrongs: ['تفاعل ماص للطاقة', 'تفاعل متعادل حراريًا', 'تفاعل لا يحدث'],
    promptAr: 'تفاعل تغيّر المحتوى الحراري له ΔH سالب. ما نوعه؟',
    promptEn: 'A reaction has a negative ΔH. What type is it?',
  },
  {
    id: 'ch-th-e2', family: 'thermochem', diff: 'easy', eq: 'احتراق الميثان',
    answer: 'طارد للطاقة، وترتفع درجة حرارة المحيط', wrongs: ['ماص للطاقة، وتنخفض درجة حرارة المحيط', 'طارد للطاقة، وتنخفض درجة حرارة المحيط', 'ماص للطاقة، وترتفع درجة حرارة المحيط'],
    promptAr: 'احتراق الميثان في الهواء: هل هو ماص أم طارد للطاقة، وماذا يحدث لدرجة حرارة المحيط؟',
    promptEn: 'Burning methane in air: is it endothermic or exothermic, and what happens to the surroundings?',
  },
  {
    id: 'ch-th-m1', family: 'thermochem', diff: 'medium', eq: 'كسر الروابط',
    answer: 'كسر الروابط يمتص طاقة وتكوينها يحرّر طاقة', wrongs: ['كسر الروابط يحرّر طاقة وتكوينها يمتص طاقة', 'كلاهما يمتص طاقة', 'كلاهما يحرّر طاقة'],
    promptAr: 'قارن بين طاقة كسر الروابط وطاقة تكوينها في أثناء التفاعل.',
    promptEn: 'Compare the energy of breaking bonds with that of forming them during a reaction.',
  },
  {
    id: 'ch-th-m2', family: 'thermochem', diff: 'medium', eq: 'q = m·c·ΔT، m = 100 g، c = 4.18 J/g·°C، ΔT = 10 °C',
    answer: '4180 J', wrongs: ['418 J', '41800 J', '1000 J'],
    promptAr: 'سُخّن 100 g من الماء فارتفعت درجة حرارته 10 °C. أوجد الطاقة الممتصة بالعلاقة q = m·c·ΔT حيث c = 4.18 J/g·°C.',
    promptEn: '100 g of water is heated by 10 °C. Find the energy absorbed using q = m·c·ΔT with c = 4.18 J/g·°C.',
  },
  {
    id: 'ch-th-h1', family: 'thermochem', diff: 'hard', eq: 'ΔH = +180 kJ/mol',
    answer: 'ماص للطاقة، وطاقة المواد الناتجة أعلى من المتفاعلة', wrongs: ['طارد للطاقة، وطاقة المواد الناتجة أقل من المتفاعلة', 'ماص للطاقة، وطاقة المواد الناتجة أقل من المتفاعلة', 'طارد للطاقة، وطاقة المواد الناتجة أعلى من المتفاعلة'],
    promptAr: 'تفاعل ΔH له = +180 kJ/mol. صف نوعه وقارن بين طاقة المواد المتفاعلة والناتجة.',
    promptEn: 'A reaction has ΔH = +180 kJ/mol. Describe its type and compare reactant and product energies.',
  },

  // ── الحموض والقواعد (grade 9) ──
  {
    id: 'ch-ac-e1', family: 'acids_bases', diff: 'easy', eq: 'pH = 3',
    answer: 'محلول حمضي', wrongs: ['محلول قاعدي', 'محلول متعادل', 'محلول ملحي'],
    promptAr: 'محلول رقمه الهيدروجيني pH = 3. ما نوعه؟',
    promptEn: 'A solution has pH = 3. What type is it?',
  },
  {
    id: 'ch-ac-e2', family: 'acids_bases', diff: 'easy', eq: 'ورق عباد الشمس الأزرق + حمض',
    answer: 'يتحول إلى الأحمر', wrongs: ['يتحول إلى الأخضر', 'يبقى أزرق', 'يفقد لونه'],
    promptAr: 'ما لون ورق عباد الشمس الأزرق عند وضعه في محلول حمضي؟',
    promptEn: 'What colour does blue litmus paper turn in an acidic solution?',
  },
  {
    id: 'ch-ac-m1', family: 'acids_bases', diff: 'medium', eq: 'HCl + NaOH',
    answer: 'NaCl + H₂O', wrongs: ['NaH + ClOH', 'NaClO + H₂', 'NaCl + H₂'],
    promptAr: 'أكمل معادلة التعادل: HCl + NaOH → ...',
    promptEn: 'Complete the neutralisation: HCl + NaOH → ...',
  },
  {
    id: 'ch-ac-m2', family: 'acids_bases', diff: 'medium', eq: 'حمض + فلز نشط',
    answer: 'ملح وغاز الهيدروجين', wrongs: ['ملح وماء', 'ملح وغاز ثاني أكسيد الكربون', 'ملح وغاز الأكسجين'],
    promptAr: 'ماذا ينتج من تفاعل حمض مع فلز نشط مثل الزنك؟',
    promptEn: 'What is produced when an acid reacts with an active metal such as zinc?',
  },
  {
    id: 'ch-ac-h1', family: 'acids_bases', diff: 'hard', eq: 'pH من 5 إلى 3',
    answer: 'تزداد الحموضة 100 مرة', wrongs: ['تزداد الحموضة مرتين', 'تقل الحموضة 100 مرة', 'تزداد الحموضة 10 مرات'],
    promptAr: 'انخفض pH محلول من 5 إلى 3. كيف تغيّرت حموضته؟ (المقياس لوغاريتمي)',
    promptEn: "A solution's pH drops from 5 to 3. How did its acidity change? (the scale is logarithmic)",
  },

  // ── نشاط الفلزات (grade 9) ──
  {
    id: 'ch-ma-e1', family: 'metal_activity', diff: 'easy', eq: 'Zn + CuSO₄',
    answer: 'ZnSO₄ + Cu', wrongs: ['لا يحدث تفاعل', 'ZnCu + SO₄', 'ZnO + CuSO₃'],
    promptAr: 'أكمل: Zn + CuSO₄ → ... علمًا أن الزنك أنشط من النحاس.',
    promptEn: 'Complete: Zn + CuSO₄ → ... given that zinc is more active than copper.',
  },
  {
    id: 'ch-ma-m1', family: 'metal_activity', diff: 'medium', eq: 'Cu + ZnSO₄',
    answer: 'لا يحدث تفاعل، لأن النحاس أقل نشاطًا من الزنك', wrongs: ['يحدث تفاعل وينتج CuSO₄ + Zn', 'يحدث تفاعل وينتج CuZn + SO₄', 'لا يحدث تفاعل، لأن الزنك أقل نشاطًا من النحاس'],
    promptAr: 'هل يحدث تفاعل عند وضع قطعة نحاس في محلول كبريتات الزنك؟ علّل.',
    promptEn: 'Does a reaction occur when copper is placed in zinc sulfate solution? Explain.',
  },
  {
    id: 'ch-ma-m2', family: 'metal_activity', diff: 'medium', eq: 'صدأ الحديد',
    answer: 'الأكسجين والماء', wrongs: ['الأكسجين وحده', 'الماء وحده', 'ثاني أكسيد الكربون والماء'],
    promptAr: 'ما العاملان اللازمان لحدوث صدأ الحديد؟',
    promptEn: 'Which two factors are needed for iron to rust?',
  },
  {
    id: 'ch-ma-h1', family: 'metal_activity', diff: 'hard', eq: 'الجلفنة',
    answer: 'الزنك أنشط من الحديد فيتأكسد بدلًا منه', wrongs: ['الزنك أقل نشاطًا فيمنع وصول الهواء فقط', 'الزنك يمنع الماء ولا علاقة له بالنشاط', 'الزنك يزيد صلابة الحديد فيقاوم الصدأ'],
    promptAr: 'يُطلى الحديد بالزنك لحمايته من الصدأ. فسّر ذلك بدلالة سلسلة النشاط الكيميائي.',
    promptEn: 'Iron is coated with zinc to protect it from rust. Explain using the activity series.',
  },

  // ── التأكسد والاختزال (grade 9) ──
  {
    id: 'ch-rx-e1', family: 'redox', diff: 'easy', eq: 'Zn → Zn²⁺ + 2e⁻',
    answer: 'تأكسد، لأن الزنك يفقد إلكترونين', wrongs: ['اختزال، لأن الزنك يكتسب إلكترونين', 'تأكسد، لأن الزنك يكتسب إلكترونين', 'اختزال، لأن الزنك يفقد إلكترونين'],
    promptAr: 'صنّف نصف التفاعل Zn → Zn²⁺ + 2e⁻ تأكسدًا أم اختزالًا، مع التعليل.',
    promptEn: 'Classify Zn → Zn²⁺ + 2e⁻ as oxidation or reduction, with a reason.',
  },
  {
    id: 'ch-rx-e2', family: 'redox', diff: 'easy', eq: 'الاختزال',
    answer: 'اكتساب إلكترونات', wrongs: ['فقد إلكترونات', 'اكتساب بروتونات', 'فقد نيوترونات'],
    promptAr: 'عرّف عملية الاختزال بدلالة الإلكترونات.',
    promptEn: 'Define reduction in terms of electrons.',
  },
  {
    id: 'ch-rx-m1', family: 'redox', diff: 'medium', eq: 'الخلية الجلفانية',
    answer: 'التأكسد عند المصعد والاختزال عند المهبط', wrongs: ['الاختزال عند المصعد والتأكسد عند المهبط', 'التأكسد والاختزال كلاهما عند المصعد', 'التأكسد والاختزال كلاهما عند المهبط'],
    promptAr: 'في الخلية الجلفانية، أين يحدث التأكسد وأين يحدث الاختزال؟',
    promptEn: 'In a galvanic cell, where does oxidation occur and where does reduction occur?',
  },
  {
    id: 'ch-rx-m2', family: 'redox', diff: 'medium', eq: 'الخلية الجلفانية مقابل خلية التحليل الكهربائي',
    answer: 'الجلفانية تحوّل الطاقة الكيميائية إلى كهربائية، والتحليل الكهربائي بالعكس', wrongs: ['كلتاهما تحوّلان الطاقة الكيميائية إلى كهربائية', 'الجلفانية تحوّل الكهربائية إلى كيميائية، والتحليل بالعكس', 'كلتاهما تحوّلان الطاقة الكهربائية إلى كيميائية'],
    promptAr: 'قارن بين الخلية الجلفانية وخلية التحليل الكهربائي من حيث تحوّل الطاقة.',
    promptEn: 'Contrast a galvanic cell with an electrolytic cell in terms of energy conversion.',
  },
  {
    id: 'ch-rx-h1', family: 'redox', diff: 'hard', eq: 'Zn + Cu²⁺ → Zn²⁺ + Cu',
    answer: 'الزنك عامل مختزل والنحاس Cu²⁺ عامل مؤكسد', wrongs: ['الزنك عامل مؤكسد والنحاس Cu²⁺ عامل مختزل', 'كلاهما عامل مؤكسد', 'كلاهما عامل مختزل'],
    promptAr: 'في التفاعل Zn + Cu²⁺ → Zn²⁺ + Cu، حدّد العامل المؤكسد والعامل المختزل.',
    promptEn: 'In Zn + Cu²⁺ → Zn²⁺ + Cu, identify the oxidising and the reducing agent.',
  },

  // ── عام: يُستعمل حين لا يُكتشف موضوع أدق ──
  {
    id: 'ch-gn-e1', family: 'general_chem', diff: 'easy', eq: 'العنصر والمركب',
    answer: 'العنصر نوع واحد من الذرات والمركب نوعان أو أكثر متحدان كيميائيًا', wrongs: ['العنصر أصغر من المركب في الحجم دائمًا', 'المركب نوع واحد من الذرات والعنصر عدة أنواع', 'لا فرق بينهما، الاسمان مترادفان'],
    promptAr: 'ما الفرق بين العنصر والمركب؟',
    promptEn: 'What is the difference between an element and a compound?',
  },
  {
    id: 'ch-gn-e2', family: 'general_chem', diff: 'easy', eq: 'التغير الكيميائي',
    answer: 'تكوّن مادة جديدة لها خصائص مختلفة', wrongs: ['تغيّر الحالة الفيزيائية فقط', 'تغيّر الشكل والحجم فقط', 'ذوبان المادة في الماء'],
    promptAr: 'ما الدليل على حدوث تغير كيميائي لا فيزيائي؟',
    promptEn: 'What shows that a change is chemical rather than physical?',
  },
  {
    id: 'ch-gn-m1', family: 'general_chem', diff: 'medium', eq: 'المخلوط والمركب',
    answer: 'المركب بنسب ثابتة ويُفصل كيميائيًا، والمخلوط بنسب متغيرة ويُفصل فيزيائيًا', wrongs: ['كلاهما بنسب ثابتة ويُفصلان كيميائيًا', 'المخلوط بنسب ثابتة والمركب بنسب متغيرة', 'كلاهما يُفصل فيزيائيًا'],
    promptAr: 'قارن بين المركب والمخلوط من حيث نسب المكونات وطريقة الفصل.',
    promptEn: 'Contrast a compound with a mixture in terms of composition and separation.',
  },
  {
    id: 'ch-gn-m2', family: 'general_chem', diff: 'medium', eq: 'التركيز',
    answer: 'يقل التركيز', wrongs: ['يزداد التركيز', 'لا يتغير التركيز', 'يتضاعف التركيز'],
    promptAr: 'أُضيف ماء إلى محلول ملحي دون تغيير كمية الملح. ماذا يحدث لتركيز المحلول؟',
    promptEn: 'Water is added to a salt solution without changing the amount of salt. What happens to the concentration?',
  },
  {
    id: 'ch-gn-h1', family: 'general_chem', diff: 'hard', eq: 'قانون حفظ الكتلة في وعاء مغلق',
    answer: 'تبقى الكتلة الكلية ثابتة', wrongs: ['تزداد الكتلة الكلية', 'تقل الكتلة الكلية', 'تعتمد على نوع التفاعل'],
    promptAr: 'حدث تفاعل كيميائي في وعاء مغلق. ماذا يحدث للكتلة الكلية قبل التفاعل وبعده؟ ولماذا؟',
    promptEn: 'A reaction occurs in a sealed vessel. What happens to the total mass before and after, and why?',
  },
  // ── Depth added 2026-10-15 ──
  // Every family below held 4–7 items, so a paper could never be longer than that. Each now has 15
  // (easy 5, medium 6, hard 4). `wrongs[0]` is the most tempting distractor — the true/false form
  // offers it as the proposed (false) answer. Equation answers are checked for atom balance and the
  // numeric ones are recomputed in `chemistryBankDepth.test.ts`.
  // ── مكونات الذرة (تتمة) ──
  {
    id: 'ch-ab-e3', family: 'atom_basics', diff: 'easy', eq: 'شحنة البروتون',
    answer: 'موجبة (+1)', wrongs: ['سالبة (−1)', 'متعادلة (صفر)', 'تتغير بتغير العنصر'],
    promptAr: 'ما شحنة البروتون؟',
    promptEn: 'What is the charge of a proton?',
  },
  {
    id: 'ch-ab-e4', family: 'atom_basics', diff: 'easy', eq: 'F: Z = 9',
    answer: '9 إلكترونات', wrongs: ['10 إلكترونات', '19 إلكترونًا', '8 إلكترونات'],
    promptAr: 'ذرة فلور متعادلة عددها الذري 9. كم إلكترونًا فيها؟',
    promptEn: 'A neutral fluorine atom has atomic number 9. How many electrons does it have?',
  },
  {
    id: 'ch-ab-e5', family: 'atom_basics', diff: 'easy', eq: 'كتلة الذرة',
    answer: 'في النواة', wrongs: ['في الإلكترونات', 'موزعة بالتساوي في أنحاء الذرة', 'في مستويات الطاقة'],
    promptAr: 'أين تتركز معظم كتلة الذرة؟',
    promptEn: 'Where is most of an atom\'s mass concentrated?',
  },
  {
    id: 'ch-ab-m3', family: 'atom_basics', diff: 'medium', eq: 'Al: Z = 13, A = 27',
    answer: '14 نيوترونًا', wrongs: ['13 نيوترونًا', '27 نيوترونًا', '40 نيوترونًا'],
    promptAr: 'ذرة ألمنيوم عددها الذري 13 وعددها الكتلي 27. كم نيوترونًا فيها؟',
    promptEn: 'An aluminium atom has atomic number 13 and mass number 27. How many neutrons does it have?',
  },
  {
    id: 'ch-ab-m4', family: 'atom_basics', diff: 'medium', eq: 'Na⁺: Z = 11',
    answer: '10 إلكترونات', wrongs: ['11 إلكترونًا', '12 إلكترونًا', '9 إلكترونات'],
    promptAr: 'أيون الصوديوم Na⁺ عدده الذري 11. كم إلكترونًا فيه؟',
    promptEn: 'The sodium ion Na⁺ has atomic number 11. How many electrons does it have?',
  },
  {
    id: 'ch-ab-m5', family: 'atom_basics', diff: 'medium', eq: '¹⁴C: Z = 6',
    answer: '6 بروتونات و8 نيوترونات', wrongs: ['6 بروتونات و14 نيوترونًا', '8 بروتونات و6 نيوترونات', '14 بروتونًا و6 نيوترونات'],
    promptAr: 'نظير الكربون ¹⁴C عدده الذري 6. كم بروتونًا وكم نيوترونًا فيه؟',
    promptEn: 'The carbon isotope ¹⁴C has atomic number 6. How many protons and neutrons does it have?',
  },
  {
    id: 'ch-ab-m6', family: 'atom_basics', diff: 'medium', eq: 'تعادل الذرة',
    answer: 'لأن عدد البروتونات الموجبة يساوي عدد الإلكترونات السالبة', wrongs: ['لأن النيوترونات تعادل شحنة البروتونات', 'لأن عدد البروتونات يساوي عدد النيوترونات', 'لأن الإلكترونات داخل النواة'],
    promptAr: 'لماذا تكون الذرة متعادلة كهربائيًا؟',
    promptEn: 'Why is an atom electrically neutral?',
  },
  {
    id: 'ch-ab-h2', family: 'atom_basics', diff: 'hard', eq: '¹²C و ¹⁴C و ¹⁴N',
    answer: '¹²C و¹⁴C، لأن لكل منهما 6 بروتونات', wrongs: ['¹⁴C و¹⁴N، لأن عددهما الكتلي متساوٍ', '¹²C و¹⁴N، لأن عدد الإلكترونات متقارب', 'الثلاثة، لأن مجموع جسيماتها متقارب'],
    promptAr: 'أيّ الذرات الآتية لها العدد الذري نفسه: ¹²C، ¹⁴C، ¹⁴N؟ (العدد الذري للكربون 6 وللنيتروجين 7)',
    promptEn: 'Which of these atoms have the same atomic number: ¹²C, ¹⁴C, ¹⁴N? (carbon has atomic number 6, nitrogen 7)',
  },
  {
    id: 'ch-ab-h3', family: 'atom_basics', diff: 'hard', eq: 'A = 31، n = 16',
    answer: 'العدد الذري 15 وعدد الإلكترونات 15', wrongs: ['العدد الذري 16 وعدد الإلكترونات 16', 'العدد الذري 31 وعدد الإلكترونات 15', 'العدد الذري 15 وعدد الإلكترونات 16'],
    promptAr: 'ذرة متعادلة عددها الكتلي 31 وفيها 16 نيوترونًا. ما عددها الذري وعدد إلكتروناتها؟',
    promptEn: 'A neutral atom has mass number 31 and 16 neutrons. What are its atomic number and its number of electrons?',
  },
  {
    id: 'ch-ab-h4', family: 'atom_basics', diff: 'hard', eq: '17 p، 18 n، 18 e⁻',
    answer: 'أيون سالب شحنته 1−', wrongs: ['ذرة متعادلة', 'أيون موجب شحنته 1+', 'أيون سالب شحنته 2−'],
    promptAr: 'جسيم فيه 17 بروتونًا و18 نيوترونًا و18 إلكترونًا. ما نوعه وما شحنته؟',
    promptEn: 'A particle has 17 protons, 18 neutrons and 18 electrons. What kind of particle is it, and what is its charge?',
  },
  // ── بنية الذرة: بور والنموذج الموجي (تتمة) ──
  {
    id: 'ch-as-e3', family: 'atomic_structure', diff: 'easy', eq: 'n = 2',
    answer: '8 إلكترونات', wrongs: ['4 إلكترونات', '18 إلكترونًا', '16 إلكترونًا'],
    promptAr: 'ما أكبر عدد من الإلكترونات يتسع له مستوى الطاقة الثاني (n = 2)؟ استعمل القاعدة 2n².',
    promptEn: 'What is the maximum number of electrons in energy level n = 2? Use the rule 2n².',
  },
  {
    id: 'ch-as-e4', family: 'atomic_structure', diff: 'easy', eq: 'n = 3 → n = 1',
    answer: 'ينبعث منه طاقة على شكل إشعاع (فوتون)', wrongs: ['يمتص طاقة', 'لا تتغير طاقته', 'يخرج من الذرة'],
    promptAr: 'ينتقل إلكترون في ذرة الهيدروجين من المستوى n = 3 إلى المستوى n = 1. ماذا يحدث؟',
    promptEn: 'An electron in a hydrogen atom moves from n = 3 to n = 1. What happens?',
  },
  {
    id: 'ch-as-e5', family: 'atomic_structure', diff: 'easy', eq: 'الحالة المستقرة',
    answer: 'المستوى n = 1', wrongs: ['المستوى n = 2', 'المستوى n = 6', 'أبعد مستوى عن النواة'],
    promptAr: 'في أيّ مستوى طاقة يوجد إلكترون ذرة الهيدروجين في حالته المستقرة (الحالة الأرضية)؟',
    promptEn: 'In which energy level is the electron of a hydrogen atom in its ground state?',
  },
  {
    id: 'ch-as-m3', family: 'atomic_structure', diff: 'medium', eq: 'E = −13.6/n² eV, n = 3',
    answer: '−1.51 eV', wrongs: ['−4.53 eV', '−13.6 eV', '−3.4 eV'],
    promptAr: 'طاقة الإلكترون في ذرة الهيدروجين تُعطى بالعلاقة E = −13.6/n² إلكترون فولت. أوجد طاقة المستوى n = 3.',
    promptEn: 'The electron energy in hydrogen is E = −13.6/n² eV. Find the energy of level n = 3.',
  },
  {
    id: 'ch-as-m4', family: 'atomic_structure', diff: 'medium', eq: 'n = 1 و n = 3',
    answer: 'n = 1، لأنه الأقرب إلى النواة', wrongs: ['n = 3، لأنه الأبعد عن النواة', 'متساويان في الطاقة', 'n = 3، لأن طاقته أكثر سالبية'],
    promptAr: 'أيّ المستويين طاقته أقل في ذرة الهيدروجين: n = 1 أم n = 3؟ ولماذا؟',
    promptEn: 'Which energy level of hydrogen has the lower energy, n = 1 or n = 3, and why?',
  },
  {
    id: 'ch-as-m5', family: 'atomic_structure', diff: 'medium', eq: 'المستوى الرئيس n = 3',
    answer: '3 مستويات فرعية (s وp وd)', wrongs: ['مستويان فرعيان (s وp)', '4 مستويات فرعية (s وp وd وf)', 'مستوى فرعي واحد (s)'],
    promptAr: 'كم مستوى فرعيًا في المستوى الرئيس الثالث (n = 3)؟',
    promptEn: 'How many subshells are in the third main energy level (n = 3)?',
  },
  {
    id: 'ch-as-m6', family: 'atomic_structure', diff: 'medium', eq: 'أعداد الكم',
    answer: 'n، ويحدد مستوى الطاقة وحجم الأوربيتال', wrongs: ['ℓ، ويحدد شكل الأوربيتال', 'm، ويحدد عدد الإلكترونات في الذرة', 's، ويحدد نوع الذرة'],
    promptAr: 'ما رمز عدد الكم الرئيس وماذا يحدد؟',
    promptEn: 'What is the symbol of the principal quantum number, and what does it determine?',
  },
  {
    id: 'ch-as-h2', family: 'atomic_structure', diff: 'hard', eq: 'المستوى الفرعي d',
    answer: '5 أوربيتالات تتسع لـ10 إلكترونات', wrongs: ['3 أوربيتالات تتسع لـ6 إلكترونات', '7 أوربيتالات تتسع لـ14 إلكترونًا', '5 أوربيتالات تتسع لـ5 إلكترونات'],
    promptAr: 'كم أوربيتالًا في المستوى الفرعي d، وكم إلكترونًا يتسع له؟',
    promptEn: 'How many orbitals are in a d subshell, and how many electrons does it hold?',
  },
  {
    id: 'ch-as-h3', family: 'atomic_structure', diff: 'hard', eq: 'عدد الكم المغزلي',
    answer: '+½ أو −½', wrongs: ['0 أو 1', '+1 أو −1', '+½ فقط'],
    promptAr: 'ما القيمتان الممكنتان لعدد الكم المغزلي لإلكترون؟',
    promptEn: 'What are the two possible values of the spin quantum number of an electron?',
  },
  {
    id: 'ch-as-h4', family: 'atomic_structure', diff: 'hard', eq: 'فروض بور',
    answer: 'لأن طاقته ثابتة ما دام في مستوى طاقة محدد', wrongs: ['لأنه ساكن في مكانه', 'لأنه لا يتحرك حول النواة', 'لأن النواة تمتص الطاقة الصادرة عنه'],
    promptAr: 'وفق نظرية بور، لماذا لا يُشعّ الإلكترون طاقة وهو في مستوى طاقته؟',
    promptEn: 'According to Bohr\'s theory, why does an electron not radiate energy while it stays in its energy level?',
  },
  // ── التوزيع الإلكتروني (تتمة) ──
  {
    id: 'ch-ec-e3', family: 'electron_config', diff: 'easy', eq: 'Na: Z = 11',
    answer: '1s² 2s² 2p⁶ 3s¹', wrongs: ['1s² 2s² 2p⁶ 3s²', '1s² 2s² 2p⁵ 3s¹', '1s² 2s¹ 2p⁶ 3s²'],
    promptAr: 'اكتب التوزيع الإلكتروني لذرة الصوديوم (Z = 11).',
    promptEn: 'Write the electron configuration of a sodium atom (Z = 11).',
  },
  {
    id: 'ch-ec-e4', family: 'electron_config', diff: 'easy', eq: 'O: Z = 8',
    answer: '1s² 2s² 2p⁴', wrongs: ['1s² 2s² 2p⁶', '1s² 2s⁴ 2p²', '1s² 2s² 2p³'],
    promptAr: 'اكتب التوزيع الإلكتروني لذرة الأكسجين (Z = 8).',
    promptEn: 'Write the electron configuration of an oxygen atom (Z = 8).',
  },
  {
    id: 'ch-ec-e5', family: 'electron_config', diff: 'easy', eq: 'المستوى الفرعي 2p',
    answer: '6 إلكترونات', wrongs: ['3 إلكترونات', '2 إلكترونات', '10 إلكترونات'],
    promptAr: 'كم إلكترونًا يتسع له المستوى الفرعي 2p عندما يكون ممتلئًا؟',
    promptEn: 'How many electrons does a full 2p subshell hold?',
  },
  {
    id: 'ch-ec-m3', family: 'electron_config', diff: 'medium', eq: 'Al: Z = 13',
    answer: '1s² 2s² 2p⁶ 3s² 3p¹', wrongs: ['1s² 2s² 2p⁶ 3s³', '1s² 2s² 2p⁶ 3s¹ 3p²', '1s² 2s² 2p⁶ 3p³'],
    promptAr: 'اكتب التوزيع الإلكتروني لذرة الألمنيوم (Z = 13).',
    promptEn: 'Write the electron configuration of an aluminium atom (Z = 13).',
  },
  {
    id: 'ch-ec-m4', family: 'electron_config', diff: 'medium', eq: 'Na⁺: Z = 11',
    answer: '1s² 2s² 2p⁶', wrongs: ['1s² 2s² 2p⁶ 3s¹', '1s² 2s² 2p⁶ 3s²', '1s² 2s² 2p⁵'],
    promptAr: 'اكتب التوزيع الإلكتروني لأيون الصوديوم Na⁺ (Z = 11).',
    promptEn: 'Write the electron configuration of the sodium ion Na⁺ (Z = 11).',
  },
  {
    id: 'ch-ec-m5', family: 'electron_config', diff: 'medium', eq: 'Cl⁻: Z = 17',
    answer: '1s² 2s² 2p⁶ 3s² 3p⁶', wrongs: ['1s² 2s² 2p⁶ 3s² 3p⁵', '1s² 2s² 2p⁶ 3s² 3p⁴', '1s² 2s² 2p⁶ 3s² 3p⁶ 4s¹'],
    promptAr: 'اكتب التوزيع الإلكتروني لأيون الكلوريد Cl⁻ (Z = 17).',
    promptEn: 'Write the electron configuration of the chloride ion Cl⁻ (Z = 17).',
  },
  {
    id: 'ch-ec-m6', family: 'electron_config', diff: 'medium', eq: '4s و 3d',
    answer: '4s', wrongs: ['3d', 'يُملآن معًا في الوقت نفسه', 'لا يمكن تحديد ذلك'],
    promptAr: 'أيّ المستويين الفرعيين يُملأ أولًا في الذرة المتعادلة: 4s أم 3d؟',
    promptEn: 'Which subshell is filled first in a neutral atom, 4s or 3d?',
  },
  {
    id: 'ch-ec-h2', family: 'electron_config', diff: 'hard', eq: 'Fe: Z = 26',
    answer: '1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d⁶', wrongs: ['1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d⁸', '1s² 2s² 2p⁶ 3s² 3p⁶ 4s¹ 3d⁷', '1s² 2s² 2p⁶ 3s² 3p⁶ 3d⁸'],
    promptAr: 'اكتب التوزيع الإلكتروني لذرة الحديد (Z = 26).',
    promptEn: 'Write the electron configuration of an iron atom (Z = 26).',
  },
  {
    id: 'ch-ec-h3', family: 'electron_config', diff: 'hard', eq: '1s² 2s² 2p⁶ 3s² 3p⁶',
    answer: 'الأرجون Ar، غاز نبيل لأن مستواه الخارجي ممتلئ', wrongs: ['الكلور Cl، لأن لديه 7 إلكترونات تكافؤ', 'البوتاسيوم K، لأن 4s يلي 3p', 'الكبريت S، لأن 3p⁶ تعني 6 إلكترونات تكافؤ'],
    promptAr: 'ذرة توزيعها الإلكتروني 1s² 2s² 2p⁶ 3s² 3p⁶. ما العنصر، ولماذا هو مستقر؟',
    promptEn: 'An atom has the electron configuration 1s² 2s² 2p⁶ 3s² 3p⁶. Which element is it, and why is it stable?',
  },
  {
    id: 'ch-ec-h4', family: 'electron_config', diff: 'hard', eq: 'N: Z = 7',
    answer: '3 إلكترونات غير مزدوجة', wrongs: ['إلكترون واحد غير مزدوج', 'إلكترونان غير مزدوجين', 'لا توجد إلكترونات غير مزدوجة'],
    promptAr: 'كم إلكترونًا غير مزدوج في ذرة النيتروجين (Z = 7) في حالتها المستقرة؟',
    promptEn: 'How many unpaired electrons does a nitrogen atom (Z = 7) have in its ground state?',
  },
  // ── الروابط الكيميائية (تتمة) ──
  {
    id: 'ch-bd-e3', family: 'bonding', diff: 'easy', eq: 'Cu',
    answer: 'رابطة فلزية', wrongs: ['رابطة أيونية', 'رابطة تساهمية نقية', 'رابطة تساهمية قطبية'],
    promptAr: 'ما نوع الرابطة بين ذرات فلز النحاس Cu؟',
    promptEn: 'What type of bond holds the atoms of copper metal together?',
  },
  {
    id: 'ch-bd-e4', family: 'bonding', diff: 'easy', eq: 'Cl₂',
    answer: 'زوج واحد', wrongs: ['زوجان', 'ثلاثة أزواج', 'لا يوجد زوج مشترك'],
    promptAr: 'كم زوجًا إلكترونيًا مشتركًا في الرابطة بين ذرتي الكلور في Cl₂؟',
    promptEn: 'How many shared electron pairs are in the bond between the two chlorine atoms in Cl₂?',
  },
  {
    id: 'ch-bd-e5', family: 'bonding', diff: 'easy', eq: 'HCl, KBr, CH₄, CO₂',
    answer: 'KBr', wrongs: ['HCl', 'CH₄', 'CO₂'],
    promptAr: 'أيّ المركبات الآتية أيوني: HCl، KBr، CH₄، CO₂؟',
    promptEn: 'Which of these compounds is ionic: HCl, KBr, CH₄, CO₂?',
  },
  {
    id: 'ch-bd-m3', family: 'bonding', diff: 'medium', eq: 'HCl',
    answer: 'تساهمية قطبية، لأن الكلور أعلى كهروسالبية من الهيدروجين', wrongs: ['تساهمية نقية، لأن الذرتين لافلزتان', 'أيونية، لأن الكلور يأخذ الإلكترون كليًا', 'فلزية، لأن الهيدروجين فلز'],
    promptAr: 'ما نوع الرابطة في جزيء HCl؟ علّل إجابتك.',
    promptEn: 'What type of bond is in an HCl molecule? Justify your answer.',
  },
  {
    id: 'ch-bd-m4', family: 'bonding', diff: 'medium', eq: 'N₂',
    answer: 'رابطة ثلاثية (3 أزواج مشتركة)', wrongs: ['رابطة أحادية (زوج مشترك)', 'رابطة ثنائية (زوجان مشتركان)', 'لا توجد رابطة'],
    promptAr: 'كم زوجًا إلكترونيًا مشتركًا بين ذرتي النيتروجين في جزيء N₂؟',
    promptEn: 'How many shared electron pairs join the two nitrogen atoms in N₂?',
  },
  {
    id: 'ch-bd-m5', family: 'bonding', diff: 'medium', eq: 'NaCl صلب',
    answer: 'لأن أيوناته مثبتة في مواقعها ولا تتحرك', wrongs: ['لأنه لا يحتوي على أيونات', 'لأن الرابطة فيه تساهمية', 'لأن إلكتروناته مقيّدة في روابط تساهمية'],
    promptAr: 'لماذا لا يوصل كلوريد الصوديوم الصلب الكهرباء؟',
    promptEn: 'Why does solid sodium chloride not conduct electricity?',
  },
  {
    id: 'ch-bd-m6', family: 'bonding', diff: 'medium', eq: 'Mg → Mg²⁺',
    answer: 'إلكترونين', wrongs: ['إلكترونًا واحدًا', 'ثلاثة إلكترونات', 'تكتسب إلكترونين'],
    promptAr: 'كم إلكترونًا تفقد ذرة المغنيسيوم عند تكوين رابطة أيونية؟',
    promptEn: 'How many electrons does a magnesium atom lose when it forms an ionic bond?',
  },
  {
    id: 'ch-bd-h2', family: 'bonding', diff: 'hard', eq: 'درجة انصهار المركبات الأيونية',
    answer: 'لقوة التجاذب الكهروستاتيكي بين الأيونات المتعاكسة الشحنة', wrongs: ['لأن جزيئاتها كبيرة فقط', 'لأن الروابط التساهمية داخلها قوية', 'لأن كتلتها المولية كبيرة'],
    promptAr: 'لماذا درجات انصهار المركبات الأيونية مرتفعة؟',
    promptEn: 'Why do ionic compounds have high melting points?',
  },
  {
    id: 'ch-bd-h3', family: 'bonding', diff: 'hard', eq: 'التوصيل في الفلزات',
    answer: 'لوجود إلكترونات تكافؤ حرة الحركة (بحر من الإلكترونات)', wrongs: ['لوجود أيونات سالبة حرة الحركة', 'لأن ذراتها متعادلة كهربائيًا فقط', 'لوجود روابط تساهمية قطبية'],
    promptAr: 'لماذا توصل الفلزات الكهرباء؟',
    promptEn: 'Why do metals conduct electricity?',
  },
  {
    id: 'ch-bd-h4', family: 'bonding', diff: 'hard', eq: 'NaCl و CH₄',
    answer: 'NaCl، لأنه مركب أيوني والتجاذب بين أيوناته كبير', wrongs: ['CH₄، لأن كتلته المولية أكبر', 'CH₄، لأن روابطه التساهمية أقوى من التجاذب بين الأيونات', 'متساويان، لأن كليهما مركب'],
    promptAr: 'أيّهما أعلى درجة انصهار: NaCl أم CH₄؟ ولماذا؟',
    promptEn: 'Which has the higher melting point, NaCl or CH₄, and why?',
  },
  // ── الصيغ الكيميائية (تتمة) ──
  {
    id: 'ch-fm-e3', family: 'formulas', diff: 'easy', eq: 'Na⁺ + Cl⁻',
    answer: 'NaCl', wrongs: ['Na₂Cl', 'NaCl₂', 'Na₂Cl₂'],
    promptAr: 'اكتب الصيغة الكيميائية للمركب المتكوّن من Na⁺ وCl⁻.',
    promptEn: 'Write the chemical formula of the compound formed from Na⁺ and Cl⁻.',
  },
  {
    id: 'ch-fm-e4', family: 'formulas', diff: 'easy', eq: 'MgO',
    answer: 'أكسيد المغنيسيوم', wrongs: ['كلوريد المغنيسيوم', 'هيدروكسيد المغنيسيوم', 'كربونات المغنيسيوم'],
    promptAr: 'ما اسم المركب MgO؟',
    promptEn: 'What is the name of the compound MgO?',
  },
  {
    id: 'ch-fm-e5', family: 'formulas', diff: 'easy', eq: 'هيدروكسيد الصوديوم',
    answer: 'NaOH', wrongs: ['Na₂OH', 'Na(OH)₂', 'NaO'],
    promptAr: 'ما الصيغة الكيميائية لهيدروكسيد الصوديوم؟',
    promptEn: 'What is the chemical formula of sodium hydroxide?',
  },
  {
    id: 'ch-fm-m3', family: 'formulas', diff: 'medium', eq: 'K⁺ + SO₄²⁻',
    answer: 'K₂SO₄', wrongs: ['KSO₄', 'K(SO₄)₂', 'K₂(SO₄)₂'],
    promptAr: 'اكتب الصيغة الكيميائية لكبريتات البوتاسيوم المتكوّنة من K⁺ وSO₄²⁻.',
    promptEn: 'Write the formula of the potassium sulfate formed from K⁺ and SO₄²⁻.',
  },
  {
    id: 'ch-fm-m4', family: 'formulas', diff: 'medium', eq: 'Ca²⁺ + PO₄³⁻',
    answer: 'Ca₃(PO₄)₂', wrongs: ['Ca₂(PO₄)₃', 'CaPO₄', 'Ca₃PO₄'],
    promptAr: 'اكتب الصيغة الكيميائية لفوسفات الكالسيوم المتكوّنة من Ca²⁺ وPO₄³⁻.',
    promptEn: 'Write the formula of the calcium phosphate formed from Ca²⁺ and PO₄³⁻.',
  },
  {
    id: 'ch-fm-m5', family: 'formulas', diff: 'medium', eq: 'NH₄Cl',
    answer: 'كلوريد الأمونيوم', wrongs: ['نيتريد الهيدروجين', 'كلورات الأمونيوم', 'كلوريد النيتروجين'],
    promptAr: 'ما اسم المركب NH₄Cl؟',
    promptEn: 'What is the name of the compound NH₄Cl?',
  },
  {
    id: 'ch-fm-m6', family: 'formulas', diff: 'medium', eq: 'CaCO₃',
    answer: 'كربونات الكالسيوم', wrongs: ['أكسيد الكالسيوم', 'كربيد الكالسيوم', 'بيكربونات الكالسيوم'],
    promptAr: 'ما اسم المركب CaCO₃؟',
    promptEn: 'What is the name of the compound CaCO₃?',
  },
  {
    id: 'ch-fm-h2', family: 'formulas', diff: 'hard', eq: '(NH₄)₂SO₄',
    answer: '8 ذرات', wrongs: ['4 ذرات', '6 ذرات', 'ذرتان'],
    promptAr: 'كم ذرة هيدروجين في وحدة الصيغة (NH₄)₂SO₄؟',
    promptEn: 'How many hydrogen atoms are in one formula unit of (NH₄)₂SO₄?',
  },
  {
    id: 'ch-fm-h3', family: 'formulas', diff: 'hard', eq: 'Al₂(SO₄)₃',
    answer: '17 ذرة', wrongs: ['9 ذرات', '14 ذرة', '23 ذرة'],
    promptAr: 'ما العدد الكلي للذرات في وحدة الصيغة Al₂(SO₄)₃؟',
    promptEn: 'What is the total number of atoms in one formula unit of Al₂(SO₄)₃?',
  },
  {
    id: 'ch-fm-h4', family: 'formulas', diff: 'hard', eq: 'Mg²⁺ + NO₃⁻',
    answer: 'Mg(NO₃)₂', wrongs: ['MgNO₃', 'Mg₂NO₃', 'Mg₂(NO₃)₃'],
    promptAr: 'اكتب الصيغة الكيميائية لنترات المغنيسيوم المتكوّنة من Mg²⁺ وNO₃⁻.',
    promptEn: 'Write the formula of the magnesium nitrate formed from Mg²⁺ and NO₃⁻.',
  },
  // ── التفاعلات ووزن المعادلات (تتمة) ──
  {
    id: 'ch-eq-e3', family: 'equations', diff: 'easy', eq: 'Na + Cl₂ → NaCl',
    answer: '2Na + Cl₂ → 2NaCl', wrongs: ['Na + Cl₂ → NaCl', '2Na + 2Cl₂ → 2NaCl', 'Na + Cl₂ → 2NaCl'],
    promptAr: 'وازن المعادلة الآتية: Na + Cl₂ → NaCl',
    promptEn: 'Balance the equation: Na + Cl₂ → NaCl',
  },
  {
    id: 'ch-eq-e4', family: 'equations', diff: 'easy', eq: 'Mg + O₂ → MgO',
    answer: '2Mg + O₂ → 2MgO', wrongs: ['Mg + O₂ → MgO', 'Mg + O₂ → 2MgO', '2Mg + 2O₂ → 2MgO'],
    promptAr: 'وازن المعادلة الآتية: Mg + O₂ → MgO',
    promptEn: 'Balance the equation: Mg + O₂ → MgO',
  },
  {
    id: 'ch-eq-e5', family: 'equations', diff: 'easy', eq: '2Na + Cl₂ → 2NaCl',
    answer: 'تفاعل اتحاد', wrongs: ['تفاعل تحلل', 'تفاعل إحلال بسيط', 'تفاعل إحلال مزدوج'],
    promptAr: 'ما نوع التفاعل الآتي: 2Na + Cl₂ → 2NaCl؟',
    promptEn: 'What type of reaction is 2Na + Cl₂ → 2NaCl?',
  },
  {
    id: 'ch-eq-m3', family: 'equations', diff: 'medium', eq: 'Zn + HCl → ZnCl₂ + H₂',
    answer: 'Zn + 2HCl → ZnCl₂ + H₂', wrongs: ['Zn + HCl → ZnCl₂ + H₂', '2Zn + 2HCl → 2ZnCl₂ + H₂', 'Zn + 2HCl → ZnCl₂ + 2H₂'],
    promptAr: 'وازن المعادلة الآتية: Zn + HCl → ZnCl₂ + H₂',
    promptEn: 'Balance the equation: Zn + HCl → ZnCl₂ + H₂',
  },
  {
    id: 'ch-eq-m4', family: 'equations', diff: 'medium', eq: 'Zn + CuSO₄ → ZnSO₄ + Cu',
    answer: 'تفاعل إحلال بسيط', wrongs: ['تفاعل اتحاد', 'تفاعل تحلل', 'تفاعل إحلال مزدوج'],
    promptAr: 'ما نوع التفاعل الآتي: Zn + CuSO₄ → ZnSO₄ + Cu؟',
    promptEn: 'What type of reaction is Zn + CuSO₄ → ZnSO₄ + Cu?',
  },
  {
    id: 'ch-eq-m5', family: 'equations', diff: 'medium', eq: 'AgNO₃ + NaCl → AgCl + NaNO₃',
    answer: 'تفاعل إحلال مزدوج', wrongs: ['تفاعل إحلال بسيط', 'تفاعل اتحاد', 'تفاعل تحلل'],
    promptAr: 'ما نوع التفاعل الآتي: AgNO₃ + NaCl → AgCl + NaNO₃؟',
    promptEn: 'What type of reaction is AgNO₃ + NaCl → AgCl + NaNO₃?',
  },
  {
    id: 'ch-eq-m6', family: 'equations', diff: 'medium', eq: 'C₃H₈ + O₂ → CO₂ + H₂O',
    answer: 'C₃H₈ + 5O₂ → 3CO₂ + 4H₂O', wrongs: ['C₃H₈ + O₂ → 3CO₂ + 4H₂O', 'C₃H₈ + 3O₂ → 3CO₂ + 4H₂O', 'C₃H₈ + 5O₂ → 3CO₂ + 8H₂O'],
    promptAr: 'وازن معادلة احتراق البروبان: C₃H₈ + O₂ → CO₂ + H₂O',
    promptEn: 'Balance the combustion of propane: C₃H₈ + O₂ → CO₂ + H₂O',
  },
  {
    id: 'ch-eq-h3', family: 'equations', diff: 'hard', eq: 'Al + O₂ → Al₂O₃',
    answer: '4Al + 3O₂ → 2Al₂O₃', wrongs: ['2Al + 3O₂ → Al₂O₃', '4Al + 6O₂ → 2Al₂O₃', '2Al + O₂ → Al₂O₃'],
    promptAr: 'وازن المعادلة الآتية: Al + O₂ → Al₂O₃',
    promptEn: 'Balance the equation: Al + O₂ → Al₂O₃',
  },
  {
    id: 'ch-eq-h4', family: 'equations', diff: 'hard', eq: 'Fe₂O₃ + CO → Fe + CO₂',
    answer: 'Fe₂O₃ + 3CO → 2Fe + 3CO₂', wrongs: ['Fe₂O₃ + CO → 2Fe + CO₂', 'Fe₂O₃ + 3CO → Fe + 3CO₂', '2Fe₂O₃ + 3CO → 4Fe + 3CO₂'],
    promptAr: 'وازن المعادلة الآتية: Fe₂O₃ + CO → Fe + CO₂',
    promptEn: 'Balance the equation: Fe₂O₃ + CO → Fe + CO₂',
  },
  // ── المول والكتلة المولية (تتمة) ──
  {
    id: 'ch-ml-e3', family: 'mole', diff: 'easy', eq: 'O₂',
    answer: '32 g/mol', wrongs: ['16 g/mol', '48 g/mol', '64 g/mol'],
    promptAr: 'أوجد الكتلة المولية لغاز الأكسجين O₂. (O = 16)',
    promptEn: 'Find the molar mass of oxygen gas, O₂. (O = 16)',
  },
  {
    id: 'ch-ml-e4', family: 'mole', diff: 'easy', eq: '1 mol',
    answer: '6.02 × 10²³ جسيمًا', wrongs: ['6.02 × 10²² جسيمًا', '3.01 × 10²³ جسيمًا', '1.00 × 10²³ جسيمًا'],
    promptAr: 'كم جسيمًا في 1 mol من أي مادة؟',
    promptEn: 'How many particles are in 1 mol of any substance?',
  },
  {
    id: 'ch-ml-e5', family: 'mole', diff: 'easy', eq: 'NH₃',
    answer: '17 g/mol', wrongs: ['15 g/mol', '14 g/mol', '18 g/mol'],
    promptAr: 'أوجد الكتلة المولية للأمونيا NH₃. (N = 14، H = 1)',
    promptEn: 'Find the molar mass of ammonia, NH₃. (N = 14, H = 1)',
  },
  {
    id: 'ch-ml-m4', family: 'mole', diff: 'medium', eq: 'm = 88 g CO₂',
    answer: '2 mol', wrongs: ['4 mol', '1 mol', '44 mol'],
    promptAr: 'كم مولًا في 88 g من CO₂؟ (الكتلة المولية 44 g/mol)',
    promptEn: 'How many moles are in 88 g of CO₂? (molar mass 44 g/mol)',
  },
  {
    id: 'ch-ml-m5', family: 'mole', diff: 'medium', eq: 'n = 0.5 mol H₂O',
    answer: '3.01 × 10²³ جزيئًا', wrongs: ['6.02 × 10²³ جزيئًا', '1.204 × 10²⁴ جزيئًا', '0.5 × 10²³ جزيئًا'],
    promptAr: 'كم جزيئًا في 0.5 mol من الماء؟ (عدد أفوجادرو 6.02 × 10²³)',
    promptEn: 'How many molecules are in 0.5 mol of water? (Avogadro\'s number 6.02 × 10²³)',
  },
  {
    id: 'ch-ml-m6', family: 'mole', diff: 'medium', eq: 'Na₂CO₃',
    answer: '106 g/mol', wrongs: ['83 g/mol', '94 g/mol', '138 g/mol'],
    promptAr: 'أوجد الكتلة المولية لكربونات الصوديوم Na₂CO₃. (Na = 23، C = 12، O = 16)',
    promptEn: 'Find the molar mass of sodium carbonate, Na₂CO₃. (Na = 23, C = 12, O = 16)',
  },
  {
    id: 'ch-ml-h3', family: 'mole', diff: 'hard', eq: 'm = 9.8 g H₂SO₄',
    answer: '0.1 mol', wrongs: ['1 mol', '0.98 mol', '10 mol'],
    promptAr: 'كم مولًا في 9.8 g من حمض الكبريتيك H₂SO₄؟ (H = 1، S = 32، O = 16)',
    promptEn: 'How many moles are in 9.8 g of sulfuric acid, H₂SO₄? (H = 1, S = 32, O = 16)',
  },
  {
    id: 'ch-ml-h4', family: 'mole', diff: 'hard', eq: '3.01 × 10²³ جزيء H₂O',
    answer: '9 g', wrongs: ['18 g', '36 g', '4.5 g'],
    promptAr: 'ما كتلة 3.01 × 10²³ جزيئًا من الماء؟ (الكتلة المولية 18 g/mol، عدد أفوجادرو 6.02 × 10²³)',
    promptEn: 'What is the mass of 3.01 × 10²³ molecules of water? (molar mass 18 g/mol, Avogadro\'s number 6.02 × 10²³)',
  },
  // ── الحسابات الكيميائية (تتمة) ──
  {
    id: 'ch-st-e2', family: 'stoichiometry', diff: 'easy', eq: '2Mg + O₂ → 2MgO',
    answer: '2 mol', wrongs: ['1 mol', '4 mol', '0.5 mol'],
    promptAr: 'في التفاعل 2Mg + O₂ → 2MgO، كم مولًا من MgO ينتج من 2 mol من Mg؟',
    promptEn: 'In 2Mg + O₂ → 2MgO, how many moles of MgO form from 2 mol of Mg?',
  },
  {
    id: 'ch-st-e3', family: 'stoichiometry', diff: 'easy', eq: '2H₂O → 2H₂ + O₂',
    answer: '2 mol', wrongs: ['4 mol', '1 mol', '8 mol'],
    promptAr: 'في التفاعل 2H₂O → 2H₂ + O₂، كم مولًا من O₂ ينتج من تحلل 4 mol من H₂O؟',
    promptEn: 'In 2H₂O → 2H₂ + O₂, how many moles of O₂ form when 4 mol of H₂O decompose?',
  },
  {
    id: 'ch-st-e4', family: 'stoichiometry', diff: 'easy', eq: 'N₂ + 3H₂ → 2NH₃',
    answer: '3 : 2', wrongs: ['2 : 3', '1 : 2', '3 : 1'],
    promptAr: 'في التفاعل N₂ + 3H₂ → 2NH₃، ما النسبة المولية بين H₂ وNH₃؟',
    promptEn: 'In N₂ + 3H₂ → 2NH₃, what is the mole ratio of H₂ to NH₃?',
  },
  {
    id: 'ch-st-e5', family: 'stoichiometry', diff: 'easy', eq: 'H₂O: O = 16، الكتلة المولية 18',
    answer: '88.9%', wrongs: ['11.1%', '50%', '16%'],
    promptAr: 'ما النسبة المئوية لكتلة الأكسجين في الماء H₂O؟ (H = 1، O = 16)',
    promptEn: 'What is the percentage by mass of oxygen in water, H₂O? (H = 1, O = 16)',
  },
  {
    id: 'ch-st-m3', family: 'stoichiometry', diff: 'medium', eq: 'CO₂: C = 12، الكتلة المولية 44',
    answer: '27.3%', wrongs: ['72.7%', '12%', '50%'],
    promptAr: 'ما النسبة المئوية لكتلة الكربون في ثاني أكسيد الكربون CO₂؟ (C = 12، O = 16)',
    promptEn: 'What is the percentage by mass of carbon in carbon dioxide, CO₂? (C = 12, O = 16)',
  },
  {
    id: 'ch-st-m4', family: 'stoichiometry', diff: 'medium', eq: 'CaCO₃ + 2HCl → CaCl₂ + H₂O + CO₂',
    answer: '1 mol', wrongs: ['0.5 mol', '0.25 mol', '2 mol'],
    promptAr: 'في التفاعل CaCO₃ + 2HCl → CaCl₂ + H₂O + CO₂، كم مولًا من HCl يلزم لتفاعل 0.5 mol من CaCO₃؟',
    promptEn: 'In CaCO₃ + 2HCl → CaCl₂ + H₂O + CO₂, how many moles of HCl react with 0.5 mol of CaCO₃?',
  },
  {
    id: 'ch-st-m5', family: 'stoichiometry', diff: 'medium', eq: 'C₆H₁₂O₆',
    answer: 'CH₂O', wrongs: ['C₆H₁₂O₆', 'C₂H₄O₂', 'CHO'],
    promptAr: 'ما الصيغة الأولية للجلوكوز C₆H₁₂O₆؟',
    promptEn: 'What is the empirical formula of glucose, C₆H₁₂O₆?',
  },
  {
    id: 'ch-st-m6', family: 'stoichiometry', diff: 'medium', eq: 'الصيغة الأولية CH₂، M = 42 g/mol',
    answer: 'C₃H₆', wrongs: ['CH₂', 'C₂H₄', 'C₄H₈'],
    promptAr: 'صيغة مركب الأولية CH₂ وكتلته المولية 42 g/mol. ما صيغته الجزيئية؟ (C = 12، H = 1)',
    promptEn: 'A compound has empirical formula CH₂ and molar mass 42 g/mol. What is its molecular formula? (C = 12, H = 1)',
  },
  {
    id: 'ch-st-h3', family: 'stoichiometry', diff: 'hard', eq: '2Mg + O₂ → 2MgO، 12 g Mg',
    answer: '20 g', wrongs: ['40 g', '12 g', '10 g'],
    promptAr: 'يحترق 12 g من المغنيسيوم حسب المعادلة 2Mg + O₂ → 2MgO. ما كتلة MgO الناتجة؟ (الكتلة المولية لـMg = 24 g/mol، ولـMgO = 40 g/mol)',
    promptEn: '12 g of magnesium burns: 2Mg + O₂ → 2MgO. What mass of MgO forms? (molar mass Mg = 24 g/mol, MgO = 40 g/mol)',
  },
  {
    id: 'ch-st-h4', family: 'stoichiometry', diff: 'hard', eq: 'المردود النظري 20 g، الفعلي 15 g',
    answer: '75%', wrongs: ['133%', '25%', '35%'],
    promptAr: 'الكتلة النظرية لناتج تفاعل 20 g والكتلة الفعلية التي حصلنا عليها 15 g. ما المردود المئوي للتفاعل؟',
    promptEn: 'The theoretical yield of a reaction is 20 g and the actual yield is 15 g. What is the percent yield?',
  },
  // ── الطاقة والتفاعلات (تتمة) ──
  {
    id: 'ch-th-e3', family: 'thermochem', diff: 'easy', eq: 'يبرد المحيط',
    answer: 'تفاعل ماص للطاقة', wrongs: ['تفاعل طارد للطاقة', 'تفاعل متعادل حراريًا', 'لا يحدث تغير في الطاقة'],
    promptAr: 'تفاعل تنخفض فيه درجة حرارة المحيط (يبرد). ما نوعه؟',
    promptEn: 'In a reaction the surroundings get colder. What type of reaction is it?',
  },
  {
    id: 'ch-th-e4', family: 'thermochem', diff: 'easy', eq: 'أمثلة',
    answer: 'احتراق الغاز الطبيعي', wrongs: ['تحلل كربونات الكالسيوم بالتسخين', 'التمثيل الضوئي', 'تحلل الماء بالتحليل الكهربائي'],
    promptAr: 'أيّ التفاعلات الآتية طارد للطاقة؟',
    promptEn: 'Which of these reactions is exothermic?',
  },
  {
    id: 'ch-th-e5', family: 'thermochem', diff: 'easy', eq: 'وحدة الطاقة',
    answer: 'الجول (J)', wrongs: ['الواط (W)', 'النيوتن (N)', 'الباسكال (Pa)'],
    promptAr: 'ما وحدة قياس الطاقة في النظام الدولي للوحدات؟',
    promptEn: 'What is the SI unit of energy?',
  },
  {
    id: 'ch-th-m3', family: 'thermochem', diff: 'medium', eq: 'q = m·c·ΔT، m = 50 g، ΔT = 10 °C',
    answer: '2090 J', wrongs: ['209 J', '4180 J', '20.9 J'],
    promptAr: 'سُخّن 50 g من الماء فارتفعت درجة حرارته 10 °C. أوجد الطاقة الممتصة بالعلاقة q = m·c·ΔT علمًا أن c = 4.18 J/g·°C.',
    promptEn: '50 g of water is heated by 10 °C. Find the energy absorbed using q = m·c·ΔT with c = 4.18 J/g·°C.',
  },
  {
    id: 'ch-th-m4', family: 'thermochem', diff: 'medium', eq: 'CH₄: ΔH = −890 kJ/mol',
    answer: '1780 kJ', wrongs: ['890 kJ', '445 kJ', '3560 kJ'],
    promptAr: 'احتراق مول واحد من الميثان تنتج عنه طاقة قدرها 890 kJ. كم kJ تنتج عند احتراق 2 mol؟',
    promptEn: 'Burning 1 mol of methane releases 890 kJ. How much energy is released by burning 2 mol?',
  },
  {
    id: 'ch-th-m5', family: 'thermochem', diff: 'medium', eq: 'H(المتفاعلات) = 100 kJ، H(النواتج) = 60 kJ',
    answer: 'ΔH = −40 kJ', wrongs: ['ΔH = +40 kJ', 'ΔH = −160 kJ', 'ΔH = +160 kJ'],
    promptAr: 'محتوى المتفاعلات الحراري 100 kJ ومحتوى النواتج 60 kJ. ما قيمة ΔH؟',
    promptEn: 'The reactants have enthalpy 100 kJ and the products 60 kJ. What is ΔH?',
  },
  {
    id: 'ch-th-m6', family: 'thermochem', diff: 'medium', eq: 'كسر الروابط 500 kJ، تكوين الروابط 650 kJ',
    answer: 'ΔH = −150 kJ (طارد)', wrongs: ['ΔH = +150 kJ (ماص)', 'ΔH = +1150 kJ (ماص)', 'ΔH = −1150 kJ (طارد)'],
    promptAr: 'في تفاعل ما، الطاقة الممتصة لكسر الروابط 500 kJ والطاقة المنبعثة عند تكوين الروابط 650 kJ. أوجد ΔH ونوع التفاعل.',
    promptEn: 'In a reaction, breaking bonds absorbs 500 kJ and forming bonds releases 650 kJ. Find ΔH and the type of reaction.',
  },
  {
    id: 'ch-th-h2', family: 'thermochem', diff: 'hard', eq: 'قانون هيس: ΔH₁ = −100، ΔH₂ = −50',
    answer: 'ΔH = −150 kJ', wrongs: ['ΔH = −50 kJ', 'ΔH = +150 kJ', 'ΔH = −100 kJ'],
    promptAr: 'يحدث تفاعل على خطوتين: ΔH للخطوة الأولى = −100 kJ وللثانية = −50 kJ. ما ΔH للتفاعل الكلي وفق قانون هيس؟',
    promptEn: 'A reaction occurs in two steps: ΔH of step 1 is −100 kJ and of step 2 is −50 kJ. What is ΔH of the overall reaction, by Hess\'s law?',
  },
  {
    id: 'ch-th-h3', family: 'thermochem', diff: 'hard', eq: 'عكس التفاعل: ΔH = −200 kJ',
    answer: 'ΔH = +200 kJ', wrongs: ['ΔH = −200 kJ', 'ΔH = −100 kJ', 'ΔH = صفر'],
    promptAr: 'تفاعل قيمة ΔH له = −200 kJ. ما قيمة ΔH للتفاعل العكسي؟',
    promptEn: 'A reaction has ΔH = −200 kJ. What is ΔH for the reverse reaction?',
  },
  {
    id: 'ch-th-h4', family: 'thermochem', diff: 'hard', eq: '2H₂ + O₂ → 2H₂O، ΔH = −572 kJ',
    answer: 'ΔH = −286 kJ', wrongs: ['ΔH = −572 kJ', 'ΔH = −1144 kJ', 'ΔH = −143 kJ'],
    promptAr: 'للتفاعل 2H₂ + O₂ → 2H₂O قيمة ΔH = −572 kJ. كم تبلغ الطاقة المرافقة لتكوين مول واحد من H₂O؟',
    promptEn: 'For 2H₂ + O₂ → 2H₂O, ΔH = −572 kJ. What is the energy change for forming 1 mol of H₂O?',
  },
  // ── الحموض والقواعد (تتمة) ──
  {
    id: 'ch-ac-e3', family: 'acids_bases', diff: 'easy', eq: 'pH = 7',
    answer: 'محلول متعادل', wrongs: ['محلول حمضي', 'محلول قاعدي', 'محلول شديد القاعدية'],
    promptAr: 'محلول رقمه الهيدروجيني pH = 7. ما نوعه؟',
    promptEn: 'A solution has pH = 7. What type is it?',
  },
  {
    id: 'ch-ac-e4', family: 'acids_bases', diff: 'easy', eq: 'HCl, NaOH, NaCl, KOH',
    answer: 'HCl', wrongs: ['NaOH', 'NaCl', 'KOH'],
    promptAr: 'أيّ المواد الآتية حمض: HCl، NaOH، NaCl، KOH؟',
    promptEn: 'Which of these substances is an acid: HCl, NaOH, NaCl, KOH?',
  },
  {
    id: 'ch-ac-e5', family: 'acids_bases', diff: 'easy', eq: 'ورق عباد الشمس الأحمر + قاعدة',
    answer: 'يتحول إلى الأزرق', wrongs: ['يبقى أحمر', 'يتحول إلى الأخضر', 'يتحول إلى الأصفر'],
    promptAr: 'ما لون ورق عباد الشمس الأحمر عند وضعه في محلول قاعدي؟',
    promptEn: 'What colour does red litmus paper turn in a basic solution?',
  },
  {
    id: 'ch-ac-m3', family: 'acids_bases', diff: 'medium', eq: 'تأين HCl',
    answer: 'HCl → H⁺ + Cl⁻', wrongs: ['HCl → H⁻ + Cl⁺', 'HCl → H₂ + Cl₂', 'HCl → OH⁻ + Cl⁺'],
    promptAr: 'اكتب معادلة تأين حمض الهيدروكلوريك HCl في الماء.',
    promptEn: 'Write the ionization equation of hydrochloric acid, HCl, in water.',
  },
  {
    id: 'ch-ac-m4', family: 'acids_bases', diff: 'medium', eq: 'تأين NaOH',
    answer: 'NaOH → Na⁺ + OH⁻', wrongs: ['NaOH → Na⁻ + OH⁺', 'NaOH → Na + O + H', 'NaOH → NaO⁻ + H⁺'],
    promptAr: 'اكتب معادلة تأين هيدروكسيد الصوديوم NaOH في الماء.',
    promptEn: 'Write the ionization equation of sodium hydroxide, NaOH, in water.',
  },
  {
    id: 'ch-ac-m5', family: 'acids_bases', diff: 'medium', eq: 'حمض قوي وحمض ضعيف',
    answer: 'القوي، لأنه يتأين كليًا', wrongs: ['الضعيف، لأنه يتأين كليًا', 'متساويان، لأن التركيز نفسه', 'لا يوصل أي منهما الكهرباء'],
    promptAr: 'محلولان لحمضين قوي وضعيف بالتركيز نفسه. أيّهما أفضل توصيلًا للكهرباء؟ ولماذا؟',
    promptEn: 'Two acid solutions, one strong and one weak, have the same concentration. Which conducts electricity better, and why?',
  },
  {
    id: 'ch-ac-m6', family: 'acids_bases', diff: 'medium', eq: 'H₂SO₄ + 2NaOH',
    answer: 'Na₂SO₄ + 2H₂O', wrongs: ['Na₂SO₄ + H₂O', 'NaSO₄ + 2H₂O', 'Na₂SO₃ + 2H₂O'],
    promptAr: 'أكمل معادلة التعادل: H₂SO₄ + 2NaOH → ...',
    promptEn: 'Complete the neutralisation: H₂SO₄ + 2NaOH → ...',
  },
  {
    id: 'ch-ac-h2', family: 'acids_bases', diff: 'hard', eq: 'المطر الحمضي',
    answer: 'أكاسيد الكبريت والنيتروجين المذابة في ماء المطر', wrongs: ['ثاني أكسيد الكربون وحده', 'الأوزون في طبقة الجو العليا', 'غبار التربة'],
    promptAr: 'ما الذي يسبب المطر الحمضي؟',
    promptEn: 'What causes acid rain?',
  },
  {
    id: 'ch-ac-h3', family: 'acids_bases', diff: 'hard', eq: 'pH = 12 مقابل pH = 9',
    answer: 'pH = 12 أقوى قاعدية؛ تركيز OH⁻ فيه أكبر 1000 مرة', wrongs: ['pH = 9 أقوى قاعدية', 'pH = 12 أقوى قاعدية؛ تركيز OH⁻ فيه أكبر 3 مرات', 'متساويان، لأن كليهما قاعدي'],
    promptAr: 'محلولان قاعديان رقماهما الهيدروجينيان 12 و9. أيّهما أقوى قاعدية، وكم مرة يزيد تركيز OH⁻ فيه عن الآخر؟ (المقياس لوغاريتمي)',
    promptEn: 'Two basic solutions have pH 12 and pH 9. Which is more basic, and by what factor is its OH⁻ concentration larger? (the scale is logarithmic)',
  },
  {
    id: 'ch-ac-h4', family: 'acids_bases', diff: 'hard', eq: '0.1 mol H₂SO₄ + NaOH',
    answer: '0.2 mol', wrongs: ['0.1 mol', '0.05 mol', '0.4 mol'],
    promptAr: 'كم مولًا من NaOH يلزم لتعادل 0.1 mol من H₂SO₄ تعادلًا تامًا؟ (H₂SO₄ + 2NaOH → Na₂SO₄ + 2H₂O)',
    promptEn: 'How many moles of NaOH are needed to neutralise 0.1 mol of H₂SO₄ completely? (H₂SO₄ + 2NaOH → Na₂SO₄ + 2H₂O)',
  },
  // ── نشاط الفلزات (تتمة) ──
  {
    id: 'ch-ma-e2', family: 'metal_activity', diff: 'easy', eq: 'Na و Cu',
    answer: 'Na', wrongs: ['Cu', 'متساويان في النشاط', 'لا يمكن المقارنة بينهما'],
    promptAr: 'أيّ الفلزين أنشط كيميائيًا: الصوديوم Na أم النحاس Cu؟',
    promptEn: 'Which metal is more reactive, sodium Na or copper Cu?',
  },
  {
    id: 'ch-ma-e3', family: 'metal_activity', diff: 'easy', eq: 'فلز + أكسجين',
    answer: 'أكسيد الفلز', wrongs: ['ملح الفلز', 'هيدروكسيد الفلز', 'غاز الهيدروجين'],
    promptAr: 'ماذا ينتج من تفاعل فلز مع غاز الأكسجين؟',
    promptEn: 'What is produced when a metal reacts with oxygen gas?',
  },
  {
    id: 'ch-ma-e4', family: 'metal_activity', diff: 'easy', eq: 'Mg + HCl',
    answer: 'غاز الهيدروجين', wrongs: ['غاز الأكسجين', 'غاز ثاني أكسيد الكربون', 'غاز الكلور'],
    promptAr: 'ما الغاز الناتج من تفاعل المغنيسيوم مع حمض الهيدروكلوريك المخفف؟',
    promptEn: 'Which gas is produced when magnesium reacts with dilute hydrochloric acid?',
  },
  {
    id: 'ch-ma-e5', family: 'metal_activity', diff: 'easy', eq: 'Na, Cu, Au, Ag',
    answer: 'Na', wrongs: ['Cu', 'Au', 'Ag'],
    promptAr: 'أيّ الفلزات الآتية يتفاعل بعنف مع الماء البارد: Na، Cu، Au، Ag؟',
    promptEn: 'Which of these metals reacts vigorously with cold water: Na, Cu, Au, Ag?',
  },
  {
    id: 'ch-ma-m3', family: 'metal_activity', diff: 'medium', eq: 'Mg + ZnSO₄',
    answer: 'نعم، لأن Mg أنشط من Zn', wrongs: ['لا، لأن Mg أقل نشاطًا من Zn', 'لا، لأن Mg لا يتفاعل مع الأملاح', 'نعم، لأن Mg أقل نشاطًا من Zn'],
    promptAr: 'هل يحلّ المغنيسيوم محل الزنك في محلول كبريتات الزنك ZnSO₄؟ علّل.',
    promptEn: 'Does magnesium displace zinc from zinc sulfate solution, ZnSO₄? Explain.',
  },
  {
    id: 'ch-ma-m4', family: 'metal_activity', diff: 'medium', eq: 'Mg + 2HCl',
    answer: 'MgCl₂ + H₂', wrongs: ['MgCl + H₂', 'MgCl₂ + H₂O', 'MgH₂ + Cl₂'],
    promptAr: 'أكمل: Mg + 2HCl → ...',
    promptEn: 'Complete: Mg + 2HCl → ...',
  },
  {
    id: 'ch-ma-m5', family: 'metal_activity', diff: 'medium', eq: 'Na + H₂O',
    answer: 'NaOH وغاز H₂', wrongs: ['Na₂O وغاز O₂', 'NaOH وغاز O₂', 'NaCl وغاز H₂'],
    promptAr: 'ما نواتج تفاعل الصوديوم مع الماء؟',
    promptEn: 'What are the products of the reaction of sodium with water?',
  },
  {
    id: 'ch-ma-m6', family: 'metal_activity', diff: 'medium', eq: 'Zn, Fe, Cu, Mg',
    answer: 'Cu', wrongs: ['Zn', 'Fe', 'Mg'],
    promptAr: 'أيّ الفلزات الآتية لا يتفاعل مع حمض الهيدروكلوريك المخفف: Zn، Fe، Cu، Mg؟',
    promptEn: 'Which of these metals does not react with dilute hydrochloric acid: Zn, Fe, Cu, Mg?',
  },
  {
    id: 'ch-ma-h2', family: 'metal_activity', diff: 'hard', eq: 'الألمنيوم',
    answer: 'تتكوّن طبقة رقيقة من أكسيد الألمنيوم تحميه', wrongs: ['لأنه أقل نشاطًا من الحديد', 'لأنه لا يتفاعل مع الأكسجين', 'لأنه يطفو على الماء'],
    promptAr: 'الألمنيوم فلز نشط، لكنه لا يصدأ كما يصدأ الحديد. فسّر ذلك.',
    promptEn: 'Aluminium is a reactive metal, yet it does not rust the way iron does. Explain.',
  },
  {
    id: 'ch-ma-h3', family: 'metal_activity', diff: 'hard', eq: 'Cu, Fe, Zn',
    answer: 'Cu < Fe < Zn', wrongs: ['Zn < Fe < Cu', 'Fe < Cu < Zn', 'Cu < Zn < Fe'],
    promptAr: 'رتّب الفلزات Fe وZn وCu تصاعديًا بحسب نشاطها الكيميائي.',
    promptEn: 'Arrange Fe, Zn and Cu in order of increasing reactivity.',
  },
  {
    id: 'ch-ma-h4', family: 'metal_activity', diff: 'hard', eq: 'حماية الحديد',
    answer: 'Zn، لأنه أنشط من الحديد فيتأكسد بدلًا منه', wrongs: ['Cu، لأنه موصل جيد للكهرباء', 'Sn، لأنه لا يصدأ', 'Ag، لأنه فلز ثمين'],
    promptAr: 'أيّ الفلزات الآتية أنسب لحماية الحديد من الصدأ بالتضحية: Cu، Zn، Ag، Sn؟ ولماذا؟',
    promptEn: 'Which of these metals is best for protecting iron from rusting by sacrificial protection: Cu, Zn, Ag, Sn? Why?',
  },
  // ── التأكسد والاختزال والتحليل الكهربائي (تتمة) ──
  {
    id: 'ch-rx-e3', family: 'redox', diff: 'easy', eq: 'التأكسد',
    answer: 'فقد إلكترونات', wrongs: ['اكتساب إلكترونات', 'اكتساب بروتونات', 'فقد نيوترونات'],
    promptAr: 'عرّف عملية التأكسد بدلالة الإلكترونات.',
    promptEn: 'Define oxidation in terms of electrons.',
  },
  {
    id: 'ch-rx-e4', family: 'redox', diff: 'easy', eq: 'Cu²⁺ + 2e⁻ → Cu',
    answer: 'اختزال، لأن Cu²⁺ يكتسب إلكترونين', wrongs: ['تأكسد، لأن Cu²⁺ يكتسب إلكترونين', 'اختزال، لأن Cu²⁺ يفقد إلكترونين', 'تأكسد، لأن Cu²⁺ يفقد إلكترونين'],
    promptAr: 'صنّف نصف التفاعل Cu²⁺ + 2e⁻ → Cu تأكسدًا أم اختزالًا، مع التعليل.',
    promptEn: 'Classify Cu²⁺ + 2e⁻ → Cu as oxidation or reduction, with a reason.',
  },
  {
    id: 'ch-rx-e5', family: 'redox', diff: 'easy', eq: 'الخلية الجلفانية',
    answer: 'عند المصعد', wrongs: ['عند المهبط', 'عند القنطرة الملحية', 'في المحلول فقط'],
    promptAr: 'أين يحدث التأكسد في الخلية الجلفانية؟',
    promptEn: 'Where does oxidation occur in a galvanic cell?',
  },
  {
    id: 'ch-rx-m3', family: 'redox', diff: 'medium', eq: 'القنطرة الملحية',
    answer: 'إكمال الدائرة الكهربائية وموازنة الشحنة بين المحلولين', wrongs: ['تزويد الخلية بالإلكترونات', 'إيقاف التفاعل', 'تسخين المحلولين'],
    promptAr: 'ما وظيفة القنطرة الملحية في الخلية الجلفانية؟',
    promptEn: 'What is the function of the salt bridge in a galvanic cell?',
  },
  {
    id: 'ch-rx-m4', family: 'redox', diff: 'medium', eq: 'التحليل الكهربائي لمصهور NaCl: المهبط',
    answer: 'فلز الصوديوم Na', wrongs: ['غاز الكلور Cl₂', 'غاز الهيدروجين H₂', 'غاز الأكسجين O₂'],
    promptAr: 'عند التحليل الكهربائي لمصهور كلوريد الصوديوم، ما الناتج عند المهبط؟',
    promptEn: 'In the electrolysis of molten sodium chloride, what is produced at the cathode?',
  },
  {
    id: 'ch-rx-m5', family: 'redox', diff: 'medium', eq: 'التحليل الكهربائي لمصهور NaCl: المصعد',
    answer: 'غاز الكلور Cl₂', wrongs: ['فلز الصوديوم Na', 'غاز الهيدروجين H₂', 'غاز الأكسجين O₂'],
    promptAr: 'عند التحليل الكهربائي لمصهور كلوريد الصوديوم، ما الناتج عند المصعد؟',
    promptEn: 'In the electrolysis of molten sodium chloride, what is produced at the anode?',
  },
  {
    id: 'ch-rx-m6', family: 'redox', diff: 'medium', eq: 'الطلاء الكهربائي',
    answer: 'المهبط (القطب السالب)', wrongs: ['المصعد (القطب الموجب)', 'القنطرة الملحية', 'لا يتصل بأي قطب'],
    promptAr: 'في الطلاء الكهربائي، بأيّ قطب يُوصل الجسم المراد طلاؤه؟',
    promptEn: 'In electroplating, which electrode is the object to be plated connected to?',
  },
  {
    id: 'ch-rx-h2', family: 'redox', diff: 'hard', eq: '2Na + Cl₂ → 2NaCl',
    answer: 'Na عامل مختزل لأنه يفقد إلكترونًا', wrongs: ['Cl₂ عامل مختزل لأنه يكتسب إلكترونات', 'Na عامل مؤكسد لأنه يفقد إلكترونًا', 'NaCl عامل مختزل'],
    promptAr: 'في التفاعل 2Na + Cl₂ → 2NaCl، حدّد العامل المختزل مع التعليل.',
    promptEn: 'In 2Na + Cl₂ → 2NaCl, identify the reducing agent and explain.',
  },
  {
    id: 'ch-rx-h3', family: 'redox', diff: 'hard', eq: 'استخلاص الصوديوم',
    answer: 'لأنه فلز شديد النشاط ولا يمكن اختزال أيوناته بسهولة بمواد كيميائية عادية', wrongs: ['لأنه فلز خامل يحتاج إلى طاقة قليلة', 'لأن مصهور مركباته لا يوصل الكهرباء', 'لأن الصوديوم يوجد حرًا في الطبيعة'],
    promptAr: 'لماذا يُستخلص الصوديوم بالتحليل الكهربائي لمصهور مركباته؟',
    promptEn: 'Why is sodium extracted by electrolysis of its molten compounds?',
  },
  {
    id: 'ch-rx-h4', family: 'redox', diff: 'hard', eq: 'خلية Zn | Cu',
    answer: 'من قطب الزنك (المصعد) إلى قطب النحاس (المهبط)', wrongs: ['من قطب النحاس إلى قطب الزنك', 'عبر القنطرة الملحية من الزنك إلى النحاس', 'لا تسري إلكترونات في السلك'],
    promptAr: 'في خلية جلفانية قطباها الزنك والنحاس، في أيّ اتجاه تسري الإلكترونات في السلك الخارجي؟',
    promptEn: 'In a galvanic cell with zinc and copper electrodes, in which direction do electrons flow in the external wire?',
  },
  // ── عام (تتمة) ──
  {
    id: 'ch-gn-e3', family: 'general_chem', diff: 'easy', eq: 'حالات المادة',
    answer: 'صلبة وسائلة وغازية', wrongs: ['صلبة وسائلة وفلزية', 'فلزية ولافلزية وشبه فلزية', 'حمضية وقاعدية ومتعادلة'],
    promptAr: 'ما حالات المادة الثلاث الشائعة؟',
    promptEn: 'What are the three common states of matter?',
  },
  {
    id: 'ch-gn-e4', family: 'general_chem', diff: 'easy', eq: 'أمثلة',
    answer: 'ذوبان الجليد', wrongs: ['احتراق الورق', 'صدأ الحديد', 'تعفن الطعام'],
    promptAr: 'أيّ التغيرات الآتية تغير فيزيائي؟',
    promptEn: 'Which of these changes is a physical change?',
  },
  {
    id: 'ch-gn-e5', family: 'general_chem', diff: 'easy', eq: 'الصوديوم',
    answer: 'Na', wrongs: ['So', 'N', 'Sd'],
    promptAr: 'ما رمز عنصر الصوديوم؟',
    promptEn: 'What is the symbol of the element sodium?',
  },
  {
    id: 'ch-gn-m3', family: 'general_chem', diff: 'medium', eq: 'المخلوطات',
    answer: 'محلول ملح الطعام في الماء', wrongs: ['زيت وماء', 'رمل وماء', 'سلطة خضار'],
    promptAr: 'أيّ المخاليط الآتية مخلوط متجانس؟',
    promptEn: 'Which of these mixtures is homogeneous?',
  },
  {
    id: 'ch-gn-m4', family: 'general_chem', diff: 'medium', eq: 'فصل الملح عن الماء',
    answer: 'التبخير', wrongs: ['الترشيح', 'الفصل بالمغناطيس', 'فصل الطبقات بالقمع'],
    promptAr: 'ما أنسب طريقة لاستعادة الملح الصلب من محلول ملح الطعام في الماء؟',
    promptEn: 'What is the best way to recover solid salt from a solution of salt in water?',
  },
  {
    id: 'ch-gn-m5', family: 'general_chem', diff: 'medium', eq: '5 g ملح + 95 g ماء',
    answer: '5%', wrongs: ['5.3%', '95%', '10%'],
    promptAr: 'أُذيب 5 g من الملح في 95 g من الماء. ما التركيز الكتلي للمحلول؟',
    promptEn: '5 g of salt is dissolved in 95 g of water. What is the mass percentage concentration of the solution?',
  },
  {
    id: 'ch-gn-m6', family: 'general_chem', diff: 'medium', eq: 'الذرة والجزيء',
    answer: 'الجزيء ذرتان أو أكثر مرتبطة معًا، والذرة أصغر وحدة بناء للعنصر', wrongs: ['الذرة أكبر من الجزيء دائمًا', 'لا فرق بينهما', 'الجزيء يتكون من ذرة واحدة فقط'],
    promptAr: 'ما الفرق بين الذرة والجزيء؟',
    promptEn: 'What is the difference between an atom and a molecule?',
  },
  {
    id: 'ch-gn-h2', family: 'general_chem', diff: 'hard', eq: '12 g Mg + 8 g O₂',
    answer: '20 g', wrongs: ['12 g', '8 g', '4 g'],
    promptAr: 'احترق 12 g من المغنيسيوم تمامًا مع 8 g من الأكسجين. ما كتلة أكسيد المغنيسيوم الناتجة؟',
    promptEn: '12 g of magnesium burns completely with 8 g of oxygen. What is the mass of magnesium oxide formed?',
  },
  {
    id: 'ch-gn-h3', family: 'general_chem', diff: 'hard', eq: 'الكثافة',
    answer: '2 g/cm³', wrongs: ['0.5 g/cm³', '25 g/cm³', '75 g/cm³'],
    promptAr: 'كتلة قطعة من مادة 50 g وحجمها 25 cm³. ما كثافتها؟',
    promptEn: 'A piece of material has mass 50 g and volume 25 cm³. What is its density?',
  },
  {
    id: 'ch-gn-h4', family: 'general_chem', diff: 'hard', eq: 'محلول 200 g بتركيز 10%',
    answer: '20 g', wrongs: ['10 g', '2 g', '180 g'],
    promptAr: 'كم غرامًا من الملح في 200 g من محلول ملحي تركيزه الكتلي 10%؟',
    promptEn: 'How many grams of salt are in 200 g of a salt solution of mass concentration 10%?',
  },
];
