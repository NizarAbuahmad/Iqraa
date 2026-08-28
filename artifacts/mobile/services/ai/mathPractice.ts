/**
 * Shared concrete math practice for DEMO_MODE generators.
 * Worksheet / quiz / homework / activity all pull from here so math never
 * falls back to abstract meta-prompts ("اشرح كيف يساعدك فهم X").
 */
import type { KBLesson } from '../knowledgeBase.ts';
import { getBookForLesson } from '../knowledgeBase.ts';

export type Lang = 'ar' | 'en';
export type QType = 'multiple_choice' | 'short_answer' | 'fill_blank' | 'true_false' | 'word_problem';
export type DiffTier = 'easy' | 'medium' | 'hard';

export interface PracticeWQ {
  text: string;
  options?: string[];
  answer: string;
  points: number;
}

type MathFamily =
  | 'exp_eq'
  | 'system_graph'
  | 'linear_quad'
  | 'quad_system'
  | 'simplify_exp'
  | 'circle'
  | 'trig'
  | 'trig_apps'
  | 'functions'
  | 'derivative'
  | 'vectors'
  | 'stats'
  | 'algebra';

interface ConcreteItem {
  id: string;
  family: MathFamily;
  diff: DiffTier;
  /** Canonical problem (short-answer / solve stem). */
  eq: string;
  answer: string;
  wrongs: string[];
  eq2?: string;
  kind?: 'single' | 'system' | 'word' | 'simplify' | 'graph';
  wordAr?: string;
  wordEn?: string;
  /** Optional stem overrides */
  promptAr?: string;
  promptEn?: string;
}

// ─── Session dedupe (one generation pass) ────────────────────────────────────

const usedIds = new Set<string>();

export function beginMathPracticeSession(): void {
  usedIds.clear();
}

export function lessonTextBlob(topic: string, kb: KBLesson | null): string {
  return [
    topic,
    kb?.id ?? '',
    kb?.titleAr ?? '',
    kb?.titleEn ?? '',
    ...(kb?.objectives ?? []),
    ...(kb?.keyConceptsAr ?? []),
    ...(kb?.keyConceptsEn ?? []),
  ].join(' ');
}

/**
 * Subject names — `Subject.name`/`.nameAr` from `lib/curriculum/src/catalog.ts` —
 * that are known and are NOT mathematics. Matched, not imported: this file has
 * no dependency on `@workspace/curriculum`, and duplicating the handful of
 * names as a regex is cheaper than adding one for a single lookup.
 */
const KNOWN_NON_MATH_SUBJECT = /^(chemistry|الكيمياء|physics|الفيزياء|biology|الأحياء|science|العلوم|financial literacy|الثقافة المالية|arabic|اللغة العربية|english|اللغة الإنجليزية|islamic studies|التربية الإسلامية|social studies|الدراسات الاجتماعية|computer|الحاسوب)$/i;

const MATH_TEXT_RE = /رياضيات|math|kbl-math|kbu-math|kb-math|معادل|أسي|أسس|دائر|مثلث|جيوب|جيب|اقتران|مشتق|متجه|احتمال|إحصاء|جيوجبرا|geogebra|quadratic|trigon|derivative|vector|circle|exponent|polynomial|sequence|statistic|probabilit/i;

/**
 * Is this generation for a maths lesson?
 *
 * Subject is authoritative, not additive: a chemistry lesson on «المعادلة
 * الكيميائية» (chemical *equation*) or a finance lesson mentioning «تراكم
 * أسي» (exponential growth) used to still flip this to `true`, because the
 * old version only ever appended `subject` to the same blob it ran one regex
 * over — the topic/lesson text could still out-vote a correctly-passed
 * non-math subject. See CLAUDE.md: "Generators branch on the subject NAME."
 *
 * `kb`, when present, is the ground truth — its own book's `subjectId` is
 * looked up directly rather than trusting the caller's `subject` string a
 * second time. `subject` is the fallback for an ungrounded topic (no KB
 * lesson resolved) where nothing else names the subject. Only when neither
 * gives a real answer does this fall back to the old topic/lesson-text
 * heuristic, which is still what free-text topics with no picked lesson need.
 */
export function isMathContext(topic: string, kb: KBLesson | null, subject?: string): boolean {
  const kbSubjectId = kb ? getBookForLesson(kb)?.subjectId : undefined;
  if (kbSubjectId) return kbSubjectId === 'mathematics';

  const s = subject?.trim();
  if (s) {
    if (KNOWN_NON_MATH_SUBJECT.test(s)) return false;
    if (/^(mathematics|رياضيات|math)$/i.test(s)) return true;
  }

  return MATH_TEXT_RE.test(lessonTextBlob(topic, kb));
}

export function detectMathFamily(topic: string, kb: KBLesson | null): MathFamily {
  const blob = lessonTextBlob(topic, kb);
  if (/u1_l4|معادلة\s*الأسية|معادلات\s*أسية|exponential\s*equation/i.test(blob)) return 'exp_eq';
  if (/u1_lab|جيوجبرا|geogebra|بيانيا|graphically|graphical/i.test(blob)) return 'system_graph';
  if (/u1_l1|خطية ومعادلة تربيعية|linear.*quadratic|quadratic.*linear/i.test(blob)) return 'linear_quad';
  if (/u1_l2|معادلتين تربيعيتين|two\s*quadratic/i.test(blob)) return 'quad_system';
  if (/u1_l3|تبسيط.*أسي|مقادير أسية|simplify.*exponent|rational\s*exponent/i.test(blob)) return 'simplify_exp';
  if (/دائر|circle|وتر|قطاع|معادلة الدائرة/i.test(blob)) return 'circle';
  if (/تطبيقات المثلث|bearing|قانون الجيوب|جيب التمام|ثلاثية الأبعاد/i.test(blob)) return 'trig_apps';
  if (/مثلث|trigon|نسب مثلثية|اقترانات مثلثية/i.test(blob)) return 'trig';
  if (/مشتق|derivative|ميل المنحنى|اشتقاق/i.test(blob)) return 'derivative';
  if (/متجه|vector/i.test(blob)) return 'vectors';
  if (/إحصاء|احتمال|statistic|probabilit|تكرار|انتشار/i.test(blob)) return 'stats';
  if (/اقتران|function|كثيرات الحدود|متتالي/i.test(blob)) return 'functions';
  return 'algebra';
}

function placeCorrect(correct: string, wrongs: string[]): string[] {
  const pos = Math.floor(Math.random() * (wrongs.length + 1));
  return [...wrongs.slice(0, pos), correct, ...wrongs.slice(pos)];
}

/**
 * A leading `label = ` on an answer: `f'(x) = 2x`, `|v| = 5`, `الميل = 6`.
 *
 * The label must be a single token — no spaces — so this cannot mistake the
 * `=` inside «متعامدان (الضرب القياسي = 0)» or «قيم حرجة عند x = ±1» for a
 * prefix and slice the answer in half.
 */
const ANSWER_LABEL = /^([^\s=]{1,12})\s*=\s*(.+)$/u;

/**
 * Make all four options the same shape.
 *
 * The bank stores answers labelled and distractors bare — answer
 * `f'(x) = 3x² − 4` against wrongs `3x²`, `x² − 4`, `3x − 4`. Projected, the
 * correct option was the only one carrying a prefix, so a student could pick
 * it without doing any maths, and the same tell ran through the vectors,
 * statistics and functions items too. Whatever else a distractor is for, it
 * cannot be eliminable on sight.
 *
 * Only strips when the distractors are bare. Where they carry their own
 * labels (`x = 5`, `x = 11`) the set is already consistent and is left
 * alone — stripping there would remove the `x =` that makes the answer
 * readable.
 */
function levelOptionShape(
  correct: string,
  wrongs: string[],
): { correct: string; wrongs: string[] } {
  const labelled = correct.match(ANSWER_LABEL);
  if (!labelled) return { correct, wrongs };
  if (wrongs.some(w => w.includes('='))) return { correct, wrongs };
  return { correct: labelled[2]!.trim(), wrongs };
}

// ─── Concrete banks (real solvable items — not meta prompts) ─────────────────

const BANK: ConcreteItem[] = [
  // ── Exponential equations ──
  { id: 'exp-e1', family: 'exp_eq', diff: 'easy', eq: '2^x = 32', answer: 'x = 5', wrongs: ['x = 4', 'x = 6', 'x = 16'] },
  { id: 'exp-e2', family: 'exp_eq', diff: 'easy', eq: '3^x = 27', answer: 'x = 3', wrongs: ['x = 2', 'x = 9', 'x = 4'] },
  { id: 'exp-e3', family: 'exp_eq', diff: 'easy', eq: '5^x = 125', answer: 'x = 3', wrongs: ['x = 2', 'x = 5', 'x = 25'] },
  { id: 'exp-e4', family: 'exp_eq', diff: 'easy', eq: '2^x = 16', answer: 'x = 4', wrongs: ['x = 3', 'x = 8', 'x = 2'] },
  { id: 'exp-e5', family: 'exp_eq', diff: 'easy', eq: '10^x = 1000', answer: 'x = 3', wrongs: ['x = 2', 'x = 4', 'x = 100'] },
  { id: 'exp-e6', family: 'exp_eq', diff: 'easy', eq: '4^x = 64', answer: 'x = 3', wrongs: ['x = 2', 'x = 4', 'x = 16'] },
  { id: 'exp-m1', family: 'exp_eq', diff: 'medium', eq: '2^{x+1} = 32', answer: 'x = 4', wrongs: ['x = 5', 'x = 3', 'x = 16'] },
  { id: 'exp-m2', family: 'exp_eq', diff: 'medium', eq: '3^{2x} = 81', answer: 'x = 2', wrongs: ['x = 4', 'x = 3', 'x = 1'] },
  { id: 'exp-m3', family: 'exp_eq', diff: 'medium', eq: '4^x = 2^{x+3}', answer: 'x = 3', wrongs: ['x = 2', 'x = 1.5', 'x = 6'] },
  { id: 'exp-m4', family: 'exp_eq', diff: 'medium', eq: '9^x = 27', answer: 'x = 3/2', wrongs: ['x = 2', 'x = 3', 'x = 1/2'] },
  { id: 'exp-m5', family: 'exp_eq', diff: 'medium', eq: '8^x = 4^{x+1}', answer: 'x = 2', wrongs: ['x = 1', 'x = 4', 'x = 3'] },
  { id: 'exp-m6', family: 'exp_eq', diff: 'medium', eq: '5^{x-1} = 25', answer: 'x = 3', wrongs: ['x = 2', 'x = 1', 'x = 4'] },
  { id: 'exp-h1', family: 'exp_eq', diff: 'hard', eq: '2^x = 4^y', eq2: 'x + y = 6', answer: 'x = 4 ، y = 2', wrongs: ['x = 2 ، y = 4', 'x = 3 ، y = 3', 'x = 6 ، y = 0'], kind: 'system' },
  { id: 'exp-h2', family: 'exp_eq', diff: 'hard', eq: '3^x = 9^y', eq2: 'x − y = 1', answer: 'x = 2 ، y = 1', wrongs: ['x = 1 ، y = 0', 'x = 3 ، y = 2', 'x = 4 ، y = 3'], kind: 'system' },
  { id: 'exp-h3', family: 'exp_eq', diff: 'hard', eq: '4^{x} = 8^{x-1}', answer: 'x = 3', wrongs: ['x = 2', 'x = 1', 'x = 4'] },
  { id: 'exp-h4', family: 'exp_eq', diff: 'hard', eq: '2^{x+2} = 2^x + 12', answer: 'x = 2', wrongs: ['x = 1', 'x = 3', 'x = 4'] },
  {
    id: 'exp-h5', family: 'exp_eq', diff: 'hard', eq: '2^t = 32', answer: 't = 5', wrongs: ['t = 4', 't = 6', 't = 32'], kind: 'word',
    wordAr: 'تتضاعف مستعمرة بكتيريا كل ساعة: N = N₀ · 2^t. متى تصبح المستعمرة 32 ضعف الحجم الابتدائي؟ اكتب المعادلة وحلّها.',
    wordEn: 'Bacteria double each hour: N = N₀ · 2^t. After how many hours is the colony 32× initial size? Write and solve.',
  },

  // ── Graphical systems (GeoGebra lab) ──
  { id: 'g-e1', family: 'system_graph', diff: 'easy', eq: 'y = x + 1', eq2: 'y = −x + 3', answer: '(1 ، 2)', wrongs: ['(2 ، 1)', '(0 ، 1)', '(3 ، 0)'], kind: 'graph', promptAr: 'أوجد نقطة تقاطع المستقيمين بيانياً أو جبرياً:\ny = x + 1\ny = −x + 3', promptEn: 'Find the intersection of:\ny = x + 1\ny = −x + 3' },
  { id: 'g-e2', family: 'system_graph', diff: 'easy', eq: 'y = 2x', eq2: 'y = −x + 6', answer: '(2 ، 4)', wrongs: ['(3 ، 6)', '(1 ، 2)', '(0 ، 6)'], kind: 'graph', promptAr: 'أوجد نقطة تقاطع:\ny = 2x\ny = −x + 6', promptEn: 'Find the intersection of:\ny = 2x\ny = −x + 6' },
  { id: 'g-m1', family: 'system_graph', diff: 'medium', eq: 'y = x²', eq2: 'y = x + 2', answer: '(−1 ، 1) و (2 ، 4)', wrongs: ['(0 ، 0) فقط', '(1 ، 1) و (2 ، 4)', 'لا تقاطع'], kind: 'graph', promptAr: 'كم نقطة تقاطع للمنحنى y = x² والمستقيم y = x + 2؟ أوجدها.', promptEn: 'How many intersections does y = x² have with y = x + 2? Find them.' },
  { id: 'g-m2', family: 'system_graph', diff: 'medium', eq: 'y = x² − 4', eq2: 'y = 0', answer: '(−2 ، 0) و (2 ، 0)', wrongs: ['(0 ، −4) فقط', '(4 ، 0)', 'لا تقاطع'], kind: 'graph', promptAr: 'أوجد نقاط تقاطع y = x² − 4 مع المحور السيني (y = 0).', promptEn: 'Find where y = x² − 4 meets the x-axis (y = 0).' },
  { id: 'g-m3', family: 'system_graph', diff: 'medium', eq: 'y = x² − 1', eq2: 'y = 2x + 2', answer: '(−1 ، 0) و (3 ، 8)', wrongs: ['(1 ، 0)', '(0 ، −1)', 'لا تقاطع'], kind: 'graph', promptAr: 'حل النظام بيانياً/جبرياً:\ny = x² − 1\ny = 2x + 2', promptEn: 'Solve graphically/algebraically:\ny = x² − 1\ny = 2x + 2' },
  { id: 'g-h1', family: 'system_graph', diff: 'hard', eq: 'y = x² − 2x', eq2: 'y = x', answer: '(0 ، 0) و (3 ، 3)', wrongs: ['(1 ، 1)', '(2 ، 2)', 'لا تقاطع'], kind: 'graph', promptAr: 'أوجد حلول النظام:\ny = x² − 2x\ny = x', promptEn: 'Solve:\ny = x² − 2x\ny = x' },
  { id: 'g-h2', family: 'system_graph', diff: 'hard', eq: 'y = x² + 1', eq2: 'y = −x² + 3', answer: '(−1 ، 2) و (1 ، 2)', wrongs: ['(0 ، 1)', '(2 ، 5)', 'لا تقاطع'], kind: 'graph', promptAr: 'أوجد نقاط تقاطع المنحنيَين:\ny = x² + 1\ny = −x² + 3', promptEn: 'Find intersections of:\ny = x² + 1\ny = −x² + 3' },
  {
    id: 'g-h3', family: 'system_graph', diff: 'hard', eq: 'y = 2x + 1', eq2: 'y = x² − 3', answer: 'نقطتا تقاطع', wrongs: ['لا تقاطع', 'نقطة واحدة', 'ثلاث نقاط'], kind: 'word',
    wordAr: 'باستخدام جيوجبرا (أو بالرسم): مثّل y = 2x + 1 و y = x² − 3. كم نقطة تقاطع تظهر؟ ثم تحقق جبرياً.',
    wordEn: 'Using GeoGebra (or by hand): graph y = 2x + 1 and y = x² − 3. How many intersections? Verify algebraically.',
  },

  // ── Linear + quadratic system ──
  { id: 'lq-e1', family: 'linear_quad', diff: 'easy', eq: 'y = x', eq2: 'y = x²', answer: '(0 ، 0) و (1 ، 1)', wrongs: ['(2 ، 2)', 'لا حل', '(−1 ، −1)'], kind: 'system', promptAr: 'حل النظام:\ny = x\ny = x²', promptEn: 'Solve:\ny = x\ny = x²' },
  { id: 'lq-e2', family: 'linear_quad', diff: 'easy', eq: 'y = 2', eq2: 'y = x² − 2', answer: '(−2 ، 2) و (2 ، 2)', wrongs: ['(0 ، −2)', '(1 ، 2)', 'لا حل'], kind: 'system', promptAr: 'حل النظام:\ny = 2\ny = x² − 2', promptEn: 'Solve:\ny = 2\ny = x² − 2' },
  { id: 'lq-m1', family: 'linear_quad', diff: 'medium', eq: 'y = x + 1', eq2: 'y = x² − 3x + 4', answer: '(1 ، 2) و (3 ، 4)', wrongs: ['(0 ، 1)', '(2 ، 3)', 'لا حل'], kind: 'system', promptAr: 'حل النظام:\ny = x + 1\ny = x² − 3x + 4', promptEn: 'Solve:\ny = x + 1\ny = x² − 3x + 4' },
  { id: 'lq-m2', family: 'linear_quad', diff: 'medium', eq: 'y = −x + 4', eq2: 'y = x² − 2x', answer: '(−2 ، 6) و (2 ، 2)', wrongs: ['(0 ، 4)', '(1 ، 3)', 'لا حل'], kind: 'system' },
  { id: 'lq-h1', family: 'linear_quad', diff: 'hard', eq: 'y = 3x − 1', eq2: 'y = x² + x − 1', answer: '(0 ، −1) و (2 ، 5)', wrongs: ['(1 ، 2)', '(−1 ، −4)', 'لا حل'], kind: 'system' },
  { id: 'lq-h2', family: 'linear_quad', diff: 'hard', eq: 'x + y = 5', eq2: 'y = x² − 1', answer: '(2 ، 3) و (−3 ، 8)', wrongs: ['(1 ، 4)', '(0 ، 5)', 'لا حل'], kind: 'system', promptAr: 'حل النظام:\nx + y = 5\ny = x² − 1', promptEn: 'Solve:\nx + y = 5\ny = x² − 1' },

  // ── Two quadratics ──
  { id: 'qq-e1', family: 'quad_system', diff: 'easy', eq: 'y = x²', eq2: 'y = 4', answer: '(−2 ، 4) و (2 ، 4)', wrongs: ['(4 ، 16)', '(0 ، 0)', 'لا حل'], kind: 'system' },
  { id: 'qq-m1', family: 'quad_system', diff: 'medium', eq: 'y = x² − 4', eq2: 'y = −x² + 4', answer: '(−2 ، 0) و (2 ، 0)', wrongs: ['(0 ، −4)', '(1 ، −3)', 'لا حل'], kind: 'system' },
  { id: 'qq-m2', family: 'quad_system', diff: 'medium', eq: 'y = x² + 1', eq2: 'y = 2x² − 3', answer: '(−2 ، 5) و (2 ، 5)', wrongs: ['(0 ، 1)', '(1 ، 2)', 'لا حل'], kind: 'system' },
  { id: 'qq-h1', family: 'quad_system', diff: 'hard', eq: 'y = x² − 2x', eq2: 'y = −x² + 4', answer: '(−1 ، 3) و (2 ، 0)', wrongs: ['(0 ، 0)', '(1 ، −1)', 'لا حل'], kind: 'system' },

  // ── Simplify exponents ──
  { id: 'se-e1', family: 'simplify_exp', diff: 'easy', eq: '2^3 · 2^4', answer: '2^7 = 128', wrongs: ['2^{12}', '8^4', '2^1'], kind: 'simplify', promptAr: 'بسّط: 2³ · 2⁴', promptEn: 'Simplify: 2³ · 2⁴' },
  { id: 'se-e2', family: 'simplify_exp', diff: 'easy', eq: '5^7 / 5^3', answer: '5^4 = 625', wrongs: ['5^{10}', '5^2', '1'], kind: 'simplify', promptAr: 'بسّط: 5⁷ ÷ 5³', promptEn: 'Simplify: 5⁷ ÷ 5³' },
  { id: 'se-e3', family: 'simplify_exp', diff: 'easy', eq: '(3^2)^3', answer: '3^6 = 729', wrongs: ['3^5', '9^3', '3^9'], kind: 'simplify', promptAr: 'بسّط: (3²)³', promptEn: 'Simplify: (3²)³' },
  { id: 'se-m1', family: 'simplify_exp', diff: 'medium', eq: '8^{2/3}', answer: '4', wrongs: ['2', '16', '8'], kind: 'simplify', promptAr: 'بسّط: 8^(2/3)', promptEn: 'Simplify: 8^(2/3)' },
  { id: 'se-m2', family: 'simplify_exp', diff: 'medium', eq: '27^{2/3}', answer: '9', wrongs: ['3', '18', '81'], kind: 'simplify', promptAr: 'بسّط: 27^(2/3)', promptEn: 'Simplify: 27^(2/3)' },
  { id: 'se-m3', family: 'simplify_exp', diff: 'medium', eq: '(2^3 · 2^{-1}) / 2', answer: '2', wrongs: ['4', '1', '8'], kind: 'simplify', promptAr: 'بسّط: (2³ · 2⁻¹) ÷ 2', promptEn: 'Simplify: (2³ · 2⁻¹) ÷ 2' },
  { id: 'se-h1', family: 'simplify_exp', diff: 'hard', eq: '(16^{3/4}) / (8^{1/3})', answer: '4', wrongs: ['2', '8', '1'], kind: 'simplify', promptAr: 'بسّط: 16^(3/4) ÷ 8^(1/3)', promptEn: 'Simplify: 16^(3/4) ÷ 8^(1/3)' },
  { id: 'se-h2', family: 'simplify_exp', diff: 'hard', eq: 'a^5 · a^{-2} / a', answer: 'a^2', wrongs: ['a^3', 'a^4', 'a'], kind: 'simplify', promptAr: 'بسّط: a⁵ · a⁻² ÷ a', promptEn: 'Simplify: a⁵ · a⁻² ÷ a' },

  // ── Circle ──
  { id: 'c-e1', family: 'circle', diff: 'easy', eq: 'r = 5', answer: 'محيط = 10π', wrongs: ['5π', '25π', '20π'], promptAr: 'دائرة نصف قطرها 5. أوجد محيطها بدلالة π.', promptEn: 'A circle has radius 5. Find its circumference in terms of π.' },
  { id: 'c-e2', family: 'circle', diff: 'easy', eq: 'r = 4', answer: 'مساحة = 16π', wrongs: ['8π', '4π', '32π'], promptAr: 'دائرة نصف قطرها 4. أوجد مساحتها بدلالة π.', promptEn: 'A circle has radius 4. Find its area in terms of π.' },
  { id: 'c-m1', family: 'circle', diff: 'medium', eq: '(x−2)² + (y+1)² = 9', answer: 'المركز (2 ، −1) ، r = 3', wrongs: ['(−2 ، 1) ، r = 9', '(2 ، 1) ، r = 3', '(0 ، 0) ، r = 3'], promptAr: 'من معادلة الدائرة (x−2)² + (y+1)² = 9 أوجد المركز ونصف القطر.', promptEn: 'From (x−2)² + (y+1)² = 9 find centre and radius.' },
  { id: 'c-m2', family: 'circle', diff: 'medium', eq: 'r = 6, θ = 60°', answer: 'طول القوس = 2π', wrongs: ['π', '6π', '3π'], promptAr: 'دائرة r = 6 وقطاع زاويته المركزية 60°. أوجد طول القوس بدلالة π.', promptEn: 'Circle r = 6, central angle 60°. Find arc length in terms of π.' },
  { id: 'c-h1', family: 'circle', diff: 'hard', eq: 'x² + y² − 6x + 4y − 3 = 0', answer: 'المركز (3 ، −2) ، r = 4', wrongs: ['(−3 ، 2) ، r = 4', '(3 ، 2) ، r = √3', '(6 ، −4) ، r = 3'], promptAr: 'حوّل x² + y² − 6x + 4y − 3 = 0 إلى الصورة القياسية ثم أوجد المركز و r.', promptEn: 'Rewrite x² + y² − 6x + 4y − 3 = 0 in standard form; find centre and r.' },

  // ── Trig ──
  { id: 't-e1', family: 'trig', diff: 'easy', eq: 'sin 30°', answer: '1/2', wrongs: ['√3/2', '√2/2', '0'], promptAr: 'أوجد قيمة sin 30°.', promptEn: 'Find sin 30°.' },
  { id: 't-e2', family: 'trig', diff: 'easy', eq: 'cos 60°', answer: '1/2', wrongs: ['√3/2', '0', '1'], promptAr: 'أوجد قيمة cos 60°.', promptEn: 'Find cos 60°.' },
  { id: 't-e3', family: 'trig', diff: 'easy', eq: 'tan 45°', answer: '1', wrongs: ['0', '√3', 'غير معرّف'], promptAr: 'أوجد قيمة tan 45°.', promptEn: 'Find tan 45°.' },
  { id: 't-m1', family: 'trig', diff: 'medium', eq: 'sin θ = 1/2', answer: 'θ = 30° أو 150° (خلال دورة)', wrongs: ['θ = 60° فقط', 'θ = 90°', 'θ = 0°'], promptAr: 'حل: sin θ = 1/2 حيث 0° ≤ θ < 360°.', promptEn: 'Solve sin θ = 1/2 for 0° ≤ θ < 360°.' },
  { id: 't-m2', family: 'trig', diff: 'medium', eq: 'cos²θ + sin²θ', answer: '1', wrongs: ['0', '2', 'cos 2θ'], promptAr: 'بسّط: cos²θ + sin²θ', promptEn: 'Simplify: cos²θ + sin²θ' },
  { id: 't-h1', family: 'trig', diff: 'hard', eq: '2 cos θ = 1', answer: 'θ = 60° أو 300°', wrongs: ['θ = 30° فقط', 'θ = 90°', 'θ = 45°'], promptAr: 'حل: 2 cos θ = 1 حيث 0° ≤ θ < 360°.', promptEn: 'Solve 2 cos θ = 1 for 0° ≤ θ < 360°.' },

  // ── Trig applications ──
  { id: 'ta-e1', family: 'trig_apps', diff: 'easy', eq: 'a=5, b=5, included=60°', answer: 'مساحة = (25√3)/4', wrongs: ['25', '12.5', '5√3'], promptAr: 'مثلث فيه ضلعان 5 و 5 والزاوية المحصورة 60°. أوجد المساحة باستخدام (1/2)ab sin C.', promptEn: 'Triangle sides 5, 5 with included angle 60°. Find area using (1/2)ab sin C.' },
  { id: 'ta-m1', family: 'trig_apps', diff: 'medium', eq: 'a=7, b=7, C=60°', answer: 'c = 7', wrongs: ['c = 14', 'c = 7√3', 'c = 3.5'], promptAr: 'في مثلث: a = 7، b = 7، C = 60°. أوجد c بقانون جيب التمام.', promptEn: 'In a triangle a = 7, b = 7, C = 60°. Find c using the cosine rule.' },
  { id: 'ta-h1', family: 'trig_apps', diff: 'hard', eq: 'a=8, A=30°, B=45°', answer: 'b = 8√2', wrongs: ['b = 8', 'b = 4', 'b = 8√3'], promptAr: 'مثلث: a = 8، A = 30°، B = 45°. أوجد b بقانون الجيوب.', promptEn: 'Triangle: a = 8, A = 30°, B = 45°. Find b using the sine rule.' },

  // ── Functions ──
  { id: 'f-e1', family: 'functions', diff: 'easy', eq: 'f(x)=2x+3, f(4)', answer: '11', wrongs: ['8', '14', '5'], promptAr: 'إذا كان f(x) = 2x + 3، أوجد f(4).', promptEn: 'If f(x) = 2x + 3, find f(4).' },
  { id: 'f-e2', family: 'functions', diff: 'easy', eq: 'f(x)=x²−1, f(3)', answer: '8', wrongs: ['9', '2', '−1'], promptAr: 'إذا كان f(x) = x² − 1، أوجد f(3).', promptEn: 'If f(x) = x² − 1, find f(3).' },
  { id: 'f-m1', family: 'functions', diff: 'medium', eq: 'f(x)=x², g(x)=x+1, (f∘g)(2)', answer: '9', wrongs: ['5', '4', '3'], promptAr: 'f(x)=x² و g(x)=x+1. أوجد (f∘g)(2).', promptEn: 'f(x)=x², g(x)=x+1. Find (f∘g)(2).' },
  { id: 'f-m2', family: 'functions', diff: 'medium', eq: 'f(x)=2x−6, f⁻¹', answer: 'f⁻¹(x) = (x+6)/2', wrongs: ['2x+6', 'x/2 − 6', '6 − 2x'], promptAr: 'أوجد الاقتران العكسي لـ f(x) = 2x − 6.', promptEn: 'Find the inverse of f(x) = 2x − 6.' },
  { id: 'f-h1', family: 'functions', diff: 'hard', eq: 'a_n = 3n − 1', answer: 'a_5 = 14', wrongs: ['15', '12', '8'], promptAr: 'متتالية حسابية a_n = 3n − 1. أوجد a_5.', promptEn: 'Arithmetic sequence a_n = 3n − 1. Find a_5.' },

  // ── Derivatives ──
  { id: 'd-e1', family: 'derivative', diff: 'easy', eq: 'f(x)=x²', answer: "f'(x) = 2x", wrongs: ['x', '2', 'x²'], promptAr: 'أوجد مشتقة f(x) = x².', promptEn: "Find the derivative of f(x) = x²." },
  { id: 'd-e2', family: 'derivative', diff: 'easy', eq: 'f(x)=5x', answer: "f'(x) = 5", wrongs: ['5x', '0', 'x'], promptAr: 'أوجد مشتقة f(x) = 5x.', promptEn: 'Find the derivative of f(x) = 5x.' },
  { id: 'd-m1', family: 'derivative', diff: 'medium', eq: 'f(x)=x³ − 4x', answer: "f'(x) = 3x² − 4", wrongs: ['3x²', 'x² − 4', '3x − 4'], promptAr: 'أوجد f′(x) إذا كان f(x) = x³ − 4x.', promptEn: 'Find f′(x) for f(x) = x³ − 4x.' },
  { id: 'd-m2', family: 'derivative', diff: 'medium', eq: 'f(x)=x², slope at x=3', answer: 'الميل = 6', wrongs: ['3', '9', '2'], promptAr: 'ما ميل مماس منحنى y = x² عند x = 3؟', promptEn: 'What is the slope of the tangent to y = x² at x = 3?' },
  { id: 'd-h1', family: 'derivative', diff: 'hard', eq: 'f(x)=x³ − 3x', answer: 'قيم حرجة عند x = ±1', wrongs: ['x = 0 فقط', 'x = 3', 'لا قيم حرجة'], promptAr: 'أوجد القيم الحرجة لـ f(x) = x³ − 3x.', promptEn: 'Find the critical points of f(x) = x³ − 3x.' },

  // ── Vectors ──
  { id: 'v-e1', family: 'vectors', diff: 'easy', eq: 'A(1,2), B(4,6)', answer: 'AB⃗ = ⟨3 ، 4⟩', wrongs: ['⟨5 ، 8⟩', '⟨−3 ، −4⟩', '⟨4 ، 3⟩'], promptAr: 'أوجد المتجه AB⃗ من A(1,2) إلى B(4,6).', promptEn: 'Find vector AB from A(1,2) to B(4,6).' },
  { id: 'v-e2', family: 'vectors', diff: 'easy', eq: '⟨3,4⟩', answer: '|v| = 5', wrongs: ['7', '12', '1'], promptAr: 'أوجد مقدار المتجه ⟨3 ، 4⟩.', promptEn: 'Find the magnitude of ⟨3, 4⟩.' },
  { id: 'v-m1', family: 'vectors', diff: 'medium', eq: 'u=⟨1,2⟩, v=⟨3,−1⟩', answer: 'u+v = ⟨4 ، 1⟩', wrongs: ['⟨2 ، 1⟩', '⟨4 ، 3⟩', '⟨3 ، 2⟩'], promptAr: 'إذا كان u = ⟨1 ، 2⟩ و v = ⟨3 ، −1⟩، أوجد u + v.', promptEn: 'If u = ⟨1, 2⟩ and v = ⟨3, −1⟩, find u + v.' },
  { id: 'v-m2', family: 'vectors', diff: 'medium', eq: 'u=⟨2,3⟩, v=⟨4,−1⟩', answer: 'u·v = 5', wrongs: ['8', '−3', '7'], promptAr: 'أوجد الضرب القياسي ⟨2 ، 3⟩ · ⟨4 ، −1⟩.', promptEn: 'Find the dot product ⟨2, 3⟩ · ⟨4, −1⟩.' },
  { id: 'v-h1', family: 'vectors', diff: 'hard', eq: 'u=⟨1,0⟩, v=⟨0,1⟩', answer: 'متعامدان (الضرب القياسي = 0)', wrongs: ['متوازيان', 'نفس الاتجاه', 'غير معرّف'], promptAr: 'هل ⟨1 ، 0⟩ و ⟨0 ، 1⟩ متعامدان؟ برّر بالضرب القياسي.', promptEn: 'Are ⟨1, 0⟩ and ⟨0, 1⟩ perpendicular? Justify with the dot product.' },

  // ── Stats / probability ──
  { id: 's-e1', family: 'stats', diff: 'easy', eq: '2,4,6,8', answer: 'المتوسط = 5', wrongs: ['4', '6', '8'], promptAr: 'أوجد المتوسط الحسابي للبيانات: 2، 4، 6، 8.', promptEn: 'Find the mean of 2, 4, 6, 8.' },
  { id: 's-e2', family: 'stats', diff: 'easy', eq: 'P=1/6', answer: '1/6', wrongs: ['1/2', '1', '0'], promptAr: 'عند رمي حجر نرد عادل، ما احتمال ظهور 5؟', promptEn: 'Fair die: probability of rolling a 5?' },
  { id: 's-m1', family: 'stats', diff: 'medium', eq: '1,3,3,5,8', answer: 'الوسيط = 3', wrongs: ['4', '5', '3.5'], promptAr: 'أوجد وسيط البيانات: 1، 3، 3، 5، 8.', promptEn: 'Find the median of 1, 3, 3, 5, 8.' },
  { id: 's-m2', family: 'stats', diff: 'medium', eq: 'P(A)=0.3, P(B)=0.5 independent', answer: 'P(A∩B) = 0.15', wrongs: ['0.8', '0.2', '0.15×2'], promptAr: 'A و B مستقلان، P(A)=0.3 و P(B)=0.5. أوجد P(A∩B).', promptEn: 'Independent events: P(A)=0.3, P(B)=0.5. Find P(A∩B).' },
  { id: 's-h1', family: 'stats', diff: 'hard', eq: 'P(A)=0.4, P(B)=0.5, P(A∩B)=0.1', answer: 'P(A∪B) = 0.8', wrongs: ['0.9', '0.4', '0.1'], promptAr: 'P(A)=0.4، P(B)=0.5، P(A∩B)=0.1. أوجد P(A∪B).', promptEn: 'P(A)=0.4, P(B)=0.5, P(A∩B)=0.1. Find P(A∪B).' },

  // ── Generic algebra fallback ──
  { id: 'a-e1', family: 'algebra', diff: 'easy', eq: '2x + 5 = 17', answer: 'x = 6', wrongs: ['x = 5', 'x = 11', 'x = 7'] },
  { id: 'a-e2', family: 'algebra', diff: 'easy', eq: '3x − 4 = 11', answer: 'x = 5', wrongs: ['x = 3', 'x = 7', 'x = 15'] },
  { id: 'a-e3', family: 'algebra', diff: 'easy', eq: 'x/2 = 9', answer: 'x = 18', wrongs: ['x = 4.5', 'x = 11', 'x = 9'] },
  { id: 'a-m1', family: 'algebra', diff: 'medium', eq: 'x² − 5x + 6 = 0', answer: 'x = 2 أو x = 3', wrongs: ['x = −2 أو −3', 'x = 1 أو 6', 'x = 0'] },
  { id: 'a-m2', family: 'algebra', diff: 'medium', eq: 'x² = 49', answer: 'x = ±7', wrongs: ['x = 7 فقط', 'x = 24.5', 'x = ±49'] },
  { id: 'a-m3', family: 'algebra', diff: 'medium', eq: '2x + y = 7, y = 3', answer: 'x = 2 ، y = 3', wrongs: ['x = 3 ، y = 2', 'x = 7', 'x = 5'] },
  { id: 'a-h1', family: 'algebra', diff: 'hard', eq: 'x² − 4x + 1 = 0', answer: 'x = 2 ± √3', wrongs: ['x = ±2', 'x = 4', 'x = 1'], promptAr: 'حل بالقانون العام: x² − 4x + 1 = 0', promptEn: 'Solve with the quadratic formula: x² − 4x + 1 = 0' },
  { id: 'a-h2', family: 'algebra', diff: 'hard', eq: 'x² − 9 = 0', answer: 'x = ±3', wrongs: ['x = 9', 'x = 3 فقط', 'x = 0'] },
  {
    id: 'a-h3', family: 'algebra', diff: 'hard', eq: '2^n = 16', answer: 'n = 4', wrongs: ['n = 8', 'n = 2', 'n = 16'], kind: 'word',
    wordAr: 'عدد يتضاعف كل يوم بدءًا من 1. بعد كم يوم يصبح 16؟ اكتب معادلة أسية وحلّها.',
    wordEn: 'A quantity doubles each day from 1. After how many days is it 16? Write and solve an exponential equation.',
  },
];

/**
 * The question as a teacher would write it.
 *
 * Every bank item that needs specific wording already carries a hand-written
 * `promptAr` / `promptEn` — «أوجد مشتقة f(x) = x².», «ما ميل مماس منحنى
 * y = x² عند x = 3؟». Only `short_answer` ever used them. Multiple choice,
 * true/false and fill-in-the-blank each built their own stem out of
 * `item.eq`, so the same derivative item that reads properly on a worksheet
 * was projected to the class as «ما ناتج / حل: f(x)=x³ − 4x؟» — which asks
 * neither for a result nor for a solution, and is not something a teacher
 * would write. The good Arabic existed and was being thrown away.
 *
 * One stem, every type. Items with no prompt fall back to wording chosen by
 * what the item actually is rather than one phrase covering everything.
 */
function itemStem(item: ConcreteItem, isAr: boolean): string {
  if (item.kind === 'word' && (item.wordAr || item.wordEn)) {
    return isAr ? (item.wordAr ?? item.eq) : (item.wordEn ?? item.eq);
  }
  if (item.promptAr || item.promptEn) {
    return isAr ? (item.promptAr ?? item.eq) : (item.promptEn ?? item.eq);
  }
  if (item.kind === 'system' || item.eq2) {
    return isAr
      ? `أوجد حل النظام الآتي:\n${item.eq}\n${item.eq2}`
      : `Solve the following system:\n${item.eq}\n${item.eq2}`;
  }
  if (item.kind === 'simplify') {
    return isAr ? `بسّط المقدار: ${item.eq}` : `Simplify: ${item.eq}`;
  }
  // Everything left in the bank without a prompt is an equation to solve;
  // check rather than assume, so an expression item never gets asked for a
  // "solution" it does not have.
  return item.eq.includes('=')
    ? (isAr ? `أوجد حل المعادلة: ${item.eq}` : `Solve the equation: ${item.eq}`)
    : (isAr ? `أوجد ناتج: ${item.eq}` : `Evaluate: ${item.eq}`);
}

function formatItem(item: ConcreteItem, lang: Lang, type: QType): { text: string; options?: string[]; answer: string } {
  const isAr = lang === 'ar';
  const stem = itemStem(item, isAr);

  if (type === 'word_problem') {
    if (item.kind === 'word' && (item.wordAr || item.wordEn)) {
      return { text: isAr ? (item.wordAr as string) : (item.wordEn as string), answer: item.answer };
    }
    // No invented scenario. This used to wrap the equation in «يحتاج طالب
    // إلى حل … ضمن تمرين صفي» — a story about a student doing an exercise,
    // which is not a word problem, just the exercise with a sentence in
    // front of it. An item with no real context asks for the working
    // instead, which is what the marks are for anyway.
    return {
      text: isAr
        ? `${stem}\n\nاكتب الحل موضّحًا الخطوات.`
        : `${stem}\n\nWrite the solution, showing your steps.`,
      answer: item.answer,
    };
  }

  if (type === 'multiple_choice') {
    const level = levelOptionShape(item.answer, item.wrongs);
    return {
      text: stem,
      options: placeCorrect(level.correct, level.wrongs),
      // The key must be the option as displayed: the teacher panel shows it
      // as the expected answer and the reveal highlights it by value, so a
      // key that still carried the prefix would disagree with the slide.
      answer: level.correct,
    };
  }

  if (type === 'true_false') {
    const sayTrue = item.id.charCodeAt(item.id.length - 1) % 2 === 0;
    const value = sayTrue ? item.answer : item.wrongs[0];
    // Question, then the claim, then the judgement — an error-analysis item.
    // A prompt is an imperative («أوجد مشتقة…»); there is no mechanical way
    // to turn one into a statement, and the old attempt produced «حل / ناتج
    // «f(x)=x³ − 4x» هو …» for every family alike.
    return {
      text: isAr
        ? `${stem}\n\nالإجابة المقترحة: ${value}\n\nهل الإجابة المقترحة صحيحة؟`
        : `${stem}\n\nProposed answer: ${value}\n\nIs the proposed answer correct?`,
      options: isAr ? ['صح', 'خطأ'] : ['True', 'False'],
      answer: sayTrue ? (isAr ? 'صح' : 'True') : (isAr ? 'خطأ' : 'False'),
    };
  }

  if (type === 'fill_blank') {
    return {
      text: isAr
        ? `${stem}\n\nالإجابة: __________`
        : `${stem}\n\nAnswer: __________`,
      answer: item.answer,
    };
  }

  // short_answer default
  return { text: stem, answer: item.answer };
}

/**
 * Take one unused concrete math item for this session.
 * Prefers matching family + difficulty; falls back within family then to algebra.
 */
export function takeConcreteMath(
  type: QType,
  topic: string,
  kb: KBLesson | null,
  diff: DiffTier,
  lang: Lang,
  points: number,
): PracticeWQ | null {
  const family = detectMathFamily(topic, kb);
  const preferWord = type === 'word_problem';

  const matches = (item: ConcreteItem, fam: MathFamily) => {
    if (usedIds.has(item.id)) return false;
    if (item.family !== fam) return false;
    if (preferWord && item.kind !== 'word' && !item.wordAr) {
      // still allow non-word items — formatItem wraps them
      return true;
    }
    return true;
  };

  const pickFrom = (fam: MathFamily): ConcreteItem | null => {
    const pool = BANK.filter(i => matches(i, fam));
    if (pool.length === 0) return null;
    // Random within the difficulty-preferred slice, not `ranked[0]`: taking
    // the first unused item in bank order meant every fresh session served
    // the identical quiz for a topic — "regenerate" only looked alive until
    // the page reloaded. `usedIds` still guarantees no repeats within a pass.
    const sameDiff = pool.filter(i => i.diff === diff);
    const candidates = sameDiff.length > 0 ? sameDiff : pool;
    return candidates[Math.floor(Math.random() * candidates.length)] ?? null;
  };

  /**
   * A worksheet/quiz asking for more items than a lesson's family has (e.g.
   * `functions` has 5) used to fall straight through to the unrelated
   * `algebra` family here — a teacher who picked one exact lesson would get
   * a quadratic-formula or linear-system item with no connection to it. A
   * repeat from the *same* family, reformatted under a different question
   * type, stays on-topic; only the generic algebra family (or true
   * exhaustion of the whole bank) should ever leave the detected family.
   */
  const pickFromRepeating = (fam: MathFamily): ConcreteItem | null => {
    const pool = BANK.filter(i => i.family === fam);
    if (pool.length === 0) return null;
    const sameDiff = pool.filter(i => i.diff === diff);
    const ranked = sameDiff.length > 0 ? sameDiff : pool;
    return ranked[Math.floor(Math.random() * ranked.length)] ?? null;
  };

  let item = pickFrom(family) ?? pickFromRepeating(family) ?? pickFrom('algebra');
  if (!item) {
    // Exhausted — allow any unused item
    item = BANK.find(i => !usedIds.has(i.id)) ?? null;
  }
  if (!item) return null;

  usedIds.add(item.id);
  const formatted = formatItem(item, lang, type);
  return { ...formatted, points };
}

/** Peek several concrete stems for activity slides (marks them used). */
export function takeConcreteMathBatch(
  count: number,
  topic: string,
  kb: KBLesson | null,
  lang: Lang,
  diff: DiffTier = 'medium',
): PracticeWQ[] {
  const out: PracticeWQ[] = [];
  for (let i = 0; i < count; i++) {
    const tier: DiffTier = i === 0 ? 'easy' : i === count - 1 ? 'hard' : diff;
    const q = takeConcreteMath('short_answer', topic, kb, tier, lang, 4);
    if (q) out.push(q);
  }
  return out;
}
