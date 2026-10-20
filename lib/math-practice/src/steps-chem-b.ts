import type { SolutionSteps } from './steps-types.ts';

/**
 * Worked solutions for the mole, stoichiometry, thermochemistry, acids and
 * bases, metal activity, redox and general chemistry families.
 *
 * Atomic masses are the rounded values the Jordanian books print (H 1, C 12,
 * N 14, O 16, Na 23, Mg 24, S 32, Cl 35.5, Ca 40, Fe 56, Cu 64). Every number
 * below was recomputed by a script against the bank answers when written.
 */
export const CHEM_B_STEPS: Record<string, SolutionSteps> = {
  // ── المول والكتلة المولية ──
  'ch-ml-e1': {
    ar: [
      'الكتلة المولية M = مجموع الكتل الذرية لجميع ذرات الصيغة',
      'في H₂O: ذرتا H وذرة O واحدة',
      'M = 2 × 1 + 1 × 16',
      'M = 2 + 16 = 18',
      'الكتلة المولية للماء = 18 g/mol',
    ],
    en: [
      'Molar mass M = the sum of the atomic masses of all atoms in the formula',
      'In H₂O: two H atoms and one O atom',
      'M = 2 × 1 + 1 × 16',
      'M = 2 + 16 = 18',
      'The molar mass of water = 18 g/mol',
    ],
  },
  'ch-ml-e2': {
    ar: [
      'الكتلة المولية M = مجموع الكتل الذرية لجميع ذرات الصيغة',
      'في CO₂: ذرة C واحدة وذرتا O',
      'M = 1 × 12 + 2 × 16 = 12 + 32',
      'الكتلة المولية لـCO₂ = 44 g/mol',
    ],
    en: [
      'Molar mass M = the sum of the atomic masses of all atoms in the formula',
      'In CO₂: one C atom and two O atoms',
      'M = 1 × 12 + 2 × 16 = 12 + 32',
      'The molar mass of CO₂ = 44 g/mol',
    ],
  },
  'ch-ml-m1': {
    ar: [
      'عدد المولات n = m ÷ M',
      'المعطيات: m = 36 g و M = 18 g/mol',
      'n = 36 ÷ 18',
      'عدد المولات n = 2 mol',
    ],
    en: [
      'Number of moles n = m ÷ M',
      'Given: m = 36 g and M = 18 g/mol',
      'n = 36 ÷ 18',
      'The number of moles n = 2 mol',
    ],
  },
  'ch-ml-m2': {
    ar: [
      'الكتلة المولية M = مجموع الكتل الذرية لجميع ذرات الصيغة',
      'في NaCl: ذرة Na واحدة وذرة Cl واحدة',
      'M = 23 + 35.5',
      'M(NaCl) = 58.5 g/mol',
    ],
    en: [
      'Molar mass M = the sum of the atomic masses of all atoms in the formula',
      'In NaCl: one Na atom and one Cl atom',
      'M = 23 + 35.5',
      'M(NaCl) = 58.5 g/mol',
    ],
  },
  'ch-ml-m3': {
    ar: [
      'الكتلة m = n × M',
      'المعطيات: n = 0.5 mol و M = 44 g/mol',
      'm = 0.5 × 44',
      'كتلة 0.5 mol من CO₂ = 22 g',
    ],
    en: [
      'Mass m = n × M',
      'Given: n = 0.5 mol and M = 44 g/mol',
      'm = 0.5 × 44',
      'The mass of 0.5 mol of CO₂ = 22 g',
    ],
  },
  'ch-ml-h1': {
    ar: [
      'الكتلة المولية M = مجموع الكتل الذرية لجميع ذرات الصيغة',
      'الرمز 2 خارج القوسين في Ca(OH)₂ يضاعف ما داخله: 1 Ca و2 O و2 H',
      'M = 1 × 40 + 2 × 16 + 2 × 1',
      'M = 40 + 32 + 2',
      'الكتلة المولية لـCa(OH)₂ = 74 g/mol',
    ],
    en: [
      'Molar mass M = the sum of the atomic masses of all atoms in the formula',
      'The 2 outside the brackets in Ca(OH)₂ doubles what is inside: 1 Ca, 2 O and 2 H',
      'M = 1 × 40 + 2 × 16 + 2 × 1',
      'M = 40 + 32 + 2',
      'The molar mass of Ca(OH)₂ = 74 g/mol',
    ],
  },
  'ch-ml-h2': {
    ar: [
      'عدد الجسيمات N = n × N_A',
      'المعطيات: n = 2 mol و N_A = 6.02 × 10²³',
      'N = 2 × 6.02 × 10²³',
      'N = 12.04 × 10²³',
      'نكتب الناتج بالصيغة العلمية: 1.204 × 10²⁴ جسيمًا',
    ],
    en: [
      'Number of particles N = n × N_A',
      'Given: n = 2 mol and N_A = 6.02 × 10²³',
      'N = 2 × 6.02 × 10²³',
      'N = 12.04 × 10²³',
      'In scientific notation: 1.204 × 10²⁴ particles',
    ],
  },

  // ── الحسابات الكيميائية ──
  'ch-st-e1': {
    ar: [
      'المعادلة موزونة: 2H₂ + O₂ → 2H₂O',
      'النسبة المولية H₂ : H₂O = 2 : 2 أي 1 : 1',
      'n(H₂O) = 2 mol × (2 ÷ 2)',
      'الناتج من H₂O = 2 mol',
    ],
    en: [
      'The equation is balanced: 2H₂ + O₂ → 2H₂O',
      'Mole ratio H₂ : H₂O = 2 : 2, that is 1 : 1',
      'n(H₂O) = 2 mol × (2 ÷ 2)',
      'The H₂O produced = 2 mol',
    ],
  },
  'ch-st-m1': {
    ar: [
      'المعادلة موزونة: N₂ + 3H₂ → 2NH₃',
      'النسبة المولية H₂ : NH₃ = 3 : 2',
      'n(NH₃) = n(H₂) × (2 ÷ 3)',
      'n(NH₃) = 3 × (2 ÷ 3)',
      'الناتج من NH₃ = 2 mol',
    ],
    en: [
      'The equation is balanced: N₂ + 3H₂ → 2NH₃',
      'Mole ratio H₂ : NH₃ = 3 : 2',
      'n(NH₃) = n(H₂) × (2 ÷ 3)',
      'n(NH₃) = 3 × (2 ÷ 3)',
      'The NH₃ produced = 2 mol',
    ],
  },
  'ch-st-m2': {
    ar: [
      'المعادلة موزونة: CH₄ + 2O₂ → CO₂ + 2H₂O',
      'النسبة المولية CH₄ : O₂ = 1 : 2',
      'n(O₂) = n(CH₄) × (2 ÷ 1)',
      'n(O₂) = 2 × 2',
      'يلزم من O₂ = 4 mol',
    ],
    en: [
      'The equation is balanced: CH₄ + 2O₂ → CO₂ + 2H₂O',
      'Mole ratio CH₄ : O₂ = 1 : 2',
      'n(O₂) = n(CH₄) × (2 ÷ 1)',
      'n(O₂) = 2 × 2',
      'The O₂ required = 4 mol',
    ],
  },
  'ch-st-h1': {
    ar: [
      'نحوّل الكتلة إلى مولات: n(CaCO₃) = 100 ÷ 100 = 1 mol',
      'المعادلة موزونة: CaCO₃ → CaO + CO₂، والنسبة المولية CaCO₃ : CO₂ = 1 : 1',
      'n(CO₂) = 1 mol × (1 ÷ 1) = 1 mol',
      'نحوّل المولات إلى كتلة: m = n × M = 1 × 44',
      'كتلة CO₂ الناتجة = 44 g',
    ],
    en: [
      'Convert mass to moles: n(CaCO₃) = 100 ÷ 100 = 1 mol',
      'The equation is balanced: CaCO₃ → CaO + CO₂, and the mole ratio CaCO₃ : CO₂ = 1 : 1',
      'n(CO₂) = 1 mol × (1 ÷ 1) = 1 mol',
      'Convert moles to mass: m = n × M = 1 × 44',
      'The mass of CO₂ produced = 44 g',
    ],
  },
  'ch-st-h2': {
    ar: [
      'المعادلة موزونة: 2H₂ + O₂ → 2H₂O، والنسبة المولية H₂ : O₂ = 2 : 1',
      'O₂ اللازم لتفاعل 4 mol من H₂ = 4 × (1 ÷ 2) = 2 mol',
      'المتوفر من O₂ هو 1 mol فقط، وهو أقل من 2 mol اللازمة، فيُستهلك كله أولًا',
      'الناتج يُحسب من المادة المحددة: n(H₂O) = 1 × (2 ÷ 1) = 2 mol',
      'O₂ هو الكاشف المحدد وينتج 2 mol من H₂O',
    ],
    en: [
      'The equation is balanced: 2H₂ + O₂ → 2H₂O, and the mole ratio H₂ : O₂ = 2 : 1',
      'O₂ needed to react with 4 mol of H₂ = 4 × (1 ÷ 2) = 2 mol',
      'Only 1 mol of O₂ is available, less than the 2 mol needed, so it is used up first',
      'The product is calculated from the limiting reagent: n(H₂O) = 1 × (2 ÷ 1) = 2 mol',
      'O₂ is the limiting reagent and 2 mol of H₂O is produced',
    ],
  },

  // ── الطاقة الكيميائية ──
  'ch-th-e1': {
    ar: [
      'ΔH = طاقة المواد الناتجة − طاقة المواد المتفاعلة',
      'ΔH سالبة، أي إن طاقة المواد الناتجة أقل من طاقة المتفاعلة',
      'الفرق في الطاقة ينطلق إلى المحيط',
      'التفاعل إذن: تفاعل طارد للطاقة',
    ],
    en: [
      'ΔH = energy of products − energy of reactants',
      'ΔH is negative, so the products have less energy than the reactants',
      'The difference in energy is released to the surroundings',
      'So the reaction is an exothermic reaction',
    ],
  },
  'ch-th-e2': {
    ar: [
      'احتراق الميثان يُصدر حرارة وضوءًا، أي ينطلق منه طاقة إلى المحيط',
      'التفاعل الذي تنطلق منه الطاقة يكون طاردًا للطاقة',
      'المحيط يكتسب هذه الطاقة، فترتفع درجة حرارته',
      'احتراق الميثان طارد للطاقة، وترتفع درجة حرارة المحيط',
    ],
    en: [
      'Burning methane gives out heat and light, so energy is released to the surroundings',
      'A reaction that releases energy is exothermic',
      'The surroundings gain this energy, so their temperature rises',
      'Burning methane is exothermic, and the temperature of the surroundings rises',
    ],
  },
  'ch-th-m1': {
    ar: [
      'لفصل ذرتين مرتبطتين لا بد من تزويدهما بطاقة، فكسر الروابط يمتص طاقة',
      'عند اتحاد الذرات وتكوين رابطة تنطلق طاقة، فتكوين الروابط يحرّر طاقة',
      'كسر الروابط يمتص طاقة وتكوينها يحرّر طاقة',
    ],
    en: [
      'Separating two bonded atoms requires energy to be supplied, so breaking bonds absorbs energy',
      'When atoms join and a bond forms, energy is released, so forming bonds releases energy',
      'Breaking bonds absorbs energy and forming them releases energy',
    ],
  },
  'ch-th-m2': {
    ar: [
      'الطاقة الممتصة q = m·c·ΔT',
      'المعطيات: m = 100 g و c = 4.18 J/g·°C و ΔT = 10 °C',
      'q = 100 × 4.18 × 10',
      'q = 4180 J',
    ],
    en: [
      'Energy absorbed q = m·c·ΔT',
      'Given: m = 100 g, c = 4.18 J/g·°C and ΔT = 10 °C',
      'q = 100 × 4.18 × 10',
      'q = 4180 J',
    ],
  },
  'ch-th-h1': {
    ar: [
      'ΔH = طاقة المواد الناتجة − طاقة المواد المتفاعلة = +180 kJ/mol',
      'ΔH موجبة، أي إن طاقة المواد الناتجة أكبر من طاقة المتفاعلة',
      'لذلك يمتص التفاعل طاقة من المحيط',
      'التفاعل ماص للطاقة، وطاقة المواد الناتجة أعلى من المتفاعلة',
    ],
    en: [
      'ΔH = energy of products − energy of reactants = +180 kJ/mol',
      'ΔH is positive, so the products have more energy than the reactants',
      'The reaction therefore absorbs energy from the surroundings',
      'The reaction is endothermic, and the energy of the products is higher than that of the reactants',
    ],
  },

  // ── الحموض والقواعد ──
  'ch-ac-e1': {
    ar: [
      'مقياس pH يمتد من 0 إلى 14',
      'القيم الأقل من 7 حمضية، و7 متعادلة، والأكبر من 7 قاعدية',
      'المحلول pH = 3 وهي أقل من 7',
      'نوع المحلول: محلول حمضي',
    ],
    en: [
      'The pH scale runs from 0 to 14',
      'Values below 7 are acidic, 7 is neutral, and values above 7 are basic',
      'The solution has pH = 3, which is below 7',
      'The type of solution: an acidic solution',
    ],
  },
  'ch-ac-e2': {
    ar: [
      'ورق عباد الشمس كاشف يتغير لونه بحسب نوع المحلول',
      'الحمض يحوّل الورق الأزرق إلى الأحمر، والقاعدة تحوّل الورق الأحمر إلى الأزرق',
      'المحلول هنا حمضي، فالورق الأزرق يتحول إلى الأحمر',
    ],
    en: [
      'Litmus paper is an indicator whose colour depends on the type of solution',
      'An acid turns blue paper red, and a base turns red paper blue',
      'The solution here is acidic, so the blue paper turns red',
    ],
  },
  'ch-ac-m1': {
    ar: [
      'HCl حمض وNaOH قاعدة، وتفاعلهما تعادل ينتج ملحًا وماءً',
      'الملح يتكون من أيون الفلز Na⁺ من القاعدة وأيون Cl⁻ من الحمض، فهو NaCl',
      'يتحد H⁺ من الحمض مع OH⁻ من القاعدة فيتكون H₂O',
      'المعادلة موزونة (ذرة واحدة من كل عنصر في الطرفين): HCl + NaOH → NaCl + H₂O',
    ],
    en: [
      'HCl is an acid and NaOH is a base; their reaction is neutralisation, which gives a salt and water',
      'The salt is made of the metal ion Na⁺ from the base and Cl⁻ from the acid, so it is NaCl',
      'H⁺ from the acid combines with OH⁻ from the base to form H₂O',
      'The equation is balanced (one atom of each element on both sides): HCl + NaOH → NaCl + H₂O',
    ],
  },
  'ch-ac-m2': {
    ar: [
      'يحل الفلز النشط محل هيدروجين الحمض لأنه أنشط منه',
      'مثال: Zn + 2HCl → ZnCl₂ + H₂',
      'أيون الفلز مع أيون الحمض يكوّنان الملح، ويتصاعد الهيدروجين غازًا',
      'الناتج: ملح وغاز الهيدروجين',
    ],
    en: [
      'An active metal replaces the hydrogen of the acid because it is more active than hydrogen',
      'Example: Zn + 2HCl → ZnCl₂ + H₂',
      'The metal ion and the acid ion form the salt, and hydrogen is released as a gas',
      'The products: a salt and hydrogen gas',
    ],
  },
  'ch-ac-h1': {
    ar: [
      'مقياس pH لوغاريتمي: كل وحدة واحدة تعني تغيّر تركيز H⁺ بمقدار 10 مرات',
      'عند pH = 5: [H⁺] = 10⁻⁵ mol/L، وعند pH = 3: [H⁺] = 10⁻³ mol/L',
      'النسبة = 10⁻³ ÷ 10⁻⁵ = 10²',
      '10² = 100، أي إن تركيز H⁺ زاد 100 مرة',
      'تزداد الحموضة 100 مرة',
    ],
    en: [
      'The pH scale is logarithmic: each single unit means the H⁺ concentration changes by a factor of 10',
      'At pH = 5: [H⁺] = 10⁻⁵ mol/L, and at pH = 3: [H⁺] = 10⁻³ mol/L',
      'Ratio = 10⁻³ ÷ 10⁻⁵ = 10²',
      '10² = 100, so the H⁺ concentration increased 100 times',
      'The acidity increases 100 times',
    ],
  },

  // ── نشاط الفلزات ──
  'ch-ma-e1': {
    ar: [
      'الفلز الأنشط يحل محل الفلز الأقل نشاطًا في محلول ملحه',
      'الزنك أنشط من النحاس، فيحل محله في CuSO₄',
      'يرتبط Zn بأيون SO₄ فيتكوّن ZnSO₄، ويتحرر Cu فلزًا',
      'Zn + CuSO₄ → ZnSO₄ + Cu',
    ],
    en: [
      'A more active metal displaces a less active metal from the solution of its salt',
      'Zinc is more active than copper, so it displaces copper from CuSO₄',
      'Zn combines with the SO₄ ion to form ZnSO₄, and Cu is released as a metal',
      'Zn + CuSO₄ → ZnSO₄ + Cu',
    ],
  },
  'ch-ma-m1': {
    ar: [
      'الفلز لا يحل محل فلز آخر في محلول ملحه إلا إذا كان أنشط منه',
      'في سلسلة النشاط الزنك أنشط من النحاس',
      'النحاس أقل نشاطًا من الزنك، فلا يستطيع أن يحل محله في ZnSO₄',
      'لا يحدث تفاعل، لأن النحاس أقل نشاطًا من الزنك',
    ],
    en: [
      'A metal displaces another metal from its salt solution only if it is more active',
      'In the activity series zinc is more active than copper',
      'Copper is less active than zinc, so it cannot displace zinc from ZnSO₄',
      'No reaction occurs, because copper is less active than zinc',
    ],
  },
  'ch-ma-m2': {
    ar: [
      'الصدأ أكسيد حديد يتكوّن حين يتأكسد الحديد',
      'الحديد في هواء جاف لا يصدأ، وفي ماء خالٍ من الأكسجين لا يصدأ أيضًا',
      'لا يحدث الصدأ إلا بوجود المادتين معًا',
      'العاملان اللازمان: الأكسجين والماء',
    ],
    en: [
      'Rust is an iron oxide formed when iron is oxidised',
      'Iron does not rust in dry air, and it does not rust in water free of oxygen either',
      'Rusting happens only when both substances are present together',
      'The two required factors: oxygen and water',
    ],
  },
  'ch-ma-h1': {
    ar: [
      'في سلسلة النشاط الزنك أعلى من الحديد، فهو أنشط منه',
      'الفلز الأنشط يفقد إلكتروناته (يتأكسد) أسهل من الأقل نشاطًا',
      'إذا خُدش الطلاء وتعرّض الحديد للهواء والماء، يتأكسد الزنك أولًا ويبقى الحديد سليمًا',
      'الزنك أنشط من الحديد فيتأكسد بدلًا منه',
    ],
    en: [
      'In the activity series zinc is above iron, so it is more active',
      'A more active metal loses electrons (is oxidised) more easily than a less active one',
      'If the coating is scratched and the iron is exposed to air and water, zinc is oxidised first and the iron stays intact',
      'Zinc is more active than iron, so it is oxidised instead of it',
    ],
  },

  // ── التأكسد والاختزال ──
  'ch-rx-e1': {
    ar: [
      'التأكسد فقد إلكترونات، والاختزال اكتساب إلكترونات',
      'في Zn → Zn²⁺ + 2e⁻ تظهر الإلكترونات في الطرف الناتج، أي إن الذرة فقدتها',
      'وتزداد الشحنة من 0 إلى +2',
      'تأكسد، لأن الزنك يفقد إلكترونين',
    ],
    en: [
      'Oxidation is loss of electrons, and reduction is gain of electrons',
      'In Zn → Zn²⁺ + 2e⁻ the electrons appear on the product side, so the atom has lost them',
      'The charge increases from 0 to +2',
      'Oxidation, because zinc loses two electrons',
    ],
  },
  'ch-rx-e2': {
    ar: [
      'التأكسد هو فقد إلكترونات',
      'الاختزال عملية معاكسة للتأكسد، فيه تنتقل الإلكترونات إلى المادة',
      'مثال: Cu²⁺ + 2e⁻ → Cu، وتنقص الشحنة من +2 إلى 0',
      'الاختزال: اكتساب إلكترونات',
    ],
    en: [
      'Oxidation is loss of electrons',
      'Reduction is the opposite process, in which electrons are transferred to the substance',
      'Example: Cu²⁺ + 2e⁻ → Cu, and the charge decreases from +2 to 0',
      'Reduction: gain of electrons',
    ],
  },
  'ch-rx-m1': {
    ar: [
      'في الخلية الجلفانية تسري الإلكترونات من قطب إلى آخر عبر السلك',
      'القطب الذي تنطلق منه الإلكترونات هو القطب الذي يحدث عنده فقد إلكترونات، أي التأكسد، ويسمى المصعد',
      'القطب الذي تصله الإلكترونات يكتسبها، أي يحدث عنده الاختزال، ويسمى المهبط',
      'التأكسد عند المصعد والاختزال عند المهبط',
    ],
    en: [
      'In a galvanic cell electrons flow from one electrode to the other through the wire',
      'The electrode the electrons leave is where electrons are lost, that is oxidation, and it is called the anode',
      'The electrode the electrons reach gains them, that is reduction, and it is called the cathode',
      'Oxidation occurs at the anode and reduction occurs at the cathode',
    ],
  },
  'ch-rx-m2': {
    ar: [
      'في الخلية الجلفانية يحدث تفاعل تأكسد واختزال تلقائي فينتج تيار كهربائي',
      'أي إن الطاقة الكيميائية تتحول إلى طاقة كهربائية',
      'في خلية التحليل الكهربائي يُمرَّر تيار من مصدر خارجي ليُجبر تفاعلًا غير تلقائي على الحدوث، فتتحول الطاقة الكهربائية إلى كيميائية',
      'الجلفانية تحوّل الطاقة الكيميائية إلى كهربائية، والتحليل الكهربائي بالعكس',
    ],
    en: [
      'In a galvanic cell a spontaneous redox reaction occurs and produces an electric current',
      'So chemical energy is converted into electrical energy',
      'In an electrolytic cell a current from an external source forces a non-spontaneous reaction to occur, so electrical energy is converted into chemical energy',
      'A galvanic cell converts chemical energy into electrical energy, and electrolysis does the reverse',
    ],
  },
  'ch-rx-h1': {
    ar: [
      'نفصل التفاعل إلى نصفين: Zn → Zn²⁺ + 2e⁻ وCu²⁺ + 2e⁻ → Cu',
      'الزنك يفقد إلكترونين فيتأكسد، وCu²⁺ يكتسب إلكترونين فيُختزل',
      'العامل المختزل هو المادة التي تتأكسد لأنها تعطي الإلكترونات، فهو Zn',
      'العامل المؤكسد هو المادة التي تُختزل لأنها تأخذ الإلكترونات، فهو Cu²⁺',
      'الزنك عامل مختزل والنحاس Cu²⁺ عامل مؤكسد',
    ],
    en: [
      'Split the reaction into two halves: Zn → Zn²⁺ + 2e⁻ and Cu²⁺ + 2e⁻ → Cu',
      'Zinc loses two electrons so it is oxidised, and Cu²⁺ gains two electrons so it is reduced',
      'The reducing agent is the substance that is oxidised because it gives electrons, so it is Zn',
      'The oxidising agent is the substance that is reduced because it takes electrons, so it is Cu²⁺',
      'Zinc is the reducing agent and copper Cu²⁺ is the oxidising agent',
    ],
  },

  // ── عام ──
  'ch-gn-e1': {
    ar: [
      'العنصر مادة نقية ذراتها من نوع واحد، مثل O₂ وFe',
      'المركب مادة نقية تتحد فيها ذرات عنصرين أو أكثر كيميائيًا، مثل H₂O',
      'العنصر نوع واحد من الذرات والمركب نوعان أو أكثر متحدان كيميائيًا',
    ],
    en: [
      'An element is a pure substance whose atoms are of one kind, such as O₂ and Fe',
      'A compound is a pure substance in which atoms of two or more elements are chemically combined, such as H₂O',
      'An element is one kind of atom, and a compound is two or more kinds chemically combined',
    ],
  },
  'ch-gn-e2': {
    ar: [
      'في التغير الفيزيائي تبقى المادة نفسها وتتغير حالتها أو شكلها فقط',
      'في التغير الكيميائي تتحول المواد المتفاعلة إلى مواد مختلفة',
      'ويُستدل عليه بتصاعد غاز أو تكوّن راسب أو تغيّر اللون أو انطلاق حرارة',
      'الدليل: تكوّن مادة جديدة لها خصائص مختلفة',
    ],
    en: [
      'In a physical change the substance stays the same and only its state or shape changes',
      'In a chemical change the reactants turn into different substances',
      'It is recognised by gas bubbles, a precipitate, a colour change or release of heat',
      'The evidence: a new substance with different properties forms',
    ],
  },
  'ch-gn-m1': {
    ar: [
      'المركب تتحد عناصره كيميائيًا بنسبة كتلية ثابتة، مثل الماء، ولا يُفصل إلا بتغير كيميائي',
      'المخلوط مواد ممزوجة فيزيائيًا بنسب يمكن أن تتغير، مثل الماء المالح',
      'ويُفصل المخلوط بطرائق فيزيائية كالتبخير والترشيح',
      'المركب بنسب ثابتة ويُفصل كيميائيًا، والمخلوط بنسب متغيرة ويُفصل فيزيائيًا',
    ],
    en: [
      'In a compound the elements are chemically combined in a fixed mass ratio, like water, and it can be separated only by a chemical change',
      'A mixture is made of substances physically mixed in ratios that can vary, like salt water',
      'A mixture is separated by physical methods such as evaporation and filtration',
      'A compound has fixed proportions and is separated chemically, and a mixture has variable proportions and is separated physically',
    ],
  },
  'ch-gn-m2': {
    ar: [
      'التركيز C = n ÷ V، أي كمية المذاب مقسومة على حجم المحلول',
      'كمية الملح n لم تتغير',
      'إضافة الماء تزيد حجم المحلول V',
      'قسمة n الثابتة على V الأكبر تعطي C أصغر، إذن يقل التركيز',
    ],
    en: [
      'Concentration C = n ÷ V, that is the amount of solute divided by the volume of solution',
      'The amount of salt n has not changed',
      'Adding water increases the volume of the solution V',
      'Dividing the same n by a larger V gives a smaller C, so the concentration decreases',
    ],
  },
  'ch-gn-h1': {
    ar: [
      'الوعاء مغلق، فلا تدخل إليه مادة ولا تخرج منه',
      'التفاعل الكيميائي يعيد ترتيب الذرات فقط، فلا تفنى ذرات ولا تُستحدث',
      'إذن كتلة الذرات قبل التفاعل تساوي كتلتها بعده',
      'تبقى الكتلة الكلية ثابتة',
    ],
    en: [
      'The vessel is sealed, so no matter enters it or leaves it',
      'A chemical reaction only rearranges atoms; no atoms are destroyed or created',
      'So the mass of the atoms before the reaction equals their mass after it',
      'The total mass stays constant',
    ],
  },
  // ── depth added 2026-10-15 ──
  'ch-ml-e3': {
    ar: [
      'الكتلة المولية = مجموع الكتل الذرية في الصيغة',
      'O₂ = 2 × 16 = 32',
      'إذن الكتلة المولية للأكسجين 32 g/mol',
    ],
    en: [
      'Molar mass = the sum of the atomic masses in the formula',
      'O₂ = 2 × 16 = 32',
      'So the molar mass of oxygen is 32 g/mol',
    ],
  },
  'ch-ml-e4': {
    ar: [
      'المول الواحد من أي مادة يحوي عددًا ثابتًا من الجسيمات',
      'هذا العدد هو عدد أفوجادرو = 6.02 × 10²³',
      'إذن في 1 mol 6.02 × 10²³ جسيمًا',
    ],
    en: [
      'One mole of any substance contains a fixed number of particles',
      'This number is Avogadro\'s number = 6.02 × 10²³',
      'So 1 mol contains 6.02 × 10²³ particles',
    ],
  },
  'ch-ml-e5': {
    ar: [
      'NH₃ = N + 3H',
      '= 14 + 3 × 1 = 17',
      'إذن الكتلة المولية 17 g/mol',
    ],
    en: [
      'NH₃ = N + 3H',
      '= 14 + 3 × 1 = 17',
      'So the molar mass is 17 g/mol',
    ],
  },
  'ch-ml-m4': {
    ar: [
      'n = m ÷ M',
      'n = 88 ÷ 44 = 2',
      'إذن عدد المولات 2 mol',
    ],
    en: [
      'n = m ÷ M',
      'n = 88 ÷ 44 = 2',
      'So the number of moles is 2 mol',
    ],
  },
  'ch-ml-m5': {
    ar: [
      'عدد الجزيئات = عدد المولات × عدد أفوجادرو',
      '= 0.5 × 6.02 × 10²³ = 3.01 × 10²³',
      'إذن في 0.5 mol 3.01 × 10²³ جزيئًا',
    ],
    en: [
      'Number of molecules = moles × Avogadro\'s number',
      '= 0.5 × 6.02 × 10²³ = 3.01 × 10²³',
      'So 0.5 mol contains 3.01 × 10²³ molecules',
    ],
  },
  'ch-ml-m6': {
    ar: [
      'Na₂CO₃ = 2Na + C + 3O',
      '= 2 × 23 + 12 + 3 × 16 = 46 + 12 + 48 = 106',
      'إذن الكتلة المولية 106 g/mol',
    ],
    en: [
      'Na₂CO₃ = 2Na + C + 3O',
      '= 2 × 23 + 12 + 3 × 16 = 46 + 12 + 48 = 106',
      'So the molar mass is 106 g/mol',
    ],
  },
  'ch-ml-h3': {
    ar: [
      'M(H₂SO₄) = 2 × 1 + 32 + 4 × 16 = 98 g/mol',
      'n = m ÷ M = 9.8 ÷ 98 = 0.1',
      'إذن عدد المولات 0.1 mol',
    ],
    en: [
      'M(H₂SO₄) = 2 × 1 + 32 + 4 × 16 = 98 g/mol',
      'n = m ÷ M = 9.8 ÷ 98 = 0.1',
      'So the number of moles is 0.1 mol',
    ],
  },
  'ch-ml-h4': {
    ar: [
      'n = عدد الجزيئات ÷ عدد أفوجادرو = 3.01 × 10²³ ÷ 6.02 × 10²³ = 0.5 mol',
      'm = n × M = 0.5 × 18 = 9',
      'إذن الكتلة 9 g',
    ],
    en: [
      'n = number of molecules ÷ Avogadro\'s number = 3.01 × 10²³ ÷ 6.02 × 10²³ = 0.5 mol',
      'm = n × M = 0.5 × 18 = 9',
      'So the mass is 9 g',
    ],
  },
  'ch-st-e2': {
    ar: [
      'النسبة المولية Mg : MgO = 2 : 2 = 1 : 1',
      'عدد مولات MgO = 2',
      'إذن ينتج 2 mol',
    ],
    en: [
      'Mole ratio Mg : MgO = 2 : 2 = 1 : 1',
      'Moles of MgO = 2',
      'So 2 mol of MgO form',
    ],
  },
  'ch-st-e3': {
    ar: [
      'النسبة المولية H₂O : O₂ = 2 : 1',
      'عدد مولات O₂ = 4 × (1 ÷ 2) = 2',
      'إذن ينتج 2 mol',
    ],
    en: [
      'Mole ratio H₂O : O₂ = 2 : 1',
      'Moles of O₂ = 4 × (1 ÷ 2) = 2',
      'So 2 mol of O₂ form',
    ],
  },
  'ch-st-e4': {
    ar: [
      'من المعادلة: كل 3 mol من H₂ تعطي 2 mol من NH₃',
      'النسبة المولية H₂ : NH₃ = 3 : 2',
      'إذن النسبة المولية 3 : 2',
    ],
    en: [
      'From the equation: every 3 mol of H₂ gives 2 mol of NH₃',
      'Mole ratio H₂ : NH₃ = 3 : 2',
      'So the mole ratio is 3 : 2',
    ],
  },
  'ch-st-e5': {
    ar: [
      'M(H₂O) = 2 × 1 + 16 = 18 g/mol',
      'النسبة المئوية للأكسجين = (16 ÷ 18) × 100',
      '≈ 88.9',
      'إذن النسبة المئوية 88.9%',
    ],
    en: [
      'M(H₂O) = 2 × 1 + 16 = 18 g/mol',
      'Percentage of oxygen = (16 ÷ 18) × 100',
      '≈ 88.9',
      'So the percentage is 88.9%',
    ],
  },
  'ch-st-m3': {
    ar: [
      'M(CO₂) = 12 + 2 × 16 = 44 g/mol',
      'النسبة المئوية للكربون = (12 ÷ 44) × 100 ≈ 27.3',
      'إذن النسبة المئوية 27.3%',
    ],
    en: [
      'M(CO₂) = 12 + 2 × 16 = 44 g/mol',
      'Percentage of carbon = (12 ÷ 44) × 100 ≈ 27.3',
      'So the percentage is 27.3%',
    ],
  },
  'ch-st-m4': {
    ar: [
      'النسبة المولية CaCO₃ : HCl = 1 : 2',
      'عدد مولات HCl = 0.5 × 2 = 1',
      'إذن يلزم 1 mol',
    ],
    en: [
      'Mole ratio CaCO₃ : HCl = 1 : 2',
      'Moles of HCl = 0.5 × 2 = 1',
      'So 1 mol is needed',
    ],
  },
  'ch-st-m5': {
    ar: [
      'الصيغة الأولية هي أبسط نسبة عددية صحيحة بين الذرات',
      'نقسم أعداد الذرات في C₆H₁₂O₆ على 6: C : H : O = 1 : 2 : 1',
      'إذن الصيغة الأولية CH₂O',
    ],
    en: [
      'The empirical formula is the simplest whole-number ratio of atoms',
      'Divide the atom counts in C₆H₁₂O₆ by 6: C : H : O = 1 : 2 : 1',
      'So the empirical formula is CH₂O',
    ],
  },
  'ch-st-m6': {
    ar: [
      'M(CH₂) = 12 + 2 × 1 = 14 g/mol',
      'عدد وحدات الصيغة الأولية = 42 ÷ 14 = 3',
      'الصيغة الجزيئية = (CH₂)₃',
      'إذن الصيغة الجزيئية C₃H₆',
    ],
    en: [
      'M(CH₂) = 12 + 2 × 1 = 14 g/mol',
      'Number of empirical units = 42 ÷ 14 = 3',
      'Molecular formula = (CH₂)₃',
      'So the molecular formula is C₃H₆',
    ],
  },
  'ch-st-h3': {
    ar: [
      'n(Mg) = 12 ÷ 24 = 0.5 mol',
      'النسبة المولية Mg : MgO = 1 : 1، فينتج 0.5 mol من MgO',
      'm(MgO) = 0.5 × 40 = 20',
      'إذن كتلة MgO 20 g',
    ],
    en: [
      'n(Mg) = 12 ÷ 24 = 0.5 mol',
      'Mole ratio Mg : MgO = 1 : 1, so 0.5 mol of MgO forms',
      'm(MgO) = 0.5 × 40 = 20',
      'So the mass of MgO is 20 g',
    ],
  },
  'ch-st-h4': {
    ar: [
      'المردود المئوي = (الكتلة الفعلية ÷ الكتلة النظرية) × 100',
      '= (15 ÷ 20) × 100 = 75',
      'إذن المردود المئوي 75%',
    ],
    en: [
      'Percent yield = (actual yield ÷ theoretical yield) × 100',
      '= (15 ÷ 20) × 100 = 75',
      'So the percent yield is 75%',
    ],
  },
  'ch-th-e3': {
    ar: [
      'انخفاض درجة حرارة المحيط يعني أن التفاعل امتص حرارة منه',
      'التفاعل الذي يمتص طاقة من المحيط ماص للطاقة',
      'إذن تفاعل ماص للطاقة',
    ],
    en: [
      'The surroundings getting colder means the reaction took heat from them',
      'A reaction that absorbs energy from its surroundings is endothermic',
      'So it is an endothermic reaction',
    ],
  },
  'ch-th-e4': {
    ar: [
      'التفاعل الطارد يُطلق طاقة إلى المحيط',
      'الاحتراق يُطلق حرارة وضوءًا، أما التحلل الحراري والتمثيل الضوئي والتحليل الكهربائي فتحتاج إلى طاقة',
      'إذن التفاعل الطارد للطاقة هو احتراق الغاز الطبيعي',
    ],
    en: [
      'An exothermic reaction releases energy to the surroundings',
      'Burning gives out heat and light, while thermal decomposition, photosynthesis and electrolysis need energy',
      'So the exothermic reaction is burning natural gas',
    ],
  },
  'ch-th-e5': {
    ar: [
      'الطاقة والشغل والحرارة تُقاس بالوحدة نفسها',
      'وحدتها في النظام الدولي هي الجول',
      'إذن وحدة الطاقة الجول (J)',
    ],
    en: [
      'Energy, work and heat are measured in the same unit',
      'Its SI unit is the joule',
      'So the unit of energy is the joule (J)',
    ],
  },
  'ch-th-m3': {
    ar: [
      'q = m·c·ΔT',
      'q = 50 × 4.18 × 10',
      'إذن الطاقة الممتصة 2090 J',
    ],
    en: [
      'q = m·c·ΔT',
      'q = 50 × 4.18 × 10',
      'So the energy absorbed is 2090 J',
    ],
  },
  'ch-th-m4': {
    ar: [
      'احتراق 1 mol من CH₄ يُطلق 890 kJ',
      'الطاقة الناتجة = عدد المولات × الطاقة لكل مول = 2 × 890',
      'إذن الطاقة الناتجة 1780 kJ',
    ],
    en: [
      'Burning 1 mol of CH₄ releases 890 kJ',
      'Energy released = moles × energy per mole = 2 × 890',
      'So the energy released is 1780 kJ',
    ],
  },
  'ch-th-m5': {
    ar: [
      'ΔH = H(النواتج) − H(المتفاعلات)',
      'ΔH = 60 − 100',
      'إذن ΔH = −40 kJ',
    ],
    en: [
      'ΔH = H(products) − H(reactants)',
      'ΔH = 60 − 100',
      'So ΔH = −40 kJ',
    ],
  },
  'ch-th-m6': {
    ar: [
      'ΔH = طاقة كسر الروابط − طاقة تكوين الروابط',
      'ΔH = 500 − 650 = −150 kJ',
      'الإشارة السالبة تعني أن التفاعل طارد للطاقة',
      'إذن ΔH = −150 kJ (طارد)',
    ],
    en: [
      'ΔH = energy to break bonds − energy released forming bonds',
      'ΔH = 500 − 650 = −150 kJ',
      'The negative sign means the reaction is exothermic',
      'So ΔH = −150 kJ (exothermic)',
    ],
  },
  'ch-th-h2': {
    ar: [
      'قانون هيس: ΔH الكلي = مجموع ΔH للخطوات',
      'ΔH = (−100) + (−50)',
      'إذن ΔH = −150 kJ',
    ],
    en: [
      'Hess\'s law: overall ΔH = the sum of the ΔH of the steps',
      'ΔH = (−100) + (−50)',
      'So ΔH = −150 kJ',
    ],
  },
  'ch-th-h3': {
    ar: [
      'عكس التفاعل يعكس إشارة ΔH مع بقاء قيمتها',
      'ΔH(العكسي) = −(−200)',
      'إذن ΔH = +200 kJ',
    ],
    en: [
      'Reversing a reaction flips the sign of ΔH and keeps its size',
      'ΔH(reverse) = −(−200)',
      'So ΔH = +200 kJ',
    ],
  },
  'ch-th-h4': {
    ar: [
      'المعادلة تُظهر تكوين 2 mol من H₂O: ΔH = −572 kJ',
      'لمول واحد نقسم على 2: −572 ÷ 2',
      'إذن ΔH = −286 kJ',
    ],
    en: [
      'The equation shows 2 mol of H₂O forming: ΔH = −572 kJ',
      'For one mole we divide by 2: −572 ÷ 2',
      'So ΔH = −286 kJ',
    ],
  },
  'ch-ac-e3': {
    ar: [
      'مقياس pH يمتد من 0 إلى 14',
      'القيمة 7 هي نقطة التعادل: لا حمضي ولا قاعدي',
      'إذن المحلول محلول متعادل',
    ],
    en: [
      'The pH scale runs from 0 to 14',
      '7 is the neutral point: neither acidic nor basic',
      'So the solution is neutral',
    ],
  },
  'ch-ac-e4': {
    ar: [
      'الحمض مادة تُنتج أيونات H⁺ في الماء',
      'HCl حمض، وNaOH وKOH قاعدتان، وNaCl ملح',
      'إذن الحمض هو HCl',
    ],
    en: [
      'An acid is a substance that produces H⁺ ions in water',
      'HCl is an acid, NaOH and KOH are bases, and NaCl is a salt',
      'So the acid is HCl',
    ],
  },
  'ch-ac-e5': {
    ar: [
      'ورق عباد الشمس الأحمر لا يتغير لونه في الحمض',
      'في المحلول القاعدي يتحول إلى الأزرق',
      'إذن لونه يتحول إلى الأزرق',
    ],
    en: [
      'Red litmus paper does not change colour in an acid',
      'In a basic solution it turns blue',
      'So it turns blue',
    ],
  },
  'ch-ac-m3': {
    ar: [
      'الحمض يتأين في الماء فيعطي أيون الهيدروجين الموجب H⁺',
      'الجزء المتبقي هو أيون الكلوريد السالب Cl⁻',
      'إذن معادلة التأين: HCl → H⁺ + Cl⁻',
    ],
    en: [
      'An acid ionizes in water, giving the positive hydrogen ion H⁺',
      'The rest is the negative chloride ion Cl⁻',
      'So the ionization equation is HCl → H⁺ + Cl⁻',
    ],
  },
  'ch-ac-m4': {
    ar: [
      'القاعدة تتأين فتعطي أيون الهيدروكسيد السالب OH⁻',
      'الجزء المتبقي هو أيون الصوديوم الموجب Na⁺',
      'إذن معادلة التأين: NaOH → Na⁺ + OH⁻',
    ],
    en: [
      'A base ionizes, giving the negative hydroxide ion OH⁻',
      'The rest is the positive sodium ion Na⁺',
      'So the ionization equation is NaOH → Na⁺ + OH⁻',
    ],
  },
  'ch-ac-m5': {
    ar: [
      'الحمض القوي يتأين كليًا فيعطي أكبر عدد من الأيونات',
      'الحمض الضعيف يتأين جزئيًا فتكون أيوناته أقل',
      'التوصيل الكهربائي يزداد بزيادة عدد الأيونات',
      'إذن القوي، لأنه يتأين كليًا',
    ],
    en: [
      'A strong acid ionizes completely, giving the most ions',
      'A weak acid ionizes partly, so it has fewer ions',
      'Conductivity rises with the number of ions',
      'So the strong acid, because it ionizes completely',
    ],
  },
  'ch-ac-m6': {
    ar: [
      'حمض + قاعدة → ملح + ماء',
      'الملح من Na⁺ وSO₄²⁻ هو Na₂SO₄، ومن 2NaOH ينتج 2H₂O',
      'إذن الناتج Na₂SO₄ + 2H₂O',
    ],
    en: [
      'Acid + base → salt + water',
      'The salt of Na⁺ and SO₄²⁻ is Na₂SO₄, and 2NaOH gives 2H₂O',
      'So the products are Na₂SO₄ + 2H₂O',
    ],
  },
  'ch-ac-h2': {
    ar: [
      'احتراق الوقود ينتج أكاسيد الكبريت والنيتروجين',
      'تذوب هذه الأكاسيد في ماء المطر فتكوّن حمضي الكبريتيك والنيتريك',
      'فيصبح المطر حمضيًا',
      'إذن سبب المطر الحمضي أكاسيد الكبريت والنيتروجين المذابة في ماء المطر',
    ],
    en: [
      'Burning fuel produces oxides of sulfur and nitrogen',
      'These oxides dissolve in rainwater, forming sulfuric and nitric acids',
      'So the rain becomes acidic',
      'So acid rain is caused by oxides of sulfur and nitrogen dissolved in rainwater',
    ],
  },
  'ch-ac-h3': {
    ar: [
      'كلما ارتفع pH وحدة واحدة في المحلول القاعدي زاد تركيز OH⁻ عشرة أضعاف (المقياس لوغاريتمي)',
      'الفرق بين 12 و9 هو 3 وحدات',
      'التغير = 10 × 10 × 10 = 1000 مرة',
      'إذن pH = 12 أقوى قاعدية؛ تركيز OH⁻ فيه أكبر 1000 مرة',
    ],
    en: [
      'Each pH unit up in a basic solution raises the OH⁻ concentration tenfold (the scale is logarithmic)',
      'The difference between 12 and 9 is 3 units',
      'Change = 10 × 10 × 10 = 1000 times',
      'So pH 12 is more basic, with 1000 times more OH⁻',
    ],
  },
  'ch-ac-h4': {
    ar: [
      'H₂SO₄ + 2NaOH → Na₂SO₄ + 2H₂O',
      'النسبة المولية H₂SO₄ : NaOH = 1 : 2',
      'عدد مولات NaOH = 0.1 × 2 = 0.2',
      'إذن يلزم 0.2 mol',
    ],
    en: [
      'H₂SO₄ + 2NaOH → Na₂SO₄ + 2H₂O',
      'Mole ratio H₂SO₄ : NaOH = 1 : 2',
      'Moles of NaOH = 0.1 × 2 = 0.2',
      'So 0.2 mol is needed',
    ],
  },
  'ch-ma-e2': {
    ar: [
      'في سلسلة النشاط الكيميائي يقع Na في أعلاها، أما Cu فتحت الهيدروجين',
      'الفلز الأعلى في السلسلة أنشط',
      'إذن الأنشط Na',
    ],
    en: [
      'In the activity series Na is near the top, while Cu is below hydrogen',
      'The higher metal is more reactive',
      'So the more reactive metal is Na',
    ],
  },
  'ch-ma-e3': {
    ar: [
      'الفلز يتحد مع الأكسجين فتتكوّن مادة من الفلز والأكسجين',
      'هذه المادة هي الأكسيد',
      'إذن الناتج أكسيد الفلز',
    ],
    en: [
      'The metal combines with oxygen to give a compound of the metal and oxygen',
      'That compound is an oxide',
      'So the product is the metal oxide',
    ],
  },
  'ch-ma-e4': {
    ar: [
      'فلز + حمض مخفف → ملح + هيدروجين',
      'Mg + 2HCl → MgCl₂ + H₂',
      'إذن الغاز الناتج غاز الهيدروجين',
    ],
    en: [
      'Metal + dilute acid → salt + hydrogen',
      'Mg + 2HCl → MgCl₂ + H₂',
      'So the gas produced is hydrogen',
    ],
  },
  'ch-ma-e5': {
    ar: [
      'الفلزات القلوية مثل Na في أعلى سلسلة النشاط',
      'Cu وAg وAu أقل نشاطًا ولا تتفاعل مع الماء البارد',
      'إذن الفلز هو Na',
    ],
    en: [
      'Alkali metals such as Na are at the top of the activity series',
      'Cu, Ag and Au are less reactive and do not react with cold water',
      'So the metal is Na',
    ],
  },
  'ch-ma-m3': {
    ar: [
      'في سلسلة النشاط Mg أعلى من Zn',
      'الفلز الأنشط يحلّ محلّ الأقل نشاطًا من محلول ملحه',
      'Mg + ZnSO₄ → MgSO₄ + Zn',
      'إذن نعم، لأن Mg أنشط من Zn',
    ],
    en: [
      'In the activity series Mg is above Zn',
      'The more reactive metal displaces the less reactive one from its salt solution',
      'Mg + ZnSO₄ → MgSO₄ + Zn',
      'So yes, because Mg is more reactive than Zn',
    ],
  },
  'ch-ma-m4': {
    ar: [
      'فلز + حمض → ملح + هيدروجين',
      'Mg يعطي أيون Mg²⁺ فالملح MgCl₂',
      'إذن الناتج MgCl₂ + H₂',
    ],
    en: [
      'Metal + acid → salt + hydrogen',
      'Mg forms Mg²⁺, so the salt is MgCl₂',
      'So the products are MgCl₂ + H₂',
    ],
  },
  'ch-ma-m5': {
    ar: [
      'فلز شديد النشاط + ماء → هيدروكسيد الفلز + هيدروجين',
      '2Na + 2H₂O → 2NaOH + H₂',
      'إذن النواتج NaOH وغاز H₂',
    ],
    en: [
      'Very reactive metal + water → metal hydroxide + hydrogen',
      '2Na + 2H₂O → 2NaOH + H₂',
      'So the products are NaOH and H₂ gas',
    ],
  },
  'ch-ma-m6': {
    ar: [
      'الفلزات فوق الهيدروجين في السلسلة تحلّ محله في الحمض',
      'Zn وFe وMg فوق الهيدروجين، أما Cu فتحته',
      'إذن الفلز الذي لا يتفاعل Cu',
    ],
    en: [
      'Metals above hydrogen in the series displace it from an acid',
      'Zn, Fe and Mg are above hydrogen, while Cu is below it',
      'So the metal that does not react is Cu',
    ],
  },
  'ch-ma-h2': {
    ar: [
      'الألمنيوم نشط ويتفاعل مع الأكسجين بسرعة',
      'الأكسيد المتكوّن يلتصق بالسطح ولا يتقشر',
      'فيمنع وصول الأكسجين إلى الفلز تحته',
      'إذن تتكوّن طبقة رقيقة من أكسيد الألمنيوم تحميه',
    ],
    en: [
      'Aluminium is reactive and reacts with oxygen quickly',
      'The oxide that forms sticks to the surface and does not flake off',
      'So it stops oxygen reaching the metal beneath',
      'So a thin layer of aluminium oxide forms and protects it',
    ],
  },
  'ch-ma-h3': {
    ar: [
      'ترتيب النشاط من الأعلى: Zn ثم Fe ثم Cu',
      'التصاعدي يبدأ بالأقل نشاطًا',
      'إذن Cu < Fe < Zn',
    ],
    en: [
      'In order of activity from the top: Zn, then Fe, then Cu',
      'Increasing order starts with the least reactive',
      'So Cu < Fe < Zn',
    ],
  },
  'ch-ma-h4': {
    ar: [
      'لحماية الحديد نصله بفلز أنشط منه فيتأكسد هو بدلًا من الحديد',
      'Zn أعلى من Fe في السلسلة، أما Cu وAg وSn فأقل نشاطًا منه',
      'إذن الفلز الأنسب Zn، لأنه أنشط من الحديد فيتأكسد بدلًا منه',
    ],
    en: [
      'To protect iron we connect it to a more reactive metal, which oxidizes instead of the iron',
      'Zn is above Fe in the series, while Cu, Ag and Sn are less reactive',
      'So the best metal is Zn, because it is more reactive than iron and oxidizes in its place',
    ],
  },
  'ch-rx-e3': {
    ar: [
      'التأكسد والاختزال عمليتان متلازمتان تتضمنان انتقال الإلكترونات',
      'الفلز مثلًا يتأكسد حين يفقد إلكتروناته',
      'إذن التأكسد فقد إلكترونات',
    ],
    en: [
      'Oxidation and reduction go together and involve moving electrons',
      'A metal, for example, is oxidized when it loses electrons',
      'So oxidation is the loss of electrons',
    ],
  },
  'ch-rx-e4': {
    ar: [
      'Cu²⁺ يتحول إلى Cu: يكتسب إلكترونين (ظاهران في الطرف الأيسر)',
      'اكتساب الإلكترونات اختزال',
      'إذن اختزال، لأن Cu²⁺ يكتسب إلكترونين',
    ],
    en: [
      'Cu²⁺ becomes Cu: it gains two electrons (shown on the left)',
      'Gaining electrons is reduction',
      'So it is reduction, because Cu²⁺ gains two electrons',
    ],
  },
  'ch-rx-e5': {
    ar: [
      'القطب الذي تتأكسد عنده المادة يسمى المصعد',
      'يفقد فيه الفلز الأنشط إلكترونات',
      'إذن يحدث التأكسد عند المصعد',
    ],
    en: [
      'The electrode where a substance is oxidized is called the anode',
      'The more reactive metal loses electrons there',
      'So oxidation occurs at the anode',
    ],
  },
  'ch-rx-m3': {
    ar: [
      'في الخلية الجلفانية يوجد محلولان في نصفي خلية منفصلين',
      'تنتقل الإلكترونات في السلك، وتنتقل الأيونات عبر القنطرة',
      'فتتعادل الشحنة في كل محلول وتبقى الدائرة مغلقة',
      'إذن وظيفتها إكمال الدائرة الكهربائية وموازنة الشحنة بين المحلولين',
    ],
    en: [
      'A galvanic cell has two solutions in separate half-cells',
      'Electrons move through the wire while ions move through the bridge',
      'So the charge stays balanced in each solution and the circuit stays closed',
      'So its function is to complete the electrical circuit and balance the charge between the two solutions',
    ],
  },
  'ch-rx-m4': {
    ar: [
      'في المصهور توجد أيونات Na⁺ وCl⁻ حرة الحركة',
      'الأيون الموجب Na⁺ ينجذب إلى المهبط (القطب السالب)',
      'Na⁺ + e⁻ → Na (اختزال)',
      'إذن الناتج عند المهبط فلز الصوديوم Na',
    ],
    en: [
      'In the melt there are free Na⁺ and Cl⁻ ions',
      'The positive ion Na⁺ is attracted to the cathode (negative electrode)',
      'Na⁺ + e⁻ → Na (reduction)',
      'So the product at the cathode is sodium metal, Na',
    ],
  },
  'ch-rx-m5': {
    ar: [
      'الأيون السالب Cl⁻ ينجذب إلى المصعد (القطب الموجب)',
      '2Cl⁻ → Cl₂ + 2e⁻ (تأكسد)',
      'إذن الناتج عند المصعد غاز الكلور Cl₂',
    ],
    en: [
      'The negative ion Cl⁻ is attracted to the anode (positive electrode)',
      '2Cl⁻ → Cl₂ + 2e⁻ (oxidation)',
      'So the product at the anode is chlorine gas, Cl₂',
    ],
  },
  'ch-rx-m6': {
    ar: [
      'الفلز يترسب من المحلول على القطب الذي يحدث عنده الاختزال',
      'الاختزال يحدث عند المهبط (القطب السالب)',
      'إذن يُوصل الجسم بالقطب المهبط (القطب السالب)',
    ],
    en: [
      'The metal is deposited on the electrode where reduction occurs',
      'Reduction occurs at the cathode (negative electrode)',
      'So the object is connected to the cathode (negative electrode)',
    ],
  },
  'ch-rx-h2': {
    ar: [
      'Na يتحول إلى Na⁺: يفقد إلكترونًا فيتأكسد',
      'المادة التي تتأكسد تتسبب في اختزال غيرها، فهي العامل المختزل',
      'Cl₂ يكتسب الإلكترونات فيُختزل، وهو العامل المؤكسد',
      'إذن Na عامل مختزل لأنه يفقد إلكترونًا',
    ],
    en: [
      'Na becomes Na⁺: it loses an electron and is oxidized',
      'The substance that is oxidized causes another to be reduced, so it is the reducing agent',
      'Cl₂ gains electrons and is reduced, so it is the oxidizing agent',
      'So Na is the reducing agent because it loses an electron',
    ],
  },
  'ch-rx-h3': {
    ar: [
      'الصوديوم فلز شديد النشاط، وأيوناته لا تُختزل بسهولة بمواد كيميائية عادية',
      'مصهور مركباته يحوي أيونات حرة الحركة فيوصل الكهرباء',
      'التيار الكهربائي يختزل Na⁺ عند المهبط',
      'إذن يُستخلص بالتحليل الكهربائي لأنه فلز شديد النشاط ولا يمكن اختزال أيوناته بسهولة بمواد كيميائية عادية',
    ],
    en: [
      'Sodium is a very reactive metal, and its ions are not easily reduced by ordinary chemicals',
      'The melt of its compounds has free-moving ions, so it conducts',
      'The electric current reduces Na⁺ at the cathode',
      'So it is extracted by electrolysis because it is very reactive and its ions cannot easily be reduced by ordinary chemicals',
    ],
  },
  'ch-rx-h4': {
    ar: [
      'Zn أنشط من Cu فيتأكسد: Zn → Zn²⁺ + 2e⁻ عند المصعد',
      'تنتقل الإلكترونات عبر السلك الخارجي إلى قطب النحاس (المهبط) حيث يحدث الاختزال',
      'إذن تسري الإلكترونات من قطب الزنك (المصعد) إلى قطب النحاس (المهبط)',
    ],
    en: [
      'Zn is more reactive than Cu, so it is oxidized: Zn → Zn²⁺ + 2e⁻ at the anode',
      'The electrons travel through the external wire to the copper electrode (cathode), where reduction occurs',
      'So the electrons flow from the zinc electrode (anode) to the copper electrode (cathode)',
    ],
  },
  'ch-gn-e3': {
    ar: [
      'المادة توجد في الطبيعة بثلاث حالات رئيسية',
      'تختلف في ترتيب الجسيمات وحرية حركتها',
      'إذن الحالات الثلاث صلبة وسائلة وغازية',
    ],
    en: [
      'Matter exists in three main states',
      'They differ in how particles are arranged and how freely they move',
      'So the three states are solid, liquid and gas',
    ],
  },
  'ch-gn-e4': {
    ar: [
      'التغير الفيزيائي لا يكوّن مادة جديدة؛ يتغير الشكل أو الحالة فقط',
      'ذوبان الجليد تغير حالة من الصلب إلى السائل',
      'أما الاحتراق والصدأ والتعفن فتكوّن مواد جديدة',
      'إذن التغير الفيزيائي ذوبان الجليد',
    ],
    en: [
      'A physical change makes no new substance; only shape or state changes',
      'Melting ice is a change of state from solid to liquid',
      'Burning, rusting and rotting make new substances',
      'So the physical change is melting of ice',
    ],
  },
  'ch-gn-e5': {
    ar: [
      'رمز العنصر حرف كبير، وقد يتبعه حرف صغير',
      'رمز الصوديوم مأخوذ من اسمه اللاتيني Natrium',
      'إذن الرمز Na',
    ],
    en: [
      'An element symbol is a capital letter, sometimes followed by a small one',
      'The symbol of sodium comes from its Latin name, Natrium',
      'So the symbol is Na',
    ],
  },
  'ch-gn-m3': {
    ar: [
      'المخلوط المتجانس له تركيب واحد في أجزائه كلها ولا نرى مكوناته',
      'الملح الذائب في الماء يعطي محلولًا متجانسًا',
      'الزيت والماء والرمل والسلطة تظهر فيها مكونات منفصلة',
      'إذن المخلوط المتجانس محلول ملح الطعام في الماء',
    ],
    en: [
      'A homogeneous mixture has the same composition throughout and its parts cannot be seen',
      'Salt dissolved in water gives a uniform solution',
      'Oil and water, sand and water and a salad show separate parts',
      'So the homogeneous mixture is salt solution in water',
    ],
  },
  'ch-gn-m4': {
    ar: [
      'الملح الذائب لا يتبخر مع الماء',
      'عند تسخين المحلول يتبخر الماء ويبقى الملح الصلب',
      'إذن الطريقة التبخير',
    ],
    en: [
      'Dissolved salt does not evaporate with the water',
      'When the solution is heated the water evaporates and solid salt is left',
      'So the method is evaporation',
    ],
  },
  'ch-gn-m5': {
    ar: [
      'كتلة المحلول = 5 + 95 = 100 g',
      'التركيز الكتلي = (كتلة المذاب ÷ كتلة المحلول) × 100',
      '= (5 ÷ 100) × 100 = 5',
      'إذن التركيز الكتلي 5%',
    ],
    en: [
      'Mass of solution = 5 + 95 = 100 g',
      'Mass concentration = (mass of solute ÷ mass of solution) × 100',
      '= (5 ÷ 100) × 100 = 5',
      'So the mass concentration is 5%',
    ],
  },
  'ch-gn-m6': {
    ar: [
      'العنصر يتكون من ذرات من نوع واحد',
      'عندما ترتبط ذرتان أو أكثر معًا يتكوّن جزيء',
      'إذن الجزيء ذرتان أو أكثر مرتبطة معًا، والذرة أصغر وحدة بناء للعنصر',
    ],
    en: [
      'An element is made of one kind of atom',
      'When two or more atoms join, a molecule forms',
      'So a molecule is two or more atoms bonded together, and an atom is the smallest building unit of an element',
    ],
  },
  'ch-gn-h2': {
    ar: [
      'قانون حفظ الكتلة: كتلة المتفاعلات = كتلة النواتج',
      'كتلة المتفاعلات = 12 + 8 = 20',
      'إذن كتلة أكسيد المغنيسيوم 20 g',
    ],
    en: [
      'Conservation of mass: mass of reactants = mass of products',
      'Mass of reactants = 12 + 8 = 20',
      'So the mass of magnesium oxide is 20 g',
    ],
  },
  'ch-gn-h3': {
    ar: [
      'الكثافة = الكتلة ÷ الحجم',
      '= 50 ÷ 25',
      'إذن الكثافة 2 g/cm³',
    ],
    en: [
      'Density = mass ÷ volume',
      '= 50 ÷ 25',
      'So the density is 2 g/cm³',
    ],
  },
  'ch-gn-h4': {
    ar: [
      'كتلة المذاب = التركيز × كتلة المحلول',
      '= (10 ÷ 100) × 200',
      'إذن كتلة الملح 20 g',
    ],
    en: [
      'Mass of solute = concentration × mass of solution',
      '= (10 ÷ 100) × 200',
      'So the mass of salt is 20 g',
    ],
  },
  // ── calorimetry ──
  'ch-ca-e1': {
    ar: [
      'الحرارة النوعية خاصية للمادة تُقاس لوحدة الكتلة (1 g)',
      'أما السعة الحرارية فتُقاس للجسم كله',
      'إذن الحرارة النوعية: كمية الطاقة اللازمة لرفع درجة حرارة 1 g من المادة درجة سلسيوس واحدة',
    ],
    en: [
      'Specific heat is a property of the substance, measured per unit mass (1 g)',
      'Heat capacity, by contrast, is measured for the whole object',
      'So the specific heat is the energy needed to raise the temperature of 1 g of the substance by 1 °C',
    ],
  },
  'ch-ca-e2': {
    ar: [
      'c = q ÷ (m × ΔT)',
      'الوحدة = J ÷ (g × °C)',
      'إذن الوحدة: J/g·°C',
    ],
    en: [
      'c = q ÷ (m × ΔT)',
      'Unit = J ÷ (g × °C)',
      'So the unit of specific heat is J/g·°C',
    ],
  },
  'ch-ca-e3': {
    ar: [
      'نضع المادة في وعاء معزول يحتوي ماءً وميزان حرارة',
      'تحسب الطاقة من التغير في درجة حرارة الماء',
      'إذن الجهاز: المسعر (الكالوريميتر)',
    ],
    en: [
      'The material is placed in an insulated container holding water and a thermometer',
      'The energy is worked out from the change in the water temperature',
      'So the device is the calorimeter',
    ],
  },
  'ch-ca-e4': {
    ar: [
      'ΔT = q ÷ (m × c)، وq وm متساويان في الحالتين',
      'كلما قلّت الحرارة النوعية ارتفعت درجة الحرارة أكثر',
      'الحديد حرارته النوعية (0.45) أصغر من الماء (4.18)',
      'إذن ترتفع أكثر حرارة: الحديد',
    ],
    en: [
      'ΔT = q ÷ (m × c), and q and m are the same for both',
      'The smaller the specific heat, the larger the rise in temperature',
      'Iron has the smaller specific heat (0.45 against 4.18)',
      'So the temperature of iron rises more',
    ],
  },
  'ch-ca-e5': {
    ar: [
      'q تمثل الطاقة التي اكتسبتها المادة',
      'اكتساب الطاقة يعني q > 0',
      'إذن إشارة q: موجبة',
    ],
    en: [
      'q is the energy gained by the substance',
      'Gaining energy means q > 0',
      'So q is positive',
    ],
  },
  'ch-ca-m1': {
    ar: [
      'q = m·c·ΔT',
      'q = 150 × 4.18 × 20',
      'إذن الطاقة الممتصة 12540 J',
    ],
    en: [
      'q = m·c·ΔT',
      'q = 150 × 4.18 × 20',
      'So the energy absorbed is 12540 J',
    ],
  },
  'ch-ca-m2': {
    ar: [
      'c = q ÷ (m × ΔT)',
      'c = 1150 ÷ (50 × 50) = 1150 ÷ 2500',
      'إذن الحرارة النوعية للفلز 0.46 J/g·°C',
    ],
    en: [
      'c = q ÷ (m × ΔT)',
      'c = 1150 ÷ (50 × 50) = 1150 ÷ 2500',
      'So the specific heat of the metal is 0.46 J/g·°C',
    ],
  },
  'ch-ca-m3': {
    ar: [
      'السعة الحرارية C = q ÷ ΔT',
      'C = 2400 ÷ 6',
      'إذن السعة الحرارية 400 J/°C',
    ],
    en: [
      'Heat capacity C = q ÷ ΔT',
      'C = 2400 ÷ 6',
      'So the heat capacity is 400 J/°C',
    ],
  },
  'ch-ca-m4': {
    ar: [
      'ΔT = q ÷ (m × c) = 8360 ÷ (100 × 4.18) = 20 °C',
      'درجة الحرارة النهائية = الابتدائية + ΔT = 25 + 20',
      'إذن درجة الحرارة النهائية 45 °C',
    ],
    en: [
      'ΔT = q ÷ (m × c) = 8360 ÷ (100 × 4.18) = 20 °C',
      'Final temperature = initial + ΔT = 25 + 20',
      'So the final temperature is 45 °C',
    ],
  },
  'ch-ca-m5': {
    ar: [
      'm = q ÷ (c × ΔT)',
      'm = 6270 ÷ (4.18 × 15) = 6270 ÷ 62.7',
      'إذن كتلة الماء 100 g',
    ],
    en: [
      'm = q ÷ (c × ΔT)',
      'm = 6270 ÷ (4.18 × 15) = 6270 ÷ 62.7',
      'So the mass of the water is 100 g',
    ],
  },
  'ch-ca-m6': {
    ar: [
      'مقدار التغير في درجة الحرارة = 60 − 40 = 20 °C',
      'الطاقة المفقودة = 200 × 4.18 × 20',
      'إذن الطاقة التي فقدها الماء 16720 J',
    ],
    en: [
      'The change in temperature = 60 − 40 = 20 °C',
      'Energy lost = 200 × 4.18 × 20',
      'So the water loses 16720 J',
    ],
  },
  'ch-ca-h1': {
    ar: [
      'الطاقة التي اكتسبها الماء = 100 × 4.18 × (24 − 20) = 1672 J',
      'الطاقة التي فقدها الفلز تساويها: 1672 J، وتغير درجة حرارة الفلز = 100 − 24 = 76 °C',
      'c = 1672 ÷ (50 × 76) = 1672 ÷ 3800',
      'إذن الحرارة النوعية للفلز 0.44 J/g·°C',
    ],
    en: [
      'Energy gained by the water = 100 × 4.18 × (24 − 20) = 1672 J',
      'The metal lost the same 1672 J, and its temperature fell by 100 − 24 = 76 °C',
      'c = 1672 ÷ (50 × 76) = 1672 ÷ 3800',
      'So the specific heat of the metal is 0.44 J/g·°C',
    ],
  },
  'ch-ca-h2': {
    ar: [
      'الطاقة المفقودة من الماء الساخن = الطاقة المكتسبة للماء البارد',
      '200 × (60 − T) = 100 × (T − 30)',
      '12000 − 200T = 100T − 3000، ومنه 300T = 15000',
      'إذن درجة حرارة المزيج 50 °C',
    ],
    en: [
      'Energy lost by the hot water = energy gained by the cold water',
      '200 × (60 − T) = 100 × (T − 30)',
      '12000 − 200T = 100T − 3000, so 300T = 15000',
      'So the temperature of the mixture is 50 °C',
    ],
  },
  'ch-ca-h3': {
    ar: [
      'الطاقة التي اكتسبها الماء = 500 × 4.18 × 10 = 20900 J = 20.9 kJ',
      'الطاقة المنبعثة من الوقود = الطاقة التي اكتسبها الماء',
      'الطاقة لكل غرام = 20.9 kJ ÷ 2 g',
      'إذن الطاقة المنبعثة 10.45 kJ/g',
    ],
    en: [
      'Energy gained by the water = 500 × 4.18 × 10 = 20900 J = 20.9 kJ',
      'Energy released by the fuel = energy gained by the water',
      'Energy per gram = 20.9 kJ ÷ 2 g',
      'So the energy released is 10.45 kJ/g',
    ],
  },
  'ch-ca-h4': {
    ar: [
      'السعة الحرارية = الكتلة × الحرارة النوعية: C = m × c',
      'C = 250 × 0.8',
      'إذن السعة الحرارية 200 J/°C',
    ],
    en: [
      'Heat capacity = mass × specific heat: C = m × c',
      'C = 250 × 0.8',
      'So the heat capacity is 200 J/°C',
    ],
  },
};
