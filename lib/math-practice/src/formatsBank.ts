/**
 * Bank items picked for the worksheet formats (صِل، رتّب، أين الخطأ؟، ارسم).
 * Same family routing and the same per-pass `session` set as every other
 * worksheet question, so a format never reuses an item the sheet already spent.
 * Bank only — nothing here is generated or guessed (spec 2026-10-11).
 */
import {
  MATH_BANK, CHEM_BANK, matchMathFamily, detectChemFamily, lessonTextBlob, isChemContext, itemStem,
  type ConcreteItem, type KBLesson, type Lang,
} from './index.ts';
import { stepsFor } from './steps.ts';
import { misstepsFor } from './missteps.ts';
import { ORDER_SAFE } from './orderSafe.ts';

export type FormatKind = 'match' | 'order' | 'spot_error' | 'graph';
export interface MatchPick { pairs: { problem: string; answer: string }[] }
export interface OrderPick { problem: string; steps: string[]; answer: string }
export interface SpotErrorPick { problem: string; steps: string[]; wrongStep: number; correctLine: string; why: string; answer: string }
export interface GraphPick {
  problem: string; exprs: string[]; answer: string;
  window: { xMin: number; xMax: number; yMin: number; yMax: number };
}

function pool(topic: string, kb: KBLesson | null, subject?: string): { items: ConcreteItem[]; maths: boolean } {
  if (isChemContext(topic, kb, subject)) {
    const fam = detectChemFamily(lessonTextBlob(topic, kb));
    return { items: CHEM_BANK.filter(i => i.family === fam), maths: false };
  }
  const fam = matchMathFamily(topic, kb);
  return { items: fam ? MATH_BANK.filter(i => i.family === fam) : [], maths: true };
}

const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();
const shuffle = <T,>(xs: T[]): T[] => xs.map(x => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map(p => p[1]);

function matchCandidates(items: ConcreteItem[], used: Set<string>): ConcreteItem[] {
  const seen = new Set<string>();
  return shuffle(items.filter(i => !used.has(i.id) && i.answer.length <= 24)).filter(i => {
    const k = norm(i.answer);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
/** Only the hand-audited items whose steps have one valid order (`orderSafe.ts`). */
const orderCandidates = (items: ConcreteItem[], used: Set<string>) =>
  items.filter(i => !used.has(i.id) && ORDER_SAFE.has(i.id)
    && (stepsFor(i.id)?.ar.length ?? 0) >= 3 && (stepsFor(i.id)?.ar.length ?? 0) <= 6);
const spotCandidates = (items: ConcreteItem[], used: Set<string>, maths: boolean) =>
  maths ? items.filter(i => !used.has(i.id) && stepsFor(i.id) && misstepsFor(i.id).length > 0) : [];
const graphCandidates = (items: ConcreteItem[], used: Set<string>, maths: boolean) =>
  maths ? items.filter(i => !used.has(i.id) && i.kind === 'graph') : [];

/** Pure availability check: marks nothing used. */
export function formatSupported(kind: FormatKind, topic: string, kb: KBLesson | null, subject?: string): boolean {
  const { items, maths } = pool(topic, kb, subject);
  const none = new Set<string>();
  if (kind === 'match') return matchCandidates(items, none).length >= 4;
  if (kind === 'order') return orderCandidates(items, none).length > 0;
  if (kind === 'spot_error') return spotCandidates(items, none, maths).length > 0;
  return graphCandidates(items, none, maths).length > 0;
}

function windowFor(answer: string): GraphPick['window'] {
  const pts = [...answer.matchAll(/\(\s*([-−]?\d+(?:\.\d+)?)\s*[،,]\s*([-−]?\d+(?:\.\d+)?)\s*\)/g)]
    .map(m => [Number(m[1]!.replace('−', '-')), Number(m[2]!.replace('−', '-'))] as const);
  if (pts.length === 0) return { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
  const clamp = (v: number) => Math.max(-10, Math.min(10, v));
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return {
    xMin: clamp(Math.floor(Math.min(...xs, 0) - 3)), xMax: clamp(Math.ceil(Math.max(...xs, 0) + 3)),
    yMin: clamp(Math.floor(Math.min(...ys, 0) - 3)), yMax: clamp(Math.ceil(Math.max(...ys, 0) + 3)),
  };
}

export function pickForFormat(
  kind: FormatKind, topic: string, kb: KBLesson | null, lang: Lang, session: Set<string>, subject?: string,
): MatchPick | OrderPick | SpotErrorPick | GraphPick | null {
  const { items, maths } = pool(topic, kb, subject);
  const ar = lang === 'ar';
  if (kind === 'match') {
    const c = matchCandidates(items, session);
    if (c.length < 4) return null;
    const take = c.slice(0, 5);
    take.forEach(i => session.add(i.id));
    return { pairs: take.map(i => ({ problem: itemStem(i, ar), answer: i.answer })) };
  }
  if (kind === 'order') {
    const c = shuffle(orderCandidates(items, session))[0];
    if (!c) return null;
    session.add(c.id);
    return { problem: itemStem(c, ar), steps: [...stepsFor(c.id)![lang]], answer: c.answer };
  }
  if (kind === 'spot_error') {
    const c = shuffle(spotCandidates(items, session, maths))[0];
    if (!c) return null;
    session.add(c.id);
    const m = shuffle(misstepsFor(c.id))[0]!;
    const real = [...stepsFor(c.id)![lang]];
    const steps = real.map((s, i) => (i === m.stepIndex ? (ar ? m.wrongAr : m.wrongEn) : s));
    return { problem: itemStem(c, ar), steps, wrongStep: m.stepIndex, correctLine: real[m.stepIndex]!, why: ar ? m.whyAr : m.whyEn, answer: c.answer };
  }
  const c = shuffle(graphCandidates(items, session, maths))[0];
  if (!c) return null;
  session.add(c.id);
  const exprs = [c.eq, c.eq2].filter((e): e is string => !!e).map(e => e.replace(/^\s*y\s*=\s*/, ''));
  return { problem: itemStem(c, ar), exprs, answer: c.answer, window: windowFor(c.answer) };
}
