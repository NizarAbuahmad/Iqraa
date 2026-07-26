export interface Grade {
  id: string;
  name: string;
  level: number;
}

export interface Subject {
  id: string;
  name: string;
  icon: string;
  color: string;
  grades: string[];
}

export interface Book {
  id: string;
  title: string;
  subjectId: string;
  gradeId: string;
  academicYear: string;
  language: string;
  edition: string;
}

export interface Unit {
  id: string;
  bookId: string;
  name: string;
  description: string;
  order: number;
}

export interface Lesson {
  id: string;
  unitId: string;
  title: string;
  estimatedDuration: number; // minutes
  objectives: string[];
  keywords: string[];
  teacherNotes: string;
  outcomes: LearningOutcome[];
}

export interface LearningOutcome {
  id: string;
  lessonId: string;
  description: string;
  bloomsLevel: 'Remember' | 'Understand' | 'Apply' | 'Analyze' | 'Evaluate' | 'Create';
  skills: string[];
  notes?: string;
}

export const GRADES: Grade[] = Array.from({ length: 12 }, (_, i) => ({
  id: `grade-${i + 1}`,
  name: `Grade ${i + 1}`,
  level: i + 1,
}));

export const SUBJECTS: Subject[] = [
  { id: 'arabic', name: 'Arabic', icon: 'document-text', color: '#1B6B62', grades: GRADES.map(g => g.id) },
  { id: 'english', name: 'English', icon: 'language', color: '#3B82F6', grades: GRADES.map(g => g.id) },
  { id: 'mathematics', name: 'Mathematics', icon: 'calculator', color: '#8B5CF6', grades: GRADES.map(g => g.id) },
  { id: 'science', name: 'Science', icon: 'flask', color: '#10B981', grades: GRADES.slice(0, 9).map(g => g.id) },
  { id: 'physics', name: 'Physics', icon: 'nuclear', color: '#0EA5E9', grades: GRADES.slice(9).map(g => g.id) },
  { id: 'chemistry', name: 'Chemistry', icon: 'beaker', color: '#F97316', grades: GRADES.slice(9).map(g => g.id) },
  { id: 'biology', name: 'Biology', icon: 'leaf', color: '#22C55E', grades: GRADES.slice(9).map(g => g.id) },
  { id: 'islamic', name: 'Islamic Studies', icon: 'moon', color: '#F59E0B', grades: GRADES.map(g => g.id) },
  { id: 'social', name: 'Social Studies', icon: 'globe', color: '#EC4899', grades: GRADES.slice(0, 9).map(g => g.id) },
  { id: 'computer', name: 'Computer', icon: 'laptop', color: '#06B6D4', grades: GRADES.map(g => g.id) },
];

export function getSubjectsForGrade(gradeId: string): Subject[] {
  return SUBJECTS.filter(s => s.grades.includes(gradeId));
}

export const BOOKS: Book[] = [
  { id: 'book-math-10', title: 'Mathematics for Grade 10', subjectId: 'mathematics', gradeId: 'grade-10', academicYear: '2024-2025', language: 'Arabic', edition: '3rd' },
  { id: 'book-english-10', title: 'English for Jordan 10', subjectId: 'english', gradeId: 'grade-10', academicYear: '2024-2025', language: 'English', edition: '2nd' },
  { id: 'book-science-8', title: 'Science Book 8', subjectId: 'science', gradeId: 'grade-8', academicYear: '2024-2025', language: 'Arabic', edition: '1st' },
  { id: 'book-arabic-9', title: 'Arabic Language 9', subjectId: 'arabic', gradeId: 'grade-9', academicYear: '2024-2025', language: 'Arabic', edition: '4th' },
];

export const UNITS: Unit[] = [
  { id: 'unit-math-10-1', bookId: 'book-math-10', name: 'Algebra and Functions', description: 'Study of algebraic structures and function behavior', order: 1 },
  { id: 'unit-math-10-2', bookId: 'book-math-10', name: 'Geometry and Trigonometry', description: 'Geometric proofs and trigonometric identities', order: 2 },
  { id: 'unit-math-10-3', bookId: 'book-math-10', name: 'Statistics and Probability', description: 'Data analysis and probability distributions', order: 3 },
  { id: 'unit-eng-10-1', bookId: 'book-english-10', name: 'Communication Skills', description: 'Reading, writing, and speaking skills', order: 1 },
  { id: 'unit-eng-10-2', bookId: 'book-english-10', name: 'Literature and Culture', description: 'Exploring global and Jordanian literature', order: 2 },
  { id: 'unit-sci-8-1', bookId: 'book-science-8', name: 'Matter and Its Properties', description: 'Physical and chemical properties of matter', order: 1 },
  { id: 'unit-sci-8-2', bookId: 'book-science-8', name: 'Energy and Forces', description: 'Types of energy and Newtonian forces', order: 2 },
];

export const LESSONS: Lesson[] = [
  {
    id: 'lesson-1',
    unitId: 'unit-math-10-1',
    title: 'Introduction to Quadratic Functions',
    estimatedDuration: 45,
    objectives: [
      'Define quadratic functions and their standard form',
      'Identify key features: vertex, axis of symmetry, intercepts',
      'Graph quadratic functions using a table of values',
    ],
    keywords: ['quadratic', 'parabola', 'vertex', 'axis of symmetry', 'coefficient'],
    teacherNotes: 'Use graphing software to demonstrate the effect of changing coefficients. Connect to prior knowledge of linear functions.',
    outcomes: [
      { id: 'out-1-1', lessonId: 'lesson-1', description: 'Students can identify the vertex from standard and vertex form', bloomsLevel: 'Understand', skills: ['Critical thinking', 'Pattern recognition'] },
      { id: 'out-1-2', lessonId: 'lesson-1', description: 'Students can graph a quadratic function given its equation', bloomsLevel: 'Apply', skills: ['Mathematical reasoning', 'Graphing'] },
    ],
  },
  {
    id: 'lesson-2',
    unitId: 'unit-math-10-1',
    title: 'Solving Quadratic Equations by Factoring',
    estimatedDuration: 50,
    objectives: [
      'Factor quadratic expressions into linear factors',
      'Apply the zero product property to solve equations',
      'Verify solutions by substitution',
    ],
    keywords: ['factoring', 'zero product property', 'roots', 'GCF', 'trinomial'],
    teacherNotes: 'Start with simple cases (leading coefficient = 1) before moving to complex cases. Use collaborative group work.',
    outcomes: [
      { id: 'out-2-1', lessonId: 'lesson-2', description: 'Students factor quadratic expressions with a = 1 correctly', bloomsLevel: 'Apply', skills: ['Algebraic manipulation'] },
      { id: 'out-2-2', lessonId: 'lesson-2', description: 'Students solve real-world problems using quadratic equations', bloomsLevel: 'Analyze', skills: ['Problem solving', 'Modeling'] },
    ],
  },
  {
    id: 'lesson-3',
    unitId: 'unit-math-10-1',
    title: 'The Quadratic Formula',
    estimatedDuration: 45,
    objectives: [
      'Derive the quadratic formula by completing the square',
      'Apply the formula to solve any quadratic equation',
      'Interpret the discriminant to determine the nature of roots',
    ],
    keywords: ['quadratic formula', 'discriminant', 'completing the square', 'roots', 'complex numbers'],
    teacherNotes: 'Emphasize the discriminant as a tool. Practice estimating roots before computing exact values.',
    outcomes: [
      { id: 'out-3-1', lessonId: 'lesson-3', description: 'Students use the discriminant to classify the nature of roots', bloomsLevel: 'Analyze', skills: ['Analytical thinking'] },
    ],
  },
  {
    id: 'lesson-4',
    unitId: 'unit-sci-8-1',
    title: 'States of Matter',
    estimatedDuration: 40,
    objectives: [
      'Describe the properties of solids, liquids, and gases',
      'Explain changes of state using particle theory',
      'Conduct a simple experiment observing state changes',
    ],
    keywords: ['solid', 'liquid', 'gas', 'particle theory', 'melting', 'boiling', 'condensation'],
    teacherNotes: "Use ice → water → steam demonstration. Connect to students' daily experiences with cooking and weather.",
    outcomes: [
      { id: 'out-4-1', lessonId: 'lesson-4', description: 'Students explain state changes using kinetic molecular theory', bloomsLevel: 'Understand', skills: ['Scientific reasoning'] },
      { id: 'out-4-2', lessonId: 'lesson-4', description: 'Students design an experiment to observe state changes', bloomsLevel: 'Create', skills: ['Experimental design', 'Observation'] },
    ],
  },
  {
    id: 'lesson-5',
    unitId: 'unit-eng-10-1',
    title: 'Effective Paragraph Writing',
    estimatedDuration: 45,
    objectives: [
      'Identify the components of an effective paragraph',
      'Write a topic sentence, supporting details, and concluding sentence',
      'Use transitional phrases for cohesion',
    ],
    keywords: ['topic sentence', 'supporting details', 'transitions', 'coherence', 'cohesion'],
    teacherNotes: 'Use mentor texts from Jordanian contexts. Pair students for peer editing.',
    outcomes: [
      { id: 'out-5-1', lessonId: 'lesson-5', description: 'Students write a well-structured paragraph on a given topic', bloomsLevel: 'Create', skills: ['Writing', 'Organization'] },
    ],
  },
];

export function getLessonsForUnit(unitId: string): Lesson[] {
  return LESSONS.filter(l => l.unitId === unitId);
}

export function getUnitsForBook(bookId: string): Unit[] {
  return UNITS.filter(u => u.bookId === bookId);
}

export function getLessonById(id: string): Lesson | undefined {
  return LESSONS.find(l => l.id === id);
}

export const MOCK_NOTIFICATIONS = [
  { id: 'n1', title: 'New curriculum update', body: 'Grade 10 Mathematics curriculum has been updated for 2024-2025.', time: '2h ago', read: false, type: 'info' },
  { id: 'n2', title: 'Lesson plan ready', body: 'Your AI-generated lesson plan for "Quadratic Functions" is ready to review.', time: '4h ago', read: false, type: 'success' },
  { id: 'n3', title: 'School admin message', body: 'Midterm exam schedule has been posted. Please review your assigned rooms.', time: '1d ago', read: true, type: 'warning' },
  { id: 'n4', title: 'New teaching resource', body: 'A new worksheet template for Science Grade 8 has been added to the library.', time: '2d ago', read: true, type: 'info' },
  { id: 'n5', title: 'Profile incomplete', body: 'Complete your teacher profile to unlock all features.', time: '3d ago', read: true, type: 'info' },
];
