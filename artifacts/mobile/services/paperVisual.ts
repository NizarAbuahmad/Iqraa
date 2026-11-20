/**
 * Whether a quiz / worksheet / homework question's drawing is shown — on screen, in
 * the HTML/PDF exports, and as the Word / text note.
 *
 * The server settled the drawing before it pooled the paper (api-server
 * lib/paperVisuals.ts). It is checked again here, every time, with the same two
 * rules: the gate (`resolvePhysicsFigure`) and the answer-leak guard (every number
 * the drawing prints is in the question's own text). So a guard fixed later reaches
 * papers saved before the fix, and a drawing whose question was reworded is not
 * drawn. A drawing that fails is simply not shown; the question always is.
 * Spec: docs/superpowers/specs/2026-11-13-physics-figures-design.md §3.
 */
import { figureNumbersInText, resolvePhysicsFigure, type PhysicsFigure } from '@workspace/figure';

export function paperVisualOf(q: { visual?: unknown; text?: unknown } | null | undefined): PhysicsFigure | null {
  if (!q || q.visual === undefined || q.visual === null || typeof q.text !== 'string') return null;
  const figure = resolvePhysicsFigure(q.visual);
  return figure && figureNumbersInText(figure, q.text) ? figure : null;
}

/** Word and the plain-text copies cannot carry the drawing; they say where it is. */
export const DRAWING_IN_PDF_AR = '(الرسم في نسخة PDF)';
export const DRAWING_IN_PDF_EN = '(The drawing is in the PDF.)';
export const drawingInPdfNote = (isAr: boolean): string => (isAr ? DRAWING_IN_PDF_AR : DRAWING_IN_PDF_EN);
