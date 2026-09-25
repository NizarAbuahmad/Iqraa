/**
 * Where the last piece of generated content actually came from.
 *
 * `RemoteAIService` falls back to `MockAIService` whenever a live call fails.
 * That fallback used to be a `console.warn` and nothing else, so with
 * `DEMO_MODE=false` the app looked identical whether the model answered or
 * the request never left the device — a broken API key, an expired token, a
 * cold API server all rendered as a perfectly plausible lesson plan.
 *
 * This module is the record of what happened, so the UI can say so. It is
 * deliberately dependency-free (no react-native, no fetch) — it is imported
 * by the service layer, by components, and by `node:test`.
 */

import { DEMO_MODE, STRICT_LIVE_AI } from './demoMode.ts';

/**
 * What produced the content the teacher is looking at — or 'none' when the
 * call failed and nothing was produced at all.
 */
export type AiSource = 'live' | 'mock' | 'none';

/**
 * Why it came from there.
 *  'demo-mode' — DEMO_MODE is on; no request was attempted. Expected.
 *  'live'      — the API answered. The only reason that means a real model ran.
 *  'fallback'  — a live call was attempted and failed; mock content stood in.
 *  'failed'    — a live call failed and strict mode refused to substitute.
 *  'cancelled' — the teacher stopped it. Nothing was produced, and nothing
 *                should be: an abort is the one failure that must never reach
 *                the mock fallback, or pressing Cancel would hand back a
 *                fabricated lesson plan indistinguishable from a real one.
 *  'saved-copy' — the API answered, but with an artifact from the shared pool
 *                because a spending cap refused a fresh generation. Real
 *                content, really generated, just not now and not for this
 *                request — which is exactly the distinction a teacher who
 *                pressed "regenerate" needs, and the one nothing on screen
 *                would otherwise make.
 */
export type AiSourceReason =
  | 'demo-mode' | 'live' | 'fallback' | 'failed' | 'cancelled' | 'saved-copy';

/** Which generator ran — matches the API path segment, e.g. 'lesson-plan'. */
export type AiGenerationKind =
  | 'lesson-plan' | 'worksheet' | 'quiz' | 'activity' | 'homework'
  | 'classroom-activity' | 'prompt-slides' | 'infographic' | 'chat';

export interface AiGenerationRecord {
  kind: AiGenerationKind;
  source: AiSource;
  reason: AiSourceReason;
  /** Set only when the live call failed — the reason it did. */
  error?: string;
  /** Epoch ms. Injected rather than read, so tests are deterministic. */
  at: number;
}

/** Keep enough to debug a session without growing without bound. */
const MAX_HISTORY = 25;

let history: AiGenerationRecord[] = [];
const listeners = new Set<(record: AiGenerationRecord) => void>();

/**
 * Trim an arbitrary thrown value down to one short line.
 *
 * Errors here carry API failure text, so they are shown to a teacher and
 * kept in memory: take the message only (never the stack, never the thrown
 * object's other fields) and cap it, so a large HTML error page from a proxy
 * can't end up rendered as a badge.
 */
export function describeAiError(e: unknown, maxLength = 120): string {
  const raw =
    e instanceof Error ? e.message
    : typeof e === 'string' ? e
    : '';
  const line = raw.replace(/\s+/g, ' ').trim();
  if (!line) return 'unknown error';
  return line.length > maxLength ? `${line.slice(0, maxLength - 1)}…` : line;
}

export function recordGeneration(record: AiGenerationRecord): AiGenerationRecord {
  history = [...history, record].slice(-MAX_HISTORY);
  for (const listener of listeners) listener(record);
  return record;
}

/** The most recent generation, or null if nothing has been generated yet. */
export function getLastGeneration(): AiGenerationRecord | null {
  return history.length > 0 ? history[history.length - 1]! : null;
}

/** Oldest first. A copy — callers must not mutate the log. */
export function getGenerationHistory(): AiGenerationRecord[] {
  return [...history];
}

/** Subscribe to every recorded generation. Returns the unsubscribe. */
export function subscribeToGenerations(
  listener: (record: AiGenerationRecord) => void,
): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Test-only: drop the log and every listener. */
export function resetGenerationLog(): void {
  history = [];
  listeners.clear();
}

/**
 * Did this rejection come from an `AbortController`, i.e. did someone cancel?
 *
 * Checked by name rather than `instanceof DOMException`: the abort travels
 * through `fetch` in the app and through plain `Error` in tests, and the
 * class is not the same object in both. The name is.
 */
export function isAbortError(e: unknown): boolean {
  return !!e && typeof e === 'object' && (e as { name?: unknown }).name === 'AbortError';
}

/**
 * The server refused because a spending cap is reached, not because anything
 * broke.
 *
 * Read off `code` rather than `instanceof ApiError`, for the same reason
 * `isAbortError` reads a name: `apiClient` reaches react-native, and this module
 * is deliberately loadable by bare `node --test` so the fallback policy can be
 * tested. Duck-typing the field keeps that true.
 *
 * `live_mode_off` belongs here too. It is the switch that says this API makes no
 * claim about AI content at all, so answering it with mock content is the one
 * substitution that most directly contradicts the switch.
 */
const CAP_CODES = new Set(['user_quota_exceeded', 'budget_exceeded', 'live_mode_off']);

export function isCapError(e: unknown): boolean {
  if (!e || typeof e !== 'object') return false;
  const code = (e as { code?: unknown }).code;
  return typeof code === 'string' && CAP_CODES.has(code);
}

/**
 * Which message a failed generation should show the teacher.
 *
 * One mapping, shared by the eight generator screens, rather than the same
 * four-branch ternary copied into each — the reason `scanBudgetSpent` reached
 * only the mark-scanning screen is that the mapping lived inside it. A screen
 * added later gets the quota wording by default instead of having to remember.
 *
 * Returns an i18n key rather than a string: this module is deliberately free of
 * react-native imports so it stays testable, and `t()` is not.
 */
/**
 * Did the API serve this from the pool because a cap said no?
 *
 * Duck-typed for the same reason as the rest of this module: the generator
 * output types live in AIService, which reaches react-native.
 */
export function servedReasonOf(out: unknown): 'quota' | 'budget' | null {
  if (!out || typeof out !== 'object') return null;
  const reason = (out as { servedReason?: unknown }).servedReason;
  return reason === 'quota' || reason === 'budget' ? reason : null;
}

export function aiErrorMessageKey(
  e: unknown,
): 'aiQuotaSpent' | 'aiUnavailable' | 'generationFailed' {
  if (!e || typeof e !== 'object') return 'generationFailed';
  const code = (e as { code?: unknown }).code;
  if (code === 'user_quota_exceeded' || code === 'budget_exceeded') return 'aiQuotaSpent';
  if (code === 'live_mode_off') return 'aiUnavailable';
  return 'generationFailed';
}

/**
 * Run a generator and record which of the two paths produced the answer.
 *
 * Lives here rather than in `RemoteAIService` so the fallback policy can be
 * tested directly: that module reaches react-native through `apiClient`, and
 * `node --test` cannot load it.
 */
export async function generateWithProvenance<T>(
  kind: AiGenerationKind,
  live: () => Promise<T>,
  mock: () => Promise<T>,
  opts: { demoMode?: boolean; strict?: boolean; now?: () => number } = {},
): Promise<T> {
  const demoMode = opts.demoMode ?? DEMO_MODE;
  const strict = opts.strict ?? STRICT_LIVE_AI;
  const now = opts.now ?? Date.now;

  if (demoMode) {
    recordGeneration({ kind, source: 'mock', reason: 'demo-mode', at: now() });
    return mock();
  }

  try {
    const out = await live();
    // The API says when a cap turned a fresh generation into a pooled repeat.
    // Recorded here rather than handled per screen: the badge that reads this
    // log already renders on every generator screen, for the neighbouring
    // problem of mock content being indistinguishable from real content. A
    // month-old variant presented as newly generated is the same problem.
    recordGeneration({
      kind,
      source: 'live',
      reason: servedReasonOf(out) ? 'saved-copy' : 'live',
      at: now(),
    });
    return out;
  } catch (e) {
    const error = describeAiError(e);
    // A cancel is not a failure to paper over. Falling back here would answer
    // "stop" with a full, plausible, entirely fabricated lesson plan — the
    // exact substitution this module exists to make visible.
    if (isAbortError(e)) {
      recordGeneration({ kind, source: 'none', reason: 'cancelled', at: now() });
      throw e;
    }
    // A cap is not a failure to paper over either, and the argument is the one
    // directly above: answering "you have used this month's allowance" with a
    // full, plausible, entirely fabricated worksheet is the exact substitution
    // this module exists to make visible. It is worse than the cancel case,
    // because the teacher did not ask for it to stop and has no reason to
    // suspect the content in front of them was never generated.
    //
    // Note the server already tries the shared pool before refusing, so getting
    // here means there was no real artifact to serve either — falling back
    // would be inventing one where none exists.
    if (isCapError(e)) {
      recordGeneration({ kind, source: 'none', reason: 'failed', error, at: now() });
      throw e;
    }
    if (strict) {
      // Refusing to substitute is the loudest possible disclosure: the screen
      // shows its error state rather than content nothing generated.
      recordGeneration({ kind, source: 'none', reason: 'failed', error, at: now() });
      throw e;
    }
    console.warn(`[RemoteAIService] ${kind} fallback:`, e);
    recordGeneration({ kind, source: 'mock', reason: 'fallback', error, at: now() });
    return mock();
  }
}

/** What the badge should say — the i18n key, and how loud to be about it. */
export interface AiSourceBadgeState {
  labelKey: 'demoModeBadge' | 'aiLiveBadge' | 'aiFallbackBadge' | 'aiSavedCopyBadge';
  icon: 'flask-outline' | 'sparkles-outline' | 'warning-outline' | 'bookmark-outline';
  /** 'warn' is the only state that breaks out of the quiet header styling. */
  tone: 'quiet' | 'warn';
  /** The failure text, for the accessibility label. Never in the visible label. */
  detail?: string;
}

/**
 * Decide what the badge shows. Pure, so the rule is tested rather than eyeballed.
 *
 * Returns null when there is nothing truthful to say: live mode, nothing
 * generated yet. A badge reading "Live AI" before any call has been made would
 * be asserting something nobody has checked — the same mistake as a `verified`
 * flag set from a code-computed fallback.
 */
export function aiSourceBadgeState(
  demoMode: boolean,
  last: AiGenerationRecord | null,
): AiSourceBadgeState | null {
  if (demoMode) return { labelKey: 'demoModeBadge', icon: 'flask-outline', tone: 'quiet' };
  if (!last) return null;
  // A cancelled run produced nothing, so there is nothing to label — same
  // reasoning as `!last`. Without this it falls through to "Live AI", which
  // would assert a model answered when the teacher stopped it before it did.
  if (last.reason === 'cancelled') return null;
  if (last.reason === 'fallback' || last.reason === 'failed') {
    return {
      labelKey: 'aiFallbackBadge', icon: 'warning-outline', tone: 'warn',
      detail: last.error,
    };
  }
  // Real content, but not generated for this request. Quiet rather than warn:
  // nothing has gone wrong and the artifact is genuine — it is the claim of
  // freshness that would be false, and this is what withdraws it.
  if (last.reason === 'saved-copy') {
    return { labelKey: 'aiSavedCopyBadge', icon: 'bookmark-outline', tone: 'quiet' };
  }
  return { labelKey: 'aiLiveBadge', icon: 'sparkles-outline', tone: 'quiet' };
}
