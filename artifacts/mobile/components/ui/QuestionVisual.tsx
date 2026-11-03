/**
 * The drawing an exam question carries (`body.visual`). The server already
 * re-gates it before a student receives it; this gates again, because the
 * teacher's screen reads the stored body directly.
 */
import React from 'react';
import { resolveFigure, type Figure } from '@workspace/figure';
import { FigureView } from './FigureView';

export function questionVisualOf(body: Record<string, unknown>): Figure | null {
  return resolveFigure(body['visual']);
}

export function QuestionVisual({ body, lang }: { body: Record<string, unknown>; lang: 'ar' | 'en' }) {
  const figure = questionVisualOf(body);
  return figure ? <FigureView figure={figure} lang={lang} /> : null;
}
