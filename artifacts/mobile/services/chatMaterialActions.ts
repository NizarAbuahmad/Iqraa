/**
 * What a chat-generated material can do besides being read.
 *
 * The tool screens have always ended the same way: save it to my materials,
 * file it under a class, project it. Chat generates the *same objects* those
 * screens do (see `ai/chatArtifacts.ts`) and offered none of it — a teacher who
 * asked for a lesson plan in the conversation could copy or export the text and
 * nothing else, so the fastest way to prepare was also the one that dead-ended.
 *
 * This module is the part of that with no React in it: which workspace type a
 * chat artifact is saved as, what it is called, what gets stored as its
 * content, and whether it can be projected at all. The screen owns the
 * buttons, the toasts and the navigation.
 */
import type { ClassroomActivity } from './ai/AIService.ts';
import type { ChatArtifactData } from './ai/chatArtifacts.ts';
import type { KBLesson } from './knowledgeBase.ts';
import type { MaterialType } from './workspace.ts';
import { buildDeckFromQuiz, buildDeckFromWorksheet } from './classDeck.ts';
import { buildLessonDeck } from './lessonSlides.ts';

/**
 * Workspace type for a chat artifact.
 *
 * An activity is filed as `activity`, its own type. That was unsafe until
 * `app/workspace/view.tsx` grew a branch for it — without one it fell through
 * to the quiz renderer, which maps over `questions` an `ActivityOutput` does
 * not have — so both chat and the Activity screen filed activities as
 * `lesson` and the type sat dead in `MaterialType`. The viewer renders them
 * now, and the type says what the material is.
 */
export function materialTypeFor(kind: ChatArtifactData['kind']): MaterialType {
  switch (kind) {
    case 'worksheet':
      return 'worksheet';
    case 'quiz':
      return 'quiz';
    case 'activity':
      return 'activity';
    case 'lesson-plan':
      return 'lesson';
  }
}

/** The generator output itself — the shape the workspace viewer parses back. */
export function materialContentFor(data: ChatArtifactData): unknown {
  switch (data.kind) {
    case 'lesson-plan':
      return data.plan;
    case 'worksheet':
      return data.worksheet;
    case 'quiz':
      return data.quiz;
    case 'activity':
      return data.activity;
  }
}

/**
 * The generator screen a saved chat material re-opens in.
 *
 * `app/workspace/view.tsx` derives the edit route from the material type, and
 * spreads `formState` into the route params. Chat has no form, so it stores the
 * one field every generator reads — the topic — and lets the rest default.
 * Storing nothing would open the generator blank, which reads as the material
 * having been lost.
 */
export function materialFormStateFor(topic: string): Record<string, string> {
  return { topic };
}

/**
 * Whether this artifact can be put on the class screen.
 *
 * Activities cannot: `ActivityOutput` is a run-sheet for the teacher (steps,
 * materials, grouping), not a slide deck, and there is no builder that turns
 * one into `ClassroomActivity`. Offering a Present button that silently did
 * nothing would be worse than not offering it — this is the "if applicable".
 */
export function canPresentArtifact(data: ChatArtifactData): boolean {
  return data.kind !== 'activity';
}

export type ArtifactDeckOptions = {
  /** Lesson title the deck is introduced with. */
  topic: string;
  isAr: boolean;
  /** Curriculum lesson behind the chat turn, when one was matched. */
  lesson?: KBLesson | null;
  subject?: string;
  grade?: string;
};

/**
 * Build the projectable deck for an artifact, or null when there isn't one.
 *
 * Note what is *not* passed to the question decks: `outcomes` / `verified`.
 * Chat does not run the answer-key verifier, so every key here is unproven and
 * the slides must say so. Passing `verified: true` to save a badge would be the
 * exact failure CLAUDE.md warns about — a ✓ nothing checked.
 */
export function deckForArtifact(
  data: ChatArtifactData,
  opts: ArtifactDeckOptions,
): ClassroomActivity | null {
  const { topic, isAr, lesson = null } = opts;
  switch (data.kind) {
    case 'lesson-plan':
      return buildLessonDeck(topic, isAr, {
        lesson,
        plan: data.plan,
        subject: opts.subject,
        grade: opts.grade,
      });
    case 'worksheet':
      return buildDeckFromWorksheet(data.worksheet, topic, isAr, { lesson });
    case 'quiz':
      return buildDeckFromQuiz(data.quiz, topic, isAr, { lesson });
    case 'activity':
      return null;
  }
}
