# Physics figure notes, PR 1 (code and drafts) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Grade 10 physics book figure on a slide can carry a short explanation and a speaker
note, written once per figure and shown only after a teacher approves it. This PR ships the
code, plus every note as an unapproved draft, so nothing a user sees changes yet.

**Architecture:**
- **The notes.** Two JSON files sit beside the physics figure lists, keyed by figure file name.
- **The reader.** `services/bookFigureNotes.ts` reads them and returns a note only when it is
  `approved`.
- **The slides.** The figure-slide builders in `lessonSlides.ts` and `classDeck.ts` take an
  optional `figureNote` reader, defaulting to the real one. With a note, the caption goes before
  the book citation and the speaker text goes into the slide's `teacher` block. With none, every
  slide is exactly as today.
- **The review script.** A pure function in `services/figureNoteReviews.ts`, plus a command-line
  wrapper in `scripts/`, writes the teacher's verdicts back into the files.

**Tech Stack:**
- TypeScript, Expo / React Native (`artifacts/mobile`).
- `node --test` with `--experimental-strip-types` for the tests.
- JSON imported with `with { type: 'json' }`.

**Spec:** `docs/superpowers/specs/2026-11-27-physics-figure-notes-design.md`. Read §1, §2 and
§4 before Task 1, and the drafting rules in §1 before Tasks 6–8.

## Global Constraints

**The notes**
- Notes live only in
  `knowledge-base/grade-10-physics/figures/phys-s1-student-book/notes.json` and
  `knowledge-base/grade-10-physics/figures/phys-s2-student-book/notes.json`, shaped
  `{ "sourceId": "...", "notes": { "<file>": entry } }`.
- An entry's status is one of `"draft" | "approved" | "needs-fix" | "skip"`.
- **A caption** is at most **140** characters, counted in code points (`[...s].length`). An
  Arabic caption never contains «في الصورة», and an English one never contains "in the
  picture" (any case).
- **An approved entry** has `ar` and `en`, each with a non-empty `caption` and `teacher`, plus a
  non-empty `reviewedBy` and a `reviewedAt` that is a real `YYYY-MM-DD` day.
- **A skip entry** has a non-empty `skipReason`.

**What a slide shows**
- Only `approved` notes ever reach a slide.
- **With no approved note, every slide is byte for byte what it is today.** The figure slide's
  `content` and `mediaCaption` are both `bookFigureCaption(figure, isAr)`, and it has no
  `teacher` key. The rule slide and the revision slides have no new keys.
- **With an approved note, on a figure slide of its own,** `content` and `mediaCaption` are both
  `` `${note.caption}\n${citation}` ``, and `teacher` is
  `{ expectedAnswer: '', teachingTips: note.teacher }`.
- **With an approved note, on a side figure** (the rule slide; the revision outcomes and terms
  slides):
  - `sideImageCaption` is `` `${note.caption}\n${citation}` ``;
  - the note's teacher text is appended to existing `teachingTips` with `'\n\n'`;
  - a slide with no `teacher` block gets `{ expectedAnswer: '', teachingTips: note.teacher }`.

**Rules for this PR**
- No renderer changes. No «ما الجديد» entry: nothing user-visible changes, since every note is a
  draft.

**Repo rules (CLAUDE.md)**
- **Where tests go.** Mobile tests go only in `artifacts/mobile/services/__tests__/`. Anything
  importing `react-native` or `expo-*` cannot be loaded there.
- **Editing files.**
  - No `sed -i` or `perl -pi` on source; use the Edit or Write tool.
  - Files are UTF-8 with Arabic. A `git diff --stat` line reading `Bin` for a text file means
    corruption.
- **Commits.**
  - `git add` named paths only, never `-A` or `.`.
  - Check `git diff --cached --stat` before each commit.
  - Every commit message ends with:
    ```
    Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
    Claude-Session: https://claude.ai/code/session_01VikuhbrMMx7Br4AiBViwWd
    ```
- **Running tests.** Run a single test file from `artifacts/mobile`:
  `node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/<name>.test.ts`.
  The full mobile suite is `pnpm test` there and prints nothing until it finishes (minutes).

## File structure

| File | Responsibility |
|---|---|
| `knowledge-base/grade-10-physics/figures/phys-s1-student-book/notes.json` (create) | S1 notes. Empty in Task 1; drafted in Task 6 |
| `knowledge-base/grade-10-physics/figures/phys-s2-student-book/notes.json` (create) | S2 notes. Empty in Task 1; drafted in Task 7 |
| `artifacts/mobile/services/bookFigureNotes.ts` (create) | Types, `NOTES_FILES`, `NOTES_BOOKS`, `figureNoteReader`, `figureNote`, `noteFileProblems` |
| `artifacts/mobile/services/lessonSlides.ts` (modify) | Notes on standalone figure slides, the rule slide and the revision deck |
| `artifacts/mobile/services/classDeck.ts` (modify) | Pass the reader through the quiz, worksheet and game decks |
| `artifacts/mobile/services/figureNoteReviews.ts` (create) | `applyFigureReviews`, `serializeNotesFile` (pure) |
| `artifacts/mobile/scripts/applyFigureReviews.ts` (create) | Command line: read an export, write the notes files |
| `artifacts/mobile/services/__tests__/bookFigureNotes.test.ts` (create) | Reader, validator and real-file validity |
| `artifacts/mobile/services/__tests__/figureNoteSlides.test.ts` (create) | The lesson deck and revision deck with and without notes |
| `artifacts/mobile/services/__tests__/figureNoteDecks.test.ts` (create) | The class decks, plus the "unchanged without approval" check over every physics lesson |
| `artifacts/mobile/services/__tests__/figureNoteReviews.test.ts` (create) | Applying verdicts |
| `docs/status-log.md`, `STATUS.md` (modify) | Write-up (top of the log) and one open-items line |

---

### Task 0: Workspace

The worktree `/home/user/wt-figure-notes` (branch `claude/figure-notes-1`) exists with the spec
committed. It has no `node_modules` yet.

- [ ] **Step 1: Install and build**

```bash
cd /home/user/wt-figure-notes && pnpm install && npx tsc --build
```
Expected: the install completes, and `tsc --build` exits 0 or prints only pre-existing errors
unrelated to `artifacts/mobile/services`. CLAUDE.md requires a full install for a fresh
worktree; a filtered one leaves `lib/curriculum` without `@types/node`.

- [ ] **Step 2: Confirm the baseline suite is green for the files this plan touches**

```bash
cd /home/user/wt-figure-notes/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/lessonSlides.test.ts services/__tests__/revisionDeck.test.ts services/__tests__/classDeck.test.ts services/__tests__/bookFigures.test.ts
```
Expected: all pass.

---

### Task 1: The notes module and its files

**Files:**
- Create: `knowledge-base/grade-10-physics/figures/phys-s1-student-book/notes.json`
- Create: `knowledge-base/grade-10-physics/figures/phys-s2-student-book/notes.json`
- Create: `artifacts/mobile/services/bookFigureNotes.ts`
- Test: `artifacts/mobile/services/__tests__/bookFigureNotes.test.ts`

**Interfaces:**
- Consumes: `type BookFigure` from `artifacts/mobile/services/bookFigures.ts` (`file`,
  `sourceId`, `pdfPage`, `unit`, `lesson`, `lessonTitleEn`).
- Produces:
  - `NOTE_STATUSES`; types `NoteStatus`, `NoteText = { caption: string; teacher: string }`,
    `NoteEntry`, `NotesFile = { sourceId: string; notes: Record<string, NoteEntry> }`,
    `FigureNote = NoteText`, `FigureNoteReader = (figure: BookFigure, isAr: boolean) => FigureNote | null`.
  - `NOTE_CAPTION_MAX = 140`.
  - `NOTES_FILES: NotesFile[]`.
  - `NOTES_BOOKS: { sourceId: string; dir: string }[]`, with `dir` relative to the repo root.
  - `figureNoteReader(files: readonly NotesFile[]): FigureNoteReader`.
  - `figureNote: FigureNoteReader`.
  - `noteFileProblems(file: NotesFile, figureFiles: readonly string[]): string[]`.

- [ ] **Step 1: Create the two empty notes files**

`knowledge-base/grade-10-physics/figures/phys-s1-student-book/notes.json`:

```json
{
  "sourceId": "phys-s1-student-book",
  "notes": {}
}
```

`knowledge-base/grade-10-physics/figures/phys-s2-student-book/notes.json`:

```json
{
  "sourceId": "phys-s2-student-book",
  "notes": {}
}
```

- [ ] **Step 2: Write the failing tests**

`artifacts/mobile/services/__tests__/bookFigureNotes.test.ts`:

```ts
/**
 * Book-figure notes: the reader returns only what a teacher approved, and the
 * shipped notes files obey the rules a slide depends on.
 *
 * Run (from artifacts/mobile):
 *   node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test \
 *     services/__tests__/bookFigureNotes.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  NOTE_CAPTION_MAX,
  NOTES_BOOKS,
  NOTES_FILES,
  figureNoteReader,
  noteFileProblems,
  type NoteEntry,
  type NotesFile,
} from '../bookFigureNotes.ts';
import type { BookFigure } from '../bookFigures.ts';
import physS1 from '../../../../knowledge-base/grade-10-physics/figures/phys-s1-student-book/index.json' with { type: 'json' };
import physS2 from '../../../../knowledge-base/grade-10-physics/figures/phys-s2-student-book/index.json' with { type: 'json' };

const INDEX: Record<string, string[]> = {
  'phys-s1-student-book': (physS1 as { figures: { file: string }[] }).figures.map(f => f.file),
  'phys-s2-student-book': (physS2 as { figures: { file: string }[] }).figures.map(f => f.file),
};

const fig = (file: string, sourceId = 'phys-s1-student-book'): BookFigure =>
  ({ file, sourceId, pdfPage: 11, unit: 1, lesson: 1, lessonTitleEn: null });

const approved = (tag: string): NoteEntry => ({
  status: 'approved',
  ar: { caption: `شرح ${tag}`, teacher: `ملاحظة ${tag}` },
  en: { caption: `Caption ${tag}`, teacher: `Note ${tag}` },
  reviewedBy: 'معلم الفيزياء',
  reviewedAt: '2026-12-01',
});

const FILE: NotesFile = {
  sourceId: 'phys-s1-student-book',
  notes: {
    'p011.png': approved('a'),
    'p012.png': { ...approved('b'), status: 'draft' },
    'p013-v2.png': { ...approved('c'), status: 'needs-fix', comment: 'أعد الصياغة' },
    'p015.png': { status: 'skip', skipReason: 'صورة زخرفية' },
  },
};

describe('figureNoteReader', () => {
  const read = figureNoteReader([FILE]);

  it('returns an approved note in the language asked for', () => {
    assert.deepEqual(read(fig('p011.png'), true), { caption: 'شرح a', teacher: 'ملاحظة a' });
    assert.deepEqual(read(fig('p011.png'), false), { caption: 'Caption a', teacher: 'Note a' });
  });

  it('returns nothing for a draft, a note that needs a fix, or a skip', () => {
    assert.equal(read(fig('p012.png'), true), null);
    assert.equal(read(fig('p013-v2.png'), true), null);
    assert.equal(read(fig('p015.png'), true), null);
  });

  it('returns nothing for a figure with no entry, or from another book', () => {
    assert.equal(read(fig('p099.png'), true), null);
    // Same file name, other book: notes are per book, never matched by name alone.
    assert.equal(read(fig('p011.png', 'phys-s2-student-book'), true), null);
    assert.equal(read(fig('p011.png', 'chem-s1-student-book'), true), null);
  });

  it('returns nothing for an approved entry whose language is empty', () => {
    const half = figureNoteReader([{ sourceId: 'phys-s1-student-book', notes: {
      'p011.png': { ...approved('a'), en: { caption: '', teacher: 'x' } },
    } }]);
    assert.equal(half(fig('p011.png'), false), null);
    assert.ok(half(fig('p011.png'), true));
  });

  it('does not treat an inherited property name as a figure', () => {
    assert.equal(read(fig('constructor'), true), null);
    assert.equal(read(fig('__proto__'), true), null);
  });
});

describe('noteFileProblems', () => {
  const files = ['p011.png', 'p012.png', 'p013-v2.png', 'p015.png'];

  it('accepts a well-formed file', () => {
    assert.deepEqual(noteFileProblems(FILE, files), []);
  });

  it('flags a key that is not a figure in the book', () => {
    const bad = { ...FILE, notes: { ...FILE.notes, 'p999.png': approved('z') } };
    assert.equal(noteFileProblems(bad, files).length, 1);
    assert.match(noteFileProblems(bad, files)[0]!, /p999\.png/);
  });

  it('flags an unknown status', () => {
    const bad = { ...FILE, notes: { 'p011.png': { ...approved('a'), status: 'ok' as never } } };
    assert.equal(noteFileProblems(bad, files).length, 1);
  });

  it('flags an approved note missing a language, a field, the reviewer or a real day', () => {
    const cases: NoteEntry[] = [
      { ...approved('a'), en: undefined },
      { ...approved('a'), ar: { caption: 'x', teacher: ' ' } },
      { ...approved('a'), reviewedBy: '' },
      { ...approved('a'), reviewedAt: '2026-02-30' },
      { ...approved('a'), reviewedAt: '1/12/2026' },
    ];
    for (const entry of cases) {
      assert.ok(noteFileProblems({ ...FILE, notes: { 'p011.png': entry } }, files).length > 0, JSON.stringify(entry));
    }
  });

  it('flags a draft with an empty field — drafts go to review complete', () => {
    const draft: NoteEntry = { ...approved('a'), status: 'draft', en: { caption: 'x', teacher: '' } };
    assert.ok(noteFileProblems({ ...FILE, notes: { 'p011.png': draft } }, files).length > 0);
  });

  it('lets a needs-fix entry carry whatever the reviewer left', () => {
    const fix: NoteEntry = { status: 'needs-fix', comment: 'خطأ في المصطلح' };
    assert.deepEqual(noteFileProblems({ ...FILE, notes: { 'p011.png': fix } }, files), []);
  });

  it('flags a skip with no reason', () => {
    assert.ok(noteFileProblems({ ...FILE, notes: { 'p015.png': { status: 'skip' } } }, files).length > 0);
  });

  it('flags a caption over the limit, counted in characters not bytes', () => {
    const at = 'ب'.repeat(NOTE_CAPTION_MAX);
    const over = 'ب'.repeat(NOTE_CAPTION_MAX + 1);
    const ok = { ...approved('a'), ar: { caption: at, teacher: 't' } };
    const bad = { ...approved('a'), ar: { caption: over, teacher: 't' } };
    assert.deepEqual(noteFileProblems({ ...FILE, notes: { 'p011.png': ok } }, files), []);
    assert.ok(noteFileProblems({ ...FILE, notes: { 'p011.png': bad } }, files).length > 0);
  });

  it('flags «في الصورة» and "in the picture" in a caption', () => {
    const ar = { ...approved('a'), ar: { caption: 'نرى في الصورة متجهين', teacher: 't' } };
    const en = { ...approved('a'), en: { caption: 'In the picture, two vectors', teacher: 't' } };
    assert.ok(noteFileProblems({ ...FILE, notes: { 'p011.png': ar } }, files).length > 0);
    assert.ok(noteFileProblems({ ...FILE, notes: { 'p011.png': en } }, files).length > 0);
  });
});

describe('the shipped notes files', () => {
  it('are the two Grade 10 physics books, and NOTES_BOOKS names the same two', () => {
    assert.deepEqual(NOTES_FILES.map(f => f.sourceId), ['phys-s1-student-book', 'phys-s2-student-book']);
    assert.deepEqual(NOTES_BOOKS.map(b => b.sourceId), ['phys-s1-student-book', 'phys-s2-student-book']);
    for (const b of NOTES_BOOKS) assert.match(b.dir, new RegExp(`^knowledge-base/grade-10-physics/figures/${b.sourceId}$`));
  });

  it('obey every rule — real keys, valid statuses, complete approvals, short captions', () => {
    for (const file of NOTES_FILES) {
      assert.deepEqual(noteFileProblems(file, INDEX[file.sourceId]!), [], file.sourceId);
    }
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run (from `artifacts/mobile`): `node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/bookFigureNotes.test.ts`
Expected: FAIL, cannot find module `../bookFigureNotes.ts`.

- [ ] **Step 4: Write the module**

`artifacts/mobile/services/bookFigureNotes.ts`:

```ts
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
```

- [ ] **Step 5: Run the test to verify it passes**

Run: the same command as Step 3.
Expected: PASS, all tests.

- [ ] **Step 6: Typecheck the mobile package**

Run (from `artifacts/mobile`): `npx tsc --noEmit -p .`
Expected: no new errors in `services/bookFigureNotes.ts` or the test. If `Object.hasOwn` is
rejected by the lib setting, use `Object.prototype.hasOwnProperty.call(notes, figure.file)`
instead.

- [ ] **Step 7: Commit**

```bash
cd /home/user/wt-figure-notes
git add knowledge-base/grade-10-physics/figures/phys-s1-student-book/notes.json knowledge-base/grade-10-physics/figures/phys-s2-student-book/notes.json artifacts/mobile/services/bookFigureNotes.ts artifacts/mobile/services/__tests__/bookFigureNotes.test.ts
git diff --cached --stat
git commit -m "Book-figure notes: files, reader and validator (no notes yet)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VikuhbrMMx7Br4AiBViwWd"
```

---

### Task 2: Notes on the lesson deck and the revision deck

**Files:**
- Modify: `artifacts/mobile/services/lessonSlides.ts`. The places to edit:
  - the imports at the top;
  - `LessonDeckOptions` (around l.109);
  - `bookFigureCaption`/`bookFigureSlides` (around l.418–475);
  - the rule slide in `buildLessonDeck` (around l.831–851);
  - `RevisionDeckOptions` (around l.1311);
  - the outcomes and terms slides in `buildRevisionDeck` (around l.1520–1592).
- Test: `artifacts/mobile/services/__tests__/figureNoteSlides.test.ts` (create).

**Interfaces:**
- Consumes (Task 1): `figureNote`, `figureNoteReader`, `type FigureNote`,
  `type FigureNoteReader`, `type NotesFile` from `./bookFigureNotes.ts`.
- Produces:
  - `bookFigureSlides(kbLessonId, isAr, figureUri?, max = BOOK_FIGURE_MAX, note: FigureNoteReader = figureNote)`;
  - `LessonDeckOptions.figureNote?: FigureNoteReader`;
  - `RevisionDeckOptions.figureNote?: FigureNoteReader`.

- [ ] **Step 1: Capture a baseline of every deck before touching any builder**

This is the one-off check from spec §4. It is not committed. Write
`/tmp/claude-0/-home-user-Iqraa/33e07f7b-582b-5db3-b942-62ad2d3e357f/scratchpad/figure-notes/deckDump.ts`:

```ts
// Scratch (not committed): a hash of every deck built from every lesson with book figures,
// so the decks after this PR can be compared with the decks before it.
// Run from artifacts/mobile:
//   node --import ./scripts/registerTestAlias.mjs --experimental-strip-types <this file> <out.json>
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { buildLessonDeck, buildRevisionDeck } from '/home/user/wt-figure-notes/artifacts/mobile/services/lessonSlides.ts';
import { buildDeckFromQuiz, buildDeckFromWorksheet, buildGameDeckFromQuiz } from '/home/user/wt-figure-notes/artifacts/mobile/services/classDeck.ts';
import { lessonsWithFigures } from '/home/user/wt-figure-notes/artifacts/mobile/services/bookFigures.ts';
import { KB_LESSONS } from '/home/user/wt-figure-notes/artifacts/mobile/services/knowledgeBase.ts';
import { revisionUnitsFromLessons } from '/home/user/wt-figure-notes/artifacts/mobile/services/revisionScope.ts';

const QUIZ = { title: 'q', duration: 10, totalPoints: 2, questions: [
  { id: 'q1', type: 'multiple_choice', text: 'س', options: ['أ', 'ب'], correctAnswer: 'أ', points: 1, explanation: '' },
  { id: 'q2', type: 'short_answer', text: 'س٢', correctAnswer: 'ج', points: 1, explanation: '' },
] } as any;
const WS = { title: 'w', instructions: 'i', sections: [{ type: 'short_answer', title: 's', questions: [{ text: 'س', points: 1 }] }],
  answerKey: [{ num: 1, answer: 'ج' }] } as any;
const uri = (f: { file: string }) => `fig://${f.file}`;
const h = (x: unknown) => createHash('sha256').update(JSON.stringify(x)).digest('hex');
const byId = new Map(KB_LESSONS.map(l => [l.id, l]));
const out: Record<string, string> = {};
for (const id of lessonsWithFigures()) {
  const lesson = byId.get(id);
  if (!lesson) continue;
  for (const isAr of [true, false]) {
    const k = `${id}|${isAr ? 'ar' : 'en'}`;
    out[`${k}|lesson`] = h(buildLessonDeck(lesson.titleAr, isAr, { lesson, figureUri: uri }));
    out[`${k}|quiz`] = h(buildDeckFromQuiz(QUIZ, lesson.titleAr, isAr, { lesson, figureUri: uri }));
    out[`${k}|ws`] = h(buildDeckFromWorksheet(WS, lesson.titleAr, isAr, { lesson, figureUri: uri }));
    out[`${k}|game`] = h(buildGameDeckFromQuiz(QUIZ, lesson.titleAr, isAr, { teamCount: 3, lesson, figureUri: uri }));
  }
}
const phys = KB_LESSONS.filter(l => l.id.startsWith('kbl-phys-s')).map(l => l.id);
for (const lang of ['ar', 'en'] as const) {
  out[`phys-revision|${lang}`] = h(buildRevisionDeck(lang === 'ar', {
    units: revisionUnitsFromLessons(phys, lang), phrase: 'x', plan: null, figureUri: uri,
  }));
}
writeFileSync(process.argv[2]!, JSON.stringify(out, null, 1));
console.log(Object.keys(out).length, 'decks hashed');
```

Run (from `artifacts/mobile`):
`node --import ./scripts/registerTestAlias.mjs --experimental-strip-types /tmp/claude-0/-home-user-Iqraa/33e07f7b-582b-5db3-b942-62ad2d3e357f/scratchpad/figure-notes/deckDump.ts /tmp/claude-0/-home-user-Iqraa/33e07f7b-582b-5db3-b942-62ad2d3e357f/scratchpad/figure-notes/before.json`

Expected: prints a count in the thousands. If a builder signature differs from the one used
here, adjust the script (never the builders). Record the count in the report.

- [ ] **Step 2: Write the failing tests**

`artifacts/mobile/services/__tests__/figureNoteSlides.test.ts`:

```ts
/**
 * An approved figure note on the lesson deck and the revision deck — and, with
 * none, the decks exactly as they were.
 *
 * Run (from artifacts/mobile):
 *   node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test \
 *     services/__tests__/figureNoteSlides.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { bookFigureCaption, buildLessonDeck, buildRevisionDeck } from '../lessonSlides.ts';
import { figuresForLesson, type BookFigure } from '../bookFigures.ts';
import { figureNoteReader, type FigureNoteReader, type NoteEntry } from '../bookFigureNotes.ts';
import { KB_LESSONS } from '../knowledgeBase.ts';
import type { ActivitySlide } from '../ai/AIService.ts';

const ID = 'kbl-phys-s1-nccd-u1_l2';
const LESSON = KB_LESSONS.find(l => l.id === ID)!;
const FIGS = figuresForLesson(ID);
const uri = (f: { file: string }) => `fig://${f.file}`;
const none: FigureNoteReader = () => null;

const entry = (file: string): NoteEntry => ({
  status: 'approved',
  ar: { caption: `شرح ${file}`, teacher: `ملاحظة ${file}` },
  en: { caption: `Caption ${file}`, teacher: `Note ${file}` },
  reviewedBy: 'معلم', reviewedAt: '2026-12-01',
});
/** Approves exactly these figures, wherever they come from. */
function approving(figs: BookFigure[]): FigureNoteReader {
  const bySource = new Map<string, Record<string, NoteEntry>>();
  for (const f of figs) {
    const notes = bySource.get(f.sourceId) ?? {};
    notes[f.file] = entry(f.file);
    bySource.set(f.sourceId, notes);
  }
  return figureNoteReader([...bySource].map(([sourceId, notes]) => ({ sourceId, notes })));
}

const figureSlides = (slides: ActivitySlide[]) => slides.filter(s => s.type === 'media' && s.mediaUrl?.startsWith('fig://'));
const noRules = { ...LESSON, rulesAr: [], rulesEn: [] };
const withRule = { ...LESSON, rulesAr: ['القاعدة'], rulesEn: ['The rule'] };

describe('probe', () => {
  it('the lesson exists and has several figures', () => {
    assert.ok(LESSON, ID);
    assert.ok(FIGS.length >= 2, 'probe: u1_l2 holds several figures');
  });
});

describe('a figure slide of its own', () => {
  for (const isAr of [true, false]) {
    it(`carries the approved note before the citation (${isAr ? 'ar' : 'en'})`, () => {
      const deck = buildLessonDeck('x', isAr, { lesson: noRules, figureUri: uri, figureNote: approving([FIGS[0]!]) });
      const shown = figureSlides(deck.slides);
      const first = shown.find(s => s.mediaUrl === uri(FIGS[0]!))!;
      const citation = bookFigureCaption(FIGS[0]!, isAr);
      const caption = isAr ? `شرح ${FIGS[0]!.file}` : `Caption ${FIGS[0]!.file}`;
      assert.equal(first.content, `${caption}\n${citation}`);
      assert.equal(first.mediaCaption, `${caption}\n${citation}`, 'the PDF and PowerPoint read mediaCaption, not content');
      assert.deepEqual(first.teacher, { expectedAnswer: '', teachingTips: isAr ? `ملاحظة ${FIGS[0]!.file}` : `Note ${FIGS[0]!.file}` });
      // the others have no approved note and are untouched
      for (const s of shown.filter(s => s !== first)) {
        assert.equal(s.content, s.mediaCaption);
        assert.equal('teacher' in s, false);
      }
    });
  }

  it('with no approved note, is exactly as before: citation twice, no teacher block', () => {
    const deck = buildLessonDeck('x', true, { lesson: noRules, figureUri: uri, figureNote: none });
    const shown = figureSlides(deck.slides);
    assert.ok(shown.length > 0);
    for (const s of shown) {
      const f = FIGS.find(g => uri(g) === s.mediaUrl)!;
      assert.equal(s.content, bookFigureCaption(f, true));
      assert.equal(s.mediaCaption, bookFigureCaption(f, true));
      assert.equal('teacher' in s, false);
    }
  });
});

describe('the figure beside the rule', () => {
  const ruleSlide = (slides: ActivitySlide[]) => slides.find(s => s.title === '📐 القاعدة')!;

  it('puts the caption above the citation and the speaker note in the teacher block', () => {
    const deck = buildLessonDeck('x', true, { lesson: withRule, figureUri: uri, figureNote: approving([FIGS[0]!]) });
    const rule = ruleSlide(deck.slides);
    assert.equal(rule.sideImageUrl, uri(FIGS[0]!));
    assert.equal(rule.sideImageCaption, `شرح ${FIGS[0]!.file}\n${bookFigureCaption(FIGS[0]!, true)}`);
    assert.deepEqual(rule.teacher, { expectedAnswer: '', teachingTips: `ملاحظة ${FIGS[0]!.file}` });
  });

  it('with no approved note, keeps the citation alone and gains no teacher block', () => {
    const deck = buildLessonDeck('x', true, { lesson: withRule, figureUri: uri, figureNote: none });
    const rule = ruleSlide(deck.slides);
    assert.equal(rule.sideImageCaption, bookFigureCaption(FIGS[0]!, true));
    assert.equal('teacher' in rule, false);
  });
});

describe('the revision deck', () => {
  const lessons = ['kbl-phys-s1-nccd-u1_l1', 'kbl-phys-s1-nccd-u1_l2'].map(id => ({ id, title: id, thin: false }));
  // Hand-built so the round has both an outcomes slide and a terms slide, and
  // terms worth asking about (which put tips on the outcomes slide already).
  const unit = {
    unitId: 'kbu-phys-s1-nccd-u1', title: 'المتجهات', lessons,
    outcomes: ['أميّز بين الكميات القياسية والكميات المتجهة.'],
    concepts: ['الكمية المتجهة', 'الكمية القياسية'],
    terms: ['المتجه'],
  };
  // unitFigures takes the first figure of each lesson in turn.
  const first = figuresForLesson('kbl-phys-s1-nccd-u1_l1')[0]!;
  const second = figuresForLesson('kbl-phys-s1-nccd-u1_l2')[0]!;
  const build = (figureNote: FigureNoteReader) =>
    buildRevisionDeck(true, { units: [unit], phrase: 'x', plan: null, figureUri: uri, figureNote });
  const byImage = (slides: ActivitySlide[], f: BookFigure) => slides.find(s => s.sideImageUrl === uri(f))!;

  it('appends the note to the outcomes slide\'s existing tips and captions both figures', () => {
    const base = build(none);
    const noted = build(approving([first, second]));
    const goals0 = byImage(base.slides, first);
    const goals = byImage(noted.slides, first);
    assert.ok(goals0.teacher?.teachingTips, 'probe: the outcomes slide already has tips');
    assert.equal(goals.sideImageCaption, `شرح ${first.file}\n${bookFigureCaption(first, true)}`);
    assert.equal(goals.teacher?.teachingTips, `${goals0.teacher!.teachingTips}\n\nملاحظة ${first.file}`);
    assert.equal(goals.teacher?.expectedAnswer, goals0.teacher?.expectedAnswer, 'the expected answer is kept');

    const terms = byImage(noted.slides, second);
    assert.equal(terms.sideImageCaption, `شرح ${second.file}\n${bookFigureCaption(second, true)}`);
    assert.deepEqual(terms.teacher, { expectedAnswer: '', teachingTips: `ملاحظة ${second.file}` });
  });

  it('with no approved note, is exactly as before', () => {
    const base = build(none);
    assert.equal(byImage(base.slides, first).sideImageCaption, bookFigureCaption(first, true));
    const terms = byImage(base.slides, second);
    assert.equal(terms.sideImageCaption, bookFigureCaption(second, true));
    assert.equal('teacher' in terms, false);
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run (from `artifacts/mobile`): `node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/figureNoteSlides.test.ts`
Expected:
- FAIL: the noted cases fail, because `content` is the bare citation and `teacher` is missing.
- PASS: the "exactly as before" cases.
- If the "probe: the outcomes slide already has tips" assertion fails, the hand-built unit did
  not produce a terms tip. Read `buildRevisionDeck` and adjust only the fixture, and say so in
  the report.

- [ ] **Step 4: Implement in `lessonSlides.ts`**

1. Imports. Add the new import after the `./bookFigures.ts` import, and add
   `TeacherCompanion` to the existing `import type { … } from './ai/AIService.ts'` list:

```ts
import { figureNote as defaultFigureNote, type FigureNote, type FigureNoteReader } from './bookFigureNotes.ts';
```

2. `LessonDeckOptions`. Add after `figureUri`:

```ts
  /**
   * Reads a figure's approved note (`bookFigureNotes.ts`). Injected so tests
   * can approve notes without editing the shipped files; the app passes
   * nothing and gets the real reader. A figure with no approved note is shown
   * exactly as before notes existed.
   */
  figureNote?: FigureNoteReader;
```

3. Right after `bookFigureCaption`, add two helpers:

```ts
/**
 * A figure's caption line: the approved note, then the book citation. With no
 * note, the citation alone — what every figure carried before notes existed.
 * The citation always stays: it is how a teacher checks the projected figure
 * against the printed page.
 */
function figureCaptionWithNote(figure: BookFigure, isAr: boolean, note: FigureNote | null): string {
  const citation = bookFigureCaption(figure, isAr);
  return note ? `${note.caption}\n${citation}` : citation;
}

/**
 * The note's speaker text after any tips the slide already has. No note →
 * the teacher block untouched (undefined stays undefined).
 */
function teacherWithNote(teacher: TeacherCompanion | undefined, note: FigureNote | null): TeacherCompanion | undefined {
  if (!note) return teacher;
  const teachingTips = [teacher?.teachingTips, note.teacher].filter(Boolean).join('\n\n');
  return { ...(teacher ?? { expectedAnswer: '' }), teachingTips };
}
```

4. `bookFigureSlides`. Add the parameter and use it. Keep the no-note object's keys in exactly
   today's order:

```ts
export function bookFigureSlides(
  kbLessonId: string | null | undefined,
  isAr: boolean,
  figureUri?: (figure: BookFigure) => string | null,
  max: number = BOOK_FIGURE_MAX,
  note: FigureNoteReader = defaultFigureNote,
): Omit<ActivitySlide, 'slideNumber'>[] {
  if (!figureUri) return [];
  const out: Omit<ActivitySlide, 'slideNumber'>[] = [];
  for (const figure of figuresForLesson(kbLessonId).slice(0, max)) {
    const uri = figureUri(figure);
    if (!uri) continue;
    const n = note(figure, isAr);
    // Both fields, because the renderers split on them: the presenter draws
    // `content` above the image, the PDF and PowerPoint draw `mediaCaption`.
    const caption = figureCaptionWithNote(figure, isAr, n);
    out.push({
      type: 'media',
      title: isAr ? 'من كتاب الطالب' : 'From the Student Book',
      content: caption,
      mediaKind: 'image',
      mediaUrl: uri,
      mediaCaption: caption,
      durationSeconds: 0,
      ...(n ? { teacher: teacherWithNote(undefined, n) } : {}),
    });
  }
  return out;
}
```

Also add one line to its doc comment: "`note` reads the figure's approved note
(`bookFigureNotes.ts`); with none, the slide is exactly as before."

5. `buildLessonDeck`, the rule slide. Pass the reader through and carry the figure's teacher
   block:

```ts
  const figures = bookFigureSlides(lesson?.id, isAr, opts.figureUri, BOOK_FIGURE_MAX, opts.figureNote);
```

and in the rule slide's spread replace

```ts
      ...(ruleFigure?.mediaUrl
        ? {
            sideImageUrl: ruleFigure.mediaUrl,
            sideImageCaption: ruleFigure.mediaCaption,
          }
        : {}),
```

with

```ts
      // `mediaCaption` already carries the note above the citation when the
      // figure has one; so does its teacher block.
      ...(ruleFigure?.mediaUrl
        ? {
            sideImageUrl: ruleFigure.mediaUrl,
            sideImageCaption: ruleFigure.mediaCaption,
            ...(ruleFigure.teacher ? { teacher: ruleFigure.teacher } : {}),
          }
        : {}),
```

6. `RevisionDeckOptions`. Add after `figureUri`:

```ts
  /** As `LessonDeckOptions.figureNote`. */
  figureNote?: FigureNoteReader;
```

7. `buildRevisionDeck`:
   - Right after `const [first, second] = figures;`, add:

```ts
    const readNote = opts.figureNote ?? defaultFigureNote;
    const firstNote = first ? readNote(first.figure, isAr) : null;
    const secondNote = second ? readNote(second.figure, isAr) : null;
```

   - On the outcomes slide:
     - Change `sideImageCaption: bookFigureCaption(first.figure, isAr)` to
       `sideImageCaption: figureCaptionWithNote(first.figure, isAr, firstNote)`.
     - Wrap its `teacher: { … }` object: `teacher: teacherWithNote({ … }, firstNote)`. With no
       note, `teacherWithNote` returns the same object, so nothing changes.
   - On the terms slide:
     - Change `sideImageCaption: bookFigureCaption(second.figure, isAr)` to
       `sideImageCaption: figureCaptionWithNote(second.figure, isAr, secondNote)`.
     - Add `...(secondNote ? { teacher: teacherWithNote(undefined, secondNote) } : {})`
       directly after the `...(second ? { sideImageUrl … } : {})` spread.
   - Leave the side-by-side (`compare`) slide alone: it exists only when there is no figure.

- [ ] **Step 5: Run the new tests, then the existing deck suites**

Run (from `artifacts/mobile`):
`node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/figureNoteSlides.test.ts services/__tests__/lessonSlides.test.ts services/__tests__/revisionDeck.test.ts services/__tests__/classDeck.test.ts services/__tests__/deckNotes.test.ts`
Expected: all PASS.

- [ ] **Step 6: Typecheck**

Run (from `artifacts/mobile`): `npx tsc --noEmit -p .`
Expected: no new errors.

- [ ] **Step 7: Commit**

```bash
cd /home/user/wt-figure-notes
git add artifacts/mobile/services/lessonSlides.ts artifacts/mobile/services/__tests__/figureNoteSlides.test.ts
git diff --cached --stat
git commit -m "Lesson and revision decks show an approved figure note

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VikuhbrMMx7Br4AiBViwWd"
```

---

### Task 3: Notes on the class decks, and "unchanged without approval" over every physics lesson

**Files:**
- Modify: `artifacts/mobile/services/classDeck.ts`. The places to edit:
  - the imports;
  - `pushFigures` (around l.164);
  - the opts of `buildDeckFromQuiz` (around l.179);
  - the opts of `buildDeckFromWorksheet` (around l.315);
  - the opts of `buildGameDeckFromQuiz` (around l.697);
  - the three `pushFigures(...)` calls (around l.212, 347, 725).
- Test: `artifacts/mobile/services/__tests__/figureNoteDecks.test.ts` (create).

**Interfaces:**
- Consumes:
  - Task 1: `NOTES_FILES`, `figureNoteReader`, `type FigureNoteReader`, `type NotesFile`;
  - Task 2: `bookFigureSlides(..., max, note)`, `bookFigureCaption`, `BOOK_FIGURE_MAX` (already
    exported from `lessonSlides.ts`), `LessonDeckOptions.figureNote`,
    `RevisionDeckOptions.figureNote`.
- Produces: `figureNote?: FigureNoteReader` on the opts of `buildDeckFromQuiz`,
  `buildDeckFromWorksheet` and `buildGameDeckFromQuiz`.

- [ ] **Step 1: Write the failing tests**

`artifacts/mobile/services/__tests__/figureNoteDecks.test.ts`:

```ts
/**
 * Figure notes on the class decks (quiz, worksheet, game), and the promise the
 * whole feature rests on: a note that is not approved changes nothing, on any
 * deck of any Grade 10 physics lesson, in either language.
 *
 * Run (from artifacts/mobile):
 *   node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test \
 *     services/__tests__/figureNoteDecks.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildDeckFromQuiz, buildDeckFromWorksheet, buildGameDeckFromQuiz } from '../classDeck.ts';
import { bookFigureCaption, buildLessonDeck, buildRevisionDeck } from '../lessonSlides.ts';
import { figuresForLesson } from '../bookFigures.ts';
import { NOTES_FILES, figureNoteReader, type FigureNoteReader, type NoteEntry, type NotesFile } from '../bookFigureNotes.ts';
import { KB_LESSONS, type KBLesson } from '../knowledgeBase.ts';
import { revisionUnitsFromLessons } from '../revisionScope.ts';
import type { ActivitySlide, QuizOutput, WorksheetOutput } from '../ai/AIService.ts';

const QUIZ: QuizOutput = {
  title: 'اختبار', duration: 10, totalPoints: 2,
  questions: [
    { id: 'q1', type: 'multiple_choice', text: 'ما وحدة القوة؟', options: ['N', 'kg'], correctAnswer: 'N', points: 1, explanation: '' },
    { id: 'q2', type: 'short_answer', text: 'عرّف المتجه.', correctAnswer: 'كمية لها مقدار واتجاه', points: 1, explanation: '' },
  ],
};
const WORKSHEET: WorksheetOutput = {
  title: 'ورقة عمل', instructions: 'أجب',
  sections: [{ type: 'short_answer', title: 'القسم الأول', questions: [{ text: 'س1', points: 1 }] }],
  answerKey: [{ num: 1, answer: 'إجابة' }],
};
const uri = (f: { file: string }) => `fig://${f.file}`;
const none: FigureNoteReader = () => null;
const PHYSICS: KBLesson[] = KB_LESSONS.filter(l => l.id.startsWith('kbl-phys-s') && figuresForLesson(l.id).length > 0);

/** The shipped files with every entry forced to `status` — text kept. */
function forced(status: NoteEntry['status']): FigureNoteReader {
  const files: NotesFile[] = NOTES_FILES.map(f => ({
    sourceId: f.sourceId,
    notes: Object.fromEntries(Object.entries(f.notes).map(([k, e]) => [k, { ...e, status }])),
  }));
  return figureNoteReader(files);
}
/** Every physics figure approved, with stand-in text: the opposite pole. */
const approveAll: FigureNoteReader = (figure, isAr) =>
  figure.sourceId.startsWith('phys-') ? { caption: isAr ? `شرح ${figure.file}` : `Caption ${figure.file}`, teacher: 'T' } : null;

type Build = (lesson: KBLesson, isAr: boolean, figureNote: FigureNoteReader) => { slides: ActivitySlide[] };
const DECKS: Record<string, Build> = {
  lesson: (lesson, isAr, figureNote) => buildLessonDeck(lesson.titleAr, isAr, { lesson, figureUri: uri, figureNote }),
  quiz: (lesson, isAr, figureNote) => buildDeckFromQuiz(QUIZ, lesson.titleAr, isAr, { lesson, figureUri: uri, figureNote }),
  worksheet: (lesson, isAr, figureNote) => buildDeckFromWorksheet(WORKSHEET, lesson.titleAr, isAr, { lesson, figureUri: uri, figureNote }),
  game: (lesson, isAr, figureNote) => buildGameDeckFromQuiz(QUIZ, lesson.titleAr, isAr, { teamCount: 3, lesson, figureUri: uri, figureNote }),
};

describe('probe', () => {
  it('Grade 10 physics has the twelve lessons with figures the map gives it', () => {
    assert.equal(PHYSICS.length, 12);
  });
});

describe('class decks carry an approved note', () => {
  const lesson = KB_LESSONS.find(l => l.id === 'kbl-phys-s2-nccd-u4_l2')!;
  const f0 = figuresForLesson(lesson.id)[0]!;
  for (const kind of ['quiz', 'worksheet', 'game'] as const) {
    it(`on the ${kind} deck`, () => {
      const deck = DECKS[kind]!(lesson, true, approveAll);
      const s = deck.slides.find(x => x.mediaUrl === uri(f0))!;
      const expected = `شرح ${f0.file}\n${bookFigureCaption(f0, true)}`;
      assert.equal(s.content, expected);
      assert.equal(s.mediaCaption, expected);
      assert.deepEqual(s.teacher, { expectedAnswer: '', teachingTips: 'T' });
    });
  }
});

describe('a note that is not approved changes nothing', () => {
  for (const status of ['draft', 'needs-fix', 'skip'] as const) {
    it(`every physics lesson, every deck, both languages — all notes ${status}`, () => {
      const reader = forced(status);
      for (const lesson of PHYSICS) {
        for (const isAr of [true, false]) {
          for (const [kind, build] of Object.entries(DECKS)) {
            assert.deepEqual(build(lesson, isAr, reader), build(lesson, isAr, none), `${lesson.id} ${kind} ${isAr ? 'ar' : 'en'}`);
          }
        }
      }
    });
  }

  it('and the revision deck over every physics unit, both languages', () => {
    const ids = KB_LESSONS.filter(l => l.id.startsWith('kbl-phys-s')).map(l => l.id);
    for (const lang of ['ar', 'en'] as const) {
      const units = revisionUnitsFromLessons(ids, lang);
      const build = (figureNote: FigureNoteReader) =>
        buildRevisionDeck(lang === 'ar', { units, phrase: 'x', plan: null, figureUri: uri, figureNote });
      assert.deepEqual(build(forced('draft')), build(none), lang);
    }
  });

  it('is not a vacuous check: approving every figure changes every physics lesson deck', () => {
    for (const lesson of PHYSICS) {
      assert.notDeepEqual(DECKS.lesson!(lesson, true, approveAll), DECKS.lesson!(lesson, true, none), lesson.id);
    }
  });

  it('with no note, a figure slide is today\'s: citation twice, no teacher block', () => {
    for (const lesson of PHYSICS) {
      for (const [kind, build] of Object.entries(DECKS)) {
        for (const s of build(lesson, true, none).slides.filter(x => x.type === 'media' && x.mediaUrl?.startsWith('fig://'))) {
          assert.equal(s.content, s.mediaCaption, `${lesson.id} ${kind}`);
          assert.equal('teacher' in s, false, `${lesson.id} ${kind}`);
        }
      }
    }
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run (from `artifacts/mobile`): `node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/figureNoteDecks.test.ts`
Expected:
- FAIL: the three "class decks carry an approved note" cases fail, because the reader is not
  passed through.
- FAIL at typecheck, or ignored at runtime: `figureNote` is not yet an option.
- PASS: the rest. The notes files are still empty, so the "not approved" cases hold trivially
  until Tasks 6–7 fill them.
- If the probe reports a count other than 12, use the actual count and say so in the report;
  the map is the source of truth.

- [ ] **Step 3: Implement in `classDeck.ts`**

1. Imports. Add `BOOK_FIGURE_MAX` to the existing `./lessonSlides.ts` import, and add:

```ts
import type { FigureNoteReader } from './bookFigureNotes.ts';
```

2. `pushFigures`:

```ts
function pushFigures(
  slides: ActivitySlide[],
  kbLessonId: string | null | undefined,
  isAr: boolean,
  figureUri?: (figure: BookFigure) => string | null,
  figureNote?: FigureNoteReader,
): void {
  for (const slide of numberedBookTitles(bookFigureSlides(kbLessonId, isAr, figureUri, BOOK_FIGURE_MAX, figureNote), isAr)) {
    slides.push({ ...slide, slideNumber: slides.length + 1 } as ActivitySlide);
  }
}
```

3. Add to the opts of `buildDeckFromQuiz`, `buildDeckFromWorksheet` and `buildGameDeckFromQuiz`,
   right after `figureUri`:

```ts
    /** Reads a figure's approved note; see `LessonDeckOptions.figureNote`. Omitted → the real notes. */
    figureNote?: FigureNoteReader;
```

4. Pass it at the three call sites: `pushFigures(slides, opts?.lesson?.id, isAr, opts?.figureUri, opts?.figureNote);`.
   The game deck's opts are not optional, so there it is `opts.figureNote`.

- [ ] **Step 4: Run the new test and the deck suites**

Run (from `artifacts/mobile`):
`node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/figureNoteDecks.test.ts services/__tests__/figureNoteSlides.test.ts services/__tests__/classDeck.test.ts services/__tests__/classDeckAnswerKey.test.ts`
Expected: all PASS.

- [ ] **Step 5: The one-off before/after comparison**

Rerun the Task 2 Step 1 script with output `after.json`. Then compare:

```bash
cd /tmp/claude-0/-home-user-Iqraa/33e07f7b-582b-5db3-b942-62ad2d3e357f/scratchpad/figure-notes && node -e "
const a=require('./before.json'), b=require('./after.json');
const keys=new Set([...Object.keys(a),...Object.keys(b)]);
const diff=[...keys].filter(k=>a[k]!==b[k]);
console.log(keys.size,'decks,',diff.length,'differ');console.log(diff.slice(0,20).join('\n'))"
```

Expected: `0 differ`. The shipped notes are still empty, so every deck of every subject must
hash the same. Any difference is a bug in Task 2 or 3: fix it before committing.

- [ ] **Step 6: Typecheck, commit**

Run (from `artifacts/mobile`): `npx tsc --noEmit -p .`. Expected: no new errors.

```bash
cd /home/user/wt-figure-notes
git add artifacts/mobile/services/classDeck.ts artifacts/mobile/services/__tests__/figureNoteDecks.test.ts
git diff --cached --stat
git commit -m "Class decks show an approved figure note; unapproved notes change no deck

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VikuhbrMMx7Br4AiBViwWd"
```

---

### Task 4: Writing review verdicts back

**Files:**
- Create: `artifacts/mobile/services/figureNoteReviews.ts`
- Create: `artifacts/mobile/scripts/applyFigureReviews.ts`
- Test: `artifacts/mobile/services/__tests__/figureNoteReviews.test.ts`

**Interfaces:**
- Consumes (Task 1): `NOTE_CAPTION_MAX`, `noteFileProblems`, `NOTES_BOOKS`,
  `type NoteEntry`, `type NoteText`, `type NotesFile`.
- Produces:
  - `type FigureReview = { sourceId: string; file: string; verdict: 'approve' | 'needs-fix'; ar: NoteText; en: NoteText; reviewer: string; reviewedAt: string; comment?: string }`;
  - `applyFigureReviews(files: readonly NotesFile[], figuresBySource: ReadonlyMap<string, readonly string[]>, reviews: readonly FigureReview[]): { files: NotesFile[]; changed: number; refused: string[] }`;
  - `serializeNotesFile(file: NotesFile): string`.

**The export format.** Spec §3 has the review page's saved verdicts exported to a JSON file
shaped `{ "reviews": FigureReview[] }`. This is the contract that page will be built against
after this PR.

- [ ] **Step 1: Write the failing tests**

`artifacts/mobile/services/__tests__/figureNoteReviews.test.ts`:

```ts
/**
 * Writing a reviewer's verdicts into the notes files.
 *
 * Run (from artifacts/mobile):
 *   node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test \
 *     services/__tests__/figureNoteReviews.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { applyFigureReviews, serializeNotesFile, type FigureReview } from '../figureNoteReviews.ts';
import type { NotesFile } from '../bookFigureNotes.ts';

const S1 = 'phys-s1-student-book';
const FIGS = new Map<string, string[]>([[S1, ['p010-v2.png', 'p011.png', 'p012.png']]]);
const draft = (tag: string) => ({
  status: 'draft' as const,
  ar: { caption: `مسودة ${tag}`, teacher: `ملاحظة ${tag}` },
  en: { caption: `Draft ${tag}`, teacher: `Note ${tag}` },
});
const FILES: NotesFile[] = [{ sourceId: S1, notes: { 'p011.png': draft('b'), 'p010-v2.png': draft('a') } }];

const review = (over: Partial<FigureReview>): FigureReview => ({
  sourceId: S1, file: 'p011.png', verdict: 'approve',
  ar: { caption: 'شرح معدّل', teacher: 'ملاحظة معدّلة' },
  en: { caption: 'Edited caption', teacher: 'Edited note' },
  reviewer: 'معلم الفيزياء', reviewedAt: '2026-12-01',
  ...over,
});

describe('applyFigureReviews', () => {
  it('approves with the reviewer\'s text, name and day', () => {
    const { files, changed, refused } = applyFigureReviews(FILES, FIGS, [review({})]);
    assert.deepEqual(refused, []);
    assert.equal(changed, 1);
    assert.deepEqual(files[0]!.notes['p011.png'], {
      status: 'approved',
      ar: { caption: 'شرح معدّل', teacher: 'ملاحظة معدّلة' },
      en: { caption: 'Edited caption', teacher: 'Edited note' },
      reviewedBy: 'معلم الفيزياء', reviewedAt: '2026-12-01',
    });
    // untouched entries stay as they were
    assert.deepEqual(files[0]!.notes['p010-v2.png'], draft('a'));
  });

  it('records a needs-fix with its comment', () => {
    const { files } = applyFigureReviews(FILES, FIGS, [review({ verdict: 'needs-fix', comment: 'المصطلح خطأ' })]);
    const e = files[0]!.notes['p011.png']!;
    assert.equal(e.status, 'needs-fix');
    assert.equal(e.comment, 'المصطلح خطأ');
    assert.equal(e.reviewedBy, 'معلم الفيزياء');
  });

  it('orders entries as the book\'s figure list does, so output is stable', () => {
    const { files } = applyFigureReviews(FILES, FIGS, [review({})]);
    assert.deepEqual(Object.keys(files[0]!.notes), ['p010-v2.png', 'p011.png']);
  });

  it('accepts a figure that had no entry yet', () => {
    const { files, refused } = applyFigureReviews(FILES, FIGS, [review({ file: 'p012.png' })]);
    assert.deepEqual(refused, []);
    assert.equal(files[0]!.notes['p012.png']!.status, 'approved');
  });

  it('refuses a figure not in the book, a book with no notes file, and a duplicate', () => {
    for (const bad of [
      [review({ file: 'p999.png' })],
      [review({ sourceId: 'chem-s1-student-book' })],
      [review({}), review({})],
    ]) {
      const out = applyFigureReviews(FILES, FIGS, bad);
      assert.ok(out.refused.length > 0, JSON.stringify(bad.map(r => r.file)));
    }
  });

  it('refuses an approval with an empty field, no reviewer, a bad day or a long caption', () => {
    for (const bad of [
      review({ en: { caption: '', teacher: 'x' } }),
      review({ ar: { caption: 'x', teacher: '  ' } }),
      review({ reviewer: '' }),
      review({ reviewedAt: '2026-13-01' }),
      review({ ar: { caption: 'ب'.repeat(141), teacher: 'x' } }),
      review({ ar: { caption: 'في الصورة متجه', teacher: 'x' } }),
    ]) {
      assert.ok(applyFigureReviews(FILES, FIGS, [bad]).refused.length > 0, JSON.stringify(bad));
    }
  });

  it('writes nothing at all when any review is refused', () => {
    const out = applyFigureReviews(FILES, FIGS, [review({}), review({ file: 'p999.png' })]);
    assert.ok(out.refused.length > 0);
    assert.equal(out.changed, 0);
    assert.deepEqual(out.files, FILES);
  });

  it('is idempotent: applying the same export twice changes nothing the second time', () => {
    const reviews = [review({}), review({ file: 'p010-v2.png', verdict: 'needs-fix', comment: 'c' })];
    const once = applyFigureReviews(FILES, FIGS, reviews);
    const twice = applyFigureReviews(once.files, FIGS, reviews);
    assert.equal(twice.changed, 0);
    assert.equal(serializeNotesFile(twice.files[0]!), serializeNotesFile(once.files[0]!));
  });

  it('does not mutate its input', () => {
    const before = JSON.stringify(FILES);
    applyFigureReviews(FILES, FIGS, [review({})]);
    assert.equal(JSON.stringify(FILES), before);
  });
});

describe('serializeNotesFile', () => {
  it('is two-space JSON with a trailing newline, Arabic kept as characters', () => {
    const text = serializeNotesFile(FILES[0]!);
    assert.ok(text.endsWith('}\n'));
    assert.match(text, /مسودة/);
    assert.deepEqual(JSON.parse(text), FILES[0]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run (from `artifacts/mobile`): `node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/figureNoteReviews.test.ts`
Expected: FAIL, cannot find module `../figureNoteReviews.ts`.

- [ ] **Step 3: Write the module**

`artifacts/mobile/services/figureNoteReviews.ts`:

```ts
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: the same command as Step 2.
Expected: PASS, all tests.

- [ ] **Step 5: Write the command-line wrapper**

`artifacts/mobile/scripts/applyFigureReviews.ts`:

```ts
/**
 * Writes a figure-note review export into the notes files.
 *
 *   cd artifacts/mobile
 *   node --import ./scripts/registerTestAlias.mjs --experimental-strip-types \
 *     scripts/applyFigureReviews.ts <reviews.json> [--dry-run]
 *
 * <reviews.json> is `{ "reviews": FigureReview[] }` (services/figureNoteReviews.ts).
 * Refuses the whole export, writing nothing, if any review is refused; prints
 * why and exits 1. Running it twice with the same export changes nothing.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { NOTES_BOOKS, type NotesFile } from '../services/bookFigureNotes.ts';
import { applyFigureReviews, serializeNotesFile, type FigureReview } from '../services/figureNoteReviews.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const [input, ...flags] = process.argv.slice(2);
if (!input) {
  console.error('usage: applyFigureReviews.ts <reviews.json> [--dry-run]');
  process.exit(2);
}
const dryRun = flags.includes('--dry-run');

const raw = JSON.parse(readFileSync(input, 'utf8')) as { reviews?: FigureReview[] };
if (!Array.isArray(raw.reviews)) {
  console.error(`${input}: expected { "reviews": [...] }`);
  process.exit(2);
}

const files: NotesFile[] = [];
const figures = new Map<string, string[]>();
for (const book of NOTES_BOOKS) {
  const dir = path.join(ROOT, book.dir);
  files.push(JSON.parse(readFileSync(path.join(dir, 'notes.json'), 'utf8')) as NotesFile);
  const index = JSON.parse(readFileSync(path.join(dir, 'index.json'), 'utf8')) as { figures: { file: string }[] };
  figures.set(book.sourceId, index.figures.map(f => f.file));
}

const { files: out, changed, refused } = applyFigureReviews(files, figures, raw.reviews);
if (refused.length > 0) {
  console.error(`refused — nothing written:\n${refused.map(r => `  ${r}`).join('\n')}`);
  process.exit(1);
}
for (const [i, book] of NOTES_BOOKS.entries()) {
  const target = path.join(ROOT, book.dir, 'notes.json');
  const text = serializeNotesFile(out[i]!);
  if (text !== readFileSync(target, 'utf8') && !dryRun) writeFileSync(target, text);
}
const tally = (s: string) => out.reduce((n, f) => n + Object.values(f.notes).filter(e => e.status === s).length, 0);
console.log(`${raw.reviews.length} reviews, ${changed} entries changed${dryRun ? ' (dry run, nothing written)' : ''}`);
console.log(`now: ${tally('approved')} approved, ${tally('needs-fix')} need a fix, ${tally('draft')} draft, ${tally('skip')} skipped`);
```

- [ ] **Step 6: Smoke-test the wrapper on a throwaway export (dry run)**

```bash
cd /tmp/claude-0/-home-user-Iqraa/33e07f7b-582b-5db3-b942-62ad2d3e357f/scratchpad/figure-notes && node -e "
require('fs').writeFileSync('bad-export.json', JSON.stringify({reviews:[{sourceId:'phys-s1-student-book',file:'p999.png',verdict:'approve',ar:{caption:'a',teacher:'b'},en:{caption:'c',teacher:'d'},reviewer:'r',reviewedAt:'2026-12-01'}]}))"
cd /home/user/wt-figure-notes/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types scripts/applyFigureReviews.ts /tmp/claude-0/-home-user-Iqraa/33e07f7b-582b-5db3-b942-62ad2d3e357f/scratchpad/figure-notes/bad-export.json --dry-run; echo "exit $?"
git -C /home/user/wt-figure-notes status --short knowledge-base
```

Expected:
- the run prints `refused — nothing written:` and `p999.png: not a figure in index.json`;
- it ends with `exit 1`;
- `git status` shows no change under `knowledge-base`.

- [ ] **Step 7: Typecheck, commit**

Run (from `artifacts/mobile`): `npx tsc --noEmit -p .`. Expected: no new errors. If the
mobile tsconfig does not include `scripts/`, run `npx tsc --noEmit --allowImportingTsExtensions --module nodenext --moduleResolution nodenext --target es2022 --strict scripts/applyFigureReviews.ts`
instead, or note that `scripts/` is outside the typechecked set, as it is for `pregenerate.ts`.

```bash
cd /home/user/wt-figure-notes
git add artifacts/mobile/services/figureNoteReviews.ts artifacts/mobile/scripts/applyFigureReviews.ts artifacts/mobile/services/__tests__/figureNoteReviews.test.ts
git diff --cached --stat
git commit -m "Script to write figure-note review verdicts back, all or nothing

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VikuhbrMMx7Br4AiBViwWd"
```

---

### Task 5: The drafting kit (scratch, not committed)

The drafting tasks need, for each figure, its image, its lesson and its page text in one
place. Build that once.

**Files:**
- Create (scratch): `/tmp/claude-0/-home-user-Iqraa/33e07f7b-582b-5db3-b942-62ad2d3e357f/scratchpad/figure-notes/briefs.ts`
- Output (scratch): `.../scratchpad/figure-notes/briefs/phys-s1.md` and `phys-s2.md`

- [ ] **Step 1: Write the brief generator**

```ts
// Scratch (not committed): one markdown brief per physics book — for each figure,
// its image path, lesson, page, and the lesson's concepts, terms and rules.
// Run from artifacts/mobile:
//   node --import ./scripts/registerTestAlias.mjs --experimental-strip-types <this file>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { KB_LESSONS } from '/home/user/wt-figure-notes/artifacts/mobile/services/knowledgeBase.ts';

const ROOT = '/home/user/wt-figure-notes';
const OUT = '/tmp/claude-0/-home-user-Iqraa/33e07f7b-582b-5db3-b942-62ad2d3e357f/scratchpad/figure-notes/briefs';
mkdirSync(OUT, { recursive: true });
const map = JSON.parse(readFileSync(`${ROOT}/knowledge-base/figure-lesson-map.json`, 'utf8')).entries as
  { sourceId: string; unit: number; lesson: number; kbLessonId: string | null }[];
const byId = new Map(KB_LESSONS.map(l => [l.id, l]));
for (const s of ['s1', 's2']) {
  const sourceId = `phys-${s}-student-book`;
  const dir = `${ROOT}/knowledge-base/grade-10-physics/figures/${sourceId}`;
  const index = JSON.parse(readFileSync(`${dir}/index.json`, 'utf8')).figures as { file: string; pdfPage: number; unit: number | null; lesson: number | null }[];
  let pages: { page: number; text: string }[] = [];
  try { pages = JSON.parse(readFileSync(`${ROOT}/lib/curriculum/src/data/extracted/${sourceId}.json`, 'utf8')).text; } catch { /* no text */ }
  const lines: string[] = [`# ${sourceId} — ${index.length} figures`, ''];
  let lastLesson = '';
  for (const f of index) {
    const id = map.find(e => e.sourceId === sourceId && e.unit === f.unit && e.lesson === f.lesson)?.kbLessonId ?? null;
    const l = id ? byId.get(id) : undefined;
    if (id !== lastLesson) {
      lastLesson = id ?? '';
      lines.push(`## ${id ?? 'NO LESSON (unmapped — mark skip)'} ${l ? `— ${l.titleAr} / ${l.titleEn}` : ''}`, '');
      if (l) {
        lines.push(`**Summary:** ${l.summaryAr}`, '', `**Concepts:** ${l.keyConceptsAr.join(' · ')}`, '');
        lines.push(`**Terms:** ${l.keyTerms.map(t => `${t.ar} (${t.en}): ${t.definitionAr}`).join(' | ')}`, '');
        if (l.rulesAr?.length) lines.push(`**Rules:** ${l.rulesAr.join(' | ')}`, '');
      }
    }
    const pageText = pages.find(p => p.page === f.pdfPage)?.text ?? '';
    lines.push(`### ${f.file} — page ${f.pdfPage}`, '', `Image: ${dir}/${f.file}`, '',
      `Page text (bidi-scrambled, for terms only): ${pageText.replace(/\s+/g, ' ').slice(0, 600)}`, '');
  }
  writeFileSync(`${OUT}/phys-${s}.md`, lines.join('\n'));
}
console.log('briefs written to', OUT);
```

- [ ] **Step 2: Run it and check the output**

Run (from `artifacts/mobile`):
`node --import ./scripts/registerTestAlias.mjs --experimental-strip-types /tmp/claude-0/-home-user-Iqraa/33e07f7b-582b-5db3-b942-62ad2d3e357f/scratchpad/figure-notes/briefs.ts`

Expected:
- two files;
- `phys-s1.md` has 32 `### ` headings and `phys-s2.md` has 65;
- `p009b.png` sits under "NO LESSON".

Check with:

```bash
cd /tmp/claude-0/-home-user-Iqraa/33e07f7b-582b-5db3-b942-62ad2d3e357f/scratchpad/figure-notes/briefs && grep -c '^### ' phys-s1.md phys-s2.md
```

---

### Tasks 6 and 7: Drafting the notes (S1: 32 figures; S2: 65)

These are content tasks, not code. Each is run by a drafter that can look at images (the Read
tool shows a PNG). The drafter writes a **fragment file** in the scratchpad, never the notes
files themselves; a fixed merge step (Step 3) writes the notes file.

- Task 6 covers S1, in one dispatch.
- Task 7 covers S2, in two dispatches:
  - unit 4 plus `p009b.png` (24 figures);
  - units 5–6 (41 figures).

**Files:**
- Create (scratch): `.../scratchpad/figure-notes/fragments/<name>.json`, each shaped
  `{ "<file>": NoteEntry }`.
- Modify: the book's `notes.json`, through the merge step only.

**The drafting rules.** Copy these into each dispatch verbatim, with spec §1.

- **What to look at.** For each figure, Read the image file named in the brief and read its
  lesson's summary, concepts, terms and rules in the brief.
  - Write about what the figure actually shows: arrows, labels, objects, apparatus.
  - Connect it to the one idea of the lesson it illustrates.
  - If the image does not show something, do not say it.
- **`status`:** `"draft"`, or `"skip"` with a one-line Arabic `skipReason`. Skip only for:
  - a decoration or photo with no physics idea to point at;
  - `p009b.png`, whose reason is «لا يقابله درس في المنهاج، فلا يُعرض على أي شريحة».
- **`ar.caption`:** one or two short Arabic sentences, at most 140 characters.
  - Say what the figure shows, then the idea, using the book's terms from the brief's
    Concepts / Terms.
  - Never «في الصورة»; name what is there («المتجه A والمتجه B ومحصلتهما R…»).
  - No number or value that is not printed on the figure or in the lesson.
  - Symbols and units in Latin as the book prints them (F, m, N, m/s²).
- **`ar.teacher`:** one or two sentences to the teacher, imperative, as the deck's other tips
  are («أشِر إلى…»), then exactly one question for the class, in «».
- **`en`:** the same two fields in plain classroom English, with the same content and the same
  question. Never "in the picture".
- **Honesty.** Where the image is too unclear to describe with confidence, still draft, but
  start `ar.teacher` with «[تحقّق]» so the reviewer looks hard at it. Never guess a label.
- **Reporting.** Report the count drafted, the count skipped, and every figure marked
  «[تحقّق]».

- [ ] **Step 1: Generate the brief for the dispatch**

Task 5 already wrote it. Hand the drafter the brief file and its slice: the file names it
covers.

- [ ] **Step 2: Draft into the fragment file**

The drafter writes
`/tmp/claude-0/-home-user-Iqraa/33e07f7b-582b-5db3-b942-62ad2d3e357f/scratchpad/figure-notes/fragments/<name>.json`
with the Write tool. Each name is one of:
- `s1`;
- `s2-u4`, which also holds `p009b.png`;
- `s2-u5u6`.

- [ ] **Step 3: Merge the fragments into the notes file (controller)**

Write the merge script once, as scratch
`/tmp/claude-0/-home-user-Iqraa/33e07f7b-582b-5db3-b942-62ad2d3e357f/scratchpad/figure-notes/merge.ts`:

```ts
// Scratch: merge drafting fragments into a book's notes.json, in figure order.
// Run from artifacts/mobile:
//   node --import ./scripts/registerTestAlias.mjs --experimental-strip-types <this> <s1|s2> <fragment.json>...
import { readFileSync, writeFileSync } from 'node:fs';
import { noteFileProblems, type NotesFile } from '/home/user/wt-figure-notes/artifacts/mobile/services/bookFigureNotes.ts';
import { serializeNotesFile } from '/home/user/wt-figure-notes/artifacts/mobile/services/figureNoteReviews.ts';

const [book, ...fragments] = process.argv.slice(2);
const dir = `/home/user/wt-figure-notes/knowledge-base/grade-10-physics/figures/phys-${book}-student-book`;
const file = JSON.parse(readFileSync(`${dir}/notes.json`, 'utf8')) as NotesFile;
const order = (JSON.parse(readFileSync(`${dir}/index.json`, 'utf8')).figures as { file: string }[]).map(f => f.file);
const notes = { ...file.notes };
for (const frag of fragments) Object.assign(notes, JSON.parse(readFileSync(frag!, 'utf8')));
const merged: NotesFile = { sourceId: file.sourceId, notes: Object.fromEntries(order.filter(k => k in notes).map(k => [k, notes[k]!])) };
const problems = noteFileProblems(merged, order);
const missing = order.filter(k => !(k in notes));
if (problems.length) { console.error(problems.join('\n')); process.exit(1); }
writeFileSync(`${dir}/notes.json`, serializeNotesFile(merged));
console.log(`${Object.keys(merged.notes).length} entries; missing: ${missing.join(', ') || 'none'}`);
```

Run it with the book's fragments. Expected: no problems, and `missing: none` once all of that
book's fragments are in. If problems are printed, send them back to the drafter, or fix the
named fragment entry with the Edit tool, then rerun.

- [ ] **Step 4: Validate and commit the book's drafts**

Run (from `artifacts/mobile`): `node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/bookFigureNotes.test.ts services/__tests__/figureNoteDecks.test.ts`
Expected: PASS. `figureNoteDecks` now exercises real draft text, forced to each non-approved
status.

```bash
cd /home/user/wt-figure-notes
git add knowledge-base/grade-10-physics/figures/phys-s1-student-book/notes.json   # Task 6; phys-s2-... for Task 7
git diff --cached --stat
git commit -m "Draft notes for the Grade 10 physics S1 figures (unapproved)

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VikuhbrMMx7Br4AiBViwWd"
```

For Task 7, use the message "Draft notes for the Grade 10 physics S2 figures (unapproved)".

---

### Task 8: Second pass over the drafts (a different agent, flags only)

**Files:**
- Create (scratch): `.../scratchpad/figure-notes/flags.md`
- Modify: both `notes.json` files, for the controller's fixes only.

- [ ] **Step 1: Dispatch a checker that did not write the drafts**

Its brief:
- the drafting rules above, plus spec §1;
- the two briefs from Task 5;
- the two notes files.

For every entry it opens the image and checks for:
1. a claim the figure does not show;
2. a term the lesson does not use, or a wrong physics term;
3. a number or value not on the figure or in the lesson;
4. a caption over 140 characters, or containing «في الصورة» / "in the picture";
5. an English text that says something different from the Arabic;
6. a teacher note without exactly one question in «».

It writes one line per problem to `flags.md` as `<sourceId>/<file> — <rule number> — <what is
wrong> — <suggested fix>`. **It edits nothing.** It also lists any figure it thinks should be a
`skip`, and any `skip` it thinks should be drafted.

- [ ] **Step 2: Fix the flags (controller)**

Fix each flag in the notes files with the Edit tool, or rule it a false flag and say why in the
ledger. Then rerun:

`node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/bookFigureNotes.test.ts services/__tests__/figureNoteDecks.test.ts`

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
cd /home/user/wt-figure-notes
git add knowledge-base/grade-10-physics/figures/phys-s1-student-book/notes.json knowledge-base/grade-10-physics/figures/phys-s2-student-book/notes.json
git diff --cached --stat
git commit -m "Figure-note drafts: fixes from the second pass

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VikuhbrMMx7Br4AiBViwWd"
```

---

### Task 9: Docs, full checks, PR

**Files:**
- Modify: `docs/status-log.md` (a new entry at the TOP), `STATUS.md` (one line under what is
  open).

- [ ] **Step 1: The log entry**

Add at the top of `docs/status-log.md`, in the house style of the entries below it, an entry
titled «Physics book figures can carry a teacher-approved explanation (PR 1: code and
drafts)». It says:

**What was built**
- the notes files, the reader, the slide wiring and the review script;
- the rule that only `approved` reaches a slide;
- that every note ships as `draft` (or `skip`), so nothing a user sees changes;
- the drafted and skipped counts, and the «[تحقّق]» figures.

**What was verified**
- the tests;
- the before/after hash comparison (N decks, 0 differ);
- the second-pass flags, and how they were settled.

**What was not verified**
- no teacher has read a draft;
- no note has been seen on a slide in the presenter, PDF or PowerPoint, which waits for PR 2;
- the review page does not exist yet.

**Limits**
- the drafts were written by a model looking at the images;
- physics only;
- re-crops lose their notes;
- slides only, not the worksheet and quiz figure appendix.

- [ ] **Step 2: The STATUS.md line**

Add one line in the open-work list, dated 2026-11-27, saying:
- Grade 10 physics book figures have drafted explanations that show on no slide until a
  teacher approves them;
- the next steps are the review page, the teacher's review, `applyFigureReviews.ts`, then PR 2
  with the approved notes and «ما الجديد»;
- the log entry is the one named in Step 1.

Keep it to one bullet, like its neighbours.

- [ ] **Step 3: Run what CI runs**

```bash
cd /home/user/wt-figure-notes && pnpm run typecheck
```
```bash
cd /home/user/wt-figure-notes/artifacts/mobile && pnpm test
```
```bash
cd /home/user/wt-figure-notes/lib/curriculum && pnpm test && pnpm run verify
```

Expected: all pass. The api-server and math-verifier are untouched; skip their suites and say
so in the PR body. If the mobile suite shows a failure outside the files this plan touched,
check it on `origin/main` before blaming this branch.

- [ ] **Step 4: Commit the docs, push, open a draft PR**

```bash
cd /home/user/wt-figure-notes
git add docs/status-log.md STATUS.md
git diff --cached --stat
git commit -m "Status: physics figure notes, PR 1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01VikuhbrMMx7Br4AiBViwWd"
git push -u origin claude/figure-notes-1
```

Open a **draft** PR to `main` titled "Physics book figures: teacher-approved explanations on
slides (PR 1: code and drafts)". Mirror `.github/pull_request_template.md` if it exists. The
body says:
- what changed;
- that no user-visible change ships, and so no «ما الجديد»: every note is a draft;
- the verification, with the hash comparison and the test counts;
- the limits;
- that PR 2 follows once a teacher has reviewed the drafts.

It ends with:

```
🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_01VikuhbrMMx7Br4AiBViwWd
```

Then subscribe to the PR's activity.

---

## After this plan (not part of it)

- **The review page.** An Artifact with a shared store: one card per figure, Approve / Needs a
  fix, editable text, a comment. Its records are exported as `{ "reviews": FigureReview[] }`.
- **The teacher's review.**
- **`applyFigureReviews.ts`.** It writes the verdicts back; then the "needs a fix" cards are
  redrafted and go round again.
- **PR 2.** The approved notes, the by-eye checks from spec §4, and the «ما الجديد» entry.
