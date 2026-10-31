/**
 * The decisions of the student's project screen (`app/homework-project/[id].tsx`), apart from the screen so
 * `node --test` can pin them (services/__tests__/homeworkProject.test.ts). It imports only the project rules,
 * which import nothing.
 */
import { noteChanged, type SubmissionState } from './homeworkSubmission.ts';

const statusOf = (e: unknown): unknown => (e && typeof e === 'object' ? (e as { status?: unknown }).status : undefined);

/**
 * What the screen draws: `edit`, `locked` (handed in and the due day has passed: read-only with the lock line), or
 * `otherAuthor` (another account handed the record's project in: a notice and nothing else — the server sends none
 * of that project and refuses every write).
 */
export type ProjectMode = 'edit' | 'locked' | 'otherAuthor';
export function projectMode(view: { locked: boolean; otherAuthor?: boolean }): ProjectMode {
  if (view.otherAuthor === true) return 'otherAuthor';
  return view.locked ? 'locked' : 'edit';
}

/** The draft must be saved: it differs from the note the server holds, and the project can still change. */
export function noteNeedsSave(view: { locked: boolean; otherAuthor?: boolean }, savedNote: string | null, draft: string): boolean {
  return projectMode(view) === 'edit' && savedNote !== null && noteChanged(savedNote, draft);
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

/**
 * The project changed under the screen (locked, emptied, a photo already gone, handed in from another account —
 * `other_author` — or cleared by the teacher while a write was on its way — `changed`): read it again.
 */
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
 * null) and while the student has not changed the draft; otherwise the student's draft stays. A `locked`
 * project always shows the server's note: an unsaved draft in a read-only field would claim a note the teacher
 * never received (edited at 23:58, the save refused as locked after midnight).
 */
export function draftAfterServer(savedBefore: string | null, draft: string, incoming: string, locked: boolean): string {
  return locked || savedBefore === null || !noteChanged(savedBefore, draft) ? incoming : draft;
}

/**
 * The draft after a note save failed. An `empty` refusal (clearing the only content of a handed-in project)
 * puts the saved note back, or every later blur would send the same refused clear again. Any other failure
 * keeps what the student typed.
 */
export function draftAfterSaveRefusal(e: unknown, savedNote: string, draft: string): string {
  return isEmptyRefusal(e) ? savedNote : draft;
}

/** How a project's state is drawn on the School row and on the project screen: an icon and a colour role. */
export type SubmissionLook = {
  icon: 'ellipse-outline' | 'checkmark-circle' | 'time';
  /** `colors.mutedForeground`, `colors.primary` or `colors.destructive` from `useColors()`. */
  tone: 'muted' | 'primary' | 'destructive';
};

/**
 * One mapping for both screens. Late is destructive, as an overdue homework is; never amber, which means
 * «now» (CLAUDE.md). Each state has its own icon, and its label is always shown beside it.
 */
export function submissionLook(state: SubmissionState): SubmissionLook {
  if (state === 'submitted') return { icon: 'checkmark-circle', tone: 'primary' };
  if (state === 'late') return { icon: 'time', tone: 'destructive' };
  return { icon: 'ellipse-outline', tone: 'muted' };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Ask before a first hand-in after the due day: the server records it late and locks it at once, so no photo
 * can be added afterwards. The due day itself is not late. `today` is Amman's day (`ammanToday()`), the same
 * calendar the server judges by; YYYY-MM-DD strings compare in date order.
 */
export function needsLateConfirm(status: SubmissionState, dueDate: string, today: string): boolean {
  return status === 'none' && DAY.test(dueDate) && DAY.test(today) && today > dueDate;
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
