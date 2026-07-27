export interface Grade {
  id: string;
  name: string;
  nameAr: string;
  level: number;
}

export interface Subject {
  id: string;
  name: string;
  nameAr: string;
  icon: string;
  color: string;
  grades: string[];
}

export interface Book {
  id: string;
  title: string;
  titleAr: string;
  subjectId: string;
  gradeId: string;
  academicYear: string;
  language: string;
  edition: string;
  hasKnowledgeBase?: boolean; // true = sourced from uploaded PDF
}

export interface Unit {
  id: string;
  bookId: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  order: number;
}

export interface Lesson {
  id: string;
  unitId: string;
  title: string;
  titleAr: string;
  estimatedDuration: number;
  objectives: string[];
  objectivesAr: string[];
  keywords: string[];
  keywordsAr: string[];
  teacherNotes: string;
  teacherNotesAr: string;
  outcomes: LearningOutcome[];
}

export interface LearningOutcome {
  id: string;
  lessonId: string;
  description: string;
  descriptionAr: string;
  bloomsLevel: 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate' | 'Create';
  skills: string[];
}

// ─── Grades ───────────────────────────────────────────────────────────────────
export const GRADES: Grade[] = Array.from({ length: 12 }, (_, i) => ({
  id: `grade-${i + 1}`,
  name: `Grade ${i + 1}`,
  nameAr: [
    'الصف الأول', 'الصف الثاني', 'الصف الثالث', 'الصف الرابع',
    'الصف الخامس', 'الصف السادس', 'الصف السابع', 'الصف الثامن',
    'الصف التاسع', 'الصف العاشر', 'الصف الحادي عشر', 'الصف الثاني عشر',
  ][i],
  level: i + 1,
}));

// ─── Subjects ─────────────────────────────────────────────────────────────────
export const SUBJECTS: Subject[] = [
  { id: 'arabic',      name: 'Arabic',          nameAr: 'اللغة العربية',     icon: 'text',            color: '#1B6B62', grades: GRADES.map(g => g.id) },
  { id: 'english',     name: 'English',          nameAr: 'اللغة الإنجليزية', icon: 'language',        color: '#3B82F6', grades: GRADES.map(g => g.id) },
  { id: 'mathematics', name: 'Mathematics',      nameAr: 'الرياضيات',        icon: 'calculator',      color: '#8B5CF6', grades: GRADES.map(g => g.id) },
  { id: 'science',     name: 'Science',          nameAr: 'العلوم',           icon: 'flask',           color: '#10B981', grades: GRADES.slice(0, 9).map(g => g.id) },
  { id: 'physics',     name: 'Physics',          nameAr: 'الفيزياء',         icon: 'nuclear',         color: '#0EA5E9', grades: GRADES.slice(9).map(g => g.id) },
  { id: 'chemistry',   name: 'Chemistry',        nameAr: 'الكيمياء',         icon: 'beaker',          color: '#F97316', grades: GRADES.slice(9).map(g => g.id) },
  { id: 'biology',     name: 'Biology',          nameAr: 'الأحياء',          icon: 'leaf',            color: '#22C55E', grades: GRADES.slice(9).map(g => g.id) },
  { id: 'islamic',     name: 'Islamic Studies',  nameAr: 'التربية الإسلامية',icon: 'moon',            color: '#F59E0B', grades: GRADES.map(g => g.id) },
  { id: 'social',      name: 'Social Studies',   nameAr: 'الدراسات الاجتماعية', icon: 'globe',        color: '#EC4899', grades: GRADES.slice(0, 9).map(g => g.id) },
  { id: 'computer',    name: 'Computer',         nameAr: 'الحاسوب',          icon: 'laptop-outline',  color: '#06B6D4', grades: GRADES.map(g => g.id) },
];

export function getSubjectsForGrade(gradeId: string): Subject[] {
  return SUBJECTS.filter(s => s.grades.includes(gradeId));
}

// ─── Books ────────────────────────────────────────────────────────────────────
export const BOOKS: Book[] = [
  // ── Grade 10 — sourced from uploaded PDFs ──────────────────────────────────
  {
    id: 'book-chem-10',
    title: 'Chemistry – Grade 10, Semester 1',
    titleAr: 'الكيمياء – الصف العاشر – الفصل الأول',
    subjectId: 'chemistry',
    gradeId: 'grade-10',
    academicYear: '2024-2025',
    language: 'Arabic',
    edition: '2nd',
    hasKnowledgeBase: true,
  },
  {
    id: 'book-math-10',
    title: 'Mathematics – Grade 10, Semester 1',
    titleAr: 'الرياضيات – الصف العاشر – الفصل الأول',
    subjectId: 'mathematics',
    gradeId: 'grade-10',
    academicYear: '2024-2025',
    language: 'Arabic',
    edition: '3rd',
    hasKnowledgeBase: true,
  },
  {
    id: 'book-math-10-s2',
    title: 'Mathematics – Grade 10, Semester 2',
    titleAr: 'الرياضيات – الصف العاشر – الفصل الثاني',
    subjectId: 'mathematics',
    gradeId: 'grade-10',
    academicYear: '2024-2025',
    language: 'Arabic',
    edition: '3rd',
    hasKnowledgeBase: true,
  },
  // ── Other grades ───────────────────────────────────────────────────────────
  {
    id: 'book-english-10',
    title: 'English for Jordan 10',
    titleAr: 'اللغة الإنجليزية للصف العاشر',
    subjectId: 'english',
    gradeId: 'grade-10',
    academicYear: '2024-2025',
    language: 'English',
    edition: '2nd',
  },
  {
    id: 'book-science-8',
    title: 'Science – Grade 8',
    titleAr: 'العلوم – الصف الثامن',
    subjectId: 'science',
    gradeId: 'grade-8',
    academicYear: '2024-2025',
    language: 'Arabic',
    edition: '1st',
  },
  {
    id: 'book-arabic-9',
    title: 'Arabic Language – Grade 9',
    titleAr: 'اللغة العربية – الصف التاسع',
    subjectId: 'arabic',
    gradeId: 'grade-9',
    academicYear: '2024-2025',
    language: 'Arabic',
    edition: '4th',
  },
  {
    id: 'book-math-9',
    title: 'Mathematics – Grade 9',
    titleAr: 'الرياضيات – الصف التاسع',
    subjectId: 'mathematics',
    gradeId: 'grade-9',
    academicYear: '2024-2025',
    language: 'Arabic',
    edition: '2nd',
  },
  {
    id: 'book-phys-11',
    title: 'Physics – Grade 11',
    titleAr: 'الفيزياء – الصف الحادي عشر',
    subjectId: 'physics',
    gradeId: 'grade-11',
    academicYear: '2024-2025',
    language: 'Arabic',
    edition: '1st',
  },
];

// ─── Units ────────────────────────────────────────────────────────────────────
export const UNITS: Unit[] = [
  // Chemistry Grade 10 — from uploaded PDF
  {
    id: 'unit-chem-10-1',
    bookId: 'book-chem-10',
    name: 'Atomic Structure',
    nameAr: 'بنية الذرة وتركيبها',
    description: "Bohr's model, wave-mechanical model, quantum numbers, electron configuration",
    descriptionAr: 'نموذج بور، النموذج الميكانيكي الموجي، الأعداد الكمية، التوزيع الإلكتروني',
    order: 1,
  },
  {
    id: 'unit-chem-10-2',
    bookId: 'book-chem-10',
    name: 'Periodic Table and Element Properties',
    nameAr: 'الجدول الدوري وخواص العناصر',
    description: 'Periodic trends: atomic radius, ionization energy, electronegativity',
    descriptionAr: 'الخواص الدورية: نصف القطر الذري، طاقة التأين، الكهروسالبية',
    order: 2,
  },
  {
    id: 'unit-chem-10-3',
    bookId: 'book-chem-10',
    name: 'Chemical Bonding',
    nameAr: 'الروابط الكيميائية',
    description: 'Ionic, covalent (single/double/triple), sigma and pi bonds, metallic bonding',
    descriptionAr: 'الرابطة الأيونية، التساهمية (أحادية/ثنائية/ثلاثية)، رابطتا سيجما وباي، الرابطة الفلزية',
    order: 3,
  },

  // Math Grade 10 — from uploaded PDF
  {
    id: 'unit-math-10-1',
    bookId: 'book-math-10',
    name: 'Functions',
    nameAr: 'الاقترانات',
    description: 'Polynomial, rational, composition, inverse, and radical functions',
    descriptionAr: 'كثيرات الحدود، الاقترانات النسبية، تركيب الاقترانات، الاقتران العكسي والجذري',
    order: 1,
  },
  {
    id: 'unit-math-10-2',
    bookId: 'book-math-10',
    name: 'Analytic Geometry',
    nameAr: 'الهندسة التحليلية',
    description: 'Circles, parabolas, ellipses, and hyperbolas in the coordinate plane',
    descriptionAr: 'الدائرة، القطع المكافئ، القطع الناقص، القطع الزائد في المستوى الإحداثي',
    order: 2,
  },
  {
    id: 'unit-math-10-3',
    bookId: 'book-math-10',
    name: 'Trigonometry',
    nameAr: 'المثلثات',
    description: 'Trigonometric functions, identities, equations, and applications',
    descriptionAr: 'الدوال المثلثية، المتطابقات، المعادلات، والتطبيقات',
    order: 3,
  },
  {
    id: 'unit-math-10-8',
    bookId: 'book-math-10',
    name: 'Probability',
    nameAr: 'الاحتمال',
    description: 'Sample space, events, mutually exclusive, conditional probability',
    descriptionAr: 'فضاء العينة، الحوادث، المتنافية، الاحتمال الشرطي',
    order: 8,
  },

  // Other books
  {
    id: 'unit-eng-10-1',
    bookId: 'book-english-10',
    name: 'Communication Skills',
    nameAr: 'مهارات التواصل',
    description: 'Reading, writing, and speaking skills',
    descriptionAr: 'مهارات القراءة والكتابة والتحدث',
    order: 1,
  },
  {
    id: 'unit-sci-8-1',
    bookId: 'book-science-8',
    name: 'Matter and Its Properties',
    nameAr: 'المادة وخواصها',
    description: 'Physical and chemical properties of matter',
    descriptionAr: 'الخواص الفيزيائية والكيميائية للمادة',
    order: 1,
  },
];

// ─── Lessons ──────────────────────────────────────────────────────────────────
export const LESSONS: Lesson[] = [
  // ── Chemistry Grade 10: Atomic Structure ──────────────────────────────────
  {
    id: 'lesson-chem-1',
    unitId: 'unit-chem-10-1',
    title: "Bohr's Model of the Hydrogen Atom",
    titleAr: 'نظرية بور لذرة الهيدروجين',
    estimatedDuration: 45,
    objectives: [
      "State the postulates of Bohr's model",
      'Calculate energy levels using E = −13.6/n² eV',
      'Explain the line emission spectrum of hydrogen',
      'Distinguish between absorption and emission spectra',
    ],
    objectivesAr: [
      'يذكر مسلّمات نموذج بور',
      'يحسب مستويات الطاقة باستخدام E = −13.6/n²',
      'يفسر الطيف الخطي لانبعاث الهيدروجين',
      'يميز بين طيفَي الامتصاص والانبعاث',
    ],
    keywords: ['energy level', 'orbit', 'quantum', 'photon', 'emission spectrum', 'Bohr'],
    keywordsAr: ['مستوى الطاقة', 'مدار', 'كم', 'فوتون', 'طيف الانبعاث', 'بور'],
    teacherNotes: 'Use colored light demonstrations and spectroscopy tubes. Show hydrogen emission spectrum. Connect to everyday LED lighting.',
    teacherNotesAr: 'استخدم أنابيب الطيف لإظهار الطيف الذري. اربط الدرس بتطبيقات الليزر ومصابيح LED في الحياة اليومية.',
    outcomes: [
      { id: 'o-chem-1-1', lessonId: 'lesson-chem-1', description: 'Students explain electron transitions using energy levels', descriptionAr: 'يشرح الطلاب انتقالات الإلكترون باستخدام مستويات الطاقة', bloomsLevel: 'Understand', skills: ['Scientific reasoning'] },
      { id: 'o-chem-1-2', lessonId: 'lesson-chem-1', description: 'Students calculate the energy emitted during electron transitions', descriptionAr: 'يحسب الطلاب الطاقة المنبعثة خلال انتقالات الإلكترون', bloomsLevel: 'Apply', skills: ['Mathematical reasoning'] },
    ],
  },
  {
    id: 'lesson-chem-2',
    unitId: 'unit-chem-10-1',
    title: 'Wave-Mechanical Model of the Atom',
    titleAr: 'النموذج الميكانيكي الموجي للذرة',
    estimatedDuration: 50,
    objectives: [
      "State Heisenberg's uncertainty principle",
      'Describe the shapes of s, p, d, f orbitals',
      'Write electron configurations using Aufbau, Hund, and Pauli rules',
    ],
    objectivesAr: [
      'يذكر مبدأ هايزنبرغ للشك',
      'يصف أشكال الأفلاك s, p, d, f',
      'يكتب التوزيع الإلكتروني باستخدام مبدأ أوفباو وقاعدة هوند ومبدأ باولي',
    ],
    keywords: ['orbital', 'quantum number', 'Aufbau', "Hund's rule", 'Pauli', 'electron configuration'],
    keywordsAr: ['فلك', 'عدد كمي', 'أوفباو', 'قاعدة هوند', 'باولي', 'توزيع إلكتروني'],
    teacherNotes: 'Use 3D orbital models or interactive software. Have students practice writing configurations for the first 20 elements.',
    teacherNotesAr: 'استخدم النماذج ثلاثية الأبعاد للأفلاك. دع الطلاب يتدربون على كتابة التوزيع الإلكتروني لأول 20 عنصرًا.',
    outcomes: [
      { id: 'o-chem-2-1', lessonId: 'lesson-chem-2', description: 'Students write correct electron configurations for elements 1-36', descriptionAr: 'يكتب الطلاب التوزيعات الإلكترونية الصحيحة للعناصر 1-36', bloomsLevel: 'Apply', skills: ['Pattern recognition'] },
    ],
  },
  {
    id: 'lesson-chem-3',
    unitId: 'unit-chem-10-3',
    title: 'Ionic and Covalent Bonding',
    titleAr: 'الرابطة الأيونية والتساهمية',
    estimatedDuration: 50,
    objectives: [
      'Explain formation of ionic and covalent bonds',
      'Distinguish single, double, and triple covalent bonds',
      'Differentiate sigma (σ) and pi (π) bonds',
    ],
    objectivesAr: [
      'يفسر تكوّن الرابطتين الأيونية والتساهمية',
      'يميز بين الروابط التساهمية الأحادية والثنائية والثلاثية',
      'يفرق بين رابطة سيجما وباي',
    ],
    keywords: ['ionic bond', 'covalent bond', 'sigma bond', 'pi bond', 'single', 'double', 'triple'],
    keywordsAr: ['رابطة أيونية', 'رابطة تساهمية', 'سيجما', 'باي', 'أحادية', 'ثنائية', 'ثلاثية'],
    teacherNotes: "Use ball-and-stick models to show bond geometries. Compare H₂, O₂, N₂ as examples of single, double, triple bonds.",
    teacherNotesAr: 'استخدم نماذج الكرة والعصا لإظهار هندسة الروابط. قارن H₂ وO₂ وN₂ كأمثلة على الروابط الأحادية والثنائية والثلاثية.',
    outcomes: [
      { id: 'o-chem-3-1', lessonId: 'lesson-chem-3', description: 'Students draw Lewis structures for simple molecules', descriptionAr: 'يرسم الطلاب تراكيب لويس للجزيئات البسيطة', bloomsLevel: 'Apply', skills: ['Spatial reasoning'] },
    ],
  },

  // ── Math Grade 10: Functions ───────────────────────────────────────────────
  {
    id: 'lesson-math-1',
    unitId: 'unit-math-10-1',
    title: 'Polynomial Functions',
    titleAr: 'كثيرات الحدود وخصائصها',
    estimatedDuration: 45,
    objectives: [
      'Define polynomial functions and identify degree, leading coefficient',
      'Add, subtract, and multiply polynomials',
      'Divide polynomials using long division',
      'Graph polynomial functions and identify zeros',
    ],
    objectivesAr: [
      'يعرّف كثيرات الحدود ويحدد الدرجة والمعامل الرئيسي',
      'يجمع كثيرات الحدود ويطرحها ويضربها',
      'يقسم كثيرات الحدود باستخدام الطريقة الطويلة',
      'يمثل كثيرات الحدود بيانيًا ويحدد أصفارها',
    ],
    keywords: ['polynomial', 'degree', 'leading coefficient', 'zeros', 'roots', 'division'],
    keywordsAr: ['كثير الحدود', 'الدرجة', 'المعامل الرئيسي', 'الأصفار', 'الجذور', 'القسمة'],
    teacherNotes: 'Use graphing calculators or Desmos to visualize polynomial behavior. Emphasize the connection between zeros and x-intercepts.',
    teacherNotesAr: 'استخدم Desmos أو الآلة الحاسبة لتصور سلوك كثيرات الحدود. أبرز العلاقة بين الأصفار ونقاط التقاطع مع محور x.',
    outcomes: [
      { id: 'o-math-1-1', lessonId: 'lesson-math-1', description: 'Students perform operations on polynomial expressions', descriptionAr: 'يجري الطلاب العمليات الحسابية على كثيرات الحدود', bloomsLevel: 'Apply', skills: ['Algebraic manipulation'] },
      { id: 'o-math-1-2', lessonId: 'lesson-math-1', description: 'Students find zeros of polynomial functions', descriptionAr: 'يجد الطلاب أصفار كثيرات الحدود', bloomsLevel: 'Analyze', skills: ['Problem solving'] },
    ],
  },
  {
    id: 'lesson-math-2',
    unitId: 'unit-math-10-1',
    title: 'Rational Functions',
    titleAr: 'الاقترانات النسبية',
    estimatedDuration: 45,
    objectives: [
      'Define rational functions and find their domains',
      'Identify vertical and horizontal asymptotes',
      'Graph rational functions',
    ],
    objectivesAr: [
      'يعرّف الاقترانات النسبية ويجد مجالها',
      'يحدد المقاربات الرأسية والأفقية',
      'يمثل الاقترانات النسبية بيانيًا',
    ],
    keywords: ['rational function', 'domain', 'vertical asymptote', 'horizontal asymptote'],
    keywordsAr: ['اقتران نسبي', 'مجال', 'مقاربة رأسية', 'مقاربة أفقية'],
    teacherNotes: 'Stress that the denominator cannot equal zero. Use a table of values near the asymptotes to show behavior.',
    teacherNotesAr: 'ركز على أن المقام لا يمكن أن يساوي صفرًا. استخدم جدول قيم بالقرب من المقاربات لإظهار سلوك الاقتران.',
    outcomes: [
      { id: 'o-math-2-1', lessonId: 'lesson-math-2', description: 'Students determine domain and asymptotes of rational functions', descriptionAr: 'يحدد الطلاب مجال الاقترانات النسبية ومقارباتها', bloomsLevel: 'Analyze', skills: ['Analytical thinking'] },
    ],
  },
  {
    id: 'lesson-math-3',
    unitId: 'unit-math-10-1',
    title: 'Function Composition and Inverse Functions',
    titleAr: 'تركيب الاقترانات والاقتران العكسي',
    estimatedDuration: 50,
    objectives: [
      'Compute (f∘g)(x) and (g∘f)(x)',
      'Find the inverse function f⁻¹ algebraically',
      'Verify inverses using composition',
      'Graph radical functions and their inverses',
    ],
    objectivesAr: [
      'يحسب (f∘g)(x) و (g∘f)(x)',
      'يجد الاقتران العكسي جبريًا',
      'يتحقق من العكوس باستخدام التركيب',
      'يمثل الاقترانات الجذرية وعكوسها بيانيًا',
    ],
    keywords: ['composition', 'inverse function', 'radical', 'domain', 'reflection', 'y=x'],
    keywordsAr: ['تركيب', 'اقتران عكسي', 'جذري', 'مجال', 'انعكاس', 'y=x'],
    teacherNotes: 'Emphasize that f(f⁻¹(x)) = x. Show graphically that f⁻¹ is a reflection of f across the line y = x.',
    teacherNotesAr: 'أكد أن f(f⁻¹(x)) = x. أظهر بيانيًا أن f⁻¹ انعكاس لـ f حول المستقيم y = x.',
    outcomes: [
      { id: 'o-math-3-1', lessonId: 'lesson-math-3', description: 'Students find inverse functions and verify using composition', descriptionAr: 'يجد الطلاب الاقتران العكسي ويتحقق منه باستخدام التركيب', bloomsLevel: 'Evaluate', skills: ['Algebraic reasoning'] },
    ],
  },
  {
    id: 'lesson-math-8-1',
    unitId: 'unit-math-10-8',
    title: 'Basic Probability Concepts',
    titleAr: 'مفاهيم الاحتمال الأساسية',
    estimatedDuration: 45,
    objectives: [
      'Define sample space, events, and probability',
      'Calculate P(E) = n(E)/n(Ω)',
      'Apply complementary probability P(Ā) = 1 − P(A)',
    ],
    objectivesAr: [
      'يعرّف فضاء العينة والحوادث والاحتمال',
      'يحسب P(E) = n(E)/n(Ω)',
      'يطبق احتمال المتممة P(Ā) = 1 − P(A)',
    ],
    keywords: ['probability', 'sample space', 'event', 'complement', 'random experiment'],
    keywordsAr: ['احتمال', 'فضاء العينة', 'حادث', 'متممة', 'تجربة عشوائية'],
    teacherNotes: 'Use dice, coins, and cards as concrete probability experiments. Have students collect real data and compare experimental vs. theoretical probability.',
    teacherNotesAr: 'استخدم النرد والعملات المعدنية والبطاقات كتجارب ملموسة. اطلب من الطلاب مقارنة الاحتمال التجريبي بالنظري.',
    outcomes: [
      { id: 'o-math-8-1', lessonId: 'lesson-math-8-1', description: 'Students calculate probabilities for simple events', descriptionAr: 'يحسب الطلاب احتمالات الحوادث البسيطة', bloomsLevel: 'Apply', skills: ['Numerical reasoning'] },
    ],
  },
  {
    id: 'lesson-math-8-2',
    unitId: 'unit-math-10-8',
    title: 'Mutually Exclusive and Non-Exclusive Events',
    titleAr: 'الحوادث المتنافية وغير المتنافية',
    estimatedDuration: 45,
    objectives: [
      'Identify mutually exclusive events (A ∩ B = ∅)',
      'Apply P(A∪B) = P(A) + P(B) for mutually exclusive events',
      'Apply P(A∪B) = P(A) + P(B) − P(A∩B) for non-exclusive events',
    ],
    objectivesAr: [
      'يحدد الحوادث المتنافية (A ∩ B = ∅)',
      'يطبق P(A∪B) = P(A) + P(B) للحوادث المتنافية',
      'يطبق P(A∪B) = P(A) + P(B) − P(A∩B) للحوادث غير المتنافية',
    ],
    keywords: ['mutually exclusive', 'union', 'intersection', 'addition rule', 'Venn diagram'],
    keywordsAr: ['متنافية', 'اتحاد', 'تقاطع', 'قاعدة الجمع', 'مخطط ڤن'],
    teacherNotes: 'Use Venn diagrams extensively. Show with dice: rolling a 1 and rolling an even number are mutually exclusive; rolling even and rolling <3 are not.',
    teacherNotesAr: 'استخدم مخططات ڤن بشكل مكثف. بيّن بالنرد: ظهور 1 وظهور عدد زوجي متنافيان، بينما زوجي وأقل من 3 غير متنافيَين.',
    outcomes: [
      { id: 'o-math-8-2', lessonId: 'lesson-math-8-2', description: 'Students apply the addition rule to find P(A∪B)', descriptionAr: 'يطبق الطلاب قاعدة الجمع لإيجاد P(A∪B)', bloomsLevel: 'Apply', skills: ['Logical reasoning'] },
    ],
  },

  // ── Other books ───────────────────────────────────────────────────────────
  {
    id: 'lesson-sci-1',
    unitId: 'unit-sci-8-1',
    title: 'States of Matter',
    titleAr: 'حالات المادة',
    estimatedDuration: 40,
    objectives: ['Describe solids, liquids, gases', 'Explain state changes using particle theory'],
    objectivesAr: ['يصف الصلب والسائل والغاز', 'يفسر تغيرات الحالة باستخدام نظرية الجسيمات'],
    keywords: ['solid', 'liquid', 'gas', 'particle theory', 'melting', 'boiling'],
    keywordsAr: ['صلب', 'سائل', 'غاز', 'نظرية الجسيمات', 'انصهار', 'غليان'],
    teacherNotes: "Use ice-to-water-to-steam demonstration. Connect to students' daily experiences.",
    teacherNotesAr: 'استخدم تجربة الجليد إلى الماء إلى البخار. اربط بتجارب الطلاب اليومية.',
    outcomes: [
      { id: 'o-sci-1-1', lessonId: 'lesson-sci-1', description: 'Students explain state changes using kinetic theory', descriptionAr: 'يشرح الطلاب تغيرات الحالة باستخدام النظرية الحركية', bloomsLevel: 'Understand', skills: ['Scientific reasoning'] },
    ],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
export function getLessonsForUnit(unitId: string): Lesson[] {
  return LESSONS.filter(l => l.unitId === unitId);
}

export function getUnitsForBook(bookId: string): Unit[] {
  return UNITS.filter(u => u.bookId === bookId).sort((a, b) => a.order - b.order);
}

export function getLessonById(id: string): Lesson | undefined {
  return LESSONS.find(l => l.id === id);
}

export function getBooksForSubjectGrade(subjectId: string, gradeId: string): Book[] {
  return BOOKS.filter(b => b.subjectId === subjectId && b.gradeId === gradeId);
}

// ─── Notifications ────────────────────────────────────────────────────────────
export const MOCK_NOTIFICATIONS = [
  { id: 'n1', title: 'تحديث المنهج', titleEn: 'Curriculum Update', body: 'تم تحديث منهج الكيمياء للصف العاشر للعام 2024-2025.', bodyEn: 'Grade 10 Chemistry curriculum updated for 2024-2025.', time: 'منذ ساعتين', timeEn: '2h ago', read: false, type: 'info' },
  { id: 'n2', title: 'خطة الدرس جاهزة', titleEn: 'Lesson Plan Ready', body: 'خطة الدرس التي ولّدها الذكاء الاصطناعي لموضوع الروابط الكيميائية جاهزة.', bodyEn: 'AI-generated lesson plan for Chemical Bonding is ready.', time: 'منذ 4 ساعات', timeEn: '4h ago', read: false, type: 'success' },
  { id: 'n3', title: 'رسالة المدير', titleEn: 'Admin Message', body: 'جدول الاختبارات النصفية متاح. يرجى مراجعة القاعات المخصصة.', bodyEn: 'Midterm exam schedule posted. Please review your assigned rooms.', time: 'منذ يوم', timeEn: '1d ago', read: true, type: 'warning' },
  { id: 'n4', title: 'مورد تعليمي جديد', titleEn: 'New Resource', body: 'تمت إضافة ورقة عمل جديدة لمادة العلوم – الصف الثامن.', bodyEn: 'New worksheet for Science Grade 8 has been added.', time: 'منذ يومين', timeEn: '2d ago', read: true, type: 'info' },
  { id: 'n5', title: 'الملف الشخصي غير مكتمل', titleEn: 'Incomplete Profile', body: 'أكمل ملفك الشخصي لفتح جميع الميزات.', bodyEn: 'Complete your teacher profile to unlock all features.', time: 'منذ 3 أيام', timeEn: '3d ago', read: true, type: 'info' },
];
