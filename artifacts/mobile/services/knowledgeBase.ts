/**
 * Knowledge Base — sourced from uploaded textbooks:
 *  • Chemistry Grade 10, Semester 1 (الكيمياء - الصف العاشر - الفصل الأول)
 *  • Mathematics Grade 10, Semester 1 (الرياضيات - الصف العاشر - الفصل الأول)
 *
 * This is the ONLY source iQra uses to answer questions.
 * Add more books by appending to KB_BOOKS / KB_UNITS / KB_LESSONS.
 */

export interface KBBook {
  id: string;
  gradeId: string;
  subjectId: string;
  titleAr: string;
  titleEn: string;
  semester: 1 | 2;
  source: string; // filename of the uploaded PDF
}

export interface KBUnit {
  id: string;
  bookId: string;
  order: number;
  titleAr: string;
  titleEn: string;
}

export interface KBLesson {
  id: string;
  unitId: string;
  order: number;
  titleAr: string;
  titleEn: string;
  summaryAr: string;
  summaryEn: string;
  keyConceptsAr: string[];
  keyConceptsEn: string[];
  keyTerms: Array<{ ar: string; en: string; definitionAr: string; definitionEn: string }>;
  examplesAr?: string[];
  examplesEn?: string[];
  rulesAr?: string[];
  rulesEn?: string[];
}

// ─────────────────────────────────────────────────────
// BOOKS
// ─────────────────────────────────────────────────────
export const KB_BOOKS: KBBook[] = [
  {
    id: 'kb-chem-10-s1',
    gradeId: 'grade-10',
    subjectId: 'chemistry',
    titleAr: 'الكيمياء – الصف العاشر – الفصل الأول',
    titleEn: 'Chemistry – Grade 10 – Semester 1',
    semester: 1,
    source: '10th_grade,_alchamy1st_semester_1785071530814.pdf',
  },
  {
    id: 'kb-math-10-s1',
    gradeId: 'grade-10',
    subjectId: 'mathematics',
    titleAr: 'الرياضيات – الصف العاشر – الفصل الأول',
    titleEn: 'Mathematics – Grade 10 – Semester 1',
    semester: 1,
    source: '10th_grade,_math,_1st_semester_1785071530816.pdf',
  },
];

// ─────────────────────────────────────────────────────
// CHEMISTRY GRADE 10 — UNITS
// ─────────────────────────────────────────────────────
export const KB_UNITS: KBUnit[] = [
  // CHEMISTRY
  { id: 'kbu-chem-1', bookId: 'kb-chem-10-s1', order: 1, titleAr: 'بنية الذرة وتركيبها', titleEn: 'Atomic Structure' },
  { id: 'kbu-chem-2', bookId: 'kb-chem-10-s1', order: 2, titleAr: 'الجدول الدوري وخواص العناصر', titleEn: 'Periodic Table and Properties of Elements' },
  { id: 'kbu-chem-3', bookId: 'kb-chem-10-s1', order: 3, titleAr: 'الروابط الكيميائية', titleEn: 'Chemical Bonding' },
  // MATH
  { id: 'kbu-math-1', bookId: 'kb-math-10-s1', order: 1, titleAr: 'الاقترانات', titleEn: 'Functions' },
  { id: 'kbu-math-2', bookId: 'kb-math-10-s1', order: 2, titleAr: 'الهندسة التحليلية', titleEn: 'Analytic Geometry' },
  { id: 'kbu-math-3', bookId: 'kb-math-10-s1', order: 3, titleAr: 'المثلثات', titleEn: 'Trigonometry' },
  { id: 'kbu-math-8', bookId: 'kb-math-10-s1', order: 8, titleAr: 'الاحتمال', titleEn: 'Probability' },
];

// ─────────────────────────────────────────────────────
// LESSONS — CHEMISTRY
// ─────────────────────────────────────────────────────
export const KB_LESSONS: KBLesson[] = [
  // ── UNIT 1: Atomic Structure ──────────────────────────────────
  {
    id: 'kbl-chem-1-1',
    unitId: 'kbu-chem-1',
    order: 1,
    titleAr: 'نظرية بور لذرة الهيدروجين',
    titleEn: "Bohr's Model of the Hydrogen Atom",
    summaryAr:
      'اقترح نيلز بور نموذجًا لذرة الهيدروجين يقوم على أن الإلكترونات تتحرك في مدارات محددة حول النواة. كل مدار له طاقة ثابتة. عندما ينتقل الإلكترون من مستوى طاقة أعلى إلى أدنى يُطلق طاقة على شكل فوتون، وعندما يمتص طاقة ينتقل إلى مستوى أعلى. هذا يفسر الطيف الذري لذرة الهيدروجين.',
    summaryEn:
      "Niels Bohr proposed that electrons orbit the nucleus in fixed energy levels. When an electron jumps from a higher to a lower energy level it emits a photon of light (emission), and when it absorbs energy it jumps to a higher level. This explains the discrete line spectrum of hydrogen. The energy of each orbit is: E = −13.6 / n² eV, where n is the principal quantum number.",
    keyConceptsAr: [
      'مستويات الطاقة (n = 1, 2, 3, ...)',
      'انتقال الإلكترون بين المستويات',
      'الطيف الخطي للانبعاث',
      'الطيف الذري للهيدروجين',
      'الطاقة المنبعثة = hf',
    ],
    keyConceptsEn: [
      'Energy levels (n = 1, 2, 3, ...)',
      'Electron transitions between levels',
      'Line emission spectrum',
      'Hydrogen atomic spectrum',
      'Energy emitted = hf (Planck equation)',
    ],
    keyTerms: [
      {
        ar: 'الطيف الخطي',
        en: 'Line Emission Spectrum',
        definitionAr: 'مجموعة من الأطوال الموجية المحددة تصدر عن الذرات المثارة',
        definitionEn: 'A set of discrete wavelengths emitted by excited atoms as electrons return to lower energy levels',
      },
      {
        ar: 'الطيف الذري',
        en: 'Atomic Spectrum',
        definitionAr: 'الطيف الصادر عن ذرات العناصر المثارة في الحالة الغازية',
        definitionEn: 'The spectrum emitted by excited atoms of an element in the gaseous state',
      },
      {
        ar: 'الفوتون',
        en: 'Photon',
        definitionAr: 'حزمة من الطاقة الكهرومغناطيسية تُطلق أو تُمتص عند انتقال الإلكترون',
        definitionEn: 'A quantum of electromagnetic energy emitted or absorbed during electron transitions',
      },
      {
        ar: 'الكم',
        en: 'Quantum',
        definitionAr: 'مقدار محدد من الطاقة ينبعث من الذرة المثارة نتيجة انتقال الإلكترون',
        definitionEn: 'A discrete packet of energy emitted when an electron transitions between energy levels',
      },
    ],
    rulesAr: [
      'طاقة المستوى: E = −13.6 / n² إلكترون فولت',
      'كلما زادت n ابتعد المستوى عن النواة وزادت طاقته',
      'الانتقال إلى مستوى أدنى = انبعاث ضوء',
      'الانتقال إلى مستوى أعلى = امتصاص طاقة',
    ],
    rulesEn: [
      'Energy of level n: E = −13.6 / n² eV',
      'Higher n = farther from nucleus, higher energy',
      'Transition to lower level → photon emission (light)',
      'Transition to higher level → energy absorption',
    ],
  },
  {
    id: 'kbl-chem-1-2',
    unitId: 'kbu-chem-1',
    order: 2,
    titleAr: 'النموذج الميكانيكي الموجي للذرة',
    titleEn: 'Wave-Mechanical Model of the Atom',
    summaryAr:
      'يستند النموذج الميكانيكي الموجي على أن الإلكترون يمتلك طبيعة جسيمية وموجية في آنٍ واحد. لا يمكن تحديد مكان الإلكترون وسرعته معًا بدقة (مبدأ هايزنبرغ). بدلًا من المدارات، تُستخدم الأفلاك (Orbitals) وهي مناطق ثلاثية الأبعاد حول النواة يكون فيها احتمال وجود الإلكترون أكبر ما يمكن. تُوصف الأفلاك بأربعة أعداد كمية.',
    summaryEn:
      'The wave-mechanical model treats the electron as both a particle and a wave. It is impossible to simultaneously know the exact position and momentum of an electron (Heisenberg Uncertainty Principle). Instead of fixed orbits, electrons occupy orbitals — three-dimensional regions of high electron probability. Orbitals are described by four quantum numbers and come in types: s (spherical), p (dumbbell), d, and f.',
    keyConceptsAr: [
      'مبدأ هايزنبرغ للشك',
      'الأفلاك: s و p و d و f',
      'الأعداد الكمية: الرئيسي n، الثانوي l، المغناطيسي ml، الغزلي ms',
      'مبدأ أوفباو',
      'قاعدة هوند',
      'مبدأ باولي للاستبعاد',
    ],
    keyConceptsEn: [
      "Heisenberg's Uncertainty Principle",
      'Orbitals: s, p, d, f types',
      'Quantum numbers: principal n, azimuthal l, magnetic ml, spin ms',
      'Aufbau principle',
      "Hund's rule",
      'Pauli exclusion principle',
    ],
    keyTerms: [
      {
        ar: 'الفلك',
        en: 'Orbital',
        definitionAr: 'منطقة فراغية حول النواة يكون فيها احتمال وجود الإلكترونات أكبر ما يمكن',
        definitionEn: 'A region of space around the nucleus where there is the highest probability of finding electrons',
      },
      {
        ar: 'مبدأ أوفباو',
        en: 'Aufbau Principle',
        definitionAr: 'امتلاء الأفلاك بالإلكترونات وفقًا لتزايد طاقاتها من الأدنى إلى الأعلى',
        definitionEn: 'Electrons fill orbitals starting from the lowest energy level, then progressively higher levels',
      },
      {
        ar: 'قاعدة هوند',
        en: "Hund's Rule",
        definitionAr: 'توزع الإلكترونات بصورة منفردة على أفلاك المستوى الفرعي الواحد قبل الاقتران',
        definitionEn: 'Electrons occupy orbitals of the same subshell singly before pairing, with parallel spins',
      },
      {
        ar: 'مبدأ باولي',
        en: 'Pauli Exclusion Principle',
        definitionAr: 'لا يمكن لإلكترونين في نفس الذرة أن يكون لهما نفس الأعداد الكمية الأربعة',
        definitionEn: 'No two electrons in an atom can have identical sets of all four quantum numbers',
      },
    ],
    rulesAr: [
      'المستوى الفرعي s يتسع لـ 2 إلكترون',
      'المستوى الفرعي p يتسع لـ 6 إلكترونات',
      'المستوى الفرعي d يتسع لـ 10 إلكترونات',
      'المستوى الفرعي f يتسع لـ 14 إلكترونًا',
      'ترتيب الملء: 1s 2s 2p 3s 3p 4s 3d 4p 5s 4d 5p 6s 4f 5d 6p',
    ],
    rulesEn: [
      's subshell holds up to 2 electrons',
      'p subshell holds up to 6 electrons',
      'd subshell holds up to 10 electrons',
      'f subshell holds up to 14 electrons',
      'Filling order (Aufbau): 1s 2s 2p 3s 3p 4s 3d 4p 5s 4d 5p',
    ],
  },

  // ── UNIT 3: Chemical Bonding ────────────────────────────────
  {
    id: 'kbl-chem-3-1',
    unitId: 'kbu-chem-3',
    order: 1,
    titleAr: 'الرابطة الأيونية',
    titleEn: 'Ionic Bonding',
    summaryAr:
      'تنشأ الرابطة الأيونية بانتقال إلكترون أو أكثر من ذرة فلز إلى ذرة لافلز، مما يؤدي إلى تكوين أيونات موجبة وسالبة تتجاذب كهرباتيًا. المركبات الأيونية عادة ذات نقطة انصهار عالية وتوصل الكهرباء عند الذوبان أو الصهر.',
    summaryEn:
      'Ionic bonds form when one or more electrons are transferred from a metal atom to a non-metal atom, creating positive cations and negative anions that attract each other electrostatically. Ionic compounds typically have high melting points and conduct electricity when dissolved or melted.',
    keyConceptsAr: ['انتقال الإلكترونات', 'الأيونات الموجبة والسالبة', 'قوة التجاذب الكهرباتي', 'خواص المركبات الأيونية'],
    keyConceptsEn: ['Electron transfer', 'Cations and anions', 'Electrostatic attraction', 'Properties of ionic compounds'],
    keyTerms: [
      {
        ar: 'المركبات الأيونية',
        en: 'Ionic Compounds',
        definitionAr: 'مركبات تنشأ عن تجاذب الأيونات الموجبة والسالبة في البلورة الصلبة',
        definitionEn: 'Compounds formed by electrostatic attraction between positive and negative ions in a crystal lattice',
      },
      {
        ar: 'طاقة الشبكة البلورية',
        en: 'Lattice Energy',
        definitionAr: 'الطاقة اللازمة لتفكيك الشبكة البلورية الصلبة إلى أيونات منفصلة في الطور الغازي',
        definitionEn: 'The energy required to separate one mole of solid ionic compound into its gaseous ions',
      },
    ],
  },
  {
    id: 'kbl-chem-3-2',
    unitId: 'kbu-chem-3',
    order: 2,
    titleAr: 'الرابطة التساهمية',
    titleEn: 'Covalent Bonding',
    summaryAr:
      'تنشأ الرابطة التساهمية بتشارك ذرتين أو أكثر في زوج أو أكثر من الإلكترونات. الرابطة الأحادية: زوج واحد مشترك. الرابطة الثنائية: زوجان مشتركان. الرابطة الثلاثية: ثلاثة أزواج مشتركة. رابطة سيجما (σ) تنشأ من التداخل الرأسي، ورابطة باي (π) تنشأ من التداخل الجانبي بين الأفلاك p.',
    summaryEn:
      'Covalent bonds form when atoms share pairs of electrons. A single bond shares one pair, a double bond two pairs, and a triple bond three pairs. Sigma (σ) bonds form by head-on orbital overlap; pi (π) bonds form by side-to-side p orbital overlap. Examples: H₂ (single), O₂ (double), N₂ (triple).',
    keyConceptsAr: [
      'الرابطة الأحادية (زوج إلكتروني واحد)',
      'الرابطة الثنائية (زوجان إلكترونيان)',
      'الرابطة الثلاثية (ثلاثة أزواج)',
      'رابطة سيجما σ: تداخل رأسي',
      'رابطة باي π: تداخل جانبي',
    ],
    keyConceptsEn: [
      'Single bond — one shared electron pair',
      'Double bond — two shared pairs (one σ + one π)',
      'Triple bond — three shared pairs (one σ + two π)',
      'Sigma bond: head-on overlap',
      'Pi bond: lateral p-orbital overlap',
    ],
    keyTerms: [
      {
        ar: 'رابطة سيجما',
        en: 'Sigma Bond (σ)',
        definitionAr: 'رابطة تنشأ من التداخل الرأسي بين الأفلاك s-s أو s-p أو p-p',
        definitionEn: 'A bond formed by head-on (axial) overlap of orbitals: s-s, s-p, or p-p',
      },
      {
        ar: 'رابطة باي',
        en: 'Pi Bond (π)',
        definitionAr: 'رابطة تنشأ من التداخل الجانبي بين فلكَي p متوازيَين',
        definitionEn: 'A bond formed by lateral (side-to-side) overlap of two parallel p orbitals',
      },
      {
        ar: 'المركبات الجزيئية',
        en: 'Molecular Compounds',
        definitionAr: 'المركبات الناتجة من تشارك ذرات العناصر اللافلزية في إلكترونات التكافؤ',
        definitionEn: 'Compounds formed when non-metallic atoms share valence electrons',
      },
    ],
    examplesAr: ['H₂: رابطة تساهمية أحادية بين ذرتَي هيدروجين', 'O₂: رابطة تساهمية ثنائية', 'N₂: رابطة تساهمية ثلاثية', 'CO₂: ذرة C مرتبطة بذرتَي O برابطتين ثنائيتين'],
    examplesEn: ['H₂: single covalent bond between two H atoms', 'O₂: double covalent bond', 'N₂: triple covalent bond', 'CO₂: carbon with two double bonds to oxygen atoms'],
  },
  {
    id: 'kbl-chem-3-3',
    unitId: 'kbu-chem-3',
    order: 3,
    titleAr: 'الرابطة الفلزية',
    titleEn: 'Metallic Bonding',
    summaryAr:
      'الرابطة الفلزية هي قوة التجاذب بين الأيونات الموجبة للفلزات والإلكترونات الحرة الحركة (بحر الإلكترونات). تنشأ عندما تفقد ذرات الفلز إلكترونات التكافؤ فتتحول إلى أيونات موجبة يحيط بها بحر من الإلكترونات الحرة. تُفسر هذه الرابطة التوصيل الكهربائي والحراري وليونة الفلزات.',
    summaryEn:
      "Metallic bonding is the electrostatic attraction between positive metal cations and a 'sea' of free-moving (delocalized) electrons. Metal atoms lose their valence electrons to form positive ions surrounded by mobile electrons. This explains metals' high electrical and thermal conductivity, malleability, and ductility.",
    keyConceptsAr: ['بحر الإلكترونات', 'الأيونات الموجبة للفلزات', 'التوصيل الكهربائي والحراري', 'الليونة والمطيلية'],
    keyConceptsEn: ['Sea of electrons (delocalized)', 'Positive metal cations', 'Electrical and thermal conductivity', 'Malleability and ductility'],
    keyTerms: [
      {
        ar: 'الرابطة الفلزية',
        en: 'Metallic Bond',
        definitionAr: 'قوة التجاذب بين الأيونات الموجبة للفلزات والإلكترونات الحرة في الشبكة البلورية',
        definitionEn: 'The attraction between positive metal ions and the delocalized sea of electrons in the crystal lattice',
      },
    ],
  },

  // ── MATH UNIT 1: Functions ────────────────────────────────────
  {
    id: 'kbl-math-1-1',
    unitId: 'kbu-math-1',
    order: 1,
    titleAr: 'كثيرات الحدود وخصائصها',
    titleEn: 'Polynomial Functions and Their Properties',
    summaryAr:
      'كثير الحدود هو اقتران من الشكل f(x) = aₙxⁿ + aₙ₋₁xⁿ⁻¹ + ... + a₁x + a₀، حيث n عدد صحيح غير سالب والمعاملات أعداد حقيقية. درجة كثير الحدود هي أعلى أس. يمكن جمع كثيرات الحدود وطرحها وضربها وقسمتها. تُمثَّل بيانيًا بمنحنيات سلسة. من تطبيقاتها نمذجة العلاقات الاقتصادية والفيزيائية.',
    summaryEn:
      'A polynomial function has the form f(x) = aₙxⁿ + aₙ₋₁xⁿ⁻¹ + ... + a₁x + a₀, where n is a non-negative integer and coefficients are real numbers. The degree is the highest power. Polynomials can be added, subtracted, multiplied, and divided. Their graphs are smooth continuous curves. They model many real-world relationships such as cost-production and physical phenomena.',
    keyConceptsAr: [
      'درجة كثير الحدود',
      'المعامل الرئيسي',
      'جمع وطرح وضرب كثيرات الحدود',
      'قسمة كثيرات الحدود (الطريقة الطويلة وطريقة هورنر)',
      'التمثيل البياني',
      'الأصفار والجذور',
    ],
    keyConceptsEn: [
      'Degree of polynomial',
      'Leading coefficient',
      'Adding, subtracting, multiplying polynomials',
      'Dividing polynomials (long division & synthetic division)',
      'Graphing polynomial functions',
      'Zeros and roots',
    ],
    keyTerms: [
      {
        ar: 'كثير الحدود',
        en: 'Polynomial',
        definitionAr: 'اقتران رياضي يتكون من حدود على الشكل aₙxⁿ حيث n عدد صحيح غير سالب',
        definitionEn: 'A mathematical function consisting of terms of the form aₙxⁿ where n is a non-negative integer',
      },
      {
        ar: 'الجذر (الصفر)',
        en: 'Root / Zero',
        definitionAr: 'القيمة التي تجعل كثير الحدود يساوي صفرًا: f(x) = 0',
        definitionEn: 'A value of x where the polynomial equals zero: f(x) = 0',
      },
    ],
    examplesAr: [
      'f(x) = 3x³ − 2x² + x − 5: درجته 3، معامله الرئيسي 3',
      'جمع: (x² + 2x) + (3x − 1) = x² + 5x − 1',
      'ضرب: (x + 2)(x − 3) = x² − x − 6',
    ],
    examplesEn: [
      'f(x) = 3x³ − 2x² + x − 5: degree 3, leading coefficient 3',
      'Addition: (x² + 2x) + (3x − 1) = x² + 5x − 1',
      'Multiplication: (x + 2)(x − 3) = x² − x − 6',
    ],
  },
  {
    id: 'kbl-math-1-2',
    unitId: 'kbu-math-1',
    order: 2,
    titleAr: 'الاقترانات النسبية',
    titleEn: 'Rational Functions',
    summaryAr:
      'الاقتران النسبي هو اقتران من الشكل f(x) = P(x)/Q(x) حيث P وQ كثيرا حدود وQ(x) ≠ 0. المجال هو مجموعة جميع الأعداد الحقيقية باستثناء قيم x التي تجعل المقام صفرًا. قد يحتوي على مقاربات رأسية وأفقية ومائلة.',
    summaryEn:
      'A rational function has the form f(x) = P(x)/Q(x) where P and Q are polynomials and Q(x) ≠ 0. The domain excludes values that make the denominator zero. The function may have vertical, horizontal, or oblique asymptotes.',
    keyConceptsAr: ['مجال الاقتران النسبي', 'المقاربة الرأسية', 'المقاربة الأفقية', 'مدى الاقتران النسبي'],
    keyConceptsEn: ['Domain of rational function', 'Vertical asymptote', 'Horizontal asymptote', 'Range of rational function'],
    keyTerms: [
      {
        ar: 'المقاربة الرأسية',
        en: 'Vertical Asymptote',
        definitionAr: 'خط رأسي x = a تقترب منه قيم الاقتران دون أن تصله عندما يقترب x من a',
        definitionEn: 'A vertical line x = a that the function approaches but never reaches as x approaches a',
      },
      {
        ar: 'المقاربة الأفقية',
        en: 'Horizontal Asymptote',
        definitionAr: 'خط أفقي y = b تقترب منه قيم الاقتران عندما تتجه x نحو ما لا نهاية',
        definitionEn: 'A horizontal line y = b the function approaches as x goes to infinity',
      },
    ],
    examplesAr: [
      'f(x) = 1/(x − 2): مجاله ℝ \\ {2}، مقاربة رأسية x = 2',
      'f(x) = (x + 1)/(x² − 4): مجاله ℝ \\ {2, −2}',
    ],
    examplesEn: [
      'f(x) = 1/(x − 2): domain ℝ \\ {2}, vertical asymptote at x = 2',
      'f(x) = (x + 1)/(x² − 4): domain ℝ \\ {2, −2}',
    ],
  },
  {
    id: 'kbl-math-1-3',
    unitId: 'kbu-math-1',
    order: 3,
    titleAr: 'تركيب الاقترانات والاقتران العكسي والاقتران الجذري',
    titleEn: 'Function Composition, Inverse, and Radical Functions',
    summaryAr:
      'تركيب الاقترانات: (f∘g)(x) = f(g(x))، نطبق g أولًا ثم f. الاقتران العكسي f⁻¹ يعكس العلاقة: إذا كان f(a) = b فإن f⁻¹(b) = a، وشرطه أن يكون الاقتران تقابلًا (1-1 وعلى). الاقتران الجذري: f(x) = √x له مجال x ≥ 0.',
    summaryEn:
      "Function composition: (f∘g)(x) = f(g(x)) — apply g first, then f. The inverse function f⁻¹ reverses the mapping: if f(a) = b then f⁻¹(b) = a. An inverse exists only when f is bijective (one-to-one and onto). Radical function: f(x) = √x has domain x ≥ 0. The graph of f⁻¹ is the reflection of f's graph across y = x.",
    keyConceptsAr: ['تركيب الاقترانات f∘g', 'الاقتران العكسي f⁻¹', 'شرط وجود الاقتران العكسي', 'الاقتران الجذري √x', 'انعكاس الرسم البياني حول y = x'],
    keyConceptsEn: ['Function composition (f∘g)', 'Inverse function f⁻¹', 'Conditions for inverse to exist', 'Radical function √x', 'Graph reflection across y = x'],
    keyTerms: [
      {
        ar: 'تركيب الاقترانات',
        en: 'Function Composition',
        definitionAr: '(f∘g)(x) = f(g(x)): تطبيق g أولًا ثم f على النتيجة',
        definitionEn: '(f∘g)(x) = f(g(x)): apply g first, then apply f to the result',
      },
      {
        ar: 'الاقتران العكسي',
        en: 'Inverse Function',
        definitionAr: 'f⁻¹ هو الاقتران الذي يعكس تأثير f: f(f⁻¹(x)) = x',
        definitionEn: 'f⁻¹ reverses the effect of f: f(f⁻¹(x)) = x for all x in the domain',
      },
    ],
    examplesAr: [
      'إذا f(x) = x + 3 و g(x) = 2x، فإن (f∘g)(x) = 2x + 3',
      'عكس f(x) = 2x − 4 هو f⁻¹(x) = (x + 4)/2',
    ],
    examplesEn: [
      'If f(x) = x + 3 and g(x) = 2x, then (f∘g)(x) = 2x + 3',
      'Inverse of f(x) = 2x − 4 is f⁻¹(x) = (x + 4)/2',
    ],
  },

  // ── MATH UNIT 8: Probability ──────────────────────────────────
  {
    id: 'kbl-math-8-1',
    unitId: 'kbu-math-8',
    order: 1,
    titleAr: 'مفاهيم الاحتمال الأساسية',
    titleEn: 'Basic Concepts of Probability',
    summaryAr:
      'التجربة العشوائية هي تجربة لا يمكن التنبؤ بنتيجتها مسبقًا. فضاء العينة (Ω) هو مجموعة جميع النتائج الممكنة. الحادث هو جزء من فضاء العينة. احتمال الحادث E يساوي: P(E) = n(E) / n(Ω). احتمال أي حادث يقع بين 0 و1.',
    summaryEn:
      'A random experiment is one whose outcome cannot be predicted with certainty. The sample space Ω is the set of all possible outcomes. An event E is a subset of the sample space. Probability: P(E) = n(E)/n(Ω). For any event: 0 ≤ P(E) ≤ 1.',
    keyConceptsAr: ['التجربة العشوائية', 'فضاء العينة Ω', 'الحادث البسيط والمركب', 'احتمال الحادث: n(E)/n(Ω)', 'متممة الحادث: P(Ā) = 1 − P(A)'],
    keyConceptsEn: ['Random experiment', 'Sample space Ω', 'Simple and compound events', 'P(E) = n(E)/n(Ω)', 'Complement: P(Ā) = 1 − P(A)'],
    keyTerms: [
      {
        ar: 'فضاء العينة',
        en: 'Sample Space',
        definitionAr: 'مجموعة جميع النتائج الممكنة للتجربة العشوائية، يرمز لها بـ Ω',
        definitionEn: 'The set of all possible outcomes of a random experiment, denoted Ω (omega)',
      },
      {
        ar: 'الحادث',
        en: 'Event',
        definitionAr: 'جزء (مجموعة جزئية) من فضاء العينة',
        definitionEn: 'A subset of the sample space',
      },
      {
        ar: 'متممة الحادث',
        en: 'Complementary Event',
        definitionAr: 'P(Ā) = 1 − P(A): احتمال عدم وقوع الحادث A',
        definitionEn: "P(Ā) = 1 − P(A): the probability that event A does not occur",
      },
    ],
    rulesAr: ['P(E) = n(E) / n(Ω)', 'P(Ā) = 1 − P(A)', '0 ≤ P(E) ≤ 1', 'P(Ω) = 1', 'P(∅) = 0'],
    rulesEn: ['P(E) = n(E) / n(Ω)', 'P(Ā) = 1 − P(A)', '0 ≤ P(E) ≤ 1', 'P(Ω) = 1', 'P(∅) = 0'],
  },
  {
    id: 'kbl-math-8-2',
    unitId: 'kbu-math-8',
    order: 2,
    titleAr: 'الحوادث المتنافية وغير المتنافية',
    titleEn: 'Mutually Exclusive and Non-Exclusive Events',
    summaryAr:
      'الحادثان المتنافيان A وB لا يمكن وقوعهما معًا: A ∩ B = ∅، لذا P(A ∩ B) = 0. في هذه الحالة: P(A ∪ B) = P(A) + P(B). الحادثان غير المتنافيين يمكنهما الوقوع معًا: P(A ∪ B) = P(A) + P(B) − P(A ∩ B).',
    summaryEn:
      'Two events A and B are mutually exclusive if they cannot occur simultaneously: A ∩ B = ∅, so P(A ∩ B) = 0. Then: P(A ∪ B) = P(A) + P(B). For non-mutually exclusive events: P(A ∪ B) = P(A) + P(B) − P(A ∩ B). This avoids double-counting the intersection.',
    keyConceptsAr: [
      'الحوادث المتنافية: A ∩ B = ∅',
      'P(A ∪ B) = P(A) + P(B) للمتنافية',
      'الحوادث غير المتنافية',
      'P(A ∪ B) = P(A) + P(B) − P(A ∩ B)',
    ],
    keyConceptsEn: [
      'Mutually exclusive: A ∩ B = ∅',
      'P(A ∪ B) = P(A) + P(B) for mutually exclusive events',
      'Non-mutually exclusive events',
      'P(A ∪ B) = P(A) + P(B) − P(A ∩ B)',
    ],
    keyTerms: [
      {
        ar: 'الحوادث المتنافية',
        en: 'Mutually Exclusive Events',
        definitionAr: 'حادثان لا يمكن وقوعهما معًا في نفس الوقت: A ∩ B = ∅',
        definitionEn: 'Two events that cannot occur at the same time: A ∩ B = ∅',
      },
    ],
    rulesAr: [
      'للحوادث المتنافية: P(A ∪ B) = P(A) + P(B)',
      'للحوادث غير المتنافية: P(A ∪ B) = P(A) + P(B) − P(A ∩ B)',
      'P(A ∩ B) = 0 إذا كانا متنافيَين',
    ],
    rulesEn: [
      'Mutually exclusive: P(A ∪ B) = P(A) + P(B)',
      'Non-mutually exclusive: P(A ∪ B) = P(A) + P(B) − P(A ∩ B)',
      'P(A ∩ B) = 0 if mutually exclusive',
    ],
    examplesAr: [
      'إلقاء حجر نرد: ظهور 1 وظهور عدد زوجي → متنافيان. P(A∪B) = 1/6 + 3/6 = 4/6 = 2/3',
      'ظهور عدد زوجي وعدد أقل من 3 → غير متنافيَين (يشتركان في 2). P(A∪B) = 3/6 + 2/6 − 1/6 = 4/6',
    ],
    examplesEn: [
      'Rolling a die: getting 1 AND getting an even number → mutually exclusive. P(A∪B) = 1/6 + 3/6 = 2/3',
      'Getting even AND less than 3 → non-exclusive (share 2). P(A∪B) = 3/6 + 2/6 − 1/6 = 4/6',
    ],
  },
];

// ─────────────────────────────────────────────────────
// SEARCH UTILITIES
// ─────────────────────────────────────────────────────

/** Strip the most common Arabic one- or two-letter prefixes from a single word. */
function stripArabicPrefix(word: string): string {
  // Order matters: try two-letter prefixes first
  const prefixes = ['ال', 'وال', 'بال', 'لل', 'فال', 'و', 'ب', 'ل', 'ف', 'ك'];
  for (const p of prefixes) {
    if (word.startsWith(p) && word.length > p.length + 1) {
      return word.slice(p.length);
    }
  }
  return word;
}

/** Tokenise + normalise a string for fuzzy matching. */
function normalizeTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s،,،.。]+/)
    .map(w => w.trim())
    .filter(Boolean)
    .map(stripArabicPrefix);
}

/**
 * Score a single query against a single field string.
 * Exact full-string match = 2× the per-token score.
 * Token exact match = full weight; token substring = half weight.
 */
function scoreField(query: string, field: string, weight: number): number {
  const fieldLower = field.toLowerCase();
  const queryLower = query.toLowerCase();

  // Full string exact / substring match
  if (fieldLower.includes(queryLower)) return weight * 2;

  // Token-level match
  const qTokens = normalizeTokens(query);
  const fTokens = normalizeTokens(field);
  if (qTokens.length === 0 || fTokens.length === 0) return 0;

  let score = 0;
  for (const qt of qTokens) {
    if (qt.length < 2) continue; // skip very short tokens
    let best = 0;
    for (const ft of fTokens) {
      if (ft === qt) { best = Math.max(best, weight); }
      else if (ft.includes(qt) || qt.includes(ft)) { best = Math.max(best, weight * 0.5); }
    }
    score += best;
  }
  return score;
}

/**
 * Search the knowledge base for relevant lessons matching a query.
 * Handles Arabic prefix variation (الرابطة matches رابطة) and partial word matches.
 * Returns ranked results (most relevant first).
 */
export function searchKB(query: string, lang: 'ar' | 'en' = 'ar'): KBLesson[] {
  const q = query.trim();
  if (!q) return [];

  const scored = KB_LESSONS.map(lesson => {
    let score = 0;

    const title   = lang === 'ar' ? lesson.titleAr   : lesson.titleEn;
    const summary = lang === 'ar' ? lesson.summaryAr  : lesson.summaryEn;
    const concepts = lang === 'ar' ? lesson.keyConceptsAr : lesson.keyConceptsEn;
    const terms   = lesson.keyTerms.map(t => lang === 'ar' ? t.ar : t.en);

    score += scoreField(q, title,   10);
    concepts.forEach(c => { score += scoreField(q, c, 4); });
    terms.forEach(t =>    { score += scoreField(q, t, 3); });
    score += scoreField(q, summary, 2);

    // Always cross-check English side to handle mixed / transliterated queries
    score += scoreField(q, lesson.titleEn, 5);
    lesson.keyConceptsEn.forEach(c => { score += scoreField(q, c, 2); });
    lesson.keyTerms.forEach(t => {
      score += scoreField(q, t.en, 2);
      score += scoreField(q, t.definitionEn, 1);
    });

    return { lesson, score };
  });

  return scored
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .map(s => s.lesson);
}

/**
 * Fetch a single lesson by its ID — used when suggestion chips are pinned
 * directly to a lesson so the result is guaranteed.
 */
export function getLessonById(id: string): KBLesson | undefined {
  return KB_LESSONS.find(l => l.id === id);
}

/**
 * Get the book for a lesson (traverses unit → book).
 */
export function getBookForLesson(lesson: KBLesson): KBBook | undefined {
  const unit = KB_UNITS.find(u => u.id === lesson.unitId);
  if (!unit) return undefined;
  return KB_BOOKS.find(b => b.id === unit.bookId);
}

export function getUnitForLesson(lesson: KBLesson): KBUnit | undefined {
  return KB_UNITS.find(u => u.id === lesson.unitId);
}

export function getLessonsForBook(bookId: string): KBLesson[] {
  const unitIds = KB_UNITS.filter(u => u.bookId === bookId).map(u => u.id);
  return KB_LESSONS.filter(l => unitIds.includes(l.unitId));
}
