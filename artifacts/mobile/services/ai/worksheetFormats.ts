/**
 * Worksheet question formats — صِل، رتّب، أين الخطأ؟، ارسم (spec 2026-10-11).
 *
 * Turns a bank pick (`pickForFormat`, lib/math-practice) into a one-question
 * section. Bank only: when the lesson's family cannot supply a format the
 * builder answers null and the caller reports it in `missingFormats`, rather
 * than inventing an item. Maths stays latin; only the labels («١)», «أ)») are
 * Arabic, since they are labels, not maths.
 */
import { pickForFormat, formatSupported, currentSession, type FormatKind } from '@workspace/math-practice';
import type { AIRequest, WorksheetOutput, WorksheetSection, WorksheetQuestionFormat } from './AIService.ts';
import { getLessonById, resolveGroundedKbLesson, type KBLesson } from '../knowledgeBase.ts';
import { parseDocumentGrounding } from '../documents/grounding.ts';
import { samplePlot } from '../deckVisuals.ts';

export const FORMAT_KINDS: readonly FormatKind[] = ['match', 'order', 'spot_error', 'graph'];

export function isFormatKind(t: string): t is FormatKind {
  return (FORMAT_KINDS as readonly string[]).includes(t);
}

type Lang = 'ar' | 'en';

const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const AR_LETTERS = ['أ', 'ب', 'ج', 'د', 'هـ', 'و'];
const EN_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

const num = (n: number, lang: Lang) =>
  lang === 'ar' ? String(n).replace(/\d/g, d => AR_DIGITS[+d]!) : String(n);
const letter = (i: number, lang: Lang) => (lang === 'ar' ? AR_LETTERS : EN_LETTERS)[i] ?? String(i + 1);

const TITLES: Record<FormatKind, { ar: string; en: string }> = {
  match: { ar: 'صِل', en: 'Match' },
  order: { ar: 'رتّب الخطوات', en: 'Put in order' },
  spot_error: { ar: 'أين الخطأ؟', en: 'Spot the mistake' },
  graph: { ar: 'ارسم', en: 'Draw the graph' },
};

export function formatSectionTitle(kind: FormatKind, lang: Lang): string {
  return TITLES[kind][lang];
}

export function formatAvailability(topic: string, kb: KBLesson | null, subject?: string): Record<FormatKind, boolean> {
  return {
    match: formatSupported('match', topic, kb, subject),
    order: formatSupported('order', topic, kb, subject),
    spot_error: formatSupported('spot_error', topic, kb, subject),
    graph: formatSupported('graph', topic, kb, subject),
  };
}

/** The bank writes «x² − 4»; the plotter reads «x^2 - 4». */
export function normalizePlotExpr(e: string): string {
  return e.replace(/−/g, '-').replace(/²/g, '^2').replace(/³/g, '^3').replace(/×/g, '*');
}

/**
 * The graph's equations a stem does not already state, as «y = …». A system
 * item's problem lists its equations, so appending every expression showed
 * each one twice. Compared with spacing and notation removed («y=x^2-2x» is
 * «y = x² − 2x»). The api-server converter keeps its own copy of this rule.
 */
export function exprsMissingFromStem(stem: string, exprs: string[]): string[] {
  const flat = (t: string) => normalizePlotExpr(t).replace(/\s+/g, '');
  const have = flat(stem);
  return exprs.filter(e => !have.includes(flat(`y = ${e}`))).map(e => `y = ${e}`);
}

type Win = { xMin: number; xMax: number; yMin: number; yMax: number };

/**
 * Widen a bank window so it holds the curves, not only the answer points —
 * the window for y = x² − 4 stops at −3 while the vertex sits at −4.
 * Never shrinks; clamped to ±10 like the bank's own windows.
 */
export function fitGraphWindow(exprs: string[], window: Win): Win {
  const clamp = (v: number) => Math.max(-10, Math.min(10, v));
  let lo = Infinity;
  let hi = -Infinity;
  for (const e of exprs) {
    const pts = samplePlot(normalizePlotExpr(e), { from: window.xMin, to: window.xMax, steps: 120 });
    for (const p of pts ?? []) {
      if (p.y < lo) lo = p.y;
      if (p.y > hi) hi = p.y;
    }
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { ...window };
  return {
    ...window,
    yMin: clamp(Math.min(window.yMin, Math.floor(lo) - 1)),
    yMax: clamp(Math.max(window.yMax, Math.ceil(hi) + 1)),
  };
}

const shuffle = <T,>(xs: T[]): T[] => xs.map(x => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map(p => p[1]);

/** Shuffle indices 0..n-1, retrying so the result is not the identity when it can avoid it. */
function shuffledIndices(n: number): number[] {
  const id = Array.from({ length: n }, (_, i) => i);
  if (n < 2) return id;
  for (let t = 0; t < 8; t++) {
    const s = shuffle(id);
    if (s.some((v, i) => v !== i)) return s;
  }
  return [...id].reverse();
}

export interface FormatCtx {
  topic: string;
  kb: KBLesson | null;
  lang: Lang;
  subject?: string;
  session?: Set<string>;
  points: number;
}

export function buildFormatQuestion(
  kind: FormatKind,
  ctx: FormatCtx,
): { section: WorksheetSection; key: { answer: string; solution?: string[] } } | null {
  const { topic, kb, lang, subject, points } = ctx;
  const session = ctx.session ?? currentSession();
  const pick = pickForFormat(kind, topic, kb, lang, session, subject);
  if (!pick) return null;

  let format: WorksheetQuestionFormat;
  let text: string;
  let key: { answer: string; solution?: string[] };

  if (kind === 'match' && 'pairs' in pick) {
    const stem = lang === 'ar'
      ? 'صِل كل سؤال في العمود الأول بإجابته في العمود الثاني.'
      : 'Match each problem with its answer.';
    const left = pick.pairs.map(p => p.problem);
    const perm = shuffledIndices(pick.pairs.length); // right[j] = answer of pair perm[j]
    const right = perm.map(i => pick.pairs[i]!.answer);
    const pairs = left.map((_, i) => perm.indexOf(i));
    format = { kind: 'match', stem, left, right, pairs };
    text = [
      stem, '',
      ...left.map((l, i) => `${num(i + 1, lang)}) ${l}`), '',
      ...right.map((r, j) => `${letter(j, lang)}) ${r}`),
    ].join('\n');
    key = { answer: pairs.map((p, i) => `${num(i + 1, lang)}-${letter(p, lang)}`).join(lang === 'ar' ? '، ' : ', ') };
  } else if (kind === 'order' && 'steps' in pick && !('wrongStep' in pick)) {
    const stem = (lang === 'ar' ? 'رتّب خطوات حل المسألة الآتية:' : 'Put the steps of this solution in order:') + '\n' + pick.problem;
    const n = pick.steps.length;
    const perm = shuffledIndices(n - 1); // steps[j] = true step perm[j]
    const steps = [...perm.map(i => pick.steps[i]!), pick.steps[n - 1]!];
    const order = pick.steps.map((_, k) => (k === n - 1 ? n - 1 : perm.indexOf(k)));
    format = { kind: 'order', stem, steps, order };
    text = [stem, ...steps.map((s, j) => `${letter(j, lang)}) ${s}`)].join('\n');
    key = { answer: order.map(i => letter(i, lang)).join(lang === 'ar' ? '، ' : ', '), solution: [...pick.steps] };
  } else if (kind === 'spot_error' && 'wrongStep' in pick) {
    const stem = (lang === 'ar'
      ? 'في الحل الآتي خطوة واحدة خاطئة. حدّدها واكتبها صحيحة.'
      : 'One step in this solution is wrong. Find it and correct it.') + '\n' + pick.problem;
    format = { kind: 'spot_error', stem, steps: pick.steps, wrongStep: pick.wrongStep, fix: pick.correctLine, why: pick.why };
    text = [stem, ...pick.steps.map((s, i) => `${num(i + 1, lang)}) ${s}`)].join('\n');
    const real = pick.steps.map((s, i) => (i === pick.wrongStep ? pick.correctLine : s));
    // The reason belongs to the answer, not to the working: listed as the
    // working's first line it shifted every number by one, so «الخطوة ٤»'s fix
    // sat at item 5 of the key. `solution[i]` is now step i+1 of the paper.
    key = {
      answer: `${lang === 'ar' ? 'الخطوة' : 'Step'} ${num(pick.wrongStep + 1, lang)}: ${pick.correctLine}\n${pick.why}`,
      solution: real,
    };
  } else if (kind === 'graph' && 'exprs' in pick) {
    const stem = (lang === 'ar' ? 'ارسم في المستوى الإحداثي ثم أجب:' : 'Draw on the grid, then answer:') + '\n' + pick.problem;
    format = { kind: 'graph', stem, exprs: pick.exprs, window: fitGraphWindow(pick.exprs, pick.window) };
    text = stem;
    key = { answer: pick.answer };
  } else {
    return null;
  }

  return {
    section: {
      type: kind,
      title: formatSectionTitle(kind, lang),
      questions: [{ text, points, fromBank: true, format }],
    },
    key,
  };
}

/** Pull the format kinds out of a ticked question-type list. */
export function splitFormatTypes(types: string[]): { formats: FormatKind[]; rest: string[] } {
  return {
    formats: types.filter(isFormatKind),
    rest: types.filter(t => !isFormatKind(t)),
  };
}

/**
 * The paper's total — the picker's own range (5-20, `NUM_Q_OPTIONS`). One
 * clamp for the offline and the live path, so they cannot disagree on it.
 */
export function worksheetTotal(req: { numQuestions?: number }): number {
  return Math.min(20, Math.max(5, req.numQuestions ?? 8));
}

/**
 * How many format questions fit in a paper of `totalQ`. Room is what is left
 * after the worked example, the half-solved item, at least one ordinary
 * question and the word problem (when ticked); asking for more would overshoot
 * the total the teacher picked. Shared by both paths.
 */
export function formatRoom(totalQ: number, wantsWordProblem: boolean): number {
  return Math.max(0, totalQ - 3 - (wantsWordProblem ? 1 : 0));
}

/** Points per format question — the offline generator's `saPts`, shared so live agrees. */
export function formatPoints(difficulty: 'easy' | 'medium' | 'hard' | undefined): number {
  return difficulty === 'easy' ? 4 : difficulty === 'hard' ? 10 : 6;
}

/** Split the ticked formats into those that fit the total and those trimmed to keep it. */
export function fitFormats(
  formats: FormatKind[],
  rest: string[],
  totalQ: number,
): { taken: FormatKind[]; trimmed: FormatKind[] } {
  const room = formatRoom(totalQ, rest.includes('word_problem'));
  return { taken: formats.slice(0, room), trimmed: formats.slice(room) };
}

/**
 * The request the live model sees. It is never asked for a format kind — the
 * bank builds those (see `appendFormats`, and the filter in the api-server's
 * `worksheetPromptAr/En`) — and the count it is asked for is the teacher's
 * total minus the formats that fit, so formats count INSIDE the number picked.
 */
export function requestWithoutFormats(req: AIRequest): AIRequest {
  const { formats, rest } = splitFormatTypes(req.questionTypes ?? []);
  if (formats.length === 0) return req;
  const totalQ = worksheetTotal(req);
  const { taken } = fitFormats(formats, rest, totalQ);
  return {
    ...req,
    questionTypes: (rest.length ? rest : ['short_answer']) as AIRequest['questionTypes'],
    numQuestions: totalQ - taken.length,
  };
}

type BuiltFormat = NonNullable<ReturnType<typeof buildFormatQuestion>>;

/** Scarcest bank first: «أين الخطأ؟» and «ارسم» have a couple of candidates a lesson, «صِل» takes five. */
const BUILD_ORDER: readonly FormatKind[] = ['spot_error', 'graph', 'order', 'match'];

/**
 * Build several formats against ONE session set. They are built scarcest-first
 * so «صِل», which takes five items, cannot leave «أين الخطأ؟» without its two,
 * and the results come back in the order ticked (the order the paper shows
 * them). A kind that cannot be built, or whose build throws, is `missing` —
 * a format bug must never cost the paper around it.
 */
export function buildFormatSet(kinds: FormatKind[], ctx: FormatCtx): { built: BuiltFormat[]; missing: FormatKind[] } {
  const results = new Map<FormatKind, BuiltFormat>();
  const session = ctx.session ?? currentSession();
  for (const kind of [...kinds].sort((a, b) => BUILD_ORDER.indexOf(a) - BUILD_ORDER.indexOf(b))) {
    try {
      const r = buildFormatQuestion(kind, { ...ctx, session });
      if (r) results.set(kind, r);
    } catch {
      /* reported as missing below */
    }
  }
  return {
    built: kinds.flatMap(k => (results.has(k) ? [results.get(k)!] : [])),
    missing: kinds.filter(k => !results.has(k)),
  };
}

/**
 * Add the bank-built format questions to a live paper, numbered on from its
 * last question. Kinds beyond `formatRoom` are trimmed (the model was asked for
 * the full remainder), and a kind the lesson's bank cannot supply — or whose
 * build throws — is reported in `missingFormats`, never invented and never
 * allowed to discard a good paper. One session set covers the whole paper so
 * two formats cannot draw the same worked item.
 */
export function appendFormats(ws: WorksheetOutput, req: AIRequest, formats: FormatKind[]): WorksheetOutput {
  if (formats.length === 0) return ws;
  const lang: Lang = req.language === 'arabic' ? 'ar' : 'en';
  // Same grounding as the offline paper: a teacher's own file has no bank lesson.
  const docs = parseDocumentGrounding(req.additionalContext);
  const topic = docs.present && docs.title ? docs.title : req.topic;
  const kb = docs.present ? null : ((req.lessonId ? getLessonById(req.lessonId) : null) ?? resolveGroundedKbLesson(topic, lang));
  const points = formatPoints(req.difficulty === 'easy' || req.difficulty === 'hard' ? req.difficulty : 'medium');
  const rest = (req.questionTypes ?? []).filter(t => !isFormatKind(t));
  const { taken, trimmed } = fitFormats(formats, rest, worksheetTotal(req));
  const sections = [...ws.sections];
  const answerKey = [...ws.answerKey];
  const missing: FormatKind[] = [...(ws.missingFormats ?? []), ...trimmed];
  // Numbered from the paper's flat question count: every consumer resolves a
  // key by flat position, so a short or gapped model key must not shift it.
  let num = ws.sections.reduce((n, s) => n + s.questions.length, 0) + 1;
  const { built, missing: unbuilt } = buildFormatSet(taken, { topic, kb, lang, subject: req.subject, session: new Set<string>(), points });
  missing.push(...unbuilt);
  for (const b of built) {
    sections.push(b.section);
    answerKey.push({ num: num++, ...b.key });
  }
  return { ...ws, sections, answerKey, ...(missing.length ? { missingFormats: missing } : {}) };
}
