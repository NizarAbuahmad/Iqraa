/**
 * Class Challenge — a Kahoot-style quiz game for a room with no student phones.
 *
 * Jordanian schools ban student phones, so the usual model (every student on a
 * device, server tallying) is unavailable. Here the projector is the game board
 * and the *class is divided into teams*: a question appears with a timer, every
 * student answers from their seat on the printed أ ب ج د card (the routine
 * `classDeck.ts` already establishes), and on reveal the teacher taps which
 * teams got it right. One device, no accounts, no network.
 *
 * ── Why scores are derived, never mutated ──
 * State is only the award ledger: which responders were credited on which
 * question. Scores, streaks and standings are folded out of it on demand. A
 * teacher running a game mis-taps constantly — awarding the wrong team, then
 * un-awarding it — and an incrementally-mutated score drifts the moment a
 * streak bonus is involved (you cannot subtract a bonus you no longer know the
 * basis for). Re-folding makes every correction exact and makes `toggleAward`
 * trivially reversible.
 *
 * ── Why the ledger is keyed by responder id, not team index ──
 * Per-student capture (printed cards read by camera, Plickers-style) is the
 * intended upgrade path. When responders become roster student ids instead of
 * team ids, this whole module is unchanged — only who is in `responders`
 * differs. That is the reason for the indirection.
 */

/** Base award for a correct answer, before bonuses. */
export const BASE_POINTS = 100;

/**
 * Streak bonus by run length. A second consecutive correct answer is worth
 * +50, a third or longer +100. Capped deliberately: an uncapped streak makes
 * the leader unreachable by question five and the rest of the class checks out.
 */
export function streakBonus(runLength: number): number {
  if (runLength >= 3) return 100;
  if (runLength === 2) return 50;
  return 0;
}

export interface GameTeam {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

export interface GameState {
  teams: GameTeam[];
  /** questionIndex → responder ids credited on that question. */
  awards: Record<number, string[]>;
  /** Number of scoreable questions, so standings can report "answered n of m". */
  questionCount: number;
}

export interface TeamStanding extends GameTeam {
  score: number;
  correctCount: number;
  /** Length of the team's current consecutive-correct run. */
  streak: number;
  /** 1-based rank; tied teams share a rank. */
  rank: number;
}

/**
 * Default team identities. Colours are the ones the presentation screen already
 * uses for slide accents, so a team chip never introduces a colour the deck's
 * palette does not contain.
 */
const TEAM_PRESETS: Array<{ emoji: string; color: string; ar: string; en: string }> = [
  { emoji: '🦅', color: '#3B82F6', ar: 'النسور', en: 'Eagles' },
  { emoji: '🦁', color: '#F59E0B', ar: 'الأسود', en: 'Lions' },
  { emoji: '🐬', color: '#0EA5E9', ar: 'الدلافين', en: 'Dolphins' },
  { emoji: '🐆', color: '#A855F7', ar: 'الفهود', en: 'Cheetahs' },
  { emoji: '🦊', color: '#F43F5E', ar: 'الثعالب', en: 'Foxes' },
  { emoji: '🐝', color: '#22C55E', ar: 'النحل', en: 'Bees' },
];

export const MIN_TEAMS = 2;
export const MAX_TEAMS = TEAM_PRESETS.length;

/** Build the starting state for a game of `teamCount` teams. */
export function createGame(teamCount: number, questionCount: number, isAr: boolean): GameState {
  const n = Math.max(MIN_TEAMS, Math.min(MAX_TEAMS, Math.floor(teamCount) || MIN_TEAMS));
  return {
    teams: TEAM_PRESETS.slice(0, n).map((preset, i) => ({
      id: `team-${i + 1}`,
      name: isAr ? preset.ar : preset.en,
      emoji: preset.emoji,
      color: preset.color,
    })),
    awards: {},
    questionCount: Math.max(0, Math.floor(questionCount) || 0),
  };
}

/** Credit (or un-credit) one responder on one question. Reversible by design. */
export function toggleAward(state: GameState, questionIndex: number, responderId: string): GameState {
  const current = state.awards[questionIndex] ?? [];
  const next = current.includes(responderId)
    ? current.filter(id => id !== responderId)
    : [...current, responderId];
  const awards = { ...state.awards };
  if (next.length === 0) delete awards[questionIndex];
  else awards[questionIndex] = next;
  return { ...state, awards };
}

/** Replace the whole credited set for a question (used by "everyone got it"). */
export function setAwards(state: GameState, questionIndex: number, responderIds: string[]): GameState {
  const awards = { ...state.awards };
  const unique = [...new Set(responderIds)];
  if (unique.length === 0) delete awards[questionIndex];
  else awards[questionIndex] = unique;
  return { ...state, awards };
}

/** Whether a responder is currently credited on a question. */
export function isAwarded(state: GameState, questionIndex: number, responderId: string): boolean {
  return (state.awards[questionIndex] ?? []).includes(responderId);
}

/** Clear the ledger, keeping the teams — "play again with the same teams". */
export function resetScores(state: GameState): GameState {
  return { ...state, awards: {} };
}

/**
 * Fold the ledger into standings.
 *
 * Questions are walked in index order because streaks are order-dependent: a
 * team that answers 1, 2 and 3 correctly earns a run of three, while the same
 * three correct answers spread across 1, 3 and 5 earn no bonus at all.
 */
export function standings(state: GameState): TeamStanding[] {
  const score = new Map<string, number>();
  const correct = new Map<string, number>();
  const run = new Map<string, number>();
  for (const team of state.teams) {
    score.set(team.id, 0);
    correct.set(team.id, 0);
    run.set(team.id, 0);
  }

  const answered = Object.keys(state.awards)
    .map(Number)
    .filter(n => Number.isFinite(n))
    .sort((a, b) => a - b);

  // Only questions that were actually adjudicated break a streak. A question
  // the teacher skipped without awarding anyone must not silently reset every
  // team's run — skipping is common (a slide gets discussed instead of scored).
  for (const qIndex of answered) {
    const credited = new Set(state.awards[qIndex] ?? []);
    for (const team of state.teams) {
      if (credited.has(team.id)) {
        const nextRun = (run.get(team.id) ?? 0) + 1;
        run.set(team.id, nextRun);
        score.set(team.id, (score.get(team.id) ?? 0) + BASE_POINTS + streakBonus(nextRun));
        correct.set(team.id, (correct.get(team.id) ?? 0) + 1);
      } else {
        run.set(team.id, 0);
      }
    }
  }

  const rows = state.teams.map(team => ({
    ...team,
    score: score.get(team.id) ?? 0,
    correctCount: correct.get(team.id) ?? 0,
    streak: run.get(team.id) ?? 0,
    rank: 0,
  }));

  // Score, then accuracy, then the original team order — never by name, which
  // would reorder the board when a teacher renames a team mid-game.
  const order = new Map(state.teams.map((t, i) => [t.id, i]));
  rows.sort((a, b) =>
    b.score - a.score
    || b.correctCount - a.correctCount
    || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

  // Tied teams share a rank, and the next rank skips accordingly (1,1,3) —
  // showing two teams as 1st and 2nd on equal points is the kind of unfairness
  // a class notices instantly.
  let lastScore: number | null = null;
  let lastRank = 0;
  rows.forEach((row, i) => {
    if (lastScore !== null && row.score === lastScore) {
      row.rank = lastRank;
    } else {
      row.rank = i + 1;
      lastRank = row.rank;
      lastScore = row.score;
    }
  });

  return rows;
}

/**
 * Podium for the final slide: every team on rank 1, 2 and 3, ties included.
 * Returns fewer than three groups when teams tie into the top places.
 */
export function podium(state: GameState): TeamStanding[][] {
  const rows = standings(state);
  // A game nobody scored in has no winner — returning the team list in setup
  // order would crown whoever happens to be first, which is worse than an
  // explicit empty podium the UI can render as "لم تُسجَّل نقاط".
  if (rows.every(r => r.score === 0)) return [];
  return [1, 2, 3]
    .map(rank => rows.filter(r => r.rank === rank))
    .filter(group => group.length > 0);
}
