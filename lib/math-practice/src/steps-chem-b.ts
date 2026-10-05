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
};
