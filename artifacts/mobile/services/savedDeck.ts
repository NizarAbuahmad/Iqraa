/**
 * Reading a deck back out of موادي.
 *
 * «تعديل» on a saved deck pushes Slides or Prompt Slides with a `savedId` and
 * the saved form fields. Both screens read the fields and ignored the id, so
 * the deck itself was never loaded — the teacher saw an empty form where the
 * deck they had built and edited should be. The stored `content` is a JSON
 * string written by an older build or a different screen, so it is read
 * defensively: anything that is not a projectable deck is refused and the
 * screen keeps its prefilled form.
 *
 * Free of react-native so `node --test` can load it.
 */
import type { ClassroomActivity } from './ai/AIService.ts';
import { linkAfterSave, type DeckLink } from './deckSaveLink.ts';

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * The deck a saved item's content holds, or null when it holds none. A deck
 * with no slides, or one whose slides are not objects, cannot be edited or
 * projected, so it is not "a deck" for this purpose. The lists the screens map
 * over are defaulted to empty — a deck saved before they existed still opens.
 */
export function parseSavedDeck(content: string): ClassroomActivity | null {
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    return null;
  }
  if (!isObject(raw)) return null;
  if (typeof raw.activityName !== 'string' || !raw.activityName.trim()) return null;
  if (!Array.isArray(raw.slides) || raw.slides.length === 0 || !raw.slides.every(isObject)) return null;
  const list = (v: unknown) => (Array.isArray(v) ? v : []);
  return {
    ...raw,
    materials: list(raw.materials),
    teacherNotes: list(raw.teacherNotes),
    answerKey: list(raw.answerKey),
  } as unknown as ClassroomActivity;
}

/**
 * The workspace link a reopened deck starts with: it IS the stored copy, so
 * the button reads «محفوظ», pressing it removes that item, and an edit is
 * written back to the same item. Seeded from the deck as parsed rather than
 * the stored string, so a stored copy that merely formats differently does
 * not look like an unsaved edit and get rewritten on load.
 */
export function reopenedDeckLink(savedId: string, deck: ClassroomActivity): DeckLink {
  return linkAfterSave(savedId, JSON.stringify(deck));
}
