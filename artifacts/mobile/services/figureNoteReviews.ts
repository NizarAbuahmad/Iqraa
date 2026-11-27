/**
 * A teacher's verdicts on figure notes, written into the notes files.
 *
 * The review page saves one record per figure (approve / needs a fix, the text
 * as the teacher left it, a comment). Exported as `{ "reviews": [...] }`, they
 * come back through `scripts/applyFigureReviews.ts`, which calls this.
 *
 * All or nothing: one refused review and no file changes, so a notes file is
 * never half-applied. Pure — no file access — so `node --test` covers it.
 */
import { noteFileProblems, type NoteEntry, type NoteText, type NotesFile } from './bookFigureNotes.ts';

export type FigureReview = {
  sourceId: string;
  file: string;
  verdict: 'approve' | 'needs-fix';
  ar: NoteText;
  en: NoteText;
  reviewer: string;
  /** `YYYY-MM-DD`. */
  reviewedAt: string;
  comment?: string;
};

export type ApplyResult = { files: NotesFile[]; changed: number; refused: string[] };

const text = (t: NoteText | undefined): NoteText => ({ caption: (t?.caption ?? '').trim(), teacher: (t?.teacher ?? '').trim() });

/** The entry a review leaves behind, keys in a fixed order so the output is stable. */
function entryFrom(r: FigureReview): NoteEntry {
  const base = { ar: text(r.ar), en: text(r.en), reviewedBy: r.reviewer.trim(), reviewedAt: r.reviewedAt };
  if (r.verdict === 'approve') return { status: 'approved', ...base };
  const comment = (r.comment ?? '').trim();
  return { status: 'needs-fix', ...base, ...(comment ? { comment } : {}) };
}

export function applyFigureReviews(
  files: readonly NotesFile[],
  figuresBySource: ReadonlyMap<string, readonly string[]>,
  reviews: readonly FigureReview[],
): ApplyResult {
  const refused: string[] = [];
  const next = new Map(files.map(f => [f.sourceId, { ...f.notes }]));
  const seen = new Set<string>();

  for (const r of reviews) {
    const at = `${r.sourceId}/${r.file}`;
    const notes = next.get(r.sourceId);
    const figures = figuresBySource.get(r.sourceId);
    if (!notes || !figures) { refused.push(`${at}: no notes file for this book`); continue; }
    if (!figures.includes(r.file)) { refused.push(`${at}: not a figure in index.json`); continue; }
    if (seen.has(at)) { refused.push(`${at}: reviewed twice in one export`); continue; }
    seen.add(at);
    if (r.verdict !== 'approve' && r.verdict !== 'needs-fix') { refused.push(`${at}: unknown verdict`); continue; }
    notes[r.file] = entryFrom(r);
  }

  // Order every file as its book's figure list does, then check the result
  // with the same rules the shipped files are tested against.
  const out: NotesFile[] = files.map(f => {
    const notes = next.get(f.sourceId)!;
    const order = figuresBySource.get(f.sourceId) ?? [];
    const keys = [...order.filter(k => Object.hasOwn(notes, k)), ...Object.keys(notes).filter(k => !order.includes(k))];
    return { sourceId: f.sourceId, notes: Object.fromEntries(keys.map(k => [k, notes[k]!])) };
  });
  for (const f of out) {
    for (const p of noteFileProblems(f, figuresBySource.get(f.sourceId) ?? [])) {
      // Only problems on what this export touched are the export's fault.
      const key = p.slice(f.sourceId.length + 1).split(':')[0]!;
      if (seen.has(`${f.sourceId}/${key}`)) refused.push(p);
    }
  }

  if (refused.length > 0) return { files: [...files], changed: 0, refused };
  let changed = 0;
  for (const f of out) {
    const before = files.find(g => g.sourceId === f.sourceId)!;
    for (const k of Object.keys(f.notes)) {
      if (JSON.stringify(f.notes[k]) !== JSON.stringify(before.notes[k])) changed++;
    }
  }
  return { files: out, changed, refused };
}

/** How a notes file is written: two-space JSON, Arabic as characters, trailing newline. */
export function serializeNotesFile(file: NotesFile): string {
  return `${JSON.stringify(file, null, 2)}\n`;
}
