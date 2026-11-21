/**
 * When one AI provider refuses the ACCOUNT, answer with the other.
 *
 * Production writes lesson plans, worksheets, quizzes, slide decks and lesson
 * explanations with Claude (`AI_MODEL_DOCUMENTS`) and every other generator with
 * OpenAI (`AI_MODEL_GENERATE`). `usableModel` in `aiBudget.ts` skips Claude only
 * when `ANTHROPIC_API_KEY` is UNSET; a key that has expired, been revoked, or
 * sits on an empty balance was used anyway, and every request failed until the
 * secret was rotated by hand. The same was true the other way round for OpenAI.
 *
 * Deliberately narrow. Only an account problem switches provider — a bad or
 * unpermitted key, an empty balance, a model the account cannot use. A busy
 * server, a rate limit, a refusal or a malformed reply does not: the other
 * provider would not fix those, and switching on every 429 doubles the bill on
 * exactly the days traffic is high. And it switches once, never back.
 *
 * The backup writes the same prompt in another model's voice, and the pool is
 * keyed by model, so a fallback artifact is stored and served under the backup's
 * own key — it never poses as Claude's work, or Claude's as OpenAI's.
 */
import { getGenerationModel, isClaudeModel } from "./aiBudget.ts";
import { logger } from "./logger.ts";

function fieldOf(value: unknown, key: string): unknown {
  return value !== null && typeof value === "object" ? (value as Record<string, unknown>)[key] : undefined;
}

/**
 * True for an error that says the ACCOUNT cannot be served, as either SDK reports it.
 *
 * Read off the shape both SDKs share (`status`, sometimes `code`) rather than by
 * `instanceof`, so it neither imports both SDKs' error classes nor misses one
 * when an SDK upgrade moves them.
 */
export function isProviderAccountError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  // Thrown by lib/claude.ts before any request is made.
  if (err.name === "ClaudeNotConfiguredError") return true;
  const status = fieldOf(err, "status");
  if (typeof status !== "number") return false;
  // 401 bad or expired key · 402 billing (Anthropic) · 403 key not permitted ·
  // 404 model the account cannot use (a retired id, a model not enabled).
  if (status === 401 || status === 402 || status === 403 || status === 404) return true;
  // OpenAI reports an empty balance as a 429 with this code — not a rate limit.
  if (status === 429) {
    const code = fieldOf(err, "code") ?? fieldOf(fieldOf(err, "error"), "code");
    return code === "insufficient_quota";
  }
  // Anthropic has also reported an empty balance as a 400 with this message.
  if (status === 400) return /credit balance/i.test(err.message);
  return false;
}

/**
 * The other provider's configured model, or null when there is none.
 *
 * Claude is backed by the OpenAI generation model, which is always configured.
 * OpenAI is backed by the Claude documents model, only when that is a Claude id
 * and a key is set — the same switch that already decides whether Claude runs at
 * all, so no second variable has to be kept in step with it.
 */
export function fallbackModelFor(model: string): string | null {
  if (isClaudeModel(model)) {
    const openai = getGenerationModel();
    return isClaudeModel(openai) ? null : openai;
  }
  const claude = process.env.AI_MODEL_DOCUMENTS;
  if (!claude || !isClaudeModel(claude) || !process.env.ANTHROPIC_API_KEY) return null;
  return claude;
}

/**
 * Run `attempt` with `model`; if the provider refuses the account and the other
 * provider is configured, run it once more with the other provider's model.
 *
 * Anything else — including the backup's own failure — is thrown as it came, so
 * the caller's existing error handling (the 502 a teacher sees) is unchanged.
 */
export async function withProviderFallback<T>(
  model: string,
  attempt: (model: string) => Promise<T>,
  context: Record<string, unknown> = {},
): Promise<T> {
  try {
    return await attempt(model);
  } catch (err) {
    const backup = isProviderAccountError(err) ? fallbackModelFor(model) : null;
    if (!backup) throw err;
    // An error, not a warning: every request is now paying the slower or the
    // dearer provider until someone fixes the key or the balance, and nothing
    // else would say so.
    logger.error(
      { ...context, err, from: model, to: backup, status: fieldOf(err, "status") },
      "AI provider refused the account — answering with the other provider",
    );
    return attempt(backup);
  }
}
