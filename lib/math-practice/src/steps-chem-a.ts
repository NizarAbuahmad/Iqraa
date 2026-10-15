import type { SolutionSteps } from './steps-types.ts';

export const CHEM_A_STEPS: Record<string, SolutionSteps> = {
  // ── atom_basics ──
  'ch-ab-e1': {
    ar: [
      'عدد البروتونات = العدد الذري Z = 11',
      'عدد النيوترونات = العدد الكتلي − العدد الذري',
      'n = A − Z = 23 − 11 = 12',
      'إذن في الذرة 11 بروتونًا و12 نيوترونًا',
    ],
    en: [
      'Number of protons = atomic number Z = 11',
      'Number of neutrons = mass number − atomic number',
      'n = A − Z = 23 − 11 = 12',
      'So the atom has 11 protons and 12 neutrons',
    ],
  },
  'ch-ab-e2': {
    ar: [
      'عدد النيوترونات = العدد الكتلي − العدد الذري',
      'n = A − Z',
      'n = 35 − 17 = 18',
      'إذن عدد النيوترونات = 18 نيوترونًا',
    ],
    en: [
      'Number of neutrons = mass number − atomic number',
      'n = A − Z',
      'n = 35 − 17 = 18',
      'So the number of neutrons = 18 neutrons',
    ],
  },
  'ch-ab-m1': {
    ar: [
      'عدد البروتونات = العدد الذري = 8، ولا يتغير عند تكوّن الأيون',
      'في الذرة المتعادلة: عدد الإلكترونات = عدد البروتونات = 8',
      'الشحنة 2− تعني أن الأيون اكتسب إلكترونين زيادة على الذرة المتعادلة',
      'عدد الإلكترونات = 8 + 2 = 10',
      'إذن في الأيون O²⁻ 8 بروتونات و10 إلكترونات',
    ],
    en: [
      'Number of protons = atomic number = 8, and it does not change when the ion forms',
      'In the neutral atom: number of electrons = number of protons = 8',
      'The charge 2− means the ion gained two electrons on top of the neutral atom',
      'Number of electrons = 8 + 2 = 10',
      'So the ion O²⁻ has 8 protons and 10 electrons',
    ],
  },
  'ch-ab-m2': {
    ar: [
      'النظائر ذرات للعنصر نفسه، فلها العدد الذري نفسه (Z = 6 للكربون)',
      'العددان الكتليان 12 و14 مختلفان',
      'عدد النيوترونات: 12 − 6 = 6 في ¹²C، و14 − 6 = 8 في ¹⁴C',
      'إذن النظيران لهما العدد الذري نفسه والعدد الكتلي مختلف',
    ],
    en: [
      'Isotopes are atoms of the same element, so they have the same atomic number (Z = 6 for carbon)',
      'The mass numbers 12 and 14 are different',
      'Number of neutrons: 12 − 6 = 6 in ¹²C, and 14 − 6 = 8 in ¹⁴C',
      'So the two isotopes have the same atomic number and a different mass number',
    ],
  },
  'ch-ab-h1': {
    ar: [
      'العدد الذري Z = عدد البروتونات = 20',
      'العدد الكتلي A = عدد البروتونات + عدد النيوترونات',
      'A = 20 + 20 = 40',
      'إذن العدد الذري 20 والعدد الكتلي 40',
    ],
    en: [
      'Atomic number Z = number of protons = 20',
      'Mass number A = number of protons + number of neutrons',
      'A = 20 + 20 = 40',
      'So the atomic number is 20 and the mass number is 40',
    ],
  },

  // ── atomic_structure ──
  'ch-as-e1': {
    ar: [
      'الانتقال من n = 1 إلى n = 3 هو انتقال إلى مستوى طاقة أعلى',
      'طاقة المستوى تزداد بزيادة n، فيلزم أن يكتسب الإلكترون فرق الطاقة بين المستويين',
      'إذن الإلكترون يمتص طاقة',
    ],
    en: [
      'Moving from n = 1 to n = 3 is a transition to a higher energy level',
      'Level energy rises as n rises, so the electron must gain the energy difference between the two levels',
      'So the electron absorbs energy',
    ],
  },
  'ch-as-e2': {
    ar: [
      'الحد الأقصى للإلكترونات في المستوى = 2n²',
      'المستوى الثالث: n = 3',
      '2n² = 2 × 3² = 2 × 9 = 18',
      'إذن يتسع المستوى الثالث لـ 18 إلكترونًا',
    ],
    en: [
      'Maximum number of electrons in a level = 2n²',
      'Third level: n = 3',
      '2n² = 2 × 3² = 2 × 9 = 18',
      'So the third level holds 18 electrons',
    ],
  },
  'ch-as-m1': {
    ar: [
      'العلاقة: E = −13.6/n² eV',
      'n = 2، إذن n² = 4',
      'E = −13.6/4 = −3.4 eV',
      'إذن طاقة المستوى n = 2 تساوي −3.4 eV',
    ],
    en: [
      'The relation: E = −13.6/n² eV',
      'n = 2, so n² = 4',
      'E = −13.6/4 = −3.4 eV',
      'So the energy of level n = 2 is −3.4 eV',
    ],
  },
  'ch-as-m2': {
    ar: [
      'الطيف المتصل يعني أن الذرة تُصدر كل الطاقات الممكنة، أما الطيف الخطي فلا',
      'كل خط يقابل انتقال إلكترون بين مستويين، وفرق الطاقة بينهما قيمة محددة',
      'ظهور خطوط محددة فقط يعني أن الطاقات المسموح بها محددة وليست متصلة',
      'إذن الطيف الخطي يدل على أن طاقة الإلكترون مكمّاة في مستويات محددة',
    ],
    en: [
      'A continuous spectrum would mean the atom emits every possible energy, but a line spectrum does not',
      'Each line matches an electron transition between two levels, with a definite energy difference',
      'Only certain lines appearing means the allowed energies are fixed, not continuous',
      'So the line spectrum shows that the electron energy is quantised in definite levels',
    ],
  },
  'ch-as-h1': {
    ar: [
      'كل أوربيتال يتسع لإلكترونين كحد أقصى',
      'المستوى الفرعي p فيه 3 أوربيتالات (px، py، pz)',
      'السعة = 3 × 2 = 6 إلكترونات',
      'إذن في المستوى الفرعي p 3 أوربيتالات تتسع لـ6 إلكترونات',
    ],
    en: [
      'Each orbital holds at most two electrons',
      'A p subshell contains 3 orbitals (px, py, pz)',
      'Capacity = 3 × 2 = 6 electrons',
      'So a p subshell has 3 orbitals that hold 6 electrons',
    ],
  },

  // ── electron_config ──
  'ch-ec-e1': {
    ar: [
      'عدد الإلكترونات في الذرة المتعادلة = Z = 12',
      'نملأ المستويات الفرعية بترتيب الطاقة: 1s ثم 2s ثم 2p ثم 3s',
      'السعات 2 و2 و6 تستوعب 2 + 2 + 6 = 10 إلكترونات',
      'يبقى 12 − 10 = 2 إلكترون يدخلان 3s',
      'إذن التوزيع الإلكتروني للمغنيسيوم: 1s² 2s² 2p⁶ 3s²',
    ],
    en: [
      'Number of electrons in the neutral atom = Z = 12',
      'Fill the subshells in order of energy: 1s, then 2s, then 2p, then 3s',
      'The capacities 2, 2 and 6 take 2 + 2 + 6 = 10 electrons',
      'That leaves 12 − 10 = 2 electrons, which go into 3s',
      'So the electron configuration of magnesium is 1s² 2s² 2p⁶ 3s²',
    ],
  },
  'ch-ec-e2': {
    ar: [
      'عدد الإلكترونات في الذرة المتعادلة = Z = 17',
      'نملأ بترتيب الطاقة: 1s ثم 2s ثم 2p ثم 3s ثم 3p',
      '1s² 2s² 2p⁶ 3s² تستوعب 2 + 2 + 6 + 2 = 12 إلكترونًا',
      'يبقى 17 − 12 = 5 إلكترونات تدخل 3p',
      'إذن التوزيع الإلكتروني للكلور: 1s² 2s² 2p⁶ 3s² 3p⁵',
    ],
    en: [
      'Number of electrons in the neutral atom = Z = 17',
      'Fill in order of energy: 1s, then 2s, then 2p, then 3s, then 3p',
      '1s² 2s² 2p⁶ 3s² takes 2 + 2 + 6 + 2 = 12 electrons',
      'That leaves 17 − 12 = 5 electrons, which go into 3p',
      'So the electron configuration of chlorine is 1s² 2s² 2p⁶ 3s² 3p⁵',
    ],
  },
  'ch-ec-m1': {
    ar: [
      'التوزيع الإلكتروني للفوسفور (Z = 15): 1s² 2s² 2p⁶ 3s² 3p³',
      'إلكترونات التكافؤ هي إلكترونات مستوى الطاقة الخارجي، وهو هنا n = 3',
      'عددها = 2 (في 3s) + 3 (في 3p) = 5',
      'إذن في ذرة الفوسفور 5 إلكترونات تكافؤ',
    ],
    en: [
      'Electron configuration of phosphorus (Z = 15): 1s² 2s² 2p⁶ 3s² 3p³',
      'Valence electrons are those in the outermost energy level, here n = 3',
      'Their number = 2 (in 3s) + 3 (in 3p) = 5',
      'So a phosphorus atom has 5 valence electrons',
    ],
  },
  'ch-ec-m2': {
    ar: [
      'عدد الإلكترونات في الذرة المتعادلة = Z = 20',
      'ترتيب الملء: 1s 2s 2p 3s 3p 4s 3d، إذ يمتلئ 4s قبل 3d لأن طاقته أقل',
      '1s² 2s² 2p⁶ 3s² 3p⁶ تستوعب 2 + 2 + 6 + 2 + 6 = 18 إلكترونًا',
      'يبقى 20 − 18 = 2 إلكترون يدخلان 4s',
      'إذن التوزيع الإلكتروني للكالسيوم: 1s² 2s² 2p⁶ 3s² 3p⁶ 4s²',
    ],
    en: [
      'Number of electrons in the neutral atom = Z = 20',
      'Filling order: 1s 2s 2p 3s 3p 4s 3d, since 4s fills before 3d because its energy is lower',
      '1s² 2s² 2p⁶ 3s² 3p⁶ takes 2 + 2 + 6 + 2 + 6 = 18 electrons',
      'That leaves 20 − 18 = 2 electrons, which go into 4s',
      'So the electron configuration of calcium is 1s² 2s² 2p⁶ 3s² 3p⁶ 4s²',
    ],
  },
  'ch-ec-h1': {
    ar: [
      'توزيع ذرة الحديد (Z = 26): 1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d⁶',
      'عند تكوّن الأيون الموجب تُفقد الإلكترونات من مستوى الطاقة الخارجي، وهو n = 4',
      'إلكترونا 4s هما الأبعد عن النواة، فيُفقدان قبل إلكترونات 3d',
      'توزيع Fe²⁺: 1s² 2s² 2p⁶ 3s² 3p⁶ 3d⁶ (24 إلكترونًا)',
      'إذن يفقد إلكتروني 4s أولًا',
    ],
    en: [
      'Electron configuration of the iron atom (Z = 26): 1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d⁶',
      'When a positive ion forms, electrons are lost from the outermost energy level, which is n = 4',
      'The two 4s electrons are the farthest from the nucleus, so they are lost before the 3d electrons',
      'Configuration of Fe²⁺: 1s² 2s² 2p⁶ 3s² 3p⁶ 3d⁶ (24 electrons)',
      'So it loses the two 4s electrons first',
    ],
  },

  // ── periodic_trends ──
  'ch-pt-e1': {
    ar: [
      'العناصر كلها في الدورة الثالثة، والعدد الذري يزداد من Na (11) إلى Si (14)',
      'عبر الدورة تزداد شحنة النواة والإلكترونات الخارجية في المستوى نفسه، فيزداد الجذب ويقل نصف القطر',
      'أكبر نصف قطر لأقل عدد ذري في الدورة',
      'إذن العنصر الأكبر نصف قطر ذري هو Na',
    ],
    en: [
      'All the elements are in period 3, and the atomic number rises from Na (11) to Si (14)',
      'Across a period the nuclear charge rises while the outer electrons stay in the same level, so the pull grows and the radius shrinks',
      'The largest radius belongs to the lowest atomic number in the period',
      'So the element with the largest atomic radius is Na',
    ],
  },
  'ch-pt-e2': {
    ar: [
      'عبر الدورة من اليسار إلى اليمين يزداد العدد الذري، فتزداد شحنة النواة الموجبة',
      'تُضاف الإلكترونات إلى مستوى الطاقة الخارجي نفسه، فلا يزداد عدد المستويات',
      'يزداد جذب النواة للإلكترونات الخارجية فتنكمش الذرة',
      'إذن من اليسار إلى اليمين يقل نصف القطر الذري',
    ],
    en: [
      'Across a period from left to right the atomic number rises, so the positive nuclear charge rises',
      'Electrons are added to the same outer energy level, so the number of levels does not increase',
      'The nucleus pulls the outer electrons more strongly, so the atom contracts',
      'So from left to right the atomic radius decreases',
    ],
  },
  'ch-pt-m1': {
    ar: [
      'Na وMg في الدورة الثالثة: Na (Z = 11) وMg (Z = 12)',
      'طاقة التأين الأولى هي الطاقة اللازمة لنزع أبعد إلكترون عن الذرة الغازية',
      'شحنة نواة Mg أكبر ونصف قطره أصغر من Na، فالإلكترون الخارجي أشد ارتباطًا بالنواة',
      'إذن طاقة التأين الأولى الأكبر لـ Mg، لأن شحنة نواته أكبر ونصف قطره أصغر',
    ],
    en: [
      'Na and Mg are in period 3: Na (Z = 11) and Mg (Z = 12)',
      'First ionization energy is the energy needed to remove the outermost electron from a gaseous atom',
      'Mg has a larger nuclear charge and a smaller radius than Na, so its outer electron is held more tightly',
      'So the higher first ionization energy belongs to Mg, because its nuclear charge is larger and its radius is smaller',
    ],
  },
  'ch-pt-m2': {
    ar: [
      'الكهروسالبية هي قدرة الذرة على جذب إلكترونات الرابطة',
      'تزداد عبر الدورة نحو اليمين وتقل في المجموعة نحو الأسفل',
      'F في أعلى المجموعة 17، فهو أصغر نصف قطر وأقوى جذب لإلكترونات الرابطة',
      'إذن العنصر الأعلى كهروسالبية هو الفلور F',
    ],
    en: [
      'Electronegativity is an atom\'s ability to attract bonding electrons',
      'It rises across a period toward the right and falls down a group',
      'F is at the top of group 17, so it has a small radius and the strongest pull on bonding electrons',
      'So the element with the highest electronegativity is fluorine, F',
    ],
  },
  'ch-pt-h1': {
    ar: [
      'Na: 1s² 2s² 2p⁶ 3s¹ (11 إلكترونًا)، وNa⁺: 1s² 2s² 2p⁶ (10 إلكترونات)',
      'عند تكوّن Na⁺ تفقد الذرة إلكترون 3s الوحيد، فيزول مستوى الطاقة الخارجي n = 3',
      'تبقى شحنة النواة +11 لكنها تجذب 10 إلكترونات فقط، فيزداد جذب كل إلكترون',
      'إذن Na⁺ أصغر، لفقده مستوى الطاقة الخارجي',
    ],
    en: [
      'Na: 1s² 2s² 2p⁶ 3s¹ (11 electrons), and Na⁺: 1s² 2s² 2p⁶ (10 electrons)',
      'When Na⁺ forms, the atom loses its only 3s electron, so the outer energy level n = 3 disappears',
      'The nuclear charge stays +11 but now pulls only 10 electrons, so the pull on each electron grows',
      'So Na⁺ is smaller, because it lost the outer energy level',
    ],
  },

  // ── bonding ──
  'ch-bd-e1': {
    ar: [
      'Na فلز (المجموعة 1) وCl لافلز (المجموعة 17)',
      'Na يفقد إلكترونًا فيصبح Na⁺، وCl يكتسبه فيصبح Cl⁻',
      'التجاذب الكهروستاتيكي بين الأيونين المختلفين في الشحنة يكوّن الرابطة',
      'إذن الرابطة في NaCl رابطة أيونية',
    ],
    en: [
      'Na is a metal (group 1) and Cl is a non-metal (group 17)',
      'Na loses an electron to become Na⁺, and Cl gains it to become Cl⁻',
      'The electrostatic attraction between the oppositely charged ions forms the bond',
      'So the bond in NaCl is an ionic bond',
    ],
  },
  'ch-bd-e2': {
    ar: [
      'ذرتا الكلور متماثلتان، فالفرق في الكهروسالبية بينهما = 0',
      'لا تستطيع إحداهما انتزاع إلكترون من الأخرى، فتتشاركان زوجًا إلكترونيًا لتكمل كل منهما الثمانية',
      'الزوج المشترك موزع بالتساوي بين الذرتين، فلا يوجد قطب موجب أو سالب',
      'إذن الرابطة في Cl₂ رابطة تساهمية نقية',
    ],
    en: [
      'The two chlorine atoms are identical, so the electronegativity difference between them = 0',
      'Neither can pull an electron away from the other, so they share an electron pair and each completes its octet',
      'The shared pair is split equally between the atoms, so there is no positive or negative pole',
      'So the bond in Cl₂ is a pure covalent bond',
    ],
  },
  'ch-bd-m1': {
    ar: [
      'O وH كلاهما لافلز، فيتشاركان الإلكترونات (رابطة تساهمية لا أيونية)',
      'O أعلى كهروسالبية من H، فينجذب الزوج المشترك نحو O',
      'توزيع الشحنة غير متساوٍ: O جزئيًا سالب وH جزئيًا موجب، فالرابطة قطبية',
      'إذن الرابطة تساهمية قطبية، لاختلاف الكهروسالبية بين O وH',
    ],
    en: [
      'O and H are both non-metals, so they share electrons (a covalent bond, not ionic)',
      'O is more electronegative than H, so the shared pair is drawn toward O',
      'The charge is unevenly shared: O is partly negative and H is partly positive, so the bond is polar',
      'So the bond is polar covalent, because of the electronegativity difference between O and H',
    ],
  },
  'ch-bd-m2': {
    ar: [
      'الفلز طاقة تأينه منخفضة وكهروسالبيته قليلة، فيميل إلى فقد إلكترونات التكافؤ',
      'اللافلز كهروسالبيته عالية، فيميل إلى اكتساب إلكترونات ليكمل مستواه الخارجي',
      'الإلكترون الذي يفقده الفلز يكتسبه اللافلز، فيتكوّن أيون موجب وأيون سالب',
      'إذن ينتقل الإلكترون من الفلز إلى اللافلز فتتكوّن أيونات',
    ],
    en: [
      'A metal has low ionization energy and low electronegativity, so it tends to lose its valence electrons',
      'A non-metal has high electronegativity, so it tends to gain electrons to complete its outer level',
      'The electron the metal loses is gained by the non-metal, giving a positive ion and a negative ion',
      'So the electron moves from the metal to the non-metal and ions form',
    ],
  },
  'ch-bd-h1': {
    ar: [
      'NaCl فلز مع لافلز: ينتقل إلكترون فتتكوّن أيونات Na⁺ وCl⁻ يربطها تجاذب كهروستاتيكي قوي',
      'HCl لافلزان يتشاركان زوجًا إلكترونيًا، وCl أعلى كهروسالبية من H، فالرابطة تساهمية قطبية',
      'المركب الأيوني بلورة تحتاج طاقة كبيرة لتفكيك تجاذب أيوناتها، فدرجة انصهاره عالية؛ أما HCl فجزيئاته منفصلة وقوى التجاذب بينها ضعيفة',
      'إذن NaCl أيوني بدرجة انصهار عالية وHCl تساهمي قطبي',
    ],
    en: [
      'NaCl is a metal with a non-metal: an electron transfers, forming Na⁺ and Cl⁻ ions held by a strong electrostatic attraction',
      'HCl is two non-metals sharing an electron pair, and Cl is more electronegative than H, so the bond is polar covalent',
      'An ionic compound is a crystal needing a lot of energy to break the attraction between its ions, so its melting point is high; HCl has separate molecules with weak attractions between them',
      'So NaCl is ionic with a high melting point, and HCl is polar covalent',
    ],
  },

  // ── formulas ──
  'ch-fm-e1': {
    ar: [
      'شحنة Ca²⁺ هي +2، وشحنة Cl⁻ هي −1',
      'المركب متعادل: مجموع الشحنات الموجبة = مجموع الشحنات السالبة',
      '1 × (+2) + n × (−1) = 0، إذن n = 2',
      'إذن الصيغة الكيميائية CaCl₂',
    ],
    en: [
      'The charge of Ca²⁺ is +2, and the charge of Cl⁻ is −1',
      'The compound is neutral: total positive charge = total negative charge',
      '1 × (+2) + n × (−1) = 0, so n = 2',
      'So the chemical formula is CaCl₂',
    ],
  },
  'ch-fm-e2': {
    ar: [
      'المركب أيوني من Na⁺ ومن أيون متعدد الذرات هو SO₄²⁻',
      'SO₄²⁻ (4 ذرات أكسجين) أيون الكبريتات، أما S²⁻ فكبريتيد وSO₃²⁻ فكبريتيت',
      'نسمّي الأنيون أولًا ثم الكاتيون: كبريتات + الصوديوم',
      'إذن اسم المركب Na₂SO₄ هو كبريتات الصوديوم',
    ],
    en: [
      'The compound is ionic: Na⁺ with the polyatomic ion SO₄²⁻',
      'SO₄²⁻ (4 oxygen atoms) is the sulfate ion, whereas S²⁻ is sulfide and SO₃²⁻ is sulfite',
      'Name the anion first, then the cation: sulfate + sodium',
      'So the compound Na₂SO₄ is named sodium sulfate',
    ],
  },
  'ch-fm-m1': {
    ar: [
      'شحنة Al³⁺ هي +3، وشحنة O²⁻ هي −2',
      'نجعل مجموع الشحنات صفرًا: المضاعف المشترك الأصغر للعددين 3 و2 هو 6',
      'عدد Al = 6 ÷ 3 = 2، وعدد O = 6 ÷ 2 = 3',
      'تحقق: 2 × (+3) + 3 × (−2) = 0',
      'إذن الصيغة الكيميائية Al₂O₃',
    ],
    en: [
      'The charge of Al³⁺ is +3, and the charge of O²⁻ is −2',
      'Make the total charge zero: the lowest common multiple of 3 and 2 is 6',
      'Number of Al = 6 ÷ 3 = 2, and number of O = 6 ÷ 2 = 3',
      'Check: 2 × (+3) + 3 × (−2) = 0',
      'So the chemical formula is Al₂O₃',
    ],
  },
  'ch-fm-m2': {
    ar: [
      'شحنة Mg²⁺ هي +2، وشحنة N³⁻ هي −3',
      'نجعل مجموع الشحنات صفرًا: المضاعف المشترك الأصغر للعددين 2 و3 هو 6',
      'عدد Mg = 6 ÷ 2 = 3، وعدد N = 6 ÷ 3 = 2',
      'تحقق: 3 × (+2) + 2 × (−3) = 0',
      'إذن الصيغة الكيميائية Mg₃N₂',
    ],
    en: [
      'The charge of Mg²⁺ is +2, and the charge of N³⁻ is −3',
      'Make the total charge zero: the lowest common multiple of 2 and 3 is 6',
      'Number of Mg = 6 ÷ 2 = 3, and number of N = 6 ÷ 3 = 2',
      'Check: 3 × (+2) + 2 × (−3) = 0',
      'So the chemical formula is Mg₃N₂',
    ],
  },
  'ch-fm-h1': {
    ar: [
      'في Ca(NO₃)₂ الرقم 2 خارج القوس يضاعف كل ما داخله، أي مجموعة NO₃ مرتين',
      'Ca بلا رقم، فعدده ذرة واحدة',
      'عدد N = 1 × 2 = 2، وعدد O = 3 × 2 = 6',
      'إذن في وحدة الصيغة ذرة كالسيوم وذرتا نيتروجين وست ذرات أكسجين',
    ],
    en: [
      'In Ca(NO₃)₂ the 2 outside the bracket multiplies everything inside, so the NO₃ group appears twice',
      'Ca has no subscript, so there is one atom',
      'Number of N = 1 × 2 = 2, and number of O = 3 × 2 = 6',
      'So one formula unit has one calcium atom, two nitrogen atoms and six oxygen atoms',
    ],
  },

  // ── equations ──
  'ch-eq-e1': {
    ar: [
      'نعدّ الذرات: يسار H = 2 وO = 2، يمين H = 2 وO = 1',
      'O غير متزن: نضع المعامل 2 أمام H₂O فيصبح O = 2 وH = 4 على اليمين',
      'H صار 4 على اليمين: نضع المعامل 2 أمام H₂ فيصبح H = 4 على اليسار',
      'تحقق: 4 H و2 O على كل جهة',
      'إذن المعادلة الموزونة: 2H₂ + O₂ → 2H₂O',
    ],
    en: [
      'Count the atoms: left H = 2 and O = 2, right H = 2 and O = 1',
      'O is unbalanced: put the coefficient 2 before H₂O, so the right side has O = 2 and H = 4',
      'H is now 4 on the right: put the coefficient 2 before H₂, so the left side has H = 4',
      'Check: 4 H and 2 O on each side',
      'So the balanced equation is 2H₂ + O₂ → 2H₂O',
    ],
  },
  'ch-eq-e2': {
    ar: [
      'C متزن: ذرة واحدة على كل جهة',
      'H: 4 على اليسار و2 على اليمين، فنضع المعامل 2 أمام H₂O',
      'O على اليمين: 2 (من CO₂) + 2 (من 2H₂O) = 4، فنضع المعامل 2 أمام O₂',
      'تحقق: C = 1 وH = 4 وO = 4 على كل جهة',
      'إذن المعادلة الموزونة: CH₄ + 2O₂ → CO₂ + 2H₂O',
    ],
    en: [
      'C is balanced: one atom on each side',
      'H: 4 on the left and 2 on the right, so put the coefficient 2 before H₂O',
      'O on the right: 2 (from CO₂) + 2 (from 2H₂O) = 4, so put the coefficient 2 before O₂',
      'Check: C = 1, H = 4 and O = 4 on each side',
      'So the balanced equation is CH₄ + 2O₂ → CO₂ + 2H₂O',
    ],
  },
  'ch-eq-m1': {
    ar: [
      'نعدّ الذرات: يسار N = 2 وH = 2، يمين N = 1 وH = 3',
      'N: نضع المعامل 2 أمام NH₃ فيصبح N = 2 وH = 6 على اليمين',
      'H: يلزم 6 على اليسار، فنضع المعامل 3 أمام H₂ (3 × 2 = 6)',
      'تحقق: N = 2 وH = 6 على كل جهة',
      'إذن المعادلة الموزونة: N₂ + 3H₂ → 2NH₃',
    ],
    en: [
      'Count the atoms: left N = 2 and H = 2, right N = 1 and H = 3',
      'N: put the coefficient 2 before NH₃, so the right side has N = 2 and H = 6',
      'H: 6 are needed on the left, so put the coefficient 3 before H₂ (3 × 2 = 6)',
      'Check: N = 2 and H = 6 on each side',
      'So the balanced equation is N₂ + 3H₂ → 2NH₃',
    ],
  },
  'ch-eq-m2': {
    ar: [
      'المادة المتفاعلة واحدة فقط: CaCO₃',
      'الناتج مادتان أبسط: CaO وCO₂',
      'التفاعل الذي تنتج فيه مادتان أو أكثر من مادة واحدة هو تحلل (عكس الاتحاد)',
      'إذن التفاعل CaCO₃ → CaO + CO₂ هو تفاعل تحلل',
    ],
    en: [
      'There is only one reactant: CaCO₃',
      'The products are two simpler substances: CaO and CO₂',
      'A reaction in which two or more substances form from a single substance is decomposition (the opposite of combination)',
      'So the reaction CaCO₃ → CaO + CO₂ is a decomposition reaction',
    ],
  },
  'ch-eq-h1': {
    ar: [
      'O: 2 على اليسار و3 على اليمين، والمضاعف المشترك الأصغر للعددين 2 و3 هو 6',
      'نضع المعامل 3 أمام O₂ (6 ذرات) والمعامل 2 أمام Fe₂O₃ (6 ذرات)',
      'Fe على اليمين: 2 × 2 = 4، فنضع المعامل 4 أمام Fe',
      'تحقق: Fe = 4 وO = 6 على كل جهة',
      'إذن المعادلة الموزونة: 4Fe + 3O₂ → 2Fe₂O₃',
    ],
    en: [
      'O: 2 on the left and 3 on the right, and the lowest common multiple of 2 and 3 is 6',
      'Put the coefficient 3 before O₂ (6 atoms) and the coefficient 2 before Fe₂O₃ (6 atoms)',
      'Fe on the right: 2 × 2 = 4, so put the coefficient 4 before Fe',
      'Check: Fe = 4 and O = 6 on each side',
      'So the balanced equation is 4Fe + 3O₂ → 2Fe₂O₃',
    ],
  },
  'ch-eq-h2': {
    ar: [
      'قانون حفظ الكتلة: كتلة المواد المتفاعلة = كتلة المواد الناتجة',
      'التفاعل الكيميائي إعادة ترتيب للذرات: تنكسر روابط وتتكوّن روابط جديدة دون فناء ذرات أو استحداثها',
      'فاختلاف عدد ذرات عنصر بين الطرفين يعني فناء ذرات أو استحداثها، وهذا غير ممكن',
      'إذن يجب وزن المعادلة، لأن الذرات لا تفنى ولا تُستحدث، فعددها محفوظ في الطرفين',
    ],
    en: [
      'Law of conservation of mass: mass of reactants = mass of products',
      'A chemical reaction rearranges atoms: bonds break and new bonds form, with no atoms destroyed or created',
      'So a different number of atoms of an element on the two sides would mean atoms were destroyed or created, which is impossible',
      'So the equation must be balanced, because atoms are neither destroyed nor created, so their number is conserved on both sides',
    ],
  },
  // ── depth added 2026-10-15 ──
  'ch-ab-e3': {
    ar: [
      'الذرة تتكون من بروتونات ونيوترونات وإلكترونات',
      'البروتونات جسيمات موجبة الشحنة في النواة',
      'إذن شحنة البروتون: موجبة (+1)',
    ],
    en: [
      'An atom is made of protons, neutrons and electrons',
      'Protons are positively charged particles in the nucleus',
      'So the charge of a proton is positive (+1)',
    ],
  },
  'ch-ab-e4': {
    ar: [
      'في الذرة المتعادلة: عدد الإلكترونات = عدد البروتونات = العدد الذري',
      'عدد الإلكترونات = 9',
      'إذن في الذرة 9 إلكترونات',
    ],
    en: [
      'In a neutral atom: electrons = protons = atomic number',
      'Number of electrons = 9',
      'So the atom has 9 electrons',
    ],
  },
  'ch-ab-e5': {
    ar: [
      'النواة تحتوي على البروتونات والنيوترونات، وكل منها أثقل بكثير من الإلكترون',
      'الإلكترونات تضيف كتلة ضئيلة جدًا',
      'إذن معظم كتلة الذرة تتركز في النواة',
    ],
    en: [
      'The nucleus holds protons and neutrons, each far heavier than an electron',
      'The electrons add almost no mass',
      'So most of the atom\'s mass is concentrated in the nucleus',
    ],
  },
  'ch-ab-m3': {
    ar: [
      'عدد النيوترونات = العدد الكتلي − العدد الذري',
      'n = A − Z = 27 − 13 = 14',
      'إذن عدد النيوترونات = 14 نيوترونًا',
    ],
    en: [
      'Number of neutrons = mass number − atomic number',
      'n = A − Z = 27 − 13 = 14',
      'So the atom has 14 neutrons',
    ],
  },
  'ch-ab-m4': {
    ar: [
      'في ذرة Na المتعادلة: عدد الإلكترونات = 11',
      'الشحنة 1+ تعني أن الأيون فقد إلكترونًا واحدًا',
      'عدد الإلكترونات = 11 − 1 = 10',
      'إذن في الأيون Na⁺ 10 إلكترونات',
    ],
    en: [
      'In a neutral Na atom: electrons = 11',
      'The charge 1+ means the ion lost one electron',
      'Electrons = 11 − 1 = 10',
      'So the ion Na⁺ has 10 electrons',
    ],
  },
  'ch-ab-m5': {
    ar: [
      'عدد البروتونات = العدد الذري = 6 في أي نظير للكربون',
      'عدد النيوترونات = A − Z = 14 − 6 = 8',
      'إذن في ¹⁴C 6 بروتونات و8 نيوترونات',
    ],
    en: [
      'Number of protons = atomic number = 6 in any carbon isotope',
      'Number of neutrons = A − Z = 14 − 6 = 8',
      'So ¹⁴C has 6 protons and 8 neutrons',
    ],
  },
  'ch-ab-m6': {
    ar: [
      'عدد البروتونات في الذرة يساوي عدد الإلكترونات',
      'الشحنة الموجبة الكلية للبروتونات تلغي الشحنة السالبة الكلية للإلكترونات',
      'إذن الذرة متعادلة لأن عدد البروتونات الموجبة يساوي عدد الإلكترونات السالبة',
    ],
    en: [
      'The number of protons in an atom equals the number of electrons',
      'The total positive charge of the protons cancels the total negative charge of the electrons',
      'So the atom is neutral because the number of positive protons equals the number of negative electrons',
    ],
  },
  'ch-ab-h2': {
    ar: [
      'العدد الذري هو عدد البروتونات، وهو الذي يحدد نوع العنصر',
      'الكربون Z = 6، فكل من ¹²C و¹⁴C فيه 6 بروتونات، أما ¹⁴N فعدده الذري 7',
      'تساوي العدد الكتلي (14) في ¹⁴C و¹⁴N لا يعني تساوي العدد الذري',
      'إذن ¹²C و¹⁴C، لأن لكل منهما 6 بروتونات',
    ],
    en: [
      'The atomic number is the number of protons, and it decides the element',
      'Carbon has Z = 6, so ¹²C and ¹⁴C each have 6 protons, while ¹⁴N has atomic number 7',
      'Equal mass numbers (14) in ¹⁴C and ¹⁴N do not mean equal atomic numbers',
      'So ¹²C and ¹⁴C, because each has 6 protons',
    ],
  },
  'ch-ab-h3': {
    ar: [
      'عدد النيوترونات n = 16 والعدد الكتلي A = 31',
      'العدد الذري Z = A − n = 31 − 16 = 15',
      'في الذرة المتعادلة عدد الإلكترونات = Z = 15',
      'إذن العدد الذري 15 وعدد الإلكترونات 15',
    ],
    en: [
      'Neutrons n = 16 and mass number A = 31',
      'Atomic number Z = A − n = 31 − 16 = 15',
      'In a neutral atom the number of electrons = Z = 15',
      'So the atomic number is 15 and the number of electrons is 15',
    ],
  },
  'ch-ab-h4': {
    ar: [
      'عدد البروتونات = 17، فالعنصر هو الكلور',
      'عدد الإلكترونات (18) أكبر من عدد البروتونات (17) بواحد',
      'الشحنة = 17 − 18 = −1',
      'إذن الجسيم أيون سالب شحنته 1−',
    ],
    en: [
      'The number of protons is 17, so the element is chlorine',
      'There are 18 electrons, one more than the 17 protons',
      'Charge = 17 − 18 = −1',
      'So the particle is a negative ion with charge 1−',
    ],
  },
  'ch-as-e3': {
    ar: [
      'عدد الإلكترونات الأقصى في المستوى n هو 2n²',
      'n = 2 ⟹ 2 × 2² = 2 × 4 = 8',
      'إذن يتسع المستوى الثاني لـ 8 إلكترونات',
    ],
    en: [
      'The maximum number of electrons in level n is 2n²',
      'n = 2 ⟹ 2 × 2² = 2 × 4 = 8',
      'So the second level holds 8 electrons',
    ],
  },
  'ch-as-e4': {
    ar: [
      'الانتقال من مستوى أعلى (n = 3) إلى مستوى أدنى (n = 1) تقل فيه طاقة الإلكترون',
      'فرق الطاقة يُطلق خارج الذرة',
      'إذن ينبعث منه طاقة على شكل ضوء',
    ],
    en: [
      'Moving from a higher level (n = 3) to a lower one (n = 1) lowers the electron\'s energy',
      'The energy difference is given out by the atom',
      'So energy is emitted as light',
    ],
  },
  'ch-as-e5': {
    ar: [
      'يميل الإلكترون إلى أقل طاقة ممكنة',
      'أقل مستوى طاقة هو الأقرب إلى النواة، أي n = 1',
      'إذن الحالة المستقرة في المستوى n = 1',
    ],
    en: [
      'An electron tends toward the lowest possible energy',
      'The lowest level is the one nearest the nucleus, n = 1',
      'So the ground state is level n = 1',
    ],
  },
  'ch-as-m3': {
    ar: [
      'E = −13.6 / n²',
      'n = 3 ⟹ E = −13.6 / 9',
      'E ≈ −1.51 eV',
      'إذن طاقة المستوى n = 3 هي −1.51 eV',
    ],
    en: [
      'E = −13.6 / n²',
      'n = 3 ⟹ E = −13.6 / 9',
      'E ≈ −1.51 eV',
      'So the energy of level n = 3 is −1.51 eV',
    ],
  },
  'ch-as-m4': {
    ar: [
      'E₁ = −13.6 eV وE₃ = −13.6/9 ≈ −1.51 eV',
      'الطاقة الأقل هي الأكثر سالبية: −13.6 < −1.51',
      'المستوى n = 1 هو الأقرب إلى النواة',
      'إذن الأقل طاقة n = 1، لأنه الأقرب إلى النواة',
    ],
    en: [
      'E₁ = −13.6 eV and E₃ = −13.6/9 ≈ −1.51 eV',
      'The lower energy is the more negative one: −13.6 < −1.51',
      'Level n = 1 is the closest to the nucleus',
      'So n = 1 has the lower energy, because it is closest to the nucleus',
    ],
  },
  'ch-as-m5': {
    ar: [
      'المستوى الرئيس n يضم n من المستويات الفرعية',
      'n = 3 ⟹ 3 مستويات فرعية: s وp وd',
      'إذن في المستوى الثالث 3 مستويات فرعية (s وp وd)',
    ],
    en: [
      'Main level n contains n subshells',
      'n = 3 ⟹ 3 subshells: s, p and d',
      'So the third level has 3 subshells (s, p and d)',
    ],
  },
  'ch-as-m6': {
    ar: [
      'أعداد الكم الأربعة هي n وℓ وm وms',
      'n هو العدد الرئيس: يحدد مستوى الطاقة وحجم الأوربيتال',
      'إذن n، ويحدد مستوى الطاقة وحجم الأوربيتال',
    ],
    en: [
      'The four quantum numbers are n, ℓ, m and ms',
      'n is the principal number: it fixes the energy level and the size of the orbital',
      'So it is n, which fixes the energy level and the size of the orbital',
    ],
  },
  'ch-as-h2': {
    ar: [
      'المستوى الفرعي d يضم 5 أوربيتالات',
      'كل أوربيتال يتسع لإلكترونين',
      'عدد الإلكترونات = 5 × 2 = 10',
      'إذن في المستوى d 5 أوربيتالات تتسع لـ10 إلكترونات',
    ],
    en: [
      'A d subshell has 5 orbitals',
      'Each orbital holds 2 electrons',
      'Electrons = 5 × 2 = 10',
      'So a d subshell has 5 orbitals holding 10 electrons',
    ],
  },
  'ch-as-h3': {
    ar: [
      'لكل إلكترون عدد كم مغزلي ms يصف اتجاه دورانه حول محوره',
      'لا يوجد إلا اتجاهان ممكنان للدوران',
      'إذن ms = +½ أو −½',
    ],
    en: [
      'Every electron has a spin quantum number ms describing the direction of its spin',
      'Only two spin directions are possible',
      'So ms = +½ or −½',
    ],
  },
  'ch-as-h4': {
    ar: [
      'وفق بور يدور الإلكترون في مستويات طاقة محددة ومستقرة',
      'في المستوى الواحد تبقى طاقته ثابتة، ولا تُمتص أو تُشع طاقة إلا عند الانتقال بين مستويين',
      'إذن لا يُشعّ طاقة لأن طاقته ثابتة ما دام في مستوى طاقة محدد',
    ],
    en: [
      'In Bohr\'s theory an electron moves in fixed, stable energy levels',
      'Within one level its energy stays constant; energy is absorbed or emitted only when it moves between levels',
      'So it does not radiate, because its energy is constant while it stays in one energy level',
    ],
  },
  'ch-ec-e3': {
    ar: [
      'Z = 11 ⟹ 11 إلكترونًا',
      'نملأ بالترتيب: 1s² ثم 2s² ثم 2p⁶ ثم 3s¹',
      'المجموع: 2 + 2 + 6 + 1 = 11',
      'إذن التوزيع الإلكتروني للصوديوم: 1s² 2s² 2p⁶ 3s¹',
    ],
    en: [
      'Z = 11 ⟹ 11 electrons',
      'Fill in order: 1s², then 2s², then 2p⁶, then 3s¹',
      'Total: 2 + 2 + 6 + 1 = 11',
      'So sodium is 1s² 2s² 2p⁶ 3s¹',
    ],
  },
  'ch-ec-e4': {
    ar: [
      'Z = 8 ⟹ 8 إلكترونات',
      'نملأ بالترتيب: 1s² (2) ثم 2s² (4 في المجموع) ثم 2p',
      'المتبقي 8 − 4 = 4 إلكترونات تذهب إلى 2p',
      'إذن التوزيع الإلكتروني للأكسجين: 1s² 2s² 2p⁴',
    ],
    en: [
      'Z = 8 ⟹ 8 electrons',
      'Fill in order: 1s² (2), then 2s² (4 so far), then 2p',
      'The remaining 8 − 4 = 4 electrons go into 2p',
      'So oxygen is 1s² 2s² 2p⁴',
    ],
  },
  'ch-ec-e5': {
    ar: [
      'المستوى الفرعي p يضم 3 أوربيتالات',
      'كل أوربيتال يتسع لإلكترونين: 3 × 2 = 6',
      'إذن يتسع 2p لـ 6 إلكترونات',
    ],
    en: [
      'A p subshell has 3 orbitals',
      'Each orbital holds 2 electrons: 3 × 2 = 6',
      'So a full 2p holds 6 electrons',
    ],
  },
  'ch-ec-m3': {
    ar: [
      'Z = 13 ⟹ 13 إلكترونًا',
      'نملأ بالترتيب: 1s² 2s² 2p⁶ (10 إلكترونات)',
      'المتبقي 13 − 10 = 3: اثنان في 3s وواحد في 3p',
      'إذن التوزيع الإلكتروني للألمنيوم: 1s² 2s² 2p⁶ 3s² 3p¹',
    ],
    en: [
      'Z = 13 ⟹ 13 electrons',
      'Fill in order: 1s² 2s² 2p⁶ (10 electrons)',
      'The remaining 13 − 10 = 3: two in 3s and one in 3p',
      'So aluminium is 1s² 2s² 2p⁶ 3s² 3p¹',
    ],
  },
  'ch-ec-m4': {
    ar: [
      'توزيع ذرة Na المتعادلة: 1s² 2s² 2p⁶ 3s¹',
      'الشحنة 1+ تعني فقد إلكترون واحد، ويُفقد من المستوى الأخير 3s',
      'يبقى 10 إلكترونات',
      'إذن توزيع Na⁺: 1s² 2s² 2p⁶',
    ],
    en: [
      'The neutral Na atom: 1s² 2s² 2p⁶ 3s¹',
      'The charge 1+ means one electron is lost, taken from the outermost level 3s',
      '10 electrons remain',
      'So Na⁺ is 1s² 2s² 2p⁶',
    ],
  },
  'ch-ec-m5': {
    ar: [
      'توزيع ذرة Cl المتعادلة: 1s² 2s² 2p⁶ 3s² 3p⁵',
      'الشحنة 1− تعني اكتساب إلكترون واحد فيصبح 3p⁶',
      'عدد الإلكترونات 18',
      'إذن توزيع Cl⁻: 1s² 2s² 2p⁶ 3s² 3p⁶',
    ],
    en: [
      'The neutral Cl atom: 1s² 2s² 2p⁶ 3s² 3p⁵',
      'The charge 1− means one electron is gained, so 3p becomes 3p⁶',
      'There are 18 electrons',
      'So Cl⁻ is 1s² 2s² 2p⁶ 3s² 3p⁶',
    ],
  },
  'ch-ec-m6': {
    ar: [
      'ترتيب الملء يتبع طاقة المستويات الفرعية: 3p ثم 4s ثم 3d',
      'طاقة 4s أقل قليلًا من طاقة 3d في الذرة المتعادلة',
      'إذن يُملأ أولًا المستوى 4s',
    ],
    en: [
      'Filling follows subshell energy: 3p, then 4s, then 3d',
      'The energy of 4s is slightly lower than that of 3d in a neutral atom',
      'So 4s is filled first',
    ],
  },
  'ch-ec-h2': {
    ar: [
      'Z = 26 ⟹ 26 إلكترونًا',
      'نملأ 1s² 2s² 2p⁶ 3s² 3p⁶ (18 إلكترونًا) ثم 4s² (20 إلكترونًا)',
      'المتبقي 26 − 20 = 6 إلكترونات تذهب إلى 3d',
      'إذن التوزيع: 1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d⁶',
    ],
    en: [
      'Z = 26 ⟹ 26 electrons',
      'Fill 1s² 2s² 2p⁶ 3s² 3p⁶ (18 electrons), then 4s² (20 electrons)',
      'The remaining 26 − 20 = 6 electrons go into 3d',
      'So iron is 1s² 2s² 2p⁶ 3s² 3p⁶ 4s² 3d⁶',
    ],
  },
  'ch-ec-h3': {
    ar: [
      'عدد الإلكترونات = 2 + 2 + 6 + 2 + 6 = 18 ⟹ Z = 18، فالعنصر هو الأرجون',
      'المستوى الخارجي 3s² 3p⁶ يضم 8 إلكترونات، أي أنه ممتلئ',
      'إذن العنصر الأرجون Ar، غاز نبيل لأن مستواه الخارجي ممتلئ',
    ],
    en: [
      'Number of electrons = 2 + 2 + 6 + 2 + 6 = 18 ⟹ Z = 18, so the element is argon',
      'The outer level 3s² 3p⁶ holds 8 electrons, so it is full',
      'So the element is argon, Ar, a noble gas because its outer level is full',
    ],
  },
  'ch-ec-h4': {
    ar: [
      '1s² 2s² 2p³: ثلاثة إلكترونات في المستوى 2p الذي يضم 3 أوربيتالات',
      'حسب قاعدة هوند يوضع إلكترون واحد في كل أوربيتال قبل أن يحدث الازدواج',
      'إذن في ذرة النيتروجين 3 إلكترونات غير مزدوجة',
    ],
    en: [
      '1s² 2s² 2p³: three electrons in the 2p subshell, which has 3 orbitals',
      'By Hund\'s rule one electron goes into each orbital before any pairing',
      'So a nitrogen atom has 3 unpaired electrons',
    ],
  },
  'ch-bd-e3': {
    ar: [
      'النحاس فلز، وذراته تتشارك إلكترونات التكافؤ في «بحر» من الإلكترونات',
      'هذا وصف الرابطة الفلزية',
      'إذن الرابطة بين ذراته رابطة فلزية',
    ],
    en: [
      'Copper is a metal; its atoms share their valence electrons in a "sea" of electrons',
      'That describes a metallic bond',
      'So the bond between its atoms is a metallic bond',
    ],
  },
  'ch-bd-e4': {
    ar: [
      'ذرة الكلور فيها 7 إلكترونات تكافؤ وتحتاج إلى إلكترون واحد لتكمل 8',
      'تتشارك كل ذرة بإلكترون واحد',
      'إذن في Cl₂ زوج واحد',
    ],
    en: [
      'A chlorine atom has 7 valence electrons and needs one more to reach 8',
      'Each atom contributes one electron',
      'So Cl₂ has one shared pair',
    ],
  },
  'ch-bd-e5': {
    ar: [
      'المركب الأيوني يتكوّن من فلز ولافلز',
      'K فلز وBr لافلز، أما HCl وCH₄ وCO₂ فمركبات من لافلزات',
      'إذن المركب الأيوني هو KBr',
    ],
    en: [
      'An ionic compound is made of a metal and a non-metal',
      'K is a metal and Br a non-metal, while HCl, CH₄ and CO₂ are made only of non-metals',
      'So the ionic compound is KBr',
    ],
  },
  'ch-bd-m3': {
    ar: [
      'H وCl لافلزان، فالرابطة تساهمية',
      'كهروسالبية Cl أعلى من H، فيُسحب الزوج المشترك نحو Cl',
      'فيصبح طرف الجزيء سالبًا جزئيًا والطرف الآخر موجبًا جزئيًا',
      'إذن الرابطة تساهمية قطبية، لأن الكلور أعلى كهروسالبية من الهيدروجين',
    ],
    en: [
      'H and Cl are non-metals, so the bond is covalent',
      'Cl is more electronegative than H, so the shared pair is pulled toward Cl',
      'One end of the molecule becomes partly negative and the other partly positive',
      'So the bond is polar covalent, because chlorine is more electronegative than hydrogen',
    ],
  },
  'ch-bd-m4': {
    ar: [
      'ذرة النيتروجين فيها 5 إلكترونات تكافؤ وتحتاج إلى 3 لتكمل 8',
      'تتشارك الذرتان بثلاثة إلكترونات من كل ذرة',
      'إذن في N₂ رابطة ثلاثية (3 أزواج مشتركة)',
    ],
    en: [
      'A nitrogen atom has 5 valence electrons and needs 3 more to reach 8',
      'The two atoms share three electrons each',
      'So N₂ has a triple bond (3 shared pairs)',
    ],
  },
  'ch-bd-m5': {
    ar: [
      'NaCl الصلب شبكة من أيونات Na⁺ وCl⁻ متجاورة',
      'التوصيل الكهربائي يحتاج إلى جسيمات مشحونة حرة الحركة',
      'الأيونات في الشبكة الصلبة مثبتة في أماكنها',
      'إذن لا يوصل الكهرباء لأن أيوناته مثبتة في مواقعها ولا تتحرك',
    ],
    en: [
      'Solid NaCl is a lattice of neighbouring Na⁺ and Cl⁻ ions',
      'Conduction needs charged particles that are free to move',
      'The ions in the solid lattice are fixed in place',
      'So it does not conduct, because its ions are held in position and cannot move',
    ],
  },
  'ch-bd-m6': {
    ar: [
      'توزيع Mg: 1s² 2s² 2p⁶ 3s²',
      'لتصل إلى توزيع الغاز النبيل تفقد الإلكترونين الخارجيين في 3s',
      'إذن تفقد ذرة المغنيسيوم إلكترونين',
    ],
    en: [
      'Mg is 1s² 2s² 2p⁶ 3s²',
      'To reach the noble-gas configuration it loses the two outer electrons in 3s',
      'So a magnesium atom loses two electrons',
    ],
  },
  'ch-bd-h2': {
    ar: [
      'في المركب الأيوني تجاذب كهروستاتيكي قوي بين الأيونات الموجبة والسالبة',
      'فصل الأيونات عن شبكتها يحتاج إلى طاقة كبيرة',
      'إذن درجة الانصهار مرتفعة لقوة التجاذب الكهروستاتيكي بين الأيونات المتعاكسة الشحنة',
    ],
    en: [
      'In an ionic compound there is a strong electrostatic attraction between positive and negative ions',
      'Separating the ions from the lattice takes a lot of energy',
      'So the melting point is high because of the strong electrostatic attraction between oppositely charged ions',
    ],
  },
  'ch-bd-h3': {
    ar: [
      'إلكترونات التكافؤ في الفلز غير مرتبطة بذرة محددة',
      'تشكّل «بحرًا» من الإلكترونات تتحرك بحرية بين الأيونات الموجبة',
      'حركة هذه الإلكترونات هي التي تحمل التيار الكهربائي',
      'إذن توصل الفلزات الكهرباء لوجود إلكترونات تكافؤ حرة الحركة (بحر من الإلكترونات)',
    ],
    en: [
      'Valence electrons in a metal are not tied to one atom',
      'They form a "sea" of electrons moving freely among the positive ions',
      'The movement of these electrons carries the current',
      'So metals conduct because they have free-moving valence electrons (a sea of electrons)',
    ],
  },
  'ch-bd-h4': {
    ar: [
      'NaCl مركب أيوني: تجاذب قوي بين الأيونات يحتاج إلى طاقة كبيرة للتغلب عليه',
      'CH₄ جزيئات تساهمية غير قطبية، والقوى بين جزيئاتها ضعيفة',
      'فالمركب الأيوني أعلى انصهارًا',
      'إذن NaCl، لأنه مركب أيوني والتجاذب بين أيوناته كبير',
    ],
    en: [
      'NaCl is ionic: a strong attraction between ions that takes a lot of energy to overcome',
      'CH₄ is made of non-polar covalent molecules with weak forces between them',
      'So the ionic compound melts higher',
      'So NaCl, because it is an ionic compound with strong attraction between its ions',
    ],
  },
  'ch-fm-e3': {
    ar: [
      'شحنة Na⁺ تساوي +1 وشحنة Cl⁻ تساوي −1',
      'مجموع الشحنات صفر بنسبة 1 : 1',
      'إذن الصيغة NaCl',
    ],
    en: [
      'Na⁺ has charge +1 and Cl⁻ has charge −1',
      'The charges cancel in a 1 : 1 ratio',
      'So the formula is NaCl',
    ],
  },
  'ch-fm-e4': {
    ar: [
      'MgO مركب من المغنيسيوم والأكسجين',
      'اسم المركب الثنائي: «أكسيد» ثم اسم الفلز',
      'إذن اسمه أكسيد المغنيسيوم',
    ],
    en: [
      'MgO is made of magnesium and oxygen',
      'A binary compound is named "oxide" first and then the metal',
      'So its name is magnesium oxide',
    ],
  },
  'ch-fm-e5': {
    ar: [
      'شحنة Na⁺ هي +1 وشحنة OH⁻ هي −1',
      'النسبة 1 : 1 فلا حاجة إلى أقواس أو أرقام سفلية',
      'إذن صيغته NaOH',
    ],
    en: [
      'Na⁺ has charge +1 and OH⁻ has charge −1',
      'The ratio is 1 : 1, so no brackets or subscripts are needed',
      'So its formula is NaOH',
    ],
  },
  'ch-fm-m3': {
    ar: [
      'شحنة K⁺ هي +1 وشحنة SO₄²⁻ هي −2',
      'لتعادل الشحنات نحتاج أيونَي K⁺ لكل SO₄²⁻: 2 × (+1) + (−2) = 0',
      'إذن الصيغة K₂SO₄',
    ],
    en: [
      'K⁺ has charge +1 and SO₄²⁻ has charge −2',
      'To balance the charges we need two K⁺ for each SO₄²⁻: 2 × (+1) + (−2) = 0',
      'So the formula is K₂SO₄',
    ],
  },
  'ch-fm-m4': {
    ar: [
      'شحنة Ca²⁺ هي +2 وشحنة PO₄³⁻ هي −3',
      'أصغر مضاعف مشترك للشحنتين هو 6: نحتاج 3 أيونات Ca²⁺ و2 من PO₄³⁻',
      '3 × (+2) + 2 × (−3) = 0',
      'إذن الصيغة Ca₃(PO₄)₂',
    ],
    en: [
      'Ca²⁺ has charge +2 and PO₄³⁻ has charge −3',
      'The lowest common multiple of 2 and 3 is 6: we need 3 Ca²⁺ and 2 PO₄³⁻',
      '3 × (+2) + 2 × (−3) = 0',
      'So the formula is Ca₃(PO₄)₂',
    ],
  },
  'ch-fm-m5': {
    ar: [
      'NH₄⁺ أيون الأمونيوم وCl⁻ أيون الكلوريد',
      'نبدأ باسم الأيون السالب ثم نذكر الأيون الموجب',
      'إذن اسمه كلوريد الأمونيوم',
    ],
    en: [
      'NH₄⁺ is the ammonium ion and Cl⁻ is the chloride ion',
      'We name the negative ion first, then the positive ion',
      'So its name is ammonium chloride',
    ],
  },
  'ch-fm-m6': {
    ar: [
      'CaCO₃ يتكوّن من Ca²⁺ وCO₃²⁻',
      'CO₃²⁻ هو أيون الكربونات',
      'إذن اسمه كربونات الكالسيوم',
    ],
    en: [
      'CaCO₃ is made of Ca²⁺ and CO₃²⁻',
      'CO₃²⁻ is the carbonate ion',
      'So its name is calcium carbonate',
    ],
  },
  'ch-fm-h2': {
    ar: [
      '(NH₄)₂SO₄ يحتوي على أيونَي NH₄⁺',
      'كل أيون NH₄⁺ فيه 4 ذرات هيدروجين',
      'عدد ذرات H = 2 × 4 = 8',
      'إذن عدد ذرات الهيدروجين 8 ذرات',
    ],
    en: [
      '(NH₄)₂SO₄ contains two NH₄⁺ ions',
      'Each NH₄⁺ ion has 4 hydrogen atoms',
      'Number of H atoms = 2 × 4 = 8',
      'So there are 8 hydrogen atoms',
    ],
  },
  'ch-fm-h3': {
    ar: [
      'Al₂(SO₄)₃: ذرتا Al أي 2',
      '(SO₄)₃: ثلاث مجموعات فيها 3 ذرات S و3 × 4 = 12 ذرة O',
      'المجموع = 2 + 3 + 12 = 17',
      'إذن العدد الكلي 17 ذرة',
    ],
    en: [
      'Al₂(SO₄)₃: two Al atoms, so 2',
      '(SO₄)₃: three groups holding 3 S atoms and 3 × 4 = 12 O atoms',
      'Total = 2 + 3 + 12 = 17',
      'So the total is 17 atoms',
    ],
  },
  'ch-fm-h4': {
    ar: [
      'شحنة Mg²⁺ هي +2 وشحنة NO₃⁻ هي −1',
      'نحتاج أيونَي NO₃⁻ لكل Mg²⁺، ونضعهما بين قوسين',
      'إذن الصيغة Mg(NO₃)₂',
    ],
    en: [
      'Mg²⁺ has charge +2 and NO₃⁻ has charge −1',
      'We need two NO₃⁻ for each Mg²⁺, written in brackets',
      'So the formula is Mg(NO₃)₂',
    ],
  },
  'ch-eq-e3': {
    ar: [
      'نوازن Cl: توجد ذرتان في Cl₂ فنضع 2 أمام NaCl',
      'نوازن Na: يلزم 2 أمام Na',
      'إذن المعادلة الموزونة: 2Na + Cl₂ → 2NaCl',
    ],
    en: [
      'Balance Cl: Cl₂ has two atoms, so put 2 in front of NaCl',
      'Balance Na: put 2 in front of Na',
      'So the balanced equation is 2Na + Cl₂ → 2NaCl',
    ],
  },
  'ch-eq-e4': {
    ar: [
      'نوازن O: توجد ذرتان في O₂ فنضع 2 أمام MgO',
      'نوازن Mg: يلزم 2 أمام Mg',
      'إذن المعادلة الموزونة: 2Mg + O₂ → 2MgO',
    ],
    en: [
      'Balance O: O₂ has two atoms, so put 2 in front of MgO',
      'Balance Mg: put 2 in front of Mg',
      'So the balanced equation is 2Mg + O₂ → 2MgO',
    ],
  },
  'ch-eq-e5': {
    ar: [
      'المتفاعلان عنصران (Na وCl₂) والناتج مركب واحد',
      'اتحاد مادتين لتكوين مادة واحدة هو تفاعل اتحاد',
      'إذن نوع التفاعل تفاعل اتحاد',
    ],
    en: [
      'The reactants are two elements (Na and Cl₂) and there is one product',
      'Two substances combining to give one is a combination reaction',
      'So it is a combination reaction',
    ],
  },
  'ch-eq-m3': {
    ar: [
      'نوازن Cl: توجد ذرتان في ZnCl₂ فنضع 2 أمام HCl',
      'نتحقق من H: ذرتان في الطرفين',
      'إذن المعادلة الموزونة: Zn + 2HCl → ZnCl₂ + H₂',
    ],
    en: [
      'Balance Cl: ZnCl₂ has two atoms, so put 2 in front of HCl',
      'Check H: two atoms on each side',
      'So the balanced equation is Zn + 2HCl → ZnCl₂ + H₂',
    ],
  },
  'ch-eq-m4': {
    ar: [
      'فلز حرّ (Zn) حلّ محلّ فلز آخر (Cu) في مركبه',
      'هذا تفاعل إحلال بسيط',
      'إذن نوع التفاعل تفاعل إحلال بسيط',
    ],
    en: [
      'A free metal (Zn) displaced another metal (Cu) from its compound',
      'That is a single displacement reaction',
      'So it is a single displacement reaction',
    ],
  },
  'ch-eq-m5': {
    ar: [
      'مركبان يتبادلان الأيونات: Ag⁺ مع Cl⁻ وNa⁺ مع NO₃⁻',
      'تبادل الأيونات بين مركبين هو إحلال مزدوج',
      'إذن نوع التفاعل تفاعل إحلال مزدوج',
    ],
    en: [
      'Two compounds swap ions: Ag⁺ with Cl⁻ and Na⁺ with NO₃⁻',
      'Swapping ions between two compounds is double displacement',
      'So it is a double displacement reaction',
    ],
  },
  'ch-eq-m6': {
    ar: [
      'نوازن C: 3 ذرات فنضع 3 أمام CO₂',
      'نوازن H: 8 ذرات فنضع 4 أمام H₂O',
      'نوازن O: 3 × 2 + 4 = 10 ذرات فنضع 5 أمام O₂',
      'إذن المعادلة الموزونة: C₃H₈ + 5O₂ → 3CO₂ + 4H₂O',
    ],
    en: [
      'Balance C: 3 atoms, so put 3 in front of CO₂',
      'Balance H: 8 atoms, so put 4 in front of H₂O',
      'Balance O: 3 × 2 + 4 = 10 atoms, so put 5 in front of O₂',
      'So the balanced equation is C₃H₈ + 5O₂ → 3CO₂ + 4H₂O',
    ],
  },
  'ch-eq-h3': {
    ar: [
      'نوازن O: أصغر مضاعف مشترك للعددين 2 و3 هو 6: نضع 3 أمام O₂ و2 أمام Al₂O₃',
      'نوازن Al: يوجد الآن 4 ذرات Al في 2Al₂O₃ فنضع 4 أمام Al',
      'إذن المعادلة الموزونة: 4Al + 3O₂ → 2Al₂O₃',
    ],
    en: [
      'Balance O: the lowest common multiple of 2 and 3 is 6, so put 3 in front of O₂ and 2 in front of Al₂O₃',
      'Balance Al: 2Al₂O₃ holds 4 Al atoms, so put 4 in front of Al',
      'So the balanced equation is 4Al + 3O₂ → 2Al₂O₃',
    ],
  },
  'ch-eq-h4': {
    ar: [
      'نوازن Fe: ذرتان في Fe₂O₃ فنضع 2 أمام Fe',
      'نوازن O: ثلاث ذرات O في Fe₂O₃ تحتاج 3CO فنضع 3 أمام CO',
      'نوازن C: نضع 3 أمام CO₂',
      'إذن المعادلة الموزونة: Fe₂O₃ + 3CO → 2Fe + 3CO₂',
    ],
    en: [
      'Balance Fe: Fe₂O₃ has two atoms, so put 2 in front of Fe',
      'Balance O: the three O atoms in Fe₂O₃ need 3CO, so put 3 in front of CO',
      'Balance C: put 3 in front of CO₂',
      'So the balanced equation is Fe₂O₃ + 3CO → 2Fe + 3CO₂',
    ],
  },
  'ch-pt-e3': {
    ar: [
      'الفلزات القلوية تقع في المجموعة الأولى',
      'رقم المجموعة الأولى يعني إلكترونًا واحدًا في مستوى التكافؤ',
      'إذن عدد إلكترونات التكافؤ إلكترون واحد',
    ],
    en: [
      'The alkali metals are in the first group',
      'The first group means one electron in the valence level',
      'So the number of valence electrons is one',
    ],
  },
  'ch-pt-e4': {
    ar: [
      'أعلى مستوى طاقة مشغول هنا هو n = 3 (3s² 3p⁴)',
      'رقم الدورة يساوي رقم أعلى مستوى طاقة مشغول',
      'إذن العنصر في الدورة الثالثة',
    ],
    en: [
      'The highest occupied energy level here is n = 3 (3s² 3p⁴)',
      'The period number equals the highest occupied energy level',
      'So the element is in the third period',
    ],
  },
  'ch-pt-e5': {
    ar: [
      'الغازات النبيلة مستوياتها الخارجية ممتلئة وهي خاملة',
      'Ar غاز نبيل، أما Na وMg فلزان وCl هالوجين',
      'إذن الغاز النبيل هو Ar',
    ],
    en: [
      'Noble gases have full outer levels and are unreactive',
      'Ar is a noble gas, Na and Mg are metals and Cl is a halogen',
      'So the noble gas is Ar',
    ],
  },
  'ch-pt-m3': {
    ar: [
      'Li وK في المجموعة نفسها، وK تحت Li',
      'النزول في المجموعة يزيد عدد مستويات الطاقة',
      'إذن الأكبر K، لأن له مستويات طاقة أكثر',
    ],
    en: [
      'Li and K are in the same group, with K below Li',
      'Going down a group adds energy levels',
      'So the larger atom is K, because it has more energy levels',
    ],
  },
  'ch-pt-m4': {
    ar: [
      'عند النزول في المجموعة يزداد نصف القطر',
      'الإلكترون الخارجي أبعد عن النواة فيسهل نزعه',
      'إذن طاقة التأين تقل، لأن الإلكترون الخارجي أبعد عن النواة',
    ],
    en: [
      'Going down a group the radius increases',
      'The outer electron is farther from the nucleus, so it is easier to remove',
      'So the ionization energy decreases, because the outer electron is farther from the nucleus',
    ],
  },
  'ch-pt-m5': {
    ar: [
      'Cl لافلز على يمين الدورة الثالثة وNa فلز على يسارها',
      'الكهروسالبية تزداد عبر الدورة من اليسار إلى اليمين',
      'إذن الأعلى كهروسالبية Cl، لأنه لافلز يميل إلى جذب الإلكترونات',
    ],
    en: [
      'Cl is a non-metal on the right of period 3 and Na a metal on the left',
      'Electronegativity increases across a period from left to right',
      'So the higher electronegativity is Cl, because it is a non-metal that tends to attract electrons',
    ],
  },
  'ch-pt-m6': {
    ar: [
      'العناصر كلها في الدورة الثالثة، وطاقة التأين تزداد عمومًا عبر الدورة',
      'Cl أقصى اليمين بينها',
      'إذن الأعلى طاقة تأين أولى Cl',
    ],
    en: [
      'All the elements are in period 3, and ionization energy generally rises across a period',
      'Cl is furthest to the right of them',
      'So the highest first ionization energy is Cl',
    ],
  },
  'ch-pt-h2': {
    ar: [
      'Cl⁻ اكتسب إلكترونًا فصار فيه 18 إلكترونًا وشحنة نواته 17+ كما هي',
      'يزداد التنافر بين الإلكترونات الخارجية فيتمدد السحاب الإلكتروني',
      'إذن Cl⁻ أكبر، لزيادة التنافر بين الإلكترونات مع بقاء شحنة النواة',
    ],
    en: [
      'Cl⁻ gained an electron, so it has 18 electrons while its nuclear charge is still 17+',
      'The repulsion among the outer electrons grows and the electron cloud expands',
      'So Cl⁻ is larger, because of the greater repulsion between electrons with the nuclear charge unchanged',
    ],
  },
  'ch-pt-h3': {
    ar: [
      'الأيونات الثلاثة فيها 10 إلكترونات، لكن عدد بروتوناتها 11 و12 و13',
      'كلما زادت شحنة النواة مع ثبات عدد الإلكترونات زاد الجذب وصغر نصف القطر',
      'إذن الأكبر Na⁺، لأن شحنته النووية أقل',
    ],
    en: [
      'All three ions have 10 electrons, but 11, 12 and 13 protons',
      'The greater the nuclear charge with the same number of electrons, the stronger the pull and the smaller the radius',
      'So the largest is Na⁺, because its nuclear charge is the smallest',
    ],
  },
  'ch-pt-h4': {
    ar: [
      'عبر الدورة تزداد شحنة النواة الموجبة',
      'الإلكترونات الخارجية تبقى في المستوى نفسه فيقل نصف القطر ويزداد جذب النواة لها',
      'فنزع الإلكترون يحتاج طاقة أكبر',
      'إذن تزداد لزيادة الشحنة النووية الفعالة ونقص نصف القطر',
    ],
    en: [
      'Across a period the positive nuclear charge increases',
      'The outer electrons stay in the same level, so the radius shrinks and the pull on them grows',
      'So removing an electron takes more energy',
      'So it increases because of the greater effective nuclear charge and the smaller radius',
    ],
  },
};
