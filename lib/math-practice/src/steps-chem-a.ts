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
};
