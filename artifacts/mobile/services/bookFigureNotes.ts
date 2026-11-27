/**
 * What a book figure shows, in a sentence the class can read under it.
 *
 * The figure index (`bookFigures.ts`) knows where each crop came from — book,
 * page, unit, lesson — and nothing about what it shows. A slide of nothing but
 * a photo and «كتاب الطالب · صفحة ٢١» was the physics reviewer's complaint
 * (u1_l2 vectors, u2_l3 Newton's laws, u4_l2 centripetal force): a picture
 * with no word on the idea it is there for.
 *
 * The book's own text layer cannot supply that word — it is bidi-scrambled —
 * so each note is written once, by hand, and kept beside the figure list in
 * `notes.json`. A note reaches a slide ONLY once a teacher has approved it
 * (`status: "approved"`); a draft, a note sent back, a skip and a figure with
 * no entry all read as "no note", and the slide stays exactly as it was. The
 * review round and the script that writes verdicts back are described in
 * `docs/superpowers/specs/2026-11-27-physics-figure-notes-design.md`.
 *
 * Keyed by the figure's file name within its book. A re-crop saves a new file
 * name (`p011.png` → `p011-v2.png`), so it starts with no note — the old one
 * described a different crop.
 */
// `with { type: 'json' }` for the same reason as bookFigures.ts: `node --test`
// runs these modules as real ESM.
import physS1Notes from '../../../knowledge-base/grade-10-physics/figures/phys-s1-student-book/notes.json' with { type: 'json' };
import physS2Notes from '../../../knowledge-base/grade-10-physics/figures/phys-s2-student-book/notes.json' with { type: 'json' };
import type { BookFigure } from './bookFigures.ts';

export const NOTE_STATUSES = ['draft', 'approved', 'needs-fix', 'skip'] as const;
export type NoteStatus = (typeof NOTE_STATUSES)[number];

/** One language of a note: the projected line and the teacher's speaker note. */
export type NoteText = { caption: string; teacher: string };

export type NoteEntry = {
  status: NoteStatus;
  ar?: NoteText;
  en?: NoteText;
  /** Who approved it (or sent it back), and the day, `YYYY-MM-DD`. */
  reviewedBy?: string;
  reviewedAt?: string;
  /** Why a `skip` figure carries no note. */
  skipReason?: string;
  /** The reviewer's word on a `needs-fix`. */
  comment?: string;
};

export type NotesFile = { sourceId: string; notes: Record<string, NoteEntry> };

export type FigureNote = NoteText;
export type FigureNoteReader = (figure: BookFigure, isAr: boolean) => FigureNote | null;

/** A caption is read off a projector from the back of a room: two short lines at most. */
export const NOTE_CAPTION_MAX = 140;

/** The books that have notes, and where their files live (repo-relative). */
export const NOTES_BOOKS: { sourceId: string; dir: string }[] = [
  { sourceId: 'phys-s1-student-book', dir: 'knowledge-base/grade-10-physics/figures/phys-s1-student-book' },
  { sourceId: 'phys-s2-student-book', dir: 'knowledge-base/grade-10-physics/figures/phys-s2-student-book' },
];

export const NOTES_FILES: NotesFile[] = [physS1Notes as NotesFile, physS2Notes as NotesFile];

/** A reader over these files. Tests build their own; the app uses `figureNote`. */
export function figureNoteReader(files: readonly NotesFile[]): FigureNoteReader {
  const bySource = new Map(files.map(f => [f.sourceId, f.notes]));
  return (figure, isAr) => {
    const notes = bySource.get(figure.sourceId);
    if (!notes || !Object.hasOwn(notes, figure.file)) return null;
    const entry = notes[figure.file]!;
    if (entry.status !== 'approved') return null;
    const text = isAr ? entry.ar : entry.en;
    const caption = text?.caption?.trim() ?? '';
    const teacher = text?.teacher?.trim() ?? '';
    if (!caption || !teacher) return null;
    return { caption, teacher };
  };
}

/** The shipped notes. Every deck builder defaults to this. */
export const figureNote: FigureNoteReader = figureNoteReader(NOTES_FILES);

const BANNED_IN_CAPTION: RegExp[] = [/في الصورة/, /in the picture/i];

function isRealDay(s: unknown): boolean {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

const filled = (s: unknown): boolean => typeof s === 'string' && s.trim().length > 0;

/**
 * Everything wrong with a notes file, one line each; empty when it is sound.
 *
 * `figureFiles` is the book's `index.json` file list — a key outside it is a
 * note for a figure that no longer exists (usually a re-crop).
 *
 * Drafts must be complete because they go to review as they are; a needs-fix
 * may hold whatever the reviewer left, since it is redrafted before it goes
 * round again. Length and wording are checked on the text that can reach a
 * slide or a reviewer — drafts and approvals.
 */
export function noteFileProblems(file: NotesFile, figureFiles: readonly string[]): string[] {
  const known = new Set(figureFiles);
  const out: string[] = [];
  for (const [key, entry] of Object.entries(file.notes)) {
    const at = `${file.sourceId}/${key}`;
    if (!known.has(key)) out.push(`${at}: not a figure in index.json`);
    if (!NOTE_STATUSES.includes(entry.status)) {
      out.push(`${at}: unknown status ${JSON.stringify(entry.status)}`);
      continue;
    }
    if (entry.status === 'skip') {
      if (!filled(entry.skipReason)) out.push(`${at}: skip without a skipReason`);
      continue;
    }
    if (entry.status === 'needs-fix') continue;
    for (const lang of ['ar', 'en'] as const) {
      const text = entry[lang];
      if (!filled(text?.caption)) out.push(`${at}: ${lang}.caption is empty`);
      if (!filled(text?.teacher)) out.push(`${at}: ${lang}.teacher is empty`);
      const caption = text?.caption ?? '';
      if ([...caption].length > NOTE_CAPTION_MAX) {
        out.push(`${at}: ${lang}.caption is ${[...caption].length} characters (max ${NOTE_CAPTION_MAX})`);
      }
      for (const banned of BANNED_IN_CAPTION) {
        if (banned.test(caption)) out.push(`${at}: ${lang}.caption says ${banned.source}`);
      }
    }
    if (entry.status === 'approved') {
      if (!filled(entry.reviewedBy)) out.push(`${at}: approved without reviewedBy`);
      if (!isRealDay(entry.reviewedAt)) out.push(`${at}: approved without a real reviewedAt day`);
    }
  }
  return out;
}
