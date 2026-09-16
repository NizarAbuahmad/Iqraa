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
 * Subject names that are chemistry — `Subject.name`/`.nameAr` from
 * `lib/curriculum/src/catalog.ts`. Matched rather than imported, for the same
 * reason `KNOWN_NON_MATH_SUBJECT` is: one lookup does not justify a dependency
 * on the whole curriculum package.
 */
const CHEM_SUBJECT = /^(chemistry|الكيمياء)$/i;

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
 * because a chemical equation is also a معادلة.
 */
export function isChemContext(
  topic: string,
  kb: KBLesson | null,
  subject?: string,
  lessonSubjectId?: string,
  textBlob?: string,
): boolean {
  if (lessonSubjectId) return lessonSubjectId === 'chemistry';

  const s = subject?.trim();
  if (s) return CHEM_SUBJECT.test(s);

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
  if (/(ال)?حسابات (ال)?كيميائية|المردود|الكاشف المحدد|stoichiometr|limiting reagent|mole ratio|نسب مولية/i.test(blob)) return 'stoichiometry';
  if (/المول|الكتلة المولية|أفوجادرو|molar mass|avogadro|\bmole\b/i.test(blob)) return 'mole';
  if (/طاقة.*تفاعل|تفاعل.*طاقة|ماص للطاقة|طارد للطاقة|المحتوى الحراري|إنثالبي|enthalpy|exotherm|endotherm|heat of reaction/i.test(blob)) return 'thermochem';
  if (/معادلة كيميائية|وزن المعادل|موازنة|التفاعلات الكيميائية|chemical equation|balanc|reaction type/i.test(blob)) return 'equations';

  // Grade 10 S1
  if (/الصيغ الكيميائية|الصيغة الكيميائية|تسمية المركب|chemical formula|nomenclature/i.test(blob)) return 'formulas';
  if (/رابطة|روابط|تساهمي|أيونية|فلزية|bond|covalent|ionic|metallic/i.test(blob)) return 'bonding';
  if (/الخصائص الدورية|نصف القطر|طاقة التأين|الكهروسالبية|periodic (trend|propert)|atomic radius|ionization|electronegativ/i.test(blob)) return 'periodic_trends';
  if (/التوزيع الإلكتروني|المستويات الفرعية|أوربيتال|electron config|orbital|subshell/i.test(blob)) return 'electron_config';
  if (/نظرية بور|الطيف الذري|الميكانيكي الموجي|الكم|bohr|spectrum|quantum|wave mechanical/i.test(blob)) return 'atomic_structure';

  // Grade 9
  if (/تأكسد|اختزال|جلفاني|التحليل الكهربائي|خلية|redox|oxidation|reduction|galvanic|electroly/i.test(blob)) return 'redox';
  if (/نشاط الفلزات|سلسلة النشاط|تآكل|صدأ|activity series|corrosion|rust/i.test(blob)) return 'metal_activity';
  if (/حمض|حموض|قاعدة|قواعد|أملاح|تعادل|قلوي|acid|base|alkali|neutralis|neutraliz|\bpH\b/i.test(blob)) return 'acids_bases';
  if (/مكونات الذرة|العدد الذري|العدد الكتلي|نظائر|بروتون|نيوترون|atomic number|mass number|isotope|proton|neutron/i.test(blob)) return 'atom_basics';

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
];
