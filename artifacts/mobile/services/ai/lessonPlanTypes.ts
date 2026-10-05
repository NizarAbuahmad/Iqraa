/**
 * Shapes and small helpers shared by the lesson-plan blueprints — kept apart
 * from `lessonPlanBlueprints.ts` so the per-kind builders can use them without
 * importing the registry that imports them.
 */
import type { KBLesson } from '../knowledgeBase.ts';
import type { Lang } from './mathPractice.ts';
import type { LessonKind } from './lessonPlanKinds.ts';

/** Content pulled from an uploaded document, when the plan is built from one. */
export interface LessonDocContext {
  /** How to name the file in prose — «الملف «bonding.pdf»» / file "bonding.pdf". */
  label: string;
  concepts: string[];
  example: string | null;
}

export interface LessonStyleContext {
  topic: string;
  kb: KBLesson | null;
  lang: Lang;
  subject: string;
  duration: number;
  /** What the lesson is made of — see `lessonPlanKinds.ts`. Absent means `calc`,
   *  the plan every subject used to get. */
  kind?: LessonKind;
  /** The catalog subject id, when known — a physics plan keeps its calculation
   *  step, a science one does not. */
  subjectId?: string;
  /** Present when the teacher attached materials; phases draw on these
   *  instead of the KB, but the STYLE still decides their shape. */
  doc?: LessonDocContext | null;
}

export interface LessonStyleBlueprint {
  materials: string[];
  mainActivity: string;
  guidedPractice: string;
  independentPractice: string;
  assessment: string;
  differentiation: string;
}

/** The lesson's own concepts — from the uploaded file when there is one. */
export function concepts(ctx: LessonStyleContext, n: number): string[] {
  if (ctx.doc?.concepts.length) return ctx.doc.concepts.slice(0, n);
  const list = ctx.lang === 'ar' ? ctx.kb?.keyConceptsAr : ctx.kb?.keyConceptsEn;
  return (list ?? []).map(c => c.trim()).filter(Boolean).slice(0, n);
}

export function firstConcept(ctx: LessonStyleContext): string {
  return concepts(ctx, 1)[0] ?? ctx.topic;
}

export function term(ctx: LessonStyleContext): string {
  const t = ctx.kb?.keyTerms?.[0];
  const text = t ? (ctx.lang === 'ar' ? t.ar : t.en) : '';
  return text?.trim() || ctx.topic;
}

/** «مستمدًا من الملف «x.pdf»» — appended so a doc-grounded phase says so. */
export function fromDoc(ctx: LessonStyleContext): string {
  if (!ctx.doc) return '';
  return ctx.lang === 'ar' ? ` (مستمدًا من ${ctx.doc.label})` : ` (drawn from ${ctx.doc.label})`;
}

/**
 * «10 دقائق», «11 دقيقة», «دقيقتان». The plan strings said «(10 دقيقة)» — the
 * singular form after a number from 3 to 10.
 */
export function arMinutes(n: number): string {
  if (n === 1) return 'دقيقة واحدة';
  if (n === 2) return 'دقيقتان';
  return n >= 3 && n <= 10 ? `${n} دقائق` : `${n} دقيقة`;
}

/** The minutes label for one phase, in the plan's language. */
export function phaseMinutes(ctx: LessonStyleContext, share: number): string {
  const n = Math.max(1, Math.round(ctx.duration * share));
  return ctx.lang === 'ar' ? arMinutes(n) : `${n} min`;
}

/** ««أ»، «ب»» / "“a”, “b”" — the lesson's concepts as a sentence fragment, or ''. */
export function conceptList(ctx: LessonStyleContext, n: number): string {
  const cs = concepts(ctx, n);
  if (cs.length === 0) return '';
  return ctx.lang === 'ar' ? cs.map(c => `«${c}»`).join('، ') : cs.map(c => `“${c}”`).join(', ');
}

export type { Lang };
