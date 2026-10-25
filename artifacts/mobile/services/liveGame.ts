/**
 * Live game (Kahoot-style) — the pure half, shared by the teacher's host
 * screen and the student's player screen. No `react-native`, no `expo-*`:
 * `node --test` loads this file (services/__tests__/liveGame.test.ts).
 *
 * The teacher projects the host screen; students join from any browser
 * device with a 6-character code and a typed name — no account. Phones are
 * banned in Jordanian classrooms, so copy says «جهاز», never «هاتف».
 *
 * ── Clocks ──
 * The countdown is computed from the server's `questionStartedAt` and the
 * offset `serverNow − Date.now()` captured on each poll — never the device
 * clock alone. A tablet a minute fast would otherwise show «0» while the
 * server still accepts answers (and the reverse).
 */
import { PROD_ORIGIN } from './siteOrigin.ts';
import { stripOptionPrefix, optionLetter } from './optionLabels.ts';
import { scoreableSlides } from './classDeck.ts';
import { contrast, textOn } from './readableColor.ts';
import { toArabicDigits } from './labFormat.ts';
import type { ClassroomActivity } from './ai/AIService.ts';
import type { TranslationKey } from './i18n.ts';

export type LiveLang = 'ar' | 'en';
export type LiveState = 'lobby' | 'question' | 'reveal' | 'ended';
export type LiveAction = 'start' | 'reveal' | 'next' | 'end';

export const LIVE_MIN_QUESTIONS = 3;
export const LIVE_MAX_QUESTIONS = 30;
export const LIVE_MAX_OPTIONS = 6;
export const LIVE_DEFAULT_SECONDS = 20;
export const LIVE_POLL_MS = 1500;
export const LIVE_CODE_LENGTH = 6;
export const LIVE_NAME_MAX = 20;

// ─── Contract types ─────────────────────────────────────────────────────────

export interface LiveQuestion {
  content: string;
  options: string[];
  correctIndex: number;
}

export interface HostPlayer {
  id: string;
  name: string;
  score: number;
  answeredCurrent: boolean;
  signedIn: boolean;
}

/** A time the server sent: epoch ms, or an ISO string. Either is read. */
export type ServerTime = number | string | null | undefined;

export interface HostGame {
  id: string;
  code: string;
  title: string;
  lang: LiveLang;
  state: LiveState;
  currentIndex: number;
  questionCount: number;
  seconds: number;
  questionStartedAt: ServerTime;
  serverNow: ServerTime;
  current: LiveQuestion | null;
  answerCounts: number[];
  answeredCount: number;
  players: HostPlayer[];
}

export interface PlayerReveal {
  correctIndex: number;
  myChoice: number | null;
  myCorrect: boolean;
  myPoints: number;
}

export interface PlayerState {
  state: LiveState;
  title: string;
  lang: LiveLang;
  currentIndex: number;
  questionCount: number;
  seconds: number;
  questionStartedAt: ServerTime;
  serverNow: ServerTime;
  question: { content: string; options: string[] } | null;
  answered: boolean;
  reveal: PlayerReveal | null;
  me: { name: string; score: number; rank: number };
  top: Array<{ name: string; score: number }>;
  /** Not in the contract today; shown as «من N» when the server sends it. */
  playerCount?: number;
}

// ─── Deck → questions ───────────────────────────────────────────────────────

/**
 * The deck's own choice questions, in the shape the host endpoint takes.
 * One source with Class Challenge: `scoreableSlides` is the rule that decides
 * what a game may score. Options lose a baked-in «أ.» marker (the tile draws
 * its own letter); a question with more than six options, or a blank one,
 * cannot be sent and is left out.
 */
export function liveQuestionsFromDeck(deck: ClassroomActivity | null): LiveQuestion[] {
  if (!deck) return [];
  const out: LiveQuestion[] = [];
  for (const s of scoreableSlides(deck)) {
    const options = (s.options ?? []).map(o => stripOptionPrefix(String(o)));
    const content = (s.content ?? '').trim();
    if (!content || options.length > LIVE_MAX_OPTIONS || options.some(o => !o)) continue;
    out.push({ content, options, correctIndex: s.correctIndex! });
    if (out.length === LIVE_MAX_QUESTIONS) break;
  }
  return out;
}

export function canPlayLive(deck: ClassroomActivity | null): boolean {
  return liveQuestionsFromDeck(deck).length >= LIVE_MIN_QUESTIONS;
}

const ARABIC_LETTER = /[؀-ۿ]/g;
const LATIN_LETTER = /[A-Za-z]/g;

/** The deck's language, read off its questions (a deck carries no language field). */
export function deckLang(questions: LiveQuestion[]): LiveLang {
  const text = questions.map(q => q.content).join(' ');
  const ar = (text.match(ARABIC_LETTER) ?? []).length;
  const en = (text.match(LATIN_LETTER) ?? []).length;
  return ar >= en ? 'ar' : 'en';
}

// ─── Codes and names ────────────────────────────────────────────────────────

const AR_DIGIT_TO_LATIN: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
};

/**
 * What a student typed or pasted → the code. Upper-case, Arabic-Indic digits
 * made latin, anything else dropped, and a pasted join link (`…?code=ABC123`)
 * read for its code.
 */
export function normalizeCode(raw: string | null | undefined): string {
  const text = String(raw ?? '');
  const fromLink = /code=([^&#\s]+)/i.exec(text);
  return (fromLink ? fromLink[1]! : text)
    .replace(/[٠-٩]/g, d => AR_DIGIT_TO_LATIN[d] ?? d)
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, LIVE_CODE_LENGTH);
}

export const isCompleteCode = (code: string) => code.length === LIVE_CODE_LENGTH;

/** Trimmed, inner whitespace collapsed, capped. Empty means not joinable. */
export function normalizeName(raw: string | null | undefined): string {
  return String(raw ?? '').replace(/\s+/g, ' ').trim().slice(0, LIVE_NAME_MAX);
}

export const joinUrl = (code: string) => `${PROD_ORIGIN}/live?code=${code}`;

/** «app.iqrra.com/live» — what the projector prints above the code. */
export const joinPageLabel = () => `${PROD_ORIGIN.replace(/^https?:\/\//, '')}/live`;

export const liveTokenKey = (code: string) => `live.token.${normalizeCode(code)}`;

// ─── Time ───────────────────────────────────────────────────────────────────

/** Epoch ms from a server time, or null when it is absent or unreadable. */
export function toMs(v: ServerTime): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const ms = Date.parse(v);
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

/** `serverNow − deviceNow`, to add to the device clock. 0 when the server sent no time. */
export function clockOffsetMs(serverNow: ServerTime, deviceNow: number = Date.now()): number {
  const s = toMs(serverNow);
  return s === null ? 0 : s - deviceNow;
}

/** Milliseconds left on the current question, clamped to `[0, seconds × 1000]`. */
export function remainingMs(
  t: { seconds: number; questionStartedAt: ServerTime },
  offsetMs: number,
  deviceNow: number = Date.now(),
): number {
  const total = Math.max(0, t.seconds) * 1000;
  const start = toMs(t.questionStartedAt);
  if (start === null) return total;
  return Math.min(total, Math.max(0, total - (deviceNow + offsetMs - start)));
}

/** Whole seconds left, rounded up so «٠» only shows when time is truly out. */
export const remainingSeconds = (
  t: { seconds: number; questionStartedAt: ServerTime },
  offsetMs: number,
  deviceNow: number = Date.now(),
): number => Math.ceil(remainingMs(t, offsetMs, deviceNow) / 1000);

/**
 * The host closes a question when its timer runs out or every joined player
 * has answered — never with nobody joined (an empty room would "all answer").
 */
export function shouldAutoReveal(
  game: Pick<HostGame, 'state' | 'answeredCount' | 'players'>,
  secondsLeft: number,
): boolean {
  if (game.state !== 'question') return false;
  if (secondsLeft <= 0) return true;
  return game.players.length > 0 && game.answeredCount >= game.players.length;
}

// ─── Options: colour is never the only cue ──────────────────────────────────

/**
 * Six fills drawn from the Okabe–Ito colour-blind-safe set (darkened where a
 * white label needed it), each paired with its own shape and letter, so the
 * tile reads by shape and letter alone. The label colour per fill is chosen
 * by `textOn`; `liveGame.test.ts` pins every pair at AA.
 */
const FILLS = ['#0062A3', '#B84A00', '#00775A', '#E69F00', '#A8457F', '#56B4E9'] as const;
const SHAPES = ['▲', '◆', '●', '■', '★', '✚'] as const;

export interface LiveOptionLook {
  letter: string;
  shape: string;
  fill: string;
  fg: string;
}

export function liveOptionLook(index: number, lang: LiveLang): LiveOptionLook {
  const i = ((index % FILLS.length) + FILLS.length) % FILLS.length;
  const fill = FILLS[i]!;
  return { letter: optionLetter(i, lang === 'ar'), shape: SHAPES[i]!, fill, fg: textOn(fill) };
}

/** Lowest label contrast over all option fills — a test hook, not a runtime one. */
export const liveOptionMinContrast = () =>
  Math.min(...FILLS.map(f => contrast(textOn(f), f)));

export const LIVE_OPTION_FILLS: readonly string[] = FILLS;
export const LIVE_OPTION_SHAPES: readonly string[] = SHAPES;

// ─── Display ────────────────────────────────────────────────────────────────

/** Latin inside, Arabic-Indic at the edge of the screen. */
export const liveNum = (n: number, lang: LiveLang): string =>
  lang === 'ar' ? toArabicDigits(String(Math.round(n))) : String(Math.round(n));

/** The bar for an option's count: 0..1 of the busiest option, so a lone answer still shows. */
export function barFractions(counts: number[]): number[] {
  const max = Math.max(1, ...counts);
  return counts.map(c => c / max);
}

/** Top `n` by score, best first; stable for ties (join order). */
export function leaderboard<T extends { score: number }>(players: T[], n: number = players.length): T[] {
  return players
    .map((p, i) => ({ p, i }))
    .sort((a, b) => b.p.score - a.p.score || a.i - b.i)
    .slice(0, n)
    .map(x => x.p);
}

/** 1-based competition ranks: tied scores share a rank, the next one skips. */
export function ranksFor(sortedScores: number[]): number[] {
  const out: number[] = [];
  sortedScores.forEach((sc, i) => out.push(i > 0 && sc === sortedScores[i - 1] ? out[i - 1]! : i + 1));
  return out;
}

// ─── Errors ─────────────────────────────────────────────────────────────────

export type JoinErrorKey = Extract<
  TranslationKey,
  'liveErrNameTaken' | 'liveErrNotFound' | 'liveErrRate' | 'liveErrNetwork' | 'liveErrFull' | 'liveErrGeneric'
>;

/** `status` 0 means the request never got an answer. */
export function joinErrorKey(status: number, code?: string): JoinErrorKey {
  if (code === 'name_taken') return 'liveErrNameTaken';
  if (code === 'game_full') return 'liveErrFull';
  if (code === 'game_not_found') return 'liveErrNotFound';
  if (code === 'rate_limited') return 'liveErrRate';
  if (status === 0) return 'liveErrNetwork';
  if (status === 409) return 'liveErrNameTaken';
  if (status === 404) return 'liveErrNotFound';
  if (status === 429) return 'liveErrRate';
  return 'liveErrGeneric';
}

/** Longest a rate-limited poll waits before trying again. */
export const LIVE_BACKOFF_CAP_MS = 30_000;
const LIVE_BACKOFF_BASE_MS = 5_000;

/**
 * How long to wait after a failed poll, or null to keep the normal interval.
 * Only a 429 backs off: the server's `Retry-After` (seconds) if it sent one,
 * otherwise 5 s doubling with each further 429 in a row — always capped, so a
 * class of tablets neither hammers a limiter nor goes quiet for minutes.
 */
export function rateLimitDelayMs(e: unknown, consecutiveFailures: number): number | null {
  const err = e as { status?: number; retryAfterSec?: number } | null;
  if (err?.status !== 429) return null;
  const hinted = err.retryAfterSec;
  const ms = typeof hinted === 'number' && Number.isFinite(hinted) && hinted > 0
    ? hinted * 1000
    : LIVE_BACKOFF_BASE_MS * 2 ** Math.max(0, consecutiveFailures - 1);
  return Math.min(LIVE_BACKOFF_CAP_MS, ms);
}

/** A poll that can never succeed by waiting: the game is gone, or the token is. */
export function isFatalPollError(e: unknown): boolean {
  const s = (e as { status?: number } | null)?.status;
  return s === 401 || s === 403 || s === 404;
}
