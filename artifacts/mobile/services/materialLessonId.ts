/**
 * The curriculum lesson id a saved material is filed under.
 *
 * Free of react-native so `node --test` can load it; `workspace.ts`, which
 * saves, is a thin caller.
 */
import { generatorLessonId } from './kbContext.ts';
import { scopeFromParam } from './wideScopeRequest.ts';

/**
 * Whether a saved `formState` describes a unit / semester / whole-book paper.
 *
 * `scopeFormState` records the scope only for those (a lesson scope records
 * nothing), so this is "the material has no single lesson". Anything that would
 * re-derive a lesson from the material's label must ask this first.
 */
export function isWideScopeFormState(formState: Record<string, any> | undefined | null): boolean {
  const sel = scopeFromParam(typeof formState?.scope === 'string' ? formState.scope : undefined);
  return !!sel && sel.kind !== 'lesson';
}

/**
 * `formState` with the curriculum lesson id added, when the topic grounds to one.
 *
 * The prep board matches materials to a lesson by this id (lessonBoard.ts),
 * because a title does not identify a lesson. Stamped by `workspace.ts`, the
 * one place every screen and the chat save through, rather than in each of
 * them. An id the caller already set wins; a free-typed topic that grounds to
 * nothing gets none and the board falls back to the topic.
 *
 * **A wide paper is never stamped.** Its topic is the scope's label («الاقترانات»
 * for a unit), grounded here without a grade limit — it landed on a Grade 9
 * lesson, and the board, "send to students" and the exports then treated the
 * paper as that lesson's.
 */
export function withLessonId(
  formState: Record<string, any> | undefined,
  topic: string | undefined,
  language: 'ar' | 'en' | undefined,
): Record<string, any> | undefined {
  if (!formState || formState.lessonId || !topic?.trim()) return formState;
  if (isWideScopeFormState(formState)) return formState;
  const lessonId = generatorLessonId(topic.trim(), language ?? 'ar');
  return lessonId ? { ...formState, lessonId } : formState;
}
