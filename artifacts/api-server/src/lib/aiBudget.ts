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
//
// The fallback only works if it is genuinely the ceiling. It was $5/$15 —
// under Claude Opus 5's real $5/$25 — so pointing AI_MODEL at a Claude model
// without touching this table would have made the guard undercount output by
// 40% and let a run sail past its cap. A "conservative" default that is
// cheaper than a model you might actually use is not conservative.
const PRICING_PER_MILLION_USD: Record<string, { input: number; output: number }> = {
  // OpenAI
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4o": { input: 2.5, output: 10 },
  // Anthropic. Claude Sonnet 5 is listed at its standard rate, not the
  // $2/$10 introductory rate that ends 2026-08-31 — a budget guard that
  // assumes a promotional price stops guarding when the promotion does.
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-fable-5": { input: 10, output: 50 },
};
// The most expensive model above, so an unrecognised id can only ever
// over-estimate spend and trip the cap early.
const FALLBACK_PRICING_PER_MILLION_USD = { input: 10, output: 50 };

/** Warn once per unpriced model, not once per request. */
const warnedUnpriced = new Set<string>();

/** Exported so the "fallback is the ceiling" invariant can be tested. */
export function getPricing(model: string): { input: number; output: number } {
  const known = PRICING_PER_MILLION_USD[model];
  if (known) return known;
  // Say so. The fallback is the most expensive model there is, which is the
  // right default for safety and a terrible one for accuracy: point AI_MODEL
  // at a cheap model this table has never heard of and the guard can bill it
  // at many times its real rate, tripping AI_BUDGET_USD long before the money
  // is spent. That reads as a broken budget unless something says why.
  if (!warnedUnpriced.has(model)) {
    warnedUnpriced.add(model);
    logger.warn(
      { model, assumed: FALLBACK_PRICING_PER_MILLION_USD },
      "ai model is not in the pricing table — spend is estimated at the most "
        + "expensive known rate, so the budget will trip early. Add it to "
        + "PRICING_PER_MILLION_USD in aiBudget.ts for an accurate cap.",
    );
  }
  return FALLBACK_PRICING_PER_MILLION_USD;
}

/** Every model the guard prices, for the same test. */
export function pricedModels(): string[] {
  return Object.keys(PRICING_PER_MILLION_USD);
}

let spentUsd = 0;

const DEFAULT_MODEL = "gpt-4o-mini";

/**
 * Generation and chat are different jobs and want different models.
 *
 * One `AI_MODEL` drove both. A lesson plan is a single long structured
 * document where quality is worth paying for; chat is many short turns where
 * latency and cost dominate. Tying them together means every choice is a
 * compromise between two workloads that share nothing but a client.
 *
 * `AI_MODEL` still works and still sets both — nobody has to change anything.
 * The specific vars override it per workload when you want them to differ.
 */
export function getGenerationModel(): string {
  return process.env.AI_MODEL_GENERATE || process.env.AI_MODEL || DEFAULT_MODEL;
}

export function getChatModel(): string {
  return process.env.AI_MODEL_CHAT || process.env.AI_MODEL || DEFAULT_MODEL;
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

/**
 * Call once per completion, after a successful response, to add its cost to
 * the running total.
 *
 * `model` is required rather than looked up. Once generation and chat can run
 * different models, pricing a completion by a single global would bill every
 * chat turn at the generation model's rate — and the guard would be wrong in
 * whichever direction the two prices differ.
 */
export function recordUsage(
  usage: { prompt_tokens?: number; completion_tokens?: number } | undefined | null,
  model: string,
): void {
  if (!usage) return;
  const { input, output } = getPricing(model);
  const cost =
    ((usage.prompt_tokens ?? 0) / 1_000_000) * input +
    ((usage.completion_tokens ?? 0) / 1_000_000) * output;
  spentUsd += cost;
  logger.info(
    { spentUsd: Number(spentUsd.toFixed(4)), limitUsd: getBudgetLimitUsd(), model },
    "ai test budget updated",
  );
}

export function getBudgetStatus(): {
  liveMode: boolean;
  generationModel: string;
  chatModel: string;
  spentUsd: number;
  limitUsd: number;
  remainingUsd: number;
} {
  const limitUsd = getBudgetLimitUsd();
  // Reports both, not one `model`. The single field was accurate only while
  // the two workloads were guaranteed to share a model; naming them separately
  // is what makes "which model answered that?" checkable from the endpoint.
  return {
    liveMode: isAiLiveModeOn(),
    generationModel: getGenerationModel(),
    chatModel: getChatModel(),
    spentUsd: Number(spentUsd.toFixed(4)),
    limitUsd,
    remainingUsd: Number(Math.max(0, limitUsd - spentUsd).toFixed(4)),
  };
}
