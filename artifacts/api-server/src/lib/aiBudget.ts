/**
 * Test-mode safety net for the OpenAI-backed routes (chat, generate,
 * derivativeVerified). DEMO_MODE on the mobile client already keeps these
 * routes unreached in production; this is the server-side switch + spend cap
 * for testing against a real key without DEMO_MODE.
 *
 * Both AI_LIVE_MODE and the running spend total are process-memory only —
 * they reset on every server restart and are not shared across instances.
 * That's fine for local/single-instance testing; it is not a substitute for
 * the hard usage limit you should also set on the OpenAI account itself
 * (Settings → Billing → Usage limits), which is the only cap that survives a
 * restart or a bug in this file.
 */
import { logger } from "./logger.ts";

export class AiLiveModeOffError extends Error {
  constructor() {
    super("AI live mode is off. Set AI_LIVE_MODE=true to enable real OpenAI calls.");
    this.name = "AiLiveModeOffError";
  }
}

export class AiBudgetExceededError extends Error {
  constructor(spentUsd: number, limitUsd: number) {
    super(
      `AI test budget exceeded: $${spentUsd.toFixed(4)} spent of a $${limitUsd.toFixed(2)} limit. ` +
        `Raise AI_BUDGET_USD, or restart the server to reset the counter.`,
    );
    this.name = "AiBudgetExceededError";
  }
}

// Rough per-million-token pricing in USD, only used to estimate spend for the
// guard below — not billing-accurate. A model not in this table falls back to
// a deliberately conservative (expensive) estimate, so an unrecognized model
// stops the budget early rather than silently overspending.
const PRICING_PER_MILLION_USD: Record<string, { input: number; output: number }> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4o": { input: 2.5, output: 10 },
};
const FALLBACK_PRICING_PER_MILLION_USD = { input: 5, output: 15 };

function getPricing(model: string): { input: number; output: number } {
  return PRICING_PER_MILLION_USD[model] ?? FALLBACK_PRICING_PER_MILLION_USD;
}

let spentUsd = 0;

/** Cheap by default — this exists to make testing affordable, not to pick quality. */
export function getAiModel(): string {
  return process.env.AI_MODEL || "gpt-4o-mini";
}

export function isAiLiveModeOn(): boolean {
  return process.env.AI_LIVE_MODE === "true";
}

function getBudgetLimitUsd(): number {
  const raw = Number(process.env.AI_BUDGET_USD);
  return Number.isFinite(raw) && raw > 0 ? raw : 2;
}

/** Throws AiLiveModeOffError unless AI_LIVE_MODE=true. Call before every OpenAI request. */
export function assertLiveModeEnabled(): void {
  if (!isAiLiveModeOn()) throw new AiLiveModeOffError();
}

/** Throws AiBudgetExceededError once the running total meets the configured cap. */
export function assertBudgetAvailable(): void {
  const limit = getBudgetLimitUsd();
  if (spentUsd >= limit) throw new AiBudgetExceededError(spentUsd, limit);
}

/** Call once per completion, after a successful response, to add its cost to the running total. */
export function recordUsage(
  usage: { prompt_tokens?: number; completion_tokens?: number } | undefined | null,
): void {
  if (!usage) return;
  const { input, output } = getPricing(getAiModel());
  const cost =
    ((usage.prompt_tokens ?? 0) / 1_000_000) * input +
    ((usage.completion_tokens ?? 0) / 1_000_000) * output;
  spentUsd += cost;
  logger.info(
    { spentUsd: Number(spentUsd.toFixed(4)), limitUsd: getBudgetLimitUsd(), model: getAiModel() },
    "ai test budget updated",
  );
}

export function getBudgetStatus(): {
  liveMode: boolean;
  model: string;
  spentUsd: number;
  limitUsd: number;
  remainingUsd: number;
} {
  const limitUsd = getBudgetLimitUsd();
  return {
    liveMode: isAiLiveModeOn(),
    model: getAiModel(),
    spentUsd: Number(spentUsd.toFixed(4)),
    limitUsd,
    remainingUsd: Number(Math.max(0, limitUsd - spentUsd).toFixed(4)),
  };
}
