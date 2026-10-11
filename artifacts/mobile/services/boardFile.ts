/**
 * The saved form of a whiteboard, and the checks that make it safe to use.
 *
 * A board is stored as the JSON string of a `BoardFile` in a `SavedMaterial`
 * of type `'board'`. That string comes back from the server or from device
 * storage, so it is **untrusted**: it is validated whole by `parseBoard`
 * before anything draws it or prints it, and a board that fails is refused,
 * never partly rendered.
 *
 * Ink is already stored as fractions of the page width (`services/penInk.ts`),
 * so a saved page looks the same on every screen. Undo history is not saved.
 *
 * Free of react-native so `node --test` can load it. The stored string counts
 * characters, not bytes: ink is ASCII, but a page's solution is Arabic prose
 * (at most ~3.2 KB of it per page), so the byte size can exceed the cap
 * slightly. The server accepts 12 MB.
 */
import { parseBoardSolution, type BoardSolution } from '@workspace/math-verify';
import {
  CANVAS_H,
  CANVAS_W,
  DEFAULT_STROKE_WIDTH,
  MAX_PAGES,
  docHasInk,
  docHasSolution,
  type BoardBackground,
  type BoardDoc,
} from './whiteboardModel.ts';

/**
 * The newest version this app understands. A board is WRITTEN as version 1
 * unless a page carries a solution, so an app that has not updated yet can
 * still open every board that has none.
 */
export const BOARD_FILE_VERSION = 2;
/**
 * Cap on the STORED STRING: enforced on save by `serializeBoard` and on open by
 * `parseBoard` for string input. For already-parsed object input only the
 * point characters are counted (`MAX_POINTS_CHARS` per stroke, summed).
 * (The server accepts 12 MB; browser storage ~5 MB shared.)
 */
export const MAX_BOARD_BYTES = 2_000_000;
export const MAX_STROKES_PER_PAGE = 5000;
export const MAX_POINTS_CHARS = 200_000;
export const MIN_STROKE_WIDTH = 0.5;
export const MAX_STROKE_WIDTH = 64;

export type BoardFileStroke = { color: string; width: number; points: string };
export type BoardFilePage = { background: BoardBackground; strokes: BoardFileStroke[]; solution?: BoardSolution };
export type BoardFile = { version: 1 | 2; canvas: { w: number; h: number }; pages: BoardFilePage[] };

const BACKGROUNDS: readonly string[] = ['blank', 'grid', 'axes'];
/** #rgb, #rgba, #rrggbb or #rrggbbaa — nothing else gets into an attribute. */
const COLOR_RE = /^#(?:[0-9A-Fa-f]{3,4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/;
/** One `x,y` token of plain decimals: no exponent, no `+`, no stray punctuation. */
const PAIR_RE = /^-?\d{1,6}(?:\.\d{1,6})?,-?\d{1,6}(?:\.\d{1,6})?$/;

function validPoints(points: unknown): points is string {
  if (typeof points !== 'string' || points.length === 0 || points.length > MAX_POINTS_CHARS) return false;
  return points.split(' ').every(token => PAIR_RE.test(token));
}

/** Rebuilt in a fixed key order so two equal boards serialise to equal strings. */
const solutionOut = (s: BoardSolution): BoardSolution => ({
  problem: s.problem,
  steps: [...s.steps],
  answer: s.answer,
  verified: s.verified,
  source: s.source,
  ...(s.understoodAs !== undefined ? { understoodAs: s.understoodAs } : {}),
});

/** The board as a plain, fixed-shape object. Never includes undo history. */
export function boardFileOf(doc: BoardDoc): BoardFile {
  return {
    version: docHasSolution(doc) ? BOARD_FILE_VERSION : 1,
    canvas: { w: CANVAS_W, h: CANVAS_H },
    pages: doc.pages.map(p => ({
      background: p.background,
      strokes: p.board.strokes.map(s => ({
        color: s.color,
        width: s.width ?? DEFAULT_STROKE_WIDTH,
        points: s.points,
      })),
      ...(p.solution ? { solution: solutionOut(p.solution) } : {}),
    })),
  };
}

export type SerializeResult =
  | { ok: true; json: string }
  | { ok: false; reason: 'too-many-pages' | 'too-big' };

/**
 * The string to store, or why it cannot be stored. Key order is fixed, so two
 * equal boards give the same string — `isBoardDirty` relies on that.
 */
export function serializeBoard(doc: BoardDoc): SerializeResult {
  if (doc.pages.length > MAX_PAGES) return { ok: false, reason: 'too-many-pages' };
  const json = JSON.stringify(boardFileOf(doc));
  if (json.length > MAX_BOARD_BYTES) return { ok: false, reason: 'too-big' };
  return { ok: true, json };
}

export type ParseResult = { ok: true; file: BoardFile } | { ok: false; reason: string };
const bad = (reason: string): ParseResult => ({ ok: false, reason });

/**
 * Validate stored content (the JSON string, or the already-parsed object).
 * Accepts only the shape `boardFileOf` writes; unknown keys are dropped.
 * Everything is checked before anything is returned, and the result is rebuilt
 * field by field so no unvalidated property can ride along.
 */
export function parseBoard(content: unknown): ParseResult {
  let value: unknown = content;
  if (typeof content === 'string') {
    if (content.length > MAX_BOARD_BYTES) return bad('too-big');
    try {
      value = JSON.parse(content);
    } catch {
      return bad('not-json');
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return bad('not-an-object');
  const v = value as Record<string, unknown>;
  if (v.version !== 1 && v.version !== 2) return bad('version');
  const version: 1 | 2 = v.version;
  const canvas = v.canvas as Record<string, unknown> | null | undefined;
  if (!canvas || typeof canvas !== 'object' || canvas.w !== CANVAS_W || canvas.h !== CANVAS_H) return bad('canvas');
  if (!Array.isArray(v.pages) || v.pages.length < 1 || v.pages.length > MAX_PAGES) return bad('pages');

  const pages: BoardFilePage[] = [];
  let totalChars = 0;
  for (const rawPage of v.pages) {
    if (!rawPage || typeof rawPage !== 'object') return bad('page');
    const p = rawPage as Record<string, unknown>;
    if (typeof p.background !== 'string' || !BACKGROUNDS.includes(p.background)) return bad('background');
    if (!Array.isArray(p.strokes) || p.strokes.length > MAX_STROKES_PER_PAGE) return bad('strokes');
    const strokes: BoardFileStroke[] = [];
    for (const rawStroke of p.strokes) {
      if (!rawStroke || typeof rawStroke !== 'object') return bad('stroke');
      const s = rawStroke as Record<string, unknown>;
      if (typeof s.color !== 'string' || !COLOR_RE.test(s.color)) return bad('color');
      if (typeof s.width !== 'number' || !Number.isFinite(s.width) || s.width < MIN_STROKE_WIDTH || s.width > MAX_STROKE_WIDTH) {
        return bad('width');
      }
      if (!validPoints(s.points)) return bad('points');
      totalChars += s.points.length;
      if (totalChars > MAX_BOARD_BYTES) return bad('too-big');
      strokes.push({ color: s.color, width: s.width, points: s.points });
    }
    let solution: BoardSolution | undefined;
    if ('solution' in p) {
      // A solution is a version-2 field; a version-1 file never has one.
      const read = version === 2 ? parseBoardSolution(p.solution) : null;
      if (!read) return bad('solution');
      solution = read;
    }
    pages.push({ background: p.background as BoardBackground, strokes, ...(solution ? { solution } : {}) });
  }
  return { ok: true, file: { version, canvas: { w: CANVAS_W, h: CANVAS_H }, pages } };
}

/** A validated file as an editable document: first page current, no undo history. */
export function docOfFile(file: BoardFile): BoardDoc {
  return {
    current: 0,
    pages: file.pages.map(p => ({
      background: p.background,
      board: {
        strokes: p.strokes.map(s => ({ color: s.color, width: s.width, points: s.points })),
        past: [],
      },
      ...(p.solution ? { solution: solutionOut(p.solution) } : {}),
    })),
  };
}

/**
 * Whether leaving now would lose something. A board that was never saved is
 * dirty when it has ink or a solution; a saved one when it no longer serialises to what was
 * saved (a board too big to serialise can never match, so it counts as dirty).
 * Undo history and the current page are not part of what is saved.
 */
export function isBoardDirty(doc: BoardDoc, savedJson: string | null): boolean {
  if (savedJson === null) return docHasInk(doc) || docHasSolution(doc);
  const r = serializeBoard(doc);
  return !r.ok || r.json !== savedJson;
}
