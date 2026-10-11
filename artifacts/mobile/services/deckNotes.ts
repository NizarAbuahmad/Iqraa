/**
 * The teacher's own notes for a slide, as labelled sections — one definition
 * for the PPTX speaker notes and the PDF's notes pages.
 *
 * The prompt spends a 16k-token budget putting a `teacher` block on every
 * slide (expected answer, misconceptions, tips) and a `hint` on the worked
 * examples, and until 2026-10-09 only the in-app presenter ever showed any of
 * it: neither export carried a single word, so the file a teacher takes to a
 * borrowed laptop was the deck with its teaching stripped out.
 *
 * Pure and react-free so `node --test` can load it.
 */
import type { ActivitySlide } from './ai/AIService.ts';

export type NoteSection = { label: string; text: string };

/** The sections worth printing for this slide, in reading order; empty when it has none. */
export function slideTeacherNotes(slide: ActivitySlide, isAr: boolean): NoteSection[] {
  const L = (ar: string, en: string) => (isAr ? ar : en);
  const t = slide.teacher;
  const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');
  const out: NoteSection[] = [];
  const push = (label: string, text: string) => { if (text) out.push({ label, text }); };
  push(L('تلميح', 'Hint'), str(slide.hint));
  push(L('الإجابة المتوقعة', 'Expected answer'), str(t?.expectedAnswer));
  push(L('أخطاء شائعة', 'Common misconceptions'), str(t?.commonMisconceptions));
  push(L('نصائح للتدريس', 'Teaching tips'), str(t?.teachingTips));
  const questions = (Array.isArray(t?.suggestedQuestions) ? t!.suggestedQuestions! : [])
    .map(str).filter(Boolean);
  push(L('أسئلة مقترحة', 'Suggested questions'), questions.map(q => `• ${q}`).join('\n'));
  push(L('التمايز', 'Differentiation'), str(t?.differentiationTips));
  return out;
}

/** The same sections as one block of plain text — what a PPTX notes pane holds. */
export function slideTeacherNotesText(slide: ActivitySlide, isAr: boolean): string {
  return slideTeacherNotes(slide, isAr).map(s => `${s.label}:\n${s.text}`).join('\n\n');
}
