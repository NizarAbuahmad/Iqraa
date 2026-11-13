/**
 * Which of the book's lessons an item is about, for the families that hold
 * more than one.
 *
 * A family is what routing finds from a lesson's title (`matchMathFamily`), and
 * several hold two or three of the book's lessons: `trig_apps` is «قانون
 * الجيوب», «قانون جيب التمام» and the triangle-area lesson. Drawing from the
 * family alone put a law-of-cosines worked example at the top of a «قانون
 * الجيوب» worksheet (2026-11-13) — a lesson the class has not reached.
 *
 * So each item of such a family names its lesson here, and a lesson's title
 * names the item lessons it accepts. The worked example and the half-solved
 * question are taken only from those (`takeSolvedFromBank`); practice takes
 * them first and only then the rest of the family (`takeFromBank`), so a thin
 * lesson keeps its question count.
 *
 * A family with a single lesson has no entry and behaves as before. Every item
 * of a family listed in `SPLIT_FAMILIES` must have a focus — `lessonFocus.test.ts`.
 */

export type LessonFocus =
  | 'sine_rule'
  | 'cosine_rule'
  | 'triangle_area'
  | 'circle_measure'
  | 'arcs_sectors'
  | 'circle_equation'
  | 'trig_ratios'
  | 'trig_equations'
  | 'function_values'
  | 'composition'
  | 'inverse'
  | 'arith_sequence'
  | 'vector_plane'
  | 'vector_add'
  | 'dot_product'
  | 'central_tendency'
  | 'probability';

/** The families whose items are split by lesson. */
export const SPLIT_FAMILIES = ['trig_apps', 'circle', 'trig', 'functions', 'vectors', 'stats'] as const;

/** Each item of a split family, and the lesson it practises. */
export const ITEM_FOCUS: Record<string, LessonFocus> = {
  'ta-e1': 'triangle_area',
  'ta-m1': 'cosine_rule',
  'ta-h1': 'sine_rule',

  // Circumference and area of a whole circle are what an arc and a sector are a fraction of.
  'c-e1': 'circle_measure',
  'c-e2': 'circle_measure',
  'c-m2': 'arcs_sectors',
  'c-m1': 'circle_equation',
  'c-h1': 'circle_equation',

  't-e1': 'trig_ratios',
  't-e2': 'trig_ratios',
  't-e3': 'trig_ratios',
  't-m2': 'trig_ratios',
  't-m1': 'trig_equations',
  't-h1': 'trig_equations',

  'f-e1': 'function_values',
  'f-e2': 'function_values',
  'f-m1': 'composition',
  'f-m2': 'inverse',
  // An arithmetic sequence filed under functions: no functions lesson takes it as its own.
  'f-h1': 'arith_sequence',

  'v-e1': 'vector_plane',
  'v-e2': 'vector_plane',
  'v-m1': 'vector_add',
  'v-m2': 'dot_product',
  'v-h1': 'dot_product',

  's-e1': 'central_tendency',
  's-m1': 'central_tendency',
  's-e2': 'probability',
  's-m2': 'probability',
  's-h1': 'probability',
};

/**
 * A lesson title, and the item lessons it accepts. Order matters only where
 * two patterns could meet one title; «قانون جيب التمام» never matches «قانون
 * الجيوب», so neither can.
 */
const FOCUS_BY_TITLE: Array<[RegExp, LessonFocus[]]> = [
  [/قانون\s*الجيوب|law\s*of\s*sines|sine\s*rule/i, ['sine_rule']],
  [/جيب\s*التمام|law\s*of\s*cosines|cosine\s*rule/i, ['cosine_rule']],
  [/مساحة\s*المثلث|area\s*of\s*a\s*triangle/i, ['triangle_area']],
  [/الأقواس|القطاعات?|arcs?\b|sectors?\b/i, ['arcs_sectors', 'circle_measure']],
  [/معادلة\s*الدائرة|الدائرة\s*ومعادلتها|equation\s*of\s*a\s*circle/i, ['circle_equation']],
  [/محيط\s*الدائرة|مساحة\s*الدائرة|circumference/i, ['circle_measure']],
  [/المعادلات\s*المثلثية|trigonometric\s*equation/i, ['trig_equations']],
  [/النسب\s*المثلثية|trigonometric\s*ratio/i, ['trig_ratios']],
  // Composing two functions starts from evaluating one.
  [/تركيب\s*الاقترانات|composition/i, ['composition', 'function_values']],
  [/الاقتران\s*العكسي|inverse\s*function/i, ['inverse']],
  [/الضرب\s*القياسي|dot\s*product|scalar\s*product/i, ['dot_product']],
  [/جمع\s*المتجهات|طرح\s*المتجهات|adding\s*vectors|vector\s*addition/i, ['vector_add']],
  [/المتجهات\s*في\s*المستوى|vectors\s*in\s*the\s*plane/i, ['vector_plane']],
  [/احتمال|probabilit/i, ['probability']],
  [/الوسط\s*الحسابي|الوسيط|النزعة\s*المركزية|central\s*tendency/i, ['central_tendency']],
];

/**
 * The item lessons a lesson accepts, or null when its family is not split or
 * its title names none of them (a typed «المتجهات» takes the whole family).
 */
export function focusForTitles(titles: string[]): LessonFocus[] | null {
  for (const [re, focus] of FOCUS_BY_TITLE) {
    if (titles.some(t => re.test(t))) return focus;
  }
  return null;
}
