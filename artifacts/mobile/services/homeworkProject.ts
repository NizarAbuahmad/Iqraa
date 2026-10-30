/**
 * The decisions of the student's project screen (`app/homework-project/[id].tsx`), apart from the screen so
 * `node --test` can pin them (services/__tests__/homeworkProject.test.ts). It imports only the project rules,
 * which import nothing.
 */
import { noteChanged, type SubmissionState } from './homeworkSubmission.ts';

const statusOf = (e: unknown): unknown => (e && typeof e === 'object' ? (e as { status?: unknown }).status : undefined);

/** The draft must be saved: it differs from the note the server holds, and the project can still change. */
export function noteNeedsSave(view: { locked: boolean }, savedNote: string | null, draft: string): boolean {
  return !view.locked && savedNote !== null && noteChanged(savedNote, draft);
}

/**
 * After a save of `sent` came back with `savedNow`: save again only for an edit made while it was in flight.
 * Comparing with what was sent (not only with what the server holds) means a server that normalises the
 * note cannot start a loop.
 */
export function saveAgain(sent: string, draftNow: string, savedNow: string): boolean {
  return draftNow !== sent && noteChanged(savedNow, draftNow);
}

/**
 * Removing a photo would leave a handed-in project empty, which the server refuses (409 `empty`): its last
 * photo, with a blank note. `draft`, not the saved note, because the screen saves the draft before it removes.
 */
export function removalWouldEmpty(view: { status: SubmissionState; photos: unknown[] }, draft: string): boolean {
  return view.status !== 'none' && view.photos.length === 1 && draft.trim() === '';
}

/**
 * A failed upload may still have been stored: no answer at all (offline, a timeout, an abort), a 2xx the
 * client could not read, or a 5xx after the write. The screen reads the project again before a retry.
 */
export function uploadMayHaveStored(e: unknown): boolean {
  const status = statusOf(e);
  return typeof status !== 'number' || (status >= 200 && status < 300) || status >= 500;
}

/** The project changed under the screen (locked, emptied, a photo already gone): read it again. */
export function isStaleRefusal(e: unknown): boolean {
  const status = statusOf(e);
  return status === 409 || status === 404;
}

/** The project routes' own `empty` refusal (by error name, as apiErrorKey.ts scopes it). */
export function isEmptyRefusal(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const { name, code } = e as { name?: unknown; code?: unknown };
  return name === 'SubmissionError' && code === 'empty';
}

/**
 * The note's draft once a view arrives from the server: the server's note on the first load (`savedBefore`
 * null) and while the student has not changed the draft; otherwise the student's draft stays.
 */
export function draftAfterServer(savedBefore: string | null, draft: string, incoming: string): string {
  return savedBefore === null || !noteChanged(savedBefore, draft) ? incoming : draft;
}

/**
 * A hand-in made on this screen is celebrated on the crossing into handed in (`justCompleted` in
 * celebration.ts, for one project), and only when it was on time: a late one is acknowledged, not celebrated.
 */
export function celebratesHandIn(before: SubmissionState, after: SubmissionState): boolean {
  return before === 'none' && after === 'submitted';
}

const SLOT_MAX = 104;
const SLOT_MIN = 72;

/** A photo slot's edge: three to a row where `width` allows, never above 104 nor below 72 points. */
export function photoSlotSize(width: number, gap: number): number {
  return Math.max(SLOT_MIN, Math.min(SLOT_MAX, Math.floor((width - 2 * gap) / 3)));
}
