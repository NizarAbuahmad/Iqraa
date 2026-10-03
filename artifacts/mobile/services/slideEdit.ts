/**
 * The per-slide text edit, shared by Slides and Prompt Slides.
 *
 * Each screen carried its own copy and they had drifted: Slides dropped the
 * verifier's badge when the question or answer changed, Prompt Slides kept
 * it — vouching for text nothing checked; Prompt Slides left a question
 * slide's answer alone (it lives in options/correctIndex), Slides did not.
 * This is the union of both rules.
 *
 * Free of react-native so `node --test` can load it.
 */
import type { ActivitySlide } from './ai/AIService.ts';

export type SlideTextEdit = { title: string; content: string; answer: string };

export function applySlideTextEdit(s: ActivitySlide, edit: SlideTextEdit): ActivitySlide {
  const answer = edit.answer.trim();
  const next: ActivitySlide = { ...s, title: edit.title.trim() || s.title, content: edit.content };
  // An emptied answer removes the reveal button rather than revealing "".
  if (s.type !== 'question' && (s.answer !== undefined || answer)) {
    if (answer) next.answer = answer; else delete next.answer;
  }
  // Changing the question or the answer invalidates whatever proof the
  // verifier gave the ORIGINAL pair. Title edits keep it; the maths is untouched.
  if (next.content !== s.content || next.answer !== s.answer) {
    delete next.verified;
    delete next.verifiedBy;
    delete next.computedAnswer;
  }
  return next;
}
