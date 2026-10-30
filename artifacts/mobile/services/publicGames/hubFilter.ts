/**
 * The /play hub's filter: by subject and by grade, both optional, both single
 * choice, combined with AND. Pure, so the matching and the URL parsing are tested
 * without a screen.
 *
 * A game's subject is typed next to its grades (`Record<PlayGameId, …>`), so a
 * new game without a subject fails typecheck, and a test pins that each subject
 * chip would show at least one game.
 */
import { PLAY_GAME_GRADES, type PlayGameId } from './gradeBands.ts';

export const PLAY_SUBJECTS = ['math', 'arabic', 'english', 'science', 'geography', 'skills'] as const;
export type PlaySubject = (typeof PLAY_SUBJECTS)[number];

/** Grades the hub offers a chip for: the Jordanian basic and secondary-stage-start years the games are written for. */
export const PLAY_FILTER_GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export const PLAY_GAME_SUBJECT: Record<PlayGameId, PlaySubject> = {
  english: 'english',
  elements: 'science',
  flags: 'geography',
  capitals: 'geography',
  memory: 'skills',
  colors: 'skills',
  multiply: 'math',
  divide: 'math',
  add: 'math',
  subtract: 'math',
  antonyms: 'arabic',
  plurals: 'arabic',
  numberType: 'math',
  fractions: 'math',
  matter: 'science',
  governorates: 'geography',
};

export interface HubFilter {
  subject: PlaySubject | null;
  grade: number | null;
}

export const NO_FILTER: HubFilter = { subject: null, grade: null };

export function gameSuitsGrade(id: PlayGameId, grade: number): boolean {
  return PLAY_GAME_GRADES[id].some(([from, to]) => grade >= from && grade <= to);
}

/** The ids that pass the filter, in the hub's own order. */
export function filterGames<T extends { id: PlayGameId }>(games: readonly T[], filter: HubFilter): T[] {
  return games.filter(g =>
    (filter.subject === null || PLAY_GAME_SUBJECT[g.id] === filter.subject) &&
    (filter.grade === null || gameSuitsGrade(g.id, filter.grade)),
  );
}

/**
 * Reads `?subject=math&grade=5`. Anything that is not a known subject or a
 * whole grade on the chip list is dropped rather than trusted: a stale or edited
 * link then shows the full hub, never an empty one for a filter nobody can see.
 */
export function parseHubFilter(params: { subject?: string | string[]; grade?: string | string[] }): HubFilter {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const s = first(params.subject);
  const g = first(params.grade);
  const subject = (PLAY_SUBJECTS as readonly string[]).includes(s ?? '') ? (s as PlaySubject) : null;
  const n = g !== undefined && /^\d{1,2}$/.test(g) ? Number(g) : null;
  const grade = n !== null && (PLAY_FILTER_GRADES as readonly number[]).includes(n) ? n : null;
  return { subject, grade };
}

/** The route params for a filter; a cleared field is undefined so `router.setParams` removes it. */
export function hubFilterParams(filter: HubFilter): { subject: string | undefined; grade: string | undefined } {
  return {
    subject: filter.subject ?? undefined,
    grade: filter.grade === null ? undefined : String(filter.grade),
  };
}
