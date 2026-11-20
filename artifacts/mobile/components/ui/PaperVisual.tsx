/**
 * A quiz / worksheet / homework question's own drawing (physics), under its text.
 * Shown only when `paperVisualOf` passes it — the same gate the exports use — so a
 * drawing is checked again every time it is drawn. Exam questions use
 * `QuestionVisual` instead (maths, its own gate).
 */
import React from 'react';
import { paperVisualOf } from '@/services/paperVisual';
import { FigureView } from './FigureView';

export function PaperVisual({ question, lang }: { question: { visual?: unknown; text?: unknown }; lang: 'ar' | 'en' }) {
  const figure = paperVisualOf(question);
  return figure ? <FigureView figure={figure} lang={lang} /> : null;
}
