/**
 * Knowledge Base — sourced from uploaded textbooks:
 *  • Chemistry Grade 10, Semester 1 (الكيمياء - الصف العاشر - الفصل الأول)
 *  • Mathematics Grade 10, Semester 1 (الرياضيات - الصف العاشر - الفصل الأول)
 *  • Mathematics Grade 10, Semester 2 (الرياضيات - الصف العاشر - الفصل الثاني)
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
  source: string;
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
  {
    id: 'kb-math-10-s2',
    gradeId: 'grade-10',
    subjectId: 'mathematics',
    titleAr: 'الرياضيات – الصف العاشر – الفصل الثاني',
    titleEn: 'Mathematics – Grade 10 – Semester 2',
    semester: 2,
    source: '10th_grade,_math,_2nd_semester_1785147978008.pdf',
  },
];

// ─────────────────────────────────────────────────────
// UNITS
// ─────────────────────────────────────────────────────
export const KB_UNITS: KBUnit[] = [
  // ── CHEMISTRY ──────────────────────────────────────
  { id: 'kbu-chem-1', bookId: 'kb-chem-10-s1', order: 1, titleAr: 'بنية الذرة وتركيبها', titleEn: 'Atomic Structure' },
  { id: 'kbu-chem-2', bookId: 'kb-chem-10-s1', order: 2, titleAr: 'الجدول الدوري وخواص العناصر', titleEn: 'Periodic Table and Properties of Elements' },
  { id: 'kbu-chem-3', bookId: 'kb-chem-10-s1', order: 3, titleAr: 'الروابط الكيميائية', titleEn: 'Chemical Bonding' },

  // ── MATH S1: Units 5–8 (Jordan curriculum numbering) ──
  { id: 'kbu-math-1', bookId: 'kb-math-10-s1', order: 5, titleAr: 'الاقترانات', titleEn: 'Functions' },
  { id: 'kbu-math-2', bookId: 'kb-math-10-s1', order: 6, titleAr: 'المشتقات', titleEn: 'Derivatives' },
  { id: 'kbu-math-3', bookId: 'kb-math-10-s1', order: 7, titleAr: 'المتجهات', titleEn: 'Vectors' },
  { id: 'kbu-math-8', bookId: 'kb-math-10-s1', order: 8, titleAr: 'الإحصاء والاحتمالات', titleEn: 'Statistics and Probability' },

  // ── MATH S2: Units 1–4 (Jordan curriculum numbering) ──
  { id: 'kbu-math-s2-1', bookId: 'kb-math-10-s2', order: 1, titleAr: 'المعادلات', titleEn: 'Equations' },
  { id: 'kbu-math-s2-2', bookId: 'kb-math-10-s2', order: 2, titleAr: 'الدائرة', titleEn: 'The Circle' },
  { id: 'kbu-math-s2-3', bookId: 'kb-math-10-s2', order: 3, titleAr: 'حساب المثلثات', titleEn: 'Trigonometry' },
  { id: 'kbu-math-s2-4', bookId: 'kb-math-10-s2', order: 4, titleAr: 'تطبيقات المثلثات', titleEn: 'Applications of Trigonometry' },
];

// ─────────────────────────────────────────────────────
// LESSONS — CHEMISTRY
// ─────────────────────────────────────────────────────
export const KB_LESSONS: KBLesson[] = [

  // ══════════════════════════════════════════════════════
  // CHEMISTRY
  // ══════════════════════════════════════════════════════

  // ── Unit 1: Atomic Structure ──────────────────────────
  {
    id: 'kbl-chem-1-1',
    unitId: 'kbu-chem-1',
    order: 1,
    titleAr: 'نظرية بور لذرة الهيدروجين',
    titleEn: "Bohr's Model of the Hydrogen Atom",
    summaryAr:
      'اقترح نيلز بور نموذجًا لذرة الهيدروجين يقوم على أن الإلكترونات تتحرك في مدارات محددة حول النواة. كل مدار له طاقة ثابتة. عندما ينتقل الإلكترون من مستوى طاقة أعلى إلى أدنى يُطلق طاقة على شكل فوتون، وعندما يمتص طاقة ينتقل إلى مستوى أعلى. هذا يفسر الطيف الذري لذرة الهيدروجين.',
    summaryEn:
      "Niels Bohr proposed that electrons orbit the nucleus in fixed energy levels. When an electron jumps from a higher to a lower energy level it emits a photon of light, and when it absorbs energy it jumps to a higher level. This explains the discrete line spectrum of hydrogen. Energy of each orbit: E = −13.6 / n² eV.",
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
      { ar: 'الطيف الخطي', en: 'Line Emission Spectrum', definitionAr: 'مجموعة من الأطوال الموجية المحددة تصدر عن الذرات المثارة', definitionEn: 'A set of discrete wavelengths emitted by excited atoms as electrons return to lower energy levels' },
      { ar: 'الطيف الذري', en: 'Atomic Spectrum', definitionAr: 'الطيف الصادر عن ذرات العناصر المثارة في الحالة الغازية', definitionEn: 'The spectrum emitted by excited atoms of an element in the gaseous state' },
      { ar: 'الفوتون', en: 'Photon', definitionAr: 'حزمة من الطاقة الكهرومغناطيسية تُطلق أو تُمتص عند انتقال الإلكترون', definitionEn: 'A quantum of electromagnetic energy emitted or absorbed during electron transitions' },
      { ar: 'الكم', en: 'Quantum', definitionAr: 'مقدار محدد من الطاقة ينبعث من الذرة المثارة نتيجة انتقال الإلكترون', definitionEn: 'A discrete packet of energy emitted when an electron transitions between energy levels' },
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
      'Transition to lower level → photon emission',
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
      'يستند النموذج الميكانيكي الموجي على أن الإلكترون يمتلك طبيعة جسيمية وموجية. لا يمكن تحديد مكان الإلكترون وسرعته معًا (مبدأ هايزنبرغ). تُستخدم الأفلاك (Orbitals) وهي مناطق ثلاثية الأبعاد حول النواة. تُوصف بأربعة أعداد كمية وأنواع: s و p و d و f.',
    summaryEn:
      'The wave-mechanical model treats the electron as both a particle and a wave. It is impossible to simultaneously know the exact position and momentum of an electron (Heisenberg Uncertainty Principle). Electrons occupy orbitals — three-dimensional regions of high electron probability, described by four quantum numbers: s, p, d, f types.',
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
      { ar: 'الفلك', en: 'Orbital', definitionAr: 'منطقة فراغية حول النواة يكون فيها احتمال وجود الإلكترونات أكبر ما يمكن', definitionEn: 'A region of space around the nucleus where there is the highest probability of finding electrons' },
      { ar: 'مبدأ أوفباو', en: 'Aufbau Principle', definitionAr: 'امتلاء الأفلاك بالإلكترونات وفقًا لتزايد طاقاتها من الأدنى إلى الأعلى', definitionEn: 'Electrons fill orbitals starting from the lowest energy level then progressively higher levels' },
      { ar: 'قاعدة هوند', en: "Hund's Rule", definitionAr: 'توزع الإلكترونات بصورة منفردة على أفلاك المستوى الفرعي الواحد قبل الاقتران', definitionEn: 'Electrons occupy orbitals of the same subshell singly before pairing, with parallel spins' },
      { ar: 'مبدأ باولي', en: 'Pauli Exclusion Principle', definitionAr: 'لا يمكن لإلكترونين في نفس الذرة أن يكون لهما نفس الأعداد الكمية الأربعة', definitionEn: 'No two electrons in an atom can have identical sets of all four quantum numbers' },
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

  // ── Unit 3: Chemical Bonding ──────────────────────────
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
      { ar: 'المركبات الأيونية', en: 'Ionic Compounds', definitionAr: 'مركبات تنشأ عن تجاذب الأيونات الموجبة والسالبة في البلورة الصلبة', definitionEn: 'Compounds formed by electrostatic attraction between positive and negative ions in a crystal lattice' },
      { ar: 'طاقة الشبكة البلورية', en: 'Lattice Energy', definitionAr: 'الطاقة اللازمة لتفكيك الشبكة البلورية الصلبة إلى أيونات منفصلة في الطور الغازي', definitionEn: 'The energy required to separate one mole of solid ionic compound into its gaseous ions' },
    ],
  },
  {
    id: 'kbl-chem-3-2',
    unitId: 'kbu-chem-3',
    order: 2,
    titleAr: 'الرابطة التساهمية',
    titleEn: 'Covalent Bonding',
    summaryAr:
      'تنشأ الرابطة التساهمية بتشارك ذرتين أو أكثر في زوج أو أكثر من الإلكترونات. الرابطة الأحادية: زوج واحد مشترك. الرابطة الثنائية: زوجان. الرابطة الثلاثية: ثلاثة أزواج. رابطة سيجما (σ) تنشأ من التداخل الرأسي، ورابطة باي (π) من التداخل الجانبي بين الأفلاك p.',
    summaryEn:
      'Covalent bonds form when atoms share pairs of electrons. Single bond: one pair. Double bond: two pairs. Triple bond: three pairs. Sigma (σ) bonds form by head-on orbital overlap; pi (π) bonds form by side-to-side p orbital overlap.',
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
      { ar: 'رابطة سيجما', en: 'Sigma Bond (σ)', definitionAr: 'رابطة تنشأ من التداخل الرأسي بين الأفلاك s-s أو s-p أو p-p', definitionEn: 'A bond formed by head-on (axial) overlap of orbitals: s-s, s-p, or p-p' },
      { ar: 'رابطة باي', en: 'Pi Bond (π)', definitionAr: 'رابطة تنشأ من التداخل الجانبي بين فلكَي p متوازيَين', definitionEn: 'A bond formed by lateral (side-to-side) overlap of two parallel p orbitals' },
      { ar: 'المركبات الجزيئية', en: 'Molecular Compounds', definitionAr: 'المركبات الناتجة من تشارك ذرات العناصر اللافلزية في إلكترونات التكافؤ', definitionEn: 'Compounds formed when non-metallic atoms share valence electrons' },
    ],
    examplesAr: ['H₂: رابطة تساهمية أحادية بين ذرتَي هيدروجين', 'O₂: رابطة تساهمية ثنائية', 'N₂: رابطة تساهمية ثلاثية'],
    examplesEn: ['H₂: single covalent bond between two H atoms', 'O₂: double covalent bond', 'N₂: triple covalent bond'],
  },
  {
    id: 'kbl-chem-3-3',
    unitId: 'kbu-chem-3',
    order: 3,
    titleAr: 'الرابطة الفلزية',
    titleEn: 'Metallic Bonding',
    summaryAr:
      'الرابطة الفلزية هي قوة التجاذب بين الأيونات الموجبة للفلزات والإلكترونات الحرة الحركة (بحر الإلكترونات). تُفسر هذه الرابطة التوصيل الكهربائي والحراري وليونة الفلزات.',
    summaryEn:
      "Metallic bonding is the electrostatic attraction between positive metal cations and a 'sea' of free-moving (delocalized) electrons. This explains metals' high electrical and thermal conductivity, malleability, and ductility.",
    keyConceptsAr: ['بحر الإلكترونات', 'الأيونات الموجبة للفلزات', 'التوصيل الكهربائي والحراري', 'الليونة والمطيلية'],
    keyConceptsEn: ['Sea of electrons (delocalized)', 'Positive metal cations', 'Electrical and thermal conductivity', 'Malleability and ductility'],
    keyTerms: [
      { ar: 'الرابطة الفلزية', en: 'Metallic Bond', definitionAr: 'قوة التجاذب بين الأيونات الموجبة للفلزات والإلكترونات الحرة في الشبكة البلورية', definitionEn: 'The attraction between positive metal ions and the delocalized sea of electrons in the crystal lattice' },
    ],
  },

  // ══════════════════════════════════════════════════════
  // MATH — SEMESTER 1
  // ══════════════════════════════════════════════════════

  // ── Unit 5: Functions (الاقترانات) ────────────────────
  {
    id: 'kbl-math-1-1',
    unitId: 'kbu-math-1',
    order: 1,
    titleAr: 'كثيرات الحدود وخصائصها',
    titleEn: 'Polynomial Functions and Their Properties',
    summaryAr:
      'كثير الحدود هو اقتران من الشكل f(x) = aₙxⁿ + ... + a₀، حيث n عدد صحيح غير سالب والمعاملات أعداد حقيقية. درجة كثير الحدود هي أعلى أس. يمكن جمعها وطرحها وضربها وقسمتها. تُمثَّل بمنحنيات سلسة. من تطبيقاتها نمذجة العلاقات الاقتصادية والفيزيائية.',
    summaryEn:
      'A polynomial function has the form f(x) = aₙxⁿ + ... + a₀, where n is a non-negative integer and coefficients are real numbers. The degree is the highest power. Polynomials can be added, subtracted, multiplied, and divided. Their graphs are smooth continuous curves.',
    keyConceptsAr: ['درجة كثير الحدود', 'المعامل الرئيسي', 'جمع وطرح وضرب كثيرات الحدود', 'قسمة كثيرات الحدود (الطريقة الطويلة وهورنر)', 'التمثيل البياني', 'الأصفار والجذور'],
    keyConceptsEn: ['Degree of polynomial', 'Leading coefficient', 'Adding, subtracting, multiplying polynomials', 'Dividing polynomials (long division & synthetic division)', 'Graphing polynomial functions', 'Zeros and roots'],
    keyTerms: [
      { ar: 'كثير الحدود', en: 'Polynomial', definitionAr: 'اقتران رياضي يتكون من حدود على الشكل aₙxⁿ حيث n عدد صحيح غير سالب', definitionEn: 'A mathematical function consisting of terms of the form aₙxⁿ where n is a non-negative integer' },
      { ar: 'الجذر (الصفر)', en: 'Root / Zero', definitionAr: 'القيمة التي تجعل كثير الحدود يساوي صفرًا: f(x) = 0', definitionEn: 'A value of x where the polynomial equals zero: f(x) = 0' },
    ],
    examplesAr: ['f(x) = 3x³ − 2x² + x − 5: درجته 3، معامله الرئيسي 3', 'جمع: (x² + 2x) + (3x − 1) = x² + 5x − 1', 'ضرب: (x + 2)(x − 3) = x² − x − 6'],
    examplesEn: ['f(x) = 3x³ − 2x² + x − 5: degree 3, leading coefficient 3', 'Addition: (x² + 2x) + (3x − 1) = x² + 5x − 1', 'Multiplication: (x + 2)(x − 3) = x² − x − 6'],
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
      { ar: 'المقاربة الرأسية', en: 'Vertical Asymptote', definitionAr: 'خط رأسي x = a تقترب منه قيم الاقتران دون أن تصله', definitionEn: 'A vertical line x = a that the function approaches but never reaches as x approaches a' },
      { ar: 'المقاربة الأفقية', en: 'Horizontal Asymptote', definitionAr: 'خط أفقي y = b تقترب منه قيم الاقتران عندما تتجه x نحو ما لا نهاية', definitionEn: 'A horizontal line y = b the function approaches as x goes to infinity' },
    ],
    examplesAr: ['f(x) = 1/(x − 2): مجاله ℝ \\ {2}، مقاربة رأسية x = 2', 'f(x) = (x + 1)/(x² − 4): مجاله ℝ \\ {2, −2}'],
    examplesEn: ['f(x) = 1/(x − 2): domain ℝ \\ {2}, vertical asymptote x = 2', 'f(x) = (x + 1)/(x² − 4): domain ℝ \\ {2, −2}'],
  },
  {
    id: 'kbl-math-1-3',
    unitId: 'kbu-math-1',
    order: 3,
    titleAr: 'تركيب الاقترانات والاقتران العكسي والاقتران الجذري',
    titleEn: 'Function Composition, Inverse, and Radical Functions',
    summaryAr:
      'تركيب الاقترانات: (f∘g)(x) = f(g(x))، نطبق g أولًا ثم f. الاقتران العكسي f⁻¹ يعكس العلاقة: إذا كان f(a) = b فإن f⁻¹(b) = a، وشرطه أن يكون الاقتران تقابلًا. الاقتران الجذري: f(x) = √x له مجال x ≥ 0.',
    summaryEn:
      "Function composition: (f∘g)(x) = f(g(x)) — apply g first, then f. The inverse function f⁻¹ reverses the mapping: if f(a) = b then f⁻¹(b) = a. An inverse exists only when f is bijective. Radical function: f(x) = √x has domain x ≥ 0. The graph of f⁻¹ is the reflection of f's graph across y = x.",
    keyConceptsAr: ['تركيب الاقترانات f∘g', 'الاقتران العكسي f⁻¹', 'شرط وجود الاقتران العكسي', 'الاقتران الجذري √x', 'انعكاس الرسم البياني حول y = x'],
    keyConceptsEn: ['Function composition (f∘g)', 'Inverse function f⁻¹', 'Conditions for inverse to exist', 'Radical function √x', 'Graph reflection across y = x'],
    keyTerms: [
      { ar: 'تركيب الاقترانات', en: 'Function Composition', definitionAr: '(f∘g)(x) = f(g(x)): تطبيق g أولًا ثم f على النتيجة', definitionEn: '(f∘g)(x) = f(g(x)): apply g first, then apply f to the result' },
      { ar: 'الاقتران العكسي', en: 'Inverse Function', definitionAr: 'f⁻¹ هو الاقتران الذي يعكس تأثير f: f(f⁻¹(x)) = x', definitionEn: 'f⁻¹ reverses the effect of f: f(f⁻¹(x)) = x for all x in the domain' },
    ],
    examplesAr: ['إذا f(x) = x + 3 و g(x) = 2x، فإن (f∘g)(x) = 2x + 3', 'عكس f(x) = 2x − 4 هو f⁻¹(x) = (x + 4)/2'],
    examplesEn: ['If f(x) = x + 3 and g(x) = 2x, then (f∘g)(x) = 2x + 3', 'Inverse of f(x) = 2x − 4 is f⁻¹(x) = (x + 4)/2'],
  },
  {
    id: 'kbl-math-1-5',
    unitId: 'kbu-math-1',
    order: 5,
    titleAr: 'المتتاليات',
    titleEn: 'Sequences',
    summaryAr:
      'المتتالية هي مجموعة مرتبة من الأعداد تُسمى حدودها. تُستنتج القاعدة العامة لمتتالية تربيعية بحساب الفروق الأولى (غير ثابتة) والفروق الثانية (ثابتة). للمتتالية التكعيبية تكون الفروق الثالثة ثابتة. تُستخدم القاعدة العامة للتنبؤ بأي حد.',
    summaryEn:
      'A sequence is an ordered list of numbers called terms. For a quadratic sequence, first differences are not constant but second differences are constant. For a cubic sequence, third differences are constant. The general rule aₙ lets you find any term without listing all preceding ones.',
    keyConceptsAr: ['المتتالية التربيعية: الفروق الثانية ثابتة', 'المتتالية التكعيبية: الفروق الثالثة ثابتة', 'الفروق الأولى والثانية والثالثة', 'القاعدة العامة للحد العام aₙ', 'استنتاج المعاملات من الفروق'],
    keyConceptsEn: ['Quadratic sequence: constant second differences', 'Cubic sequence: constant third differences', 'First, second, and third differences', 'General term rule aₙ', 'Deducing coefficients from differences'],
    keyTerms: [
      { ar: 'المتتالية', en: 'Sequence', definitionAr: 'مجموعة مرتبة من الأعداد تُسمى حدودها: a₁, a₂, a₃, ...', definitionEn: 'An ordered list of numbers called terms: a₁, a₂, a₃, ...' },
      { ar: 'الفروق الأولى', en: 'First Differences', definitionAr: 'الفرق بين كل حد والحد الذي يليه في المتتالية', definitionEn: 'The difference between each term and the next term in the sequence' },
      { ar: 'الفروق الثانية', en: 'Second Differences', definitionAr: 'الفرق بين الفروق الأولى المتتالية؛ تكون ثابتة في المتتالية التربيعية', definitionEn: 'Differences of the first differences; constant in a quadratic sequence' },
    ],
    rulesAr: [
      'متتالية تربيعية: aₙ = an² + bn + c حيث الفروق الثانية = 2a',
      'متتالية تكعيبية: aₙ = an³ + bn² + cn + d',
      'لإيجاد a: 2a = الفرق الثاني الثابت',
    ],
    rulesEn: [
      'Quadratic sequence: aₙ = an² + bn + c where second difference = 2a',
      'Cubic sequence: aₙ = an³ + bn² + cn + d',
      'To find a in quadratic: 2a = constant second difference',
    ],
    examplesAr: ['المتتالية 3, 7, 13, 21: فروق أولى 4,6,8 وفروق ثانية 2,2 → تربيعية. 2a=2 → a=1، القاعدة: n²+n+1'],
    examplesEn: ['Sequence 3, 7, 13, 21: first differences 4,6,8 and second differences 2,2 → quadratic. 2a=2 → a=1, rule: n²+n+1'],
  },

  // ── Unit 6: Derivatives (المشتقات) ────────────────────
  {
    id: 'kbl-math-2-1',
    unitId: 'kbu-math-2',
    order: 1,
    titleAr: 'تقدير ميل المنحنى',
    titleEn: 'Estimating the Slope of a Curve',
    summaryAr:
      'يُعرَّف ميل المنحنى عند نقطة ما بأنه ميل المماس (المستقيم الذي يلمس المنحنى في تلك النقطة فقط). لتقدير الميل: نرسم المماس بيانيًا ونختار نقطتين عليه ثم نحسب الميل. تطبيق: السرعة اللحظية لجسم متحرك تساوي ميل منحنى الموقع-الزمن عند تلك اللحظة.',
    summaryEn:
      'The slope of a curve at a point is defined as the slope of the tangent line at that point. To estimate it: draw the tangent graphically, pick two points on it, and calculate m = (y₂−y₁)/(x₂−x₁). Application: instantaneous velocity equals the slope of the position-time curve at that moment.',
    keyConceptsAr: ['المماس: خط يلمس المنحنى في نقطة واحدة', 'ميل المنحنى عند نقطة = ميل المماس', 'تقدير الميل بيانيًا', 'السرعة اللحظية', 'القاطع يصبح مماسًا عند تقليص الفترة الزمنية'],
    keyConceptsEn: ['Tangent: a line touching the curve at one point', 'Slope of curve at a point = slope of tangent', 'Graphical estimation of slope', 'Instantaneous velocity', 'Secant line approaches tangent as interval shrinks'],
    keyTerms: [
      { ar: 'المماس', en: 'Tangent Line', definitionAr: 'مستقيم يلمس المنحنى في نقطة واحدة فقط ويمثل ميله عند تلك النقطة', definitionEn: 'A line that touches the curve at exactly one point and represents its slope there' },
      { ar: 'القاطع', en: 'Secant Line', definitionAr: 'مستقيم يمر بنقطتين على المنحنى، ويُستخدم لتقريب المماس', definitionEn: 'A line passing through two points on a curve, used to approximate the tangent' },
      { ar: 'السرعة اللحظية', en: 'Instantaneous Velocity', definitionAr: 'السرعة عند لحظة زمنية محددة، تساوي ميل مماس منحنى الموقع-الزمن', definitionEn: 'Speed at a specific instant, equal to the slope of the position-time curve at that moment' },
    ],
    rulesAr: ['ميل المستقيم = (y₂ − y₁) / (x₂ − x₁)', 'ميل المنحنى عند نقطة ≈ ميل مماسه عند تلك النقطة'],
    rulesEn: ['Slope of line = (y₂ − y₁) / (x₂ − x₁)', 'Slope of curve at a point ≈ slope of its tangent at that point'],
    examplesAr: ['إذا كان s(t) = 4.9t²، فإن السرعة اللحظية عند t=3 تُقدَّر برسم المماس وحساب ميله'],
    examplesEn: ['If s(t) = 4.9t², instantaneous velocity at t=3 is estimated by drawing the tangent and computing its slope'],
  },
  {
    id: 'kbl-math-2-2',
    unitId: 'kbu-math-2',
    order: 2,
    titleAr: 'الاشتقاق',
    titleEn: 'Differentiation',
    summaryAr:
      'المشتقة هي مقياس دقيق لمعدل تغير الاقتران. قواعد الاشتقاق: مشتقة الثابت = 0، مشتقة xⁿ = nxⁿ⁻¹، مشتقة مجموع أو فرق اقترانين = مجموع أو فرق مشتقتيهما. المشتقة = ميل المماس في أي نقطة على المنحنى.',
    summaryEn:
      "The derivative measures the exact rate of change of a function. Rules: derivative of a constant = 0, derivative of xⁿ = nxⁿ⁻¹, derivative of a sum/difference = sum/difference of derivatives. f'(x) gives the slope of the tangent at any point.",
    keyConceptsAr: ['المشتقة f\'(x): معدل التغير الفوري', 'قاعدة القوة: d/dx(xⁿ) = nxⁿ⁻¹', 'قاعدة الثابت: d/dx(c) = 0', 'قاعدة المجموع: (f+g)\' = f\' + g\'', 'مشتقة الضرب بثابت: d/dx(cf) = cf\''],
    keyConceptsEn: ["Derivative f'(x): instantaneous rate of change", "Power rule: d/dx(xⁿ) = nxⁿ⁻¹", "Constant rule: d/dx(c) = 0", "Sum rule: (f+g)' = f' + g'", "Constant multiple rule: d/dx(cf) = cf'"],
    keyTerms: [
      { ar: 'المشتقة', en: 'Derivative', definitionAr: 'معدل التغير الفوري للاقتران عند نقطة ما، يساوي ميل المماس', definitionEn: "The instantaneous rate of change of a function at a point, equal to the tangent slope" },
      { ar: 'قاعدة القوة', en: 'Power Rule', definitionAr: 'إذا f(x) = xⁿ فإن f\'(x) = nxⁿ⁻¹', definitionEn: "If f(x) = xⁿ then f'(x) = nxⁿ⁻¹" },
    ],
    rulesAr: ['d/dx(c) = 0', 'd/dx(xⁿ) = nxⁿ⁻¹', 'd/dx(cf(x)) = c·f\'(x)', 'd/dx(f ± g) = f\' ± g\''],
    rulesEn: ['d/dx(c) = 0', 'd/dx(xⁿ) = nxⁿ⁻¹', "d/dx(cf(x)) = c·f'(x)", "d/dx(f ± g) = f' ± g'"],
    examplesAr: ['f(x) = x³ → f\'(x) = 3x²', 'f(x) = 4x² + 3x − 1 → f\'(x) = 8x + 3', 'f(x) = 5 → f\'(x) = 0'],
    examplesEn: ["f(x) = x³ → f'(x) = 3x²", "f(x) = 4x² + 3x − 1 → f'(x) = 8x + 3", "f(x) = 5 → f'(x) = 0"],
  },
  {
    id: 'kbl-math-2-3',
    unitId: 'kbu-math-2',
    order: 3,
    titleAr: 'القيم العظمى والقيم الصغرى',
    titleEn: 'Maximum and Minimum Values',
    summaryAr:
      'القيمة العظمى المحلية هي أعلى قيمة للاقتران في منطقة معينة، والقيمة الصغرى المحلية هي أدنى قيمة. تقع عند النقاط الحرجة حيث f\'(x) = 0. لتحديد النوع: إذا تغيرت إشارة f\'(x) من + إلى − فالنقطة عظمى، ومن − إلى + فالنقطة صغرى.',
    summaryEn:
      "A local maximum is the highest value in a region; a local minimum is the lowest. Both occur at critical points where f'(x) = 0. To classify: if f'(x) changes from + to − it's a maximum; from − to + it's a minimum. Used in optimization problems.",
    keyConceptsAr: ['النقاط الحرجة: f\'(x) = 0', 'القيمة العظمى المحلية', 'القيمة الصغرى المحلية', 'اختبار إشارة المشتقة', 'مسائل التحسين (الأمثلية)'],
    keyConceptsEn: ["Critical points: f'(x) = 0", 'Local maximum', 'Local minimum', "Sign test of derivative", 'Optimization problems'],
    keyTerms: [
      { ar: 'النقطة الحرجة', en: 'Critical Point', definitionAr: 'نقطة x₀ حيث f\'(x₀) = 0، قد تكون قيمة عظمى أو صغرى أو نقطة انعطاف', definitionEn: "A point x₀ where f'(x₀) = 0; may be a max, min, or inflection point" },
      { ar: 'القيمة العظمى المحلية', en: 'Local Maximum', definitionAr: 'قيمة الاقتران عند نقطة تكون أكبر من قيمه في محيطها', definitionEn: 'Function value at a point that is greater than values in its neighborhood' },
      { ar: 'القيمة الصغرى المحلية', en: 'Local Minimum', definitionAr: 'قيمة الاقتران عند نقطة تكون أصغر من قيمه في محيطها', definitionEn: 'Function value at a point that is less than values in its neighborhood' },
    ],
    rulesAr: ['أجد النقاط الحرجة بحل f\'(x) = 0', 'قبل النقطة الحرجة: f\'(x) > 0 وبعدها f\'(x) < 0 → عظمى', 'قبل النقطة الحرجة: f\'(x) < 0 وبعدها f\'(x) > 0 → صغرى'],
    rulesEn: ["Find critical points by solving f'(x) = 0", "f' changes from + to − → local maximum", "f' changes from − to + → local minimum"],
    examplesAr: ['f(x) = −x² + 4x: f\'(x) = −2x + 4 = 0 → x = 2، قيمة عظمى = f(2) = 4'],
    examplesEn: ["f(x) = −x² + 4x: f'(x) = −2x + 4 = 0 → x = 2, maximum value = f(2) = 4"],
  },

  // ── Unit 7: Vectors (المتجهات) ─────────────────────────
  {
    id: 'kbl-math-3-1',
    unitId: 'kbu-math-3',
    order: 1,
    titleAr: 'المتجهات في المستوى الإحداثي',
    titleEn: 'Vectors in the Coordinate Plane',
    summaryAr:
      'المتجه كمية تمتلك مقدارًا واتجاهًا. يُمثَّل بقطعة مستقيمة موجَّهة من نقطة البداية إلى نقطة النهاية. الصورة الإحداثية: v = ⟨v₁, v₂⟩. مقدار المتجه: |v| = √(v₁² + v₂²). المتجهان متساويان إذا كانا متطابقَي المقدار والاتجاه.',
    summaryEn:
      'A vector has both magnitude and direction. It is represented by a directed line segment from initial to terminal point. Component form: v = ⟨v₁, v₂⟩. Magnitude: |v| = √(v₁² + v₂²). Two vectors are equal if they have the same magnitude and direction.',
    keyConceptsAr: ['المقدار والاتجاه', 'الصورة الإحداثية ⟨v₁, v₂⟩', 'مقدار المتجه |v|', 'المتجه الوحدة', 'المتجهات المتساوية'],
    keyConceptsEn: ['Magnitude and direction', 'Component form ⟨v₁, v₂⟩', 'Magnitude |v|', 'Unit vector', 'Equal vectors'],
    keyTerms: [
      { ar: 'المتجه', en: 'Vector', definitionAr: 'كمية لها مقدار واتجاه، تُمثَّل بسهم من نقطة البداية إلى نقطة النهاية', definitionEn: 'A quantity with both magnitude and direction, represented by an arrow from initial to terminal point' },
      { ar: 'مقدار المتجه', en: 'Magnitude', definitionAr: 'طول المتجه: |v| = √(v₁² + v₂²)', definitionEn: 'The length of a vector: |v| = √(v₁² + v₂²)' },
      { ar: 'المتجه الوحدة', en: 'Unit Vector', definitionAr: 'متجه مقداره 1، يُستخدم لتحديد الاتجاه فقط', definitionEn: 'A vector with magnitude 1, used to indicate direction only' },
    ],
    rulesAr: ['إذا كانت نقطة البداية P₁(x₁,y₁) ونهاية P₂(x₂,y₂) فإن v = ⟨x₂−x₁, y₂−y₁⟩', '|v| = √(v₁² + v₂²)'],
    rulesEn: ['If initial point P₁(x₁,y₁) and terminal point P₂(x₂,y₂) then v = ⟨x₂−x₁, y₂−y₁⟩', '|v| = √(v₁² + v₂²)'],
    examplesAr: ['v = ⟨3, 4⟩: |v| = √(9+16) = √25 = 5', 'من P₁(1,2) إلى P₂(4,6): v = ⟨3, 4⟩'],
    examplesEn: ['v = ⟨3, 4⟩: |v| = √(9+16) = 5', 'From P₁(1,2) to P₂(4,6): v = ⟨3, 4⟩'],
  },
  {
    id: 'kbl-math-3-2',
    unitId: 'kbu-math-3',
    order: 2,
    titleAr: 'جمع المتجهات وطرحها',
    titleEn: 'Vector Addition and Subtraction',
    summaryAr:
      'جمع متجهَين: نجمع المركبات المتناظرة. طرح متجهَين: نطرح المركبات المتناظرة. الضرب بثابت: نضرب كل مركبة بالثابت. القانون الهندسي: بالمثلث أو متوازي الأضلاع. المتجه الصفري: ⟨0, 0⟩ هو المحايد للجمع.',
    summaryEn:
      'To add vectors: add corresponding components. To subtract: subtract components. Scalar multiplication: multiply each component by the scalar. Geometric method: triangle or parallelogram law. Zero vector ⟨0,0⟩ is the additive identity.',
    keyConceptsAr: ['جمع المتجهات: ⟨a₁+b₁, a₂+b₂⟩', 'طرح المتجهات: ⟨a₁−b₁, a₂−b₂⟩', 'الضرب بثابت: k⟨v₁, v₂⟩ = ⟨kv₁, kv₂⟩', 'قانون المثلث وقانون متوازي الأضلاع', 'المتجه الصفري ⟨0,0⟩'],
    keyConceptsEn: ['Vector addition: ⟨a₁+b₁, a₂+b₂⟩', 'Vector subtraction: ⟨a₁−b₁, a₂−b₂⟩', 'Scalar multiplication: k⟨v₁,v₂⟩ = ⟨kv₁,kv₂⟩', 'Triangle and parallelogram laws', 'Zero vector ⟨0,0⟩'],
    keyTerms: [
      { ar: 'الضرب القياسي للمتجه بثابت', en: 'Scalar Multiplication', definitionAr: 'ضرب كل مركبة من مركبات المتجه في الثابت: k⟨v₁,v₂⟩ = ⟨kv₁,kv₂⟩', definitionEn: 'Multiplying each component by a scalar: k⟨v₁,v₂⟩ = ⟨kv₁,kv₂⟩' },
    ],
    rulesAr: ['a + b = ⟨a₁+b₁, a₂+b₂⟩', 'a − b = ⟨a₁−b₁, a₂−b₂⟩', 'k·a = ⟨ka₁, ka₂⟩', '|ka| = |k|·|a|'],
    rulesEn: ['a + b = ⟨a₁+b₁, a₂+b₂⟩', 'a − b = ⟨a₁−b₁, a₂−b₂⟩', 'k·a = ⟨ka₁, ka₂⟩', '|ka| = |k|·|a|'],
    examplesAr: ['⟨2,3⟩ + ⟨1,−1⟩ = ⟨3,2⟩', '3·⟨2,4⟩ = ⟨6,12⟩', '⟨5,2⟩ − ⟨3,4⟩ = ⟨2,−2⟩'],
    examplesEn: ['⟨2,3⟩ + ⟨1,−1⟩ = ⟨3,2⟩', '3·⟨2,4⟩ = ⟨6,12⟩', '⟨5,2⟩ − ⟨3,4⟩ = ⟨2,−2⟩'],
  },
  {
    id: 'kbl-math-3-3',
    unitId: 'kbu-math-3',
    order: 3,
    titleAr: 'الضرب القياسي (الداخلي)',
    titleEn: 'Dot Product (Scalar Product)',
    summaryAr:
      'الضرب القياسي لمتجهَين ينتج عددًا حقيقيًا: a·b = a₁b₁ + a₂b₂. العلاقة مع الزاوية: a·b = |a||b| cos θ. إذا كان a·b = 0 فإن المتجهَين متعامدان (θ = 90°). يُستخدم لإيجاد الزاوية بين متجهَين.',
    summaryEn:
      'The dot product of two vectors produces a scalar: a·b = a₁b₁ + a₂b₂. Related to the angle: a·b = |a||b| cos θ. If a·b = 0 the vectors are perpendicular (θ = 90°). Used to find the angle between two vectors.',
    keyConceptsAr: ['الضرب القياسي: a·b = a₁b₁ + a₂b₂', 'العلاقة بالزاوية: cos θ = (a·b)/(|a||b|)', 'الشرط للتعامد: a·b = 0', 'إيجاد الزاوية بين متجهَين'],
    keyConceptsEn: ['Dot product: a·b = a₁b₁ + a₂b₂', 'Angle relation: cos θ = (a·b)/(|a||b|)', 'Perpendicularity condition: a·b = 0', 'Finding angle between two vectors'],
    keyTerms: [
      { ar: 'الضرب القياسي (الداخلي)', en: 'Dot Product', definitionAr: 'حاصل ضرب متجهَين يساوي a₁b₁ + a₂b₂، وهو عدد حقيقي', definitionEn: 'Product of two vectors giving a scalar: a₁b₁ + a₂b₂' },
    ],
    rulesAr: ['a·b = a₁b₁ + a₂b₂', 'cos θ = (a·b) / (|a|·|b|)', 'a ⊥ b ↔ a·b = 0'],
    rulesEn: ['a·b = a₁b₁ + a₂b₂', 'cos θ = (a·b) / (|a|·|b|)', 'a ⊥ b ↔ a·b = 0'],
    examplesAr: ['a=⟨2,3⟩ و b=⟨4,−1⟩: a·b = 8+(−3) = 5', 'a=⟨1,0⟩ و b=⟨0,1⟩: a·b=0 → متعامدان'],
    examplesEn: ['a=⟨2,3⟩ and b=⟨4,−1⟩: a·b = 8+(−3) = 5', 'a=⟨1,0⟩ and b=⟨0,1⟩: a·b=0 → perpendicular'],
  },

  // ── Unit 8: Statistics and Probability ────────────────
  {
    id: 'kbl-math-8-0',
    unitId: 'kbu-math-8',
    order: 1,
    titleAr: 'أشكال الانتشار',
    titleEn: 'Scatter Plots',
    summaryAr:
      'شكل الانتشار هو تمثيل بياني لمجموعة من الأزواج المرتبة (x, y) يكشف عن العلاقة بين متغيرَين. إذا ارتفعت قيم y مع x → ارتباط موجب. إذا انخفضت → ارتباط سالب. المستقيم الأفضل مطابقة يصف العلاقة ويُستخدم للتنبؤ.',
    summaryEn:
      'A scatter plot shows ordered pairs (x,y) to reveal the relationship between two variables. If y increases as x increases → positive correlation. If y decreases → negative correlation. The line of best fit describes the relationship and is used for prediction.',
    keyConceptsAr: ['شكل الانتشار (scatter plot)', 'الارتباط الموجب والسالب والمنعدم', 'المستقيم الأفضل مطابقة (خط الانحدار)', 'استعمال المستقيم للتنبؤ', 'برمجية جيوجبرا لرسم خط الانحدار'],
    keyConceptsEn: ['Scatter plot', 'Positive, negative, and zero correlation', 'Line of best fit (regression line)', 'Using the line for prediction', 'GeoGebra for drawing regression line'],
    keyTerms: [
      { ar: 'شكل الانتشار', en: 'Scatter Plot', definitionAr: 'تمثيل بياني تُوضع فيه نقاط البيانات كأزواج مرتبة لإظهار العلاقة بين متغيرَين', definitionEn: 'A graph where data points are plotted as ordered pairs to show the relationship between two variables' },
      { ar: 'المستقيم الأفضل مطابقة', en: 'Line of Best Fit', definitionAr: 'مستقيم يمر بأقرب مسافة ممكنة من جميع نقاط شكل الانتشار', definitionEn: 'A line that passes as close as possible to all points in a scatter plot' },
      { ar: 'الارتباط', en: 'Correlation', definitionAr: 'العلاقة بين المتغيرَين: موجب (تزامن الارتفاع) أو سالب (تعاكس) أو منعدم', definitionEn: 'The relationship between variables: positive (both rise), negative (opposite), or no correlation' },
    ],
    examplesAr: ['درجات الطلاب في الرياضيات والعلوم: ارتباط موجب → نقاط تتجه للأعلى يمينًا'],
    examplesEn: ['Student scores in Maths and Science: positive correlation → points trend up to the right'],
  },
  {
    id: 'kbl-math-8-02',
    unitId: 'kbu-math-8',
    order: 2,
    titleAr: 'المنحنى التكراري التراكمي',
    titleEn: 'Cumulative Frequency Graph',
    summaryAr:
      'المنحنى التكراري التراكمي يُمثِّل العلاقة بين التكرار التراكمي والحدود العليا للفئات. يُستخدم لإيجاد الربيعيات (Q1, Q2, Q3) والمئينات. الربيع الأول Q1: 25% من البيانات تحته. الوسيط Q2: 50%. الربيع الثالث Q3: 75%.',
    summaryEn:
      'The cumulative frequency graph plots cumulative frequency against upper class boundaries. Used to find quartiles (Q1, Q2, Q3) and percentiles. Q1: 25% of data below it. Median Q2: 50%. Q3: 75%. Interquartile range = Q3 − Q1.',
    keyConceptsAr: ['التكرار التراكمي', 'الحدود العليا للفئات', 'الربيعيات Q1 و Q2 و Q3', 'المئينات', 'المدى الربيعي = Q3 − Q1'],
    keyConceptsEn: ['Cumulative frequency', 'Upper class boundaries', 'Quartiles Q1, Q2, Q3', 'Percentiles', 'Interquartile range = Q3 − Q1'],
    keyTerms: [
      { ar: 'التكرار التراكمي', en: 'Cumulative Frequency', definitionAr: 'مجموع التكرارات من بداية البيانات حتى الفئة الحالية', definitionEn: 'The running total of frequencies from the start of the data up to the current class' },
      { ar: 'الربيعيات', en: 'Quartiles', definitionAr: 'Q1 و Q2 و Q3: قيم تقسم البيانات إلى أرباع متساوية', definitionEn: 'Q1, Q2, Q3: values dividing the data into four equal parts' },
      { ar: 'المدى الربيعي', en: 'Interquartile Range (IQR)', definitionAr: 'المدى الربيعي = Q3 − Q1، يقيس تشتت النصف الأوسط من البيانات', definitionEn: 'IQR = Q3 − Q1, measures the spread of the middle 50% of data' },
    ],
    rulesAr: ['أرسم المنحنى بوضع الحدود العليا على المحور الأفقي والتكرار التراكمي على العمودي', 'Q1 عند 25% من المجموع الكلي، Q2 عند 50%، Q3 عند 75%'],
    rulesEn: ['Plot cumulative frequency against upper class boundaries', 'Q1 at 25% of total, Q2 at 50%, Q3 at 75%'],
  },
  {
    id: 'kbl-math-8-03',
    unitId: 'kbu-math-8',
    order: 3,
    titleAr: 'مقاييس التشتت للجداول التكرارية ذات الفئات',
    titleEn: 'Measures of Dispersion for Grouped Data',
    summaryAr:
      'مقاييس التشتت تقيس مدى تباعد البيانات. المدى = أكبر قيمة − أصغر قيمة. لحساب الانحراف المعياري للبيانات المبوبة: نستخدم منتصف كل فئة كممثل لها، ونحسب الانحراف عن الوسط الحسابي.',
    summaryEn:
      'Measures of dispersion quantify the spread of data. Range = maximum − minimum. For grouped data: use class midpoints as representatives, compute deviations from the mean. Standard deviation measures how spread out values are from the mean.',
    keyConceptsAr: ['المدى = الحد الأعلى − الحد الأدنى', 'منتصف الفئة كممثل', 'الانحراف عن الوسط الحسابي', 'الانحراف المعياري للبيانات المبوبة', 'التباين'],
    keyConceptsEn: ['Range = max − min', 'Class midpoint as representative', 'Deviation from the mean', 'Standard deviation for grouped data', 'Variance'],
    keyTerms: [
      { ar: 'المدى', en: 'Range', definitionAr: 'الفرق بين أكبر قيمة وأصغر قيمة في مجموعة البيانات', definitionEn: 'The difference between the maximum and minimum values in a dataset' },
      { ar: 'الانحراف المعياري', en: 'Standard Deviation', definitionAr: 'مقياس لمتوسط انحراف القيم عن الوسط الحسابي', definitionEn: 'A measure of the average deviation of values from the mean' },
    ],
    rulesAr: ['المدى = أكبر قيمة − أصغر قيمة', 'الوسط الحسابي للمبوبة = Σ(fₓ · xᵢ) / Σfₓ حيث xᵢ منتصف الفئة'],
    rulesEn: ['Range = max value − min value', 'Mean for grouped data = Σ(fᵢ · xᵢ) / Σfᵢ where xᵢ is the class midpoint'],
  },
  {
    id: 'kbl-math-8-1',
    unitId: 'kbu-math-8',
    order: 4,
    titleAr: 'مفاهيم الاحتمال الأساسية',
    titleEn: 'Basic Concepts of Probability',
    summaryAr:
      'التجربة العشوائية هي تجربة لا يمكن التنبؤ بنتيجتها. فضاء العينة (Ω) هو مجموعة جميع النتائج الممكنة. الحادث هو جزء من فضاء العينة. احتمال الحادث E: P(E) = n(E) / n(Ω). احتمال أي حادث يقع بين 0 و1.',
    summaryEn:
      'A random experiment is one whose outcome cannot be predicted. The sample space Ω is the set of all possible outcomes. An event E is a subset of the sample space. Probability: P(E) = n(E)/n(Ω). For any event: 0 ≤ P(E) ≤ 1.',
    keyConceptsAr: ['التجربة العشوائية', 'فضاء العينة Ω', 'الحادث البسيط والمركب', 'P(E) = n(E)/n(Ω)', 'متممة الحادث: P(Ā) = 1 − P(A)'],
    keyConceptsEn: ['Random experiment', 'Sample space Ω', 'Simple and compound events', 'P(E) = n(E)/n(Ω)', 'Complement: P(Ā) = 1 − P(A)'],
    keyTerms: [
      { ar: 'فضاء العينة', en: 'Sample Space', definitionAr: 'مجموعة جميع النتائج الممكنة للتجربة العشوائية، يرمز لها بـ Ω', definitionEn: 'The set of all possible outcomes of a random experiment, denoted Ω' },
      { ar: 'الحادث', en: 'Event', definitionAr: 'جزء (مجموعة جزئية) من فضاء العينة', definitionEn: 'A subset of the sample space' },
      { ar: 'متممة الحادث', en: 'Complementary Event', definitionAr: 'P(Ā) = 1 − P(A): احتمال عدم وقوع الحادث A', definitionEn: "P(Ā) = 1 − P(A): the probability that event A does not occur" },
    ],
    rulesAr: ['P(E) = n(E) / n(Ω)', 'P(Ā) = 1 − P(A)', '0 ≤ P(E) ≤ 1', 'P(Ω) = 1', 'P(∅) = 0'],
    rulesEn: ['P(E) = n(E) / n(Ω)', 'P(Ā) = 1 − P(A)', '0 ≤ P(E) ≤ 1', 'P(Ω) = 1', 'P(∅) = 0'],
  },
  {
    id: 'kbl-math-8-2',
    unitId: 'kbu-math-8',
    order: 5,
    titleAr: 'الحوادث المتنافية وغير المتنافية',
    titleEn: 'Mutually Exclusive and Non-Exclusive Events',
    summaryAr:
      'الحادثان المتنافيان A وB لا يمكن وقوعهما معًا: A ∩ B = ∅، P(A ∪ B) = P(A) + P(B). غير المتنافيَين يمكنهما الوقوع معًا: P(A ∪ B) = P(A) + P(B) − P(A ∩ B).',
    summaryEn:
      'Two events A and B are mutually exclusive if A ∩ B = ∅: P(A ∪ B) = P(A) + P(B). Non-mutually exclusive events can occur together: P(A ∪ B) = P(A) + P(B) − P(A ∩ B). This avoids double-counting the intersection.',
    keyConceptsAr: ['الحوادث المتنافية: A ∩ B = ∅', 'P(A ∪ B) = P(A) + P(B) للمتنافية', 'P(A ∪ B) = P(A) + P(B) − P(A ∩ B) لغير المتنافية'],
    keyConceptsEn: ['Mutually exclusive: A ∩ B = ∅', 'P(A ∪ B) = P(A) + P(B) for mutually exclusive', 'P(A ∪ B) = P(A) + P(B) − P(A ∩ B) for non-exclusive'],
    keyTerms: [
      { ar: 'الحوادث المتنافية', en: 'Mutually Exclusive Events', definitionAr: 'حادثان لا يمكن وقوعهما معًا في نفس الوقت: A ∩ B = ∅', definitionEn: 'Two events that cannot occur at the same time: A ∩ B = ∅' },
    ],
    rulesAr: ['للمتنافية: P(A ∪ B) = P(A) + P(B)', 'لغير المتنافية: P(A ∪ B) = P(A) + P(B) − P(A ∩ B)', 'P(A ∩ B) = 0 إذا كانا متنافيَين'],
    rulesEn: ['Mutually exclusive: P(A ∪ B) = P(A) + P(B)', 'Non-exclusive: P(A ∪ B) = P(A) + P(B) − P(A ∩ B)', 'P(A ∩ B) = 0 if mutually exclusive'],
    examplesAr: ['إلقاء حجر نرد: ظهور 1 وعدد زوجي → متنافيان. P(A∪B) = 1/6 + 3/6 = 2/3'],
    examplesEn: ['Rolling a die: getting 1 AND getting an even number → mutually exclusive. P(A∪B) = 1/6 + 3/6 = 2/3'],
  },
  {
    id: 'kbl-math-8-3',
    unitId: 'kbu-math-8',
    order: 6,
    titleAr: 'احتمالات الحوادث المستقلة وغير المستقلة',
    titleEn: 'Independent and Dependent Events',
    summaryAr:
      'الحادثان المستقلان: وقوع أحدهما لا يؤثر على احتمال وقوع الآخر. P(A ∩ B) = P(A) × P(B). الحادثان غير المستقلَين (المتوقفَين): وقوع أحدهما يؤثر على الآخر. P(A ∩ B) = P(A) × P(B|A). الاحتمال الشرطي P(B|A): احتمال B بفرض وقوع A.',
    summaryEn:
      'Independent events: occurrence of one does not affect the other. P(A ∩ B) = P(A) × P(B). Dependent events: occurrence of one affects the other. P(A ∩ B) = P(A) × P(B|A). Conditional probability P(B|A): probability of B given A has occurred. Probability trees help organize multi-stage experiments.',
    keyConceptsAr: ['الحوادث المستقلة: P(A ∩ B) = P(A)·P(B)', 'الحوادث غير المستقلة', 'الاحتمال الشرطي P(B|A)', 'شجرة الاحتمالات', 'السحب بالإرجاع (مستقل) وبدون إرجاع (غير مستقل)'],
    keyConceptsEn: ['Independent events: P(A ∩ B) = P(A)·P(B)', 'Dependent events', 'Conditional probability P(B|A)', 'Probability tree', 'Sampling with replacement (independent) vs without (dependent)'],
    keyTerms: [
      { ar: 'الحوادث المستقلة', en: 'Independent Events', definitionAr: 'حادثان وقوع أحدهما لا يغيّر احتمال وقوع الآخر', definitionEn: 'Two events where the occurrence of one does not change the probability of the other' },
      { ar: 'الاحتمال الشرطي', en: 'Conditional Probability', definitionAr: 'P(B|A): احتمال وقوع B بشرط أن A قد وقع', definitionEn: 'P(B|A): probability of B given that A has occurred' },
    ],
    rulesAr: ['مستقلان: P(A ∩ B) = P(A) × P(B)', 'غير مستقلَين: P(A ∩ B) = P(A) × P(B|A)', 'P(B|A) = P(A ∩ B) / P(A)'],
    rulesEn: ['Independent: P(A ∩ B) = P(A) × P(B)', 'Dependent: P(A ∩ B) = P(A) × P(B|A)', 'P(B|A) = P(A ∩ B) / P(A)'],
    examplesAr: ['كيس فيه 5 كرات حمراء و3 خضراء، سحب كرتين بدون إرجاع: P(أحمر ثم أحمر) = (5/8)×(4/7) = 20/56'],
    examplesEn: ['Bag: 5 red + 3 green balls, drawing 2 without replacement: P(red then red) = (5/8)×(4/7) = 20/56'],
  },

  // ══════════════════════════════════════════════════════
  // MATH — SEMESTER 2
  // ══════════════════════════════════════════════════════

  // ── Unit 1: Equations (المعادلات) ──────────────────────
  {
    id: 'kbl-math-s2-1-1',
    unitId: 'kbu-math-s2-1',
    order: 1,
    titleAr: 'حل معادلات خاصة',
    titleEn: 'Solving Special Equations',
    summaryAr:
      'نتعلم حل معادلات أس المتغير فيها عدد صحيح موجب أكبر من 2، باستعمال التحليل وإخراج العامل المشترك الأكبر وخاصية الضرب الصفري. كذلك نحل معادلات يمكن تحويلها إلى صورة تربيعية بالتعويض (مثل x⁶ − 3x³ − 40 = 0 بتعويض u = x³).',
    summaryEn:
      'We solve equations where the variable exponent is a positive integer greater than 2, using factoring (GCF) and the zero-product property. Equations reducible to quadratic form (e.g. x⁶ − 3x³ − 40 = 0) are solved by substituting u = x³ then back-substituting.',
    keyConceptsAr: ['إخراج العامل المشترك الأكبر', 'خاصية الضرب الصفري', 'التحويل إلى الصورة التربيعية', 'التعويض u = xⁿ', 'التحليل إلى عوامل'],
    keyConceptsEn: ['Factoring out the GCF', 'Zero-product property', 'Reducing to quadratic form', 'Substitution u = xⁿ', 'Factoring into linear/quadratic factors'],
    keyTerms: [
      { ar: 'خاصية الضرب الصفري', en: 'Zero-Product Property', definitionAr: 'إذا كان ab = 0 فإن a = 0 أو b = 0', definitionEn: 'If ab = 0 then a = 0 or b = 0' },
      { ar: 'الصورة التربيعية', en: 'Quadratic Form', definitionAr: 'معادلة يمكن كتابتها كـ au² + bu + c = 0 بتعويض u = xⁿ', definitionEn: 'An equation that can be written as au² + bu + c = 0 by substituting u = xⁿ' },
    ],
    rulesAr: ['لحل x³ + 4x² − 5x = 0: أخرج x مشتركًا: x(x²+4x−5)=0 → x=0 أو حل x²+4x−5=0', 'لحل x⁶−3x³−40=0: ضع u=x³ → u²−3u−40=0 → حل u ثم x'],
    rulesEn: ['To solve x³+4x²−5x=0: factor x: x(x²+4x−5)=0 → x=0 or solve x²+4x−5=0', 'To solve x⁶−3x³−40=0: let u=x³ → u²−3u−40=0 → solve for u then x'],
    examplesAr: ['x³−2x²+9x−18=0: حلول x=2 و x=±3i', 'x⁶−3x³−40=0: u=x³ → (u−8)(u+5)=0 → x=2 أو x=∛(−5)'],
    examplesEn: ['x³−2x²+9x−18=0: solutions x=2 and x=±3i', 'x⁶−3x³−40=0: u=x³ → (u−8)(u+5)=0 → x=2 or x=∛(−5)'],
  },
  {
    id: 'kbl-math-s2-1-2',
    unitId: 'kbu-math-s2-1',
    order: 2,
    titleAr: 'حل نظام مكون من معادلة خطية ومعادلة تربيعية',
    titleEn: 'Solving a System: Linear and Quadratic Equations',
    summaryAr:
      'نحل نظامًا يتكون من معادلة خطية ومعادلة تربيعية بطريقة التعويض: نعزل المتغير من الخطية ونعوضه في التربيعية. الحلول الممكنة: لا يوجد حل (لا تتقاطع)، حل واحد (تتماس)، أو حلان (تتقاطعان في نقطتين).',
    summaryEn:
      'To solve a system of one linear and one quadratic equation, use substitution: isolate a variable from the linear equation and substitute into the quadratic. Solutions: no solution (no intersection), one solution (tangent), or two solutions (two intersection points).',
    keyConceptsAr: ['طريقة التعويض في أنظمة المعادلات', 'نظام خطي-تربيعي', 'الحلول الممكنة: 0 أو 1 أو 2', 'التحقق من الحل بالتعويض', 'تمثيل الحل بيانيًا'],
    keyConceptsEn: ['Substitution method for systems', 'Linear-quadratic system', 'Possible solutions: 0, 1, or 2', 'Checking solutions by substitution', 'Graphical representation of solutions'],
    keyTerms: [
      { ar: 'طريقة التعويض', en: 'Substitution Method', definitionAr: 'عزل متغير من معادلة وتعويضه في المعادلة الأخرى', definitionEn: 'Isolating a variable in one equation and substituting into the other' },
    ],
    rulesAr: ['الخطوات: 1) عزل y من المعادلة الخطية 2) تعويضه في التربيعية 3) حل المعادلة الناتجة 4) إيجاد y لكل x'],
    rulesEn: ['Steps: 1) Isolate y from the linear equation 2) Substitute into quadratic 3) Solve resulting equation 4) Find y for each x'],
    examplesAr: ['y = 2x−5 و y = x²−5x+7: 2x−5 = x²−5x+7 → x²−7x+12=0 → x=3 أو x=4'],
    examplesEn: ['y = 2x−5 and y = x²−5x+7: 2x−5 = x²−5x+7 → x²−7x+12=0 → x=3 or x=4'],
  },
  {
    id: 'kbl-math-s2-1-3',
    unitId: 'kbu-math-s2-1',
    order: 3,
    titleAr: 'حل نظام مكون من معادلتين تربيعيتين',
    titleEn: 'Solving a System of Two Quadratic Equations',
    summaryAr:
      'نحل نظامًا من معادلتين تربيعيتين بطريقة التعويض أو الطرح. نطرح المعادلتين للتخلص من حد x² إذا كانا متساويَي المعاملات، فنحصل على معادلة خطية ثم نعوض للحصول على y.',
    summaryEn:
      'Solve a system of two quadratic equations by substitution or elimination. If both equations have the same x² coefficient, subtract to get a linear equation, then substitute back to find both variables.',
    keyConceptsAr: ['طريقة الطرح لإلغاء حد x²', 'طريقة التعويض في نظام تربيعي-تربيعي', 'عدد الحلول الممكنة: 0 أو 1 أو 2 أو 4', 'التحقق من الحل'],
    keyConceptsEn: ['Subtraction to eliminate x² term', 'Substitution in quadratic-quadratic system', 'Possible solutions: 0, 1, 2, or 4', 'Verifying solutions'],
    keyTerms: [
      { ar: 'طريقة الطرح', en: 'Elimination Method', definitionAr: 'طرح معادلة من أخرى للتخلص من متغير ما', definitionEn: 'Subtracting one equation from another to eliminate a variable' },
    ],
    rulesAr: ['إذا كان معامل x² متساويًا: اطرح المعادلتين للحصول على معادلة خطية في x وy'],
    rulesEn: ['If x² coefficients are equal: subtract equations to get a linear equation in x and y'],
  },

  // ── Unit 2: The Circle (الدائرة) ───────────────────────
  {
    id: 'kbl-math-s2-2-1',
    unitId: 'kbu-math-s2-2',
    order: 1,
    titleAr: 'أوتار الدائرة وأقطارها ومماساتها',
    titleEn: 'Chords, Diameters, and Tangents of a Circle',
    summaryAr:
      'الوتر قطعة مستقيمة تصل نقطتين على الدائرة. القطر أطول وتر ويمر بالمركز. المماس خط يلمس الدائرة في نقطة واحدة وهو عمودي على نصف القطر عند نقطة التماس. الأوتار المتساوية تبعد مسافات متساوية عن المركز.',
    summaryEn:
      'A chord connects two points on the circle. The diameter is the longest chord and passes through the center. A tangent touches the circle at exactly one point and is perpendicular to the radius at that point. Equal chords are equidistant from the center.',
    keyConceptsAr: ['الوتر: قطعة مستقيمة تصل نقطتين على الدائرة', 'القطر = أطول وتر = 2r', 'المماس عمودي على نصف القطر عند نقطة التماس', 'الأوتار المتساوية متساوية البعد عن المركز', 'المنصف العمودي للوتر يمر بالمركز'],
    keyConceptsEn: ['Chord: connects two points on circle', 'Diameter = longest chord = 2r', 'Tangent perpendicular to radius at point of tangency', 'Equal chords are equidistant from center', 'Perpendicular bisector of a chord passes through center'],
    keyTerms: [
      { ar: 'الوتر', en: 'Chord', definitionAr: 'قطعة مستقيمة تصل نقطتين على محيط الدائرة', definitionEn: 'A line segment connecting two points on the circle' },
      { ar: 'المماس', en: 'Tangent', definitionAr: 'مستقيم يلمس الدائرة في نقطة واحدة فقط ويكون عموديًا على نصف القطر', definitionEn: 'A line that touches the circle at exactly one point, perpendicular to the radius at that point' },
    ],
    rulesAr: ['المماس ⊥ نصف القطر عند نقطة التماس', 'المنصف العمودي لأي وتر يمر بمركز الدائرة', 'أوتار متساوية → متساوية البعد عن المركز'],
    rulesEn: ['Tangent ⊥ radius at point of tangency', 'Perpendicular bisector of any chord passes through center', 'Equal chords → equidistant from center'],
  },
  {
    id: 'kbl-math-s2-2-2',
    unitId: 'kbu-math-s2-2',
    order: 2,
    titleAr: 'الأقواس والقطاعات الدائرية',
    titleEn: 'Arcs and Sectors of a Circle',
    summaryAr:
      'القوس جزء من محيط الدائرة. القطاع الدائري المنطقة المحصورة بين قوسَين ونصفَي قطر. طول القوس = (θ/360) × 2πr حيث θ بالدرجات. مساحة القطاع = (θ/360) × πr². بالراديان: طول القوس = rθ، مساحة القطاع = ½r²θ.',
    summaryEn:
      'An arc is part of the circle circumference. A sector is the region between two radii and an arc. Arc length = (θ/360) × 2πr where θ is in degrees. Sector area = (θ/360) × πr². In radians: arc length = rθ, sector area = ½r²θ.',
    keyConceptsAr: ['القوس: جزء من محيط الدائرة', 'القطاع الدائري', 'طول القوس = (θ/360) × 2πr', 'مساحة القطاع = (θ/360) × πr²', 'الراديان كوحدة قياس الزاوية'],
    keyConceptsEn: ['Arc: part of circumference', 'Circular sector', 'Arc length = (θ/360) × 2πr', 'Sector area = (θ/360) × πr²', 'Radian as angle unit'],
    keyTerms: [
      { ar: 'القوس', en: 'Arc', definitionAr: 'جزء من محيط الدائرة محدود بنقطتين عليها', definitionEn: 'A portion of the circle circumference between two points' },
      { ar: 'القطاع الدائري', en: 'Sector', definitionAr: 'المنطقة المحصورة بين قوس الدائرة ونصفَي القطر المحددَين له', definitionEn: 'The region bounded by an arc and the two radii connecting its endpoints to the center' },
      { ar: 'الراديان', en: 'Radian', definitionAr: 'وحدة قياس الزاوية: 1 راديان = الزاوية التي قوسها يساوي نصف القطر. π راديان = 180°', definitionEn: 'Unit of angle: 1 radian is the angle whose arc equals the radius. π radians = 180°' },
    ],
    rulesAr: ['طول القوس = (θ/360) × 2πr', 'مساحة القطاع = (θ/360) × πr²', 'بالراديان: l = rθ ، A = ½r²θ'],
    rulesEn: ['Arc length = (θ/360) × 2πr', 'Sector area = (θ/360) × πr²', 'In radians: l = rθ, A = ½r²θ'],
    examplesAr: ['دائرة نصف قطرها 6 cm وزاوية مركزية 60°: طول القوس = (60/360)×2π×6 = 2π cm'],
    examplesEn: ['Circle radius 6 cm, central angle 60°: arc length = (60/360)×2π×6 = 2π cm'],
  },
  {
    id: 'kbl-math-s2-2-3',
    unitId: 'kbu-math-s2-2',
    order: 3,
    titleAr: 'الزوايا في الدائرة',
    titleEn: 'Angles in a Circle',
    summaryAr:
      'الزاوية المركزية رأسها مركز الدائرة وتساوي القوس الذي تحصره. الزاوية المحيطية رأسها على الدائرة وتساوي نصف الزاوية المركزية المقابلة لنفس القوس. الزاوية في نصف دائرة = 90°. الزوايا المحيطية المبنية على نفس القوس متساوية.',
    summaryEn:
      'A central angle has its vertex at the center and equals the intercepted arc. An inscribed angle has its vertex on the circle and equals half the central angle subtending the same arc. Angle in a semicircle = 90°. Inscribed angles subtending the same arc are equal.',
    keyConceptsAr: ['الزاوية المركزية = القوس الذي تحصره', 'الزاوية المحيطية = نصف الزاوية المركزية', 'الزاوية في نصف دائرة = 90°', 'زوايا محيطية على نفس القوس متساوية', 'الزوايا المقابلة في رباعي منتظم على الدائرة تكملان 180°'],
    keyConceptsEn: ['Central angle = intercepted arc', 'Inscribed angle = half the central angle', 'Angle in semicircle = 90°', 'Inscribed angles on same arc are equal', 'Opposite angles in cyclic quadrilateral sum to 180°'],
    keyTerms: [
      { ar: 'الزاوية المركزية', en: 'Central Angle', definitionAr: 'زاوية رأسها مركز الدائرة وضلعاها نصفا قطر', definitionEn: 'An angle with its vertex at the center of the circle and sides as radii' },
      { ar: 'الزاوية المحيطية', en: 'Inscribed Angle', definitionAr: 'زاوية رأسها على محيط الدائرة وضلعاها وتران', definitionEn: 'An angle with its vertex on the circle and sides as chords' },
    ],
    rulesAr: ['الزاوية المحيطية = ½ × الزاوية المركزية على نفس القوس', 'الزاوية في نصف دائرة = 90°', 'زوايا محيطية على نفس القوس متساوية'],
    rulesEn: ['Inscribed angle = ½ × central angle on same arc', 'Angle in semicircle = 90°', 'Inscribed angles on same arc are equal'],
    examplesAr: ['زاوية مركزية = 80° → الزاوية المحيطية على نفس القوس = 40°'],
    examplesEn: ['Central angle = 80° → inscribed angle on same arc = 40°'],
  },
  {
    id: 'kbl-math-s2-2-4',
    unitId: 'kbu-math-s2-2',
    order: 4,
    titleAr: 'معادلة الدائرة',
    titleEn: 'Equation of a Circle',
    summaryAr:
      'معادلة الدائرة ذات المركز (h, k) ونصف القطر r هي: (x − h)² + (y − k)² = r². إذا كان المركز في الأصل: x² + y² = r². من معادلة مكتوبة بالصورة العامة x² + y² + Dx + Ey + F = 0 نجد المركز ونصف القطر بإكمال المربع.',
    summaryEn:
      'The equation of a circle with center (h, k) and radius r: (x − h)² + (y − k)² = r². If center is at origin: x² + y² = r². From general form x² + y² + Dx + Ey + F = 0, find center and radius by completing the square.',
    keyConceptsAr: ['معادلة الدائرة: (x−h)²+(y−k)²=r²', 'المركز (h, k) ونصف القطر r', 'الصورة العامة: x²+y²+Dx+Ey+F=0', 'إكمال المربع لإيجاد المركز ونصف القطر'],
    keyConceptsEn: ['Circle equation: (x−h)²+(y−k)²=r²', 'Center (h,k) and radius r', 'General form: x²+y²+Dx+Ey+F=0', 'Completing the square to find center and radius'],
    keyTerms: [
      { ar: 'معادلة الدائرة', en: 'Equation of a Circle', definitionAr: '(x−h)²+(y−k)²=r² حيث (h,k) المركز و r نصف القطر', definitionEn: '(x−h)²+(y−k)²=r² where (h,k) is the center and r is the radius' },
    ],
    rulesAr: ['معادلة الدائرة: (x−h)²+(y−k)²=r²', 'المركز في الأصل: x²+y²=r²', 'نصف القطر: r = √(h²+k²−F) من الصورة العامة بعد إكمال المربع'],
    rulesEn: ['Circle equation: (x−h)²+(y−k)²=r²', 'Center at origin: x²+y²=r²', 'From general form, r = √(h²+k²−F) after completing the square'],
    examplesAr: ['دائرة مركزها (2,−3) ونصف قطرها 5: (x−2)²+(y+3)²=25', 'x²+y²−4x+6y−3=0 → مركزها (2,−3) ونصف قطرها 4'],
    examplesEn: ['Circle center (2,−3) radius 5: (x−2)²+(y+3)²=25', 'x²+y²−4x+6y−3=0 → center (2,−3) radius 4'],
  },

  // ── Unit 3: Trigonometry (حساب المثلثات) ───────────────
  {
    id: 'kbl-math-s2-3-1',
    unitId: 'kbu-math-s2-3',
    order: 1,
    titleAr: 'النسب المثلثية',
    titleEn: 'Trigonometric Ratios',
    summaryAr:
      'في مثلث قائم الزاوية: جيب الزاوية (sin) = المقابل/الوتر، جيب التمام (cos) = المجاور/الوتر، الظل (tan) = المقابل/المجاور. العلاقة الأساسية: sin²A + cos²A = 1. القيم الخاصة: sin 30° = ½، cos 60° = ½، sin 45° = cos 45° = √2/2.',
    summaryEn:
      'In a right triangle: sin A = opposite/hypotenuse, cos A = adjacent/hypotenuse, tan A = opposite/adjacent. Fundamental identity: sin²A + cos²A = 1. Special values: sin 30° = ½, cos 60° = ½, sin 45° = cos 45° = √2/2.',
    keyConceptsAr: ['sin A = مقابل/وتر', 'cos A = مجاور/وتر', 'tan A = مقابل/مجاور', 'sin²A + cos²A = 1', 'قيم الزوايا الخاصة: 30°، 45°، 60°'],
    keyConceptsEn: ['sin A = opposite/hypotenuse', 'cos A = adjacent/hypotenuse', 'tan A = opposite/adjacent', 'sin²A + cos²A = 1', 'Special angles: 30°, 45°, 60°'],
    keyTerms: [
      { ar: 'جيب الزاوية (sin)', en: 'Sine', definitionAr: 'نسبة الضلع المقابل للزاوية إلى الوتر في المثلث القائم', definitionEn: 'Ratio of the opposite side to the hypotenuse in a right triangle' },
      { ar: 'جيب التمام (cos)', en: 'Cosine', definitionAr: 'نسبة الضلع المجاور للزاوية إلى الوتر في المثلث القائم', definitionEn: 'Ratio of the adjacent side to the hypotenuse in a right triangle' },
      { ar: 'الظل (tan)', en: 'Tangent', definitionAr: 'نسبة الضلع المقابل للزاوية إلى الضلع المجاور: tan A = sin A / cos A', definitionEn: 'Ratio of opposite to adjacent: tan A = sin A / cos A' },
    ],
    rulesAr: ['sin²A + cos²A = 1', 'tan A = sin A / cos A', 'sin 30°=½, cos 30°=√3/2, tan 30°=√3/3', 'sin 45°=cos 45°=√2/2, tan 45°=1', 'sin 60°=√3/2, cos 60°=½, tan 60°=√3'],
    rulesEn: ['sin²A + cos²A = 1', 'tan A = sin A / cos A', 'sin 30°=½, cos 30°=√3/2, tan 30°=√3/3', 'sin 45°=cos 45°=√2/2, tan 45°=1', 'sin 60°=√3/2, cos 60°=½, tan 60°=√3'],
    examplesAr: ['مثلث قائم: الوتر=10، مقابل زاوية A = 6: sin A = 6/10 = 0.6 → A = 37°'],
    examplesEn: ['Right triangle: hypotenuse=10, opposite of angle A=6: sin A = 6/10 = 0.6 → A = 37°'],
  },
  {
    id: 'kbl-math-s2-3-2',
    unitId: 'kbu-math-s2-3',
    order: 2,
    titleAr: 'النسب المثلثية للزوايا ضمن الدورة الواحدة',
    titleEn: 'Trigonometric Ratios for Angles in a Full Rotation',
    summaryAr:
      'تُعرَّف النسب المثلثية لأي زاوية (0°−360°) باستخدام الدائرة الوحدة والربعات الأربعة. إشارة النسب في الربعات: الأول (+،+،+)، الثاني (sin+، بقية −)، الثالث (tan+، بقية −)، الرابع (cos+، بقية −). قاعدة ASTC (All-Sin-Tan-Cos). الزاوية المرجعية: الزاوية الحادة المقابلة لأي زاوية.',
    summaryEn:
      'Trig ratios for any angle (0°−360°) use the unit circle and four quadrants. Signs by quadrant: 1st (all +), 2nd (sin +, rest −), 3rd (tan +, rest −), 4th (cos +, rest −). Rule ASTC (All-Sin-Tan-Cos). Reference angle: the acute angle corresponding to any angle.',
    keyConceptsAr: ['الربعات الأربعة وإشارة النسب المثلثية', 'قاعدة ASTC', 'الزاوية المرجعية', 'sin(180°−θ) = sin θ', 'cos(360°−θ) = cos θ'],
    keyConceptsEn: ['Four quadrants and sign of trig ratios', 'ASTC rule', 'Reference angle', 'sin(180°−θ) = sin θ', 'cos(360°−θ) = cos θ'],
    keyTerms: [
      { ar: 'الزاوية المرجعية', en: 'Reference Angle', definitionAr: 'الزاوية الحادة الموجبة بين ذراع الزاوية والمحور الأفقي، تساوي النسب المثلثية بصرف النظر عن الإشارة', definitionEn: 'The acute positive angle between the terminal side and the horizontal axis' },
    ],
    rulesAr: ['الربع الأول: جميع النسب موجبة', 'الربع الثاني: sin موجب فقط', 'الربع الثالث: tan موجب فقط', 'الربع الرابع: cos موجب فقط', 'sin(180°−θ)=sinθ, cos(180°−θ)=−cosθ'],
    rulesEn: ['Quadrant 1: all positive', 'Quadrant 2: sin positive only', 'Quadrant 3: tan positive only', 'Quadrant 4: cos positive only', 'sin(180°−θ)=sinθ, cos(180°−θ)=−cosθ'],
    examplesAr: ['sin 150° = sin(180°−30°) = sin 30° = ½', 'cos 270° = 0، sin 270° = −1'],
    examplesEn: ['sin 150° = sin(180°−30°) = sin 30° = ½', 'cos 270° = 0, sin 270° = −1'],
  },
  {
    id: 'kbl-math-s2-3-3',
    unitId: 'kbu-math-s2-3',
    order: 3,
    titleAr: 'تمثيل الاقترانات المثلثية',
    titleEn: 'Graphing Trigonometric Functions',
    summaryAr:
      'اقتران الجيب y = sin x: دوري بفترة 360°، سعة 1، يمر بالأصل. اقتران الجيب التمام y = cos x: دوري بفترة 360°، سعة 1، يبدأ من (0,1). للاقتران y = a·sin(bx + c) + d: السعة = |a|، الفترة = 360°/|b|، الإزاحة الأفقية = −c/b، الإزاحة الرأسية = d.',
    summaryEn:
      'y = sin x: periodic with period 360°, amplitude 1, passes through origin. y = cos x: periodic with period 360°, amplitude 1, starts at (0,1). For y = a·sin(bx + c) + d: amplitude = |a|, period = 360°/|b|, horizontal shift = −c/b, vertical shift = d.',
    keyConceptsAr: ['الدورة (الفترة) = 360° لـ sin وcos', 'السعة = |a|', 'الفترة = 360°/|b|', 'الإزاحة الأفقية والرأسية', 'القيم العظمى والصغرى للاقتران المثلثي'],
    keyConceptsEn: ['Period = 360° for sin and cos', 'Amplitude = |a|', 'Period = 360°/|b|', 'Horizontal and vertical shift', 'Maximum and minimum of trig function'],
    keyTerms: [
      { ar: 'السعة', en: 'Amplitude', definitionAr: 'نصف الفرق بين القيمة العظمى والصغرى للاقتران المثلثي', definitionEn: 'Half the difference between the maximum and minimum values of a trig function' },
      { ar: 'الفترة (الدورة)', en: 'Period', definitionAr: 'أصغر قيمة موجبة T حيث f(x+T) = f(x)، أي طول دورة كاملة', definitionEn: 'The smallest positive T where f(x+T)=f(x), the length of one complete cycle' },
    ],
    rulesAr: ['y = a·sin(bx) + d: السعة |a|، الفترة 360°/|b|، المحور الوسطي y=d', 'y = sin x: قيمة عظمى 1 عند 90°، صفر عند 0° و180°، قيمة صغرى −1 عند 270°'],
    rulesEn: ['y = a·sin(bx)+d: amplitude |a|, period 360°/|b|, midline y=d', 'y = sin x: max 1 at 90°, zero at 0° and 180°, min −1 at 270°'],
    examplesAr: ['y = 3·sin(2x): سعة=3، فترة=360°/2=180°', 'y = cos(x)+2: نفس شكل cos لكن مرفوع 2 وحدات'],
    examplesEn: ['y = 3·sin(2x): amplitude=3, period=360°/2=180°', 'y = cos(x)+2: same shape as cos but shifted up 2 units'],
  },
  {
    id: 'kbl-math-s2-3-4',
    unitId: 'kbu-math-s2-3',
    order: 4,
    titleAr: 'حل المعادلات المثلثية',
    titleEn: 'Solving Trigonometric Equations',
    summaryAr:
      'لحل معادلة مثلثية مثل sin x = k: أجد الحل الأساسي باستخدام arcsin، ثم أجد جميع الحلول في الفترة المطلوبة [0°, 360°] بمراعاة ربع الزاوية وإشارة النسبة. لـ cos x = k: حلان في الدورة. لـ tan x = k: حل واحد في [0°, 180°].',
    summaryEn:
      'To solve sin x = k: find the principal solution using arcsin, then find all solutions in [0°, 360°] using the quadrant and sign. For cos x = k: two solutions per cycle. For tan x = k: one solution in [0°, 180°].',
    keyConceptsAr: ['arcsin و arccos و arctan (النسب العكسية)', 'الحلول في الفترة [0°, 360°]', 'للـ sin: ربعان (1 و2)، للـ cos: ربعان (1 و4)، للـ tan: ربعان (1 و3)', 'الحلول الكاملة: +360°n'],
    keyConceptsEn: ['arcsin, arccos, arctan (inverse trig)', 'Solutions in [0°, 360°]', 'For sin: quadrants 1&2; cos: 1&4; tan: 1&3', 'General solutions: +360°n'],
    keyTerms: [
      { ar: 'الدالة العكسية للنسبة المثلثية', en: 'Inverse Trig Function', definitionAr: 'arcsin(k) تعطي الزاوية التي جيبها k، مجالها [−90°, 90°]', definitionEn: 'arcsin(k) gives the angle whose sine is k, range [−90°, 90°]' },
    ],
    rulesAr: ['sin x = k → x = arcsin(k) أو x = 180° − arcsin(k)', 'cos x = k → x = arccos(k) أو x = 360° − arccos(k)', 'tan x = k → x = arctan(k) أو x = 180° + arctan(k)'],
    rulesEn: ['sin x = k → x = arcsin(k) or x = 180° − arcsin(k)', 'cos x = k → x = arccos(k) or x = 360° − arccos(k)', 'tan x = k → x = arctan(k) or x = 180° + arctan(k)'],
    examplesAr: ['sin x = 0.5 في [0°,360°]: x = 30° أو x = 150°', 'cos x = −½: x = 120° أو x = 240°'],
    examplesEn: ['sin x = 0.5 in [0°,360°]: x = 30° or x = 150°', 'cos x = −½: x = 120° or x = 240°'],
  },

  // ── Unit 4: Applications of Trigonometry ──────────────
  {
    id: 'kbl-math-s2-4-1',
    unitId: 'kbu-math-s2-4',
    order: 1,
    titleAr: 'الاتجاه من الشمال',
    titleEn: 'Bearing (Direction from North)',
    summaryAr:
      'الاتجاه (البيرينج) هو زاوية تُقاس من الشمال باتجاه عقارب الساعة. يُكتب بثلاثة أرقام: 000° للشمال، 090° للشرق، 180° للجنوب، 270° للغرب. يُستخدم في الملاحة والمسائل التطبيقية. لحل المسائل نرسم مثلثًا ثم نطبق النسب المثلثية أو قوانين الجيوب/جيوب التمام.',
    summaryEn:
      'A bearing is an angle measured clockwise from north. Written as three digits: 000° = North, 090° = East, 180° = South, 270° = West. Used in navigation problems. To solve: draw a triangle then apply trig ratios or the sine/cosine rule.',
    keyConceptsAr: ['الاتجاه يُقاس من الشمال باتجاه عقارب الساعة', 'يُكتب بثلاثة أرقام: 000° إلى 360°', 'الشمال=000°، الشرق=090°، الجنوب=180°، الغرب=270°', 'رسم مثلث للمسألة ثم تطبيق القوانين المثلثية'],
    keyConceptsEn: ['Bearing measured clockwise from north', 'Written as three digits: 000° to 360°', 'North=000°, East=090°, South=180°, West=270°', 'Draw a triangle then apply trig laws'],
    keyTerms: [
      { ar: 'الاتجاه (البيرينج)', en: 'Bearing', definitionAr: 'زاوية تُقاس من اتجاه الشمال باتجاه عقارب الساعة للوصول إلى الاتجاه المطلوب', definitionEn: 'An angle measured clockwise from north to indicate a direction, written as three digits' },
    ],
    examplesAr: ['سفينة تسير بالاتجاه 045° تسير شمال شرق', 'من A إلى B الاتجاه 120°، من B إلى C الاتجاه 210°: أجد المسافة من A إلى C'],
    examplesEn: ['A ship on bearing 045° is heading northeast', 'A to B bearing 120°, B to C bearing 210°: find distance from A to C'],
  },
  {
    id: 'kbl-math-s2-4-2',
    unitId: 'kbu-math-s2-4',
    order: 2,
    titleAr: 'قانون الجيوب',
    titleEn: 'The Law of Sines',
    summaryAr:
      'في أي مثلث: a/sin A = b/sin B = c/sin C حيث a,b,c أطوال الأضلاع والزوايا A,B,C المقابلة لها. يُستخدم عندما نعرف: زاوية وضلعًا مقابلًا لها وزاوية أخرى (ZZض)، أو زاويتين وضلعًا (ZضZ). يُستخدم أيضًا لإيجاد زوايا مجهولة.',
    summaryEn:
      'In any triangle: a/sin A = b/sin B = c/sin C where a,b,c are side lengths and A,B,C are the opposite angles. Use when: angle-side-angle (ASA), angle-angle-side (AAS), or when two sides and a non-included angle are known (SSA — ambiguous case).',
    keyConceptsAr: ['a/sin A = b/sin B = c/sin C', 'يُستخدم عند معرفة زاوية وضلعها المقابل', 'حالة الغموض (ضضز): قد يوجد مثلثان', 'مثلثات حادة وقائمة ومنفرجة'],
    keyConceptsEn: ['a/sin A = b/sin B = c/sin C', 'Use when an angle and its opposite side are known', 'Ambiguous case (SSA): may give two triangles', 'Acute, right, and obtuse triangles'],
    keyTerms: [
      { ar: 'قانون الجيوب', en: 'Law of Sines', definitionAr: 'في أي مثلث: a/sin A = b/sin B = c/sin C', definitionEn: 'In any triangle: a/sin A = b/sin B = c/sin C' },
    ],
    rulesAr: ['a/sin A = b/sin B = c/sin C', 'يُستخدم عند توفر (زاوية + ضلعها المقابل + زاوية أو ضلع آخر)'],
    rulesEn: ['a/sin A = b/sin B = c/sin C', 'Use when you know one angle-side pair and one other element'],
    examplesAr: ['مثلث: A=40°، B=75°، a=8.3 → C=65°، b=8.3×sin75°/sin40°≈12.2'],
    examplesEn: ['Triangle: A=40°, B=75°, a=8.3 → C=65°, b=8.3×sin75°/sin40°≈12.2'],
  },
  {
    id: 'kbl-math-s2-4-3',
    unitId: 'kbu-math-s2-4',
    order: 3,
    titleAr: 'قانون جيوب التمام',
    titleEn: 'The Law of Cosines',
    summaryAr:
      'في أي مثلث: a² = b² + c² − 2bc·cos A. يُستخدم عندما نعرف ثلاثة أضلاع (ضضض)، أو ضلعَين والزاوية المحصورة بينهما (ضزض). يُعمِّم نظرية فيثاغورس: إذا كانت A = 90° فإن 2bc·cos 90° = 0.',
    summaryEn:
      'In any triangle: a² = b² + c² − 2bc·cos A. Use when: all three sides known (SSS), or two sides and the included angle (SAS). Generalizes Pythagoras: when A = 90°, the formula reduces to a² = b² + c².',
    keyConceptsAr: ['a² = b² + c² − 2bc·cos A', 'يُستخدم عند معرفة (ضضض) أو (ضزض)', 'تعميم لنظرية فيثاغورس', 'إيجاد أي زاوية من ثلاثة أضلاع: cos A = (b²+c²−a²)/(2bc)'],
    keyConceptsEn: ['a² = b² + c² − 2bc·cos A', 'Use for SSS or SAS', 'Generalization of Pythagorean theorem', 'Find angle from three sides: cos A = (b²+c²−a²)/(2bc)'],
    keyTerms: [
      { ar: 'قانون جيوب التمام', en: 'Law of Cosines', definitionAr: 'a² = b² + c² − 2bc·cos A في أي مثلث', definitionEn: 'a² = b² + c² − 2bc·cos A in any triangle' },
    ],
    rulesAr: ['a² = b² + c² − 2bc·cos A', 'b² = a² + c² − 2ac·cos B', 'c² = a² + b² − 2ab·cos C', 'cos A = (b²+c²−a²)/(2bc)'],
    rulesEn: ['a² = b² + c² − 2bc·cos A', 'b² = a² + c² − 2ac·cos B', 'c² = a² + b² − 2ab·cos C', 'cos A = (b²+c²−a²)/(2bc)'],
    examplesAr: ['مثلث: b=6, c=8, A=60°: a²=36+64−2×6×8×½=100−48=52 → a=√52≈7.2'],
    examplesEn: ['Triangle: b=6, c=8, A=60°: a²=36+64−2×6×8×½=100−48=52 → a=√52≈7.2'],
  },
  {
    id: 'kbl-math-s2-4-4',
    unitId: 'kbu-math-s2-4',
    order: 4,
    titleAr: 'مساحة المثلث باستعمال جيب الزاوية',
    titleEn: 'Area of a Triangle Using Sine',
    summaryAr:
      'مساحة المثلث = ½ × a × b × sin C حيث a وb ضلعان وC الزاوية المحصورة بينهما. تُستخدم هذه الصيغة عندما لا نعرف ارتفاع المثلث لكن نعرف ضلعَين والزاوية بينهما.',
    summaryEn:
      'Area of a triangle = ½ × a × b × sin C, where a and b are two sides and C is the included angle. Use this formula when the height is unknown but two sides and the included angle are known.',
    keyConceptsAr: ['مساحة المثلث = ½ab·sin C', 'C هي الزاوية المحصورة بين الضلعَين a وb', 'تُستخدم عندما لا يُعطى الارتفاع'],
    keyConceptsEn: ['Area = ½ab·sin C', 'C is the angle included between sides a and b', 'Use when height is not given'],
    keyTerms: [
      { ar: 'مساحة المثلث بالجيب', en: 'Triangle Area (Sine Formula)', definitionAr: 'مساحة = ½ × a × b × sin C حيث C الزاوية المحصورة بين a وb', definitionEn: 'Area = ½ × a × b × sin C where C is included between sides a and b' },
    ],
    rulesAr: ['مساحة = ½ × a × b × sin C'],
    rulesEn: ['Area = ½ × a × b × sin C'],
    examplesAr: ['مثلث: a=7, b=5, C=38°: المساحة = ½×7×5×sin38° = 17.5×0.616 ≈ 10.8 وحدة²'],
    examplesEn: ['Triangle: a=7, b=5, C=38°: Area = ½×7×5×sin38° = 17.5×0.616 ≈ 10.8 sq units'],
  },
  {
    id: 'kbl-math-s2-4-5',
    unitId: 'kbu-math-s2-4',
    order: 5,
    titleAr: 'حل مسائل ثلاثية الأبعاد',
    titleEn: 'Solving 3D Problems',
    summaryAr:
      'نحل مسائل الهندسة الفراغية بتحديد المثلثات المناسبة في المسألة ثم تطبيق النسب المثلثية أو قانون الجيوب أو جيوب التمام. الزاوية بين خط ومستوى: نسقط الخط على المستوى ونجد الزاوية بين الخط وإسقاطه.',
    summaryEn:
      'Solve 3D geometry problems by identifying relevant triangles and applying trig ratios, the sine rule, or the cosine rule. Angle between a line and a plane: project the line onto the plane and find the angle between the line and its projection.',
    keyConceptsAr: ['تحديد المثلثات في الشكل الفراغي', 'الزاوية بين خط ومستوى', 'إسقاط الخط على المستوى', 'تطبيق قوانين المثلثية في الفضاء'],
    keyConceptsEn: ['Identifying triangles in 3D figures', 'Angle between line and plane', 'Projecting a line onto a plane', 'Applying trig laws in 3D space'],
    keyTerms: [
      { ar: 'الزاوية بين خط ومستوى', en: 'Angle between Line and Plane', definitionAr: 'الزاوية بين الخط وإسقاطه الأفقي على المستوى', definitionEn: 'The angle between the line and its orthogonal projection onto the plane' },
    ],
    rulesAr: ['ارسم الشكل الفراغي وحدد المثلثات', 'طبّق النسب المثلثية أو قانون الجيوب أو جيوب التمام'],
    rulesEn: ['Draw the 3D figure and identify the relevant triangles', 'Apply trig ratios or sine/cosine rule'],
    examplesAr: ['مكعب طول ضلعه 5 cm: زاوية قطر الوجه مع قطر المكعب = arctan(5/√50) ≈ 35.3°'],
    examplesEn: ['Cube side 5 cm: angle between face diagonal and space diagonal = arctan(5/√50) ≈ 35.3°'],
  },
];

// ─────────────────────────────────────────────────────
// SEARCH UTILITIES
// ─────────────────────────────────────────────────────

/** Strip the most common Arabic one- or two-letter prefixes from a single word. */
function stripArabicPrefix(word: string): string {
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

  if (fieldLower.includes(queryLower)) return weight * 2;

  const qTokens = normalizeTokens(query);
  const fTokens = normalizeTokens(field);
  if (qTokens.length === 0 || fTokens.length === 0) return 0;

  let score = 0;
  for (const qt of qTokens) {
    if (qt.length < 2) continue;
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
 * Handles Arabic prefix variation and partial word matches.
 * Returns ranked results (most relevant first).
 */
export function searchKB(query: string, lang: 'ar' | 'en' = 'ar'): KBLesson[] {
  const q = query.trim();
  if (!q) return [];

  const scored = KB_LESSONS.map(lesson => {
    let score = 0;

    const title    = lang === 'ar' ? lesson.titleAr    : lesson.titleEn;
    const summary  = lang === 'ar' ? lesson.summaryAr  : lesson.summaryEn;
    const concepts = lang === 'ar' ? lesson.keyConceptsAr : lesson.keyConceptsEn;
    const terms    = lesson.keyTerms.map(t => lang === 'ar' ? t.ar : t.en);

    score += scoreField(q, title,   10);
    concepts.forEach(c => { score += scoreField(q, c, 4); });
    terms.forEach(t =>    { score += scoreField(q, t, 3); });
    score += scoreField(q, summary, 2);

    // Cross-check English side for mixed/transliterated queries
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
 * Semantic KB search that handles:
 *  • "semester 2 / الفصل الثاني" with no specific topic  → all S2 lessons
 *  • "first/second/... lesson (in semester N)"           → lesson by ordinal
 *  • Falls back to regular scoreField search otherwise
 *
 * Use this everywhere instead of bare searchKB so vague queries still return
 * useful context for the AI.
 */
export function searchKBSemantic(query: string, lang: 'ar' | 'en' = 'ar'): KBLesson[] {
  const q = query.trim();

  // Semester preference signals
  const prefersS2 = /فصل\s*(ال)?ثاني|semester\s*2|\bs2\b/i.test(q);
  const prefersS1 = /فصل\s*(ال)?(أول|اول)|semester\s*1|\bs1\b/i.test(q);

  // 1. Regular score-based search
  const regular = searchKB(q, lang);

  if (prefersS2 && regular.length > 0) {
    // Prefer S2 lessons when the query explicitly mentions semester 2
    const s2UnitIds = KB_UNITS.filter(u => u.bookId === 'kb-math-10-s2').map(u => u.id);
    const s2Results = regular.filter(l => s2UnitIds.includes(l.unitId));
    if (s2Results.length > 0) return s2Results;
  }
  if (regular.length > 0) return regular;

  // 2. Ordinal lesson references: "first lesson", "الدرس الأول", "الدرس الثاني في الفصل الثاني"
  const ordinals: [RegExp, number][] = [
    [/\b(أول|أولى|الأول|الأولى|first|1st|درس\s*1)\b/i, 1],
    [/\b(ثاني|ثانية|الثاني|الثانية|second|2nd|درس\s*2)\b/i, 2],
    [/\b(ثالث|ثالثة|الثالث|الثالثة|third|3rd|درس\s*3)\b/i, 3],
    [/\b(رابع|رابعة|الرابع|الرابعة|fourth|4th|درس\s*4)\b/i, 4],
    [/\b(خامس|خامسة|الخامس|الخامسة|fifth|5th|درس\s*5)\b/i, 5],
  ];

  const bookId = prefersS2 ? 'kb-math-10-s2' : 'kb-math-10-s1';
  const orderedLessons = getLessonsForBook(bookId);

  for (const [pattern, num] of ordinals) {
    if (pattern.test(q)) {
      const lesson = orderedLessons[num - 1];
      if (lesson) return [lesson];
    }
  }

  // 3. Bare semester query with no topic match → return first 4 lessons as overview
  if (prefersS2) return getLessonsForBook('kb-math-10-s2').slice(0, 4);
  if (prefersS1) return getLessonsForBook('kb-math-10-s1').slice(0, 4);

  return [];
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
