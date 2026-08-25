/**
 * Test-mode safety net for the OpenAI-backed routes (chat, generate,
 * derivativeVerified). DEMO_MODE on the mobile client already keeps these
 * routes unreached in production; this is the server-side switch + spend cap
 * for testing against a real key without DEMO_MODE.
 *
 * The spend total is now month-to-date, summed from the `ai_generations`
 * table, so it survives a restart. It used to be a module-scope variable —
 * and because the free tier sleeps after ~15 minutes idle, every wake reset it
 * to zero, which made AI_BUDGET_USD a per-wake allowance rather than a cap.
 *
 * It still is not the last line of defence, and is not meant to be. The
 * OpenAI project spend limit is (checked 2026-08-22: $50/month on the Iqraa
 * project, $100/month on the organization, with only gpt-5.4-mini and
 * gpt-5.4-nano permitted). This guard exists so the *app* can see its own
 * spend, refuse work before the provider has to, and later enforce per-user
 * quotas — none of which the console can do.
 *
 * When the table is unreachable the total silently falls back to this
 * process's own counter. `getBudgetStatus().persisted` reports which of the
 * two you are looking at, because a guard that has quietly stopped guarding
 * should not look identical to one that works.
 */
import { logger } from "./logger.ts";
import {
  currentPeriodStart,
  getPersistenceFailure,
  readPeriodSpendUsd,
  readUserPeriodSpendUsd,
  recordGeneration,
} from "./aiUsageLog.ts";

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
  // OpenAI. Standard short-context rates from developers.openai.com/api/docs/pricing
  // (checked 2026-08-22). Cached-input and long-context tiers are cheaper and
  // dearer respectively; pricing at the standard rate keeps the guard simple
  // and can only under-run the cap on cached traffic, never over-run it.
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-5.4": { input: 2.5, output: 15 },
  "gpt-5.4-mini": { input: 0.75, output: 4.5 },
  "gpt-5.4-nano": { input: 0.2, output: 1.25 },
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

/**
 * Month-to-date spend. Seeded from the store by hydrateSpendFromStore() and
 * incremented in memory thereafter, so the hot path stays synchronous and
 * costs no query per request.
 */
let spentUsd = 0;
/** Whether `spentUsd` was ever seeded from the store — reported, not assumed. */
let hydrated = false;
/** Which UTC month `spentUsd` covers, so a rollover zeroes it. */
let periodStart = currentPeriodStart();

const DEFAULT_MODEL = "gpt-4o-mini";

/**
 * Load the month's spend from `ai_generations`. Call once at startup, before
 * the server accepts traffic.
 *
 * Failure is not fatal: the guard degrades to per-process counting, which is
 * exactly what it did before this existed. Being unable to read the total is a
 * reason to log loudly, not a reason to refuse to serve teachers.
 */
export async function hydrateSpendFromStore(): Promise<void> {
  periodStart = currentPeriodStart();
  const total = await readPeriodSpendUsd();
  if (total === null) {
    logger.warn(
      { limitUsd: getBudgetLimitUsd() },
      "ai spend total could not be loaded — counting from zero for this process only",
    );
    return;
  }
  spentUsd = total;
  hydrated = true;
  logger.info(
    { spentUsd: Number(spentUsd.toFixed(4)), limitUsd: getBudgetLimitUsd(), periodStart },
    "ai spend total loaded for the current month",
  );
}

/** Zero the counter when the UTC month rolls over, matching how the OpenAI
 *  project spend limit resets. Without this a long-lived process would carry
 *  last month's spend into this month's budget. */
function rollPeriodIfNeeded(): void {
  const current = currentPeriodStart();
  if (current.getTime() === periodStart.getTime()) return;
  periodStart = current;
  spentUsd = 0;
  hydrated = false;
  logger.info({ periodStart }, "ai budget period rolled over; spend total reset");
}

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
export class AiUserQuotaExceededError extends Error {
  constructor(spentUsd: number, limitUsd: number) {
    super(
      `This teacher has used $${spentUsd.toFixed(4)} of their $${limitUsd.toFixed(2)} monthly ` +
        `allowance. Raise AI_USER_BUDGET_USD to change it.`,
    );
    this.name = "AiUserQuotaExceededError";
  }
}

/**
 * Per-teacher monthly allowance. Zero or unset means no per-teacher cap, which
 * is the right default for a single-teacher deployment and the wrong one for a
 * pilot — with fifty teachers sharing a single project budget, one enthusiastic
 * user can spend everyone else's month in an afternoon.
 */
export function getUserBudgetLimitUsd(): number {
  const raw = Number(process.env["AI_USER_BUDGET_USD"]);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

/**
 * Refuse if this teacher is over their own allowance.
 *
 * Async because it reads the ledger rather than a process counter — a per-user
 * total cannot live in memory when the free tier restarts on every wake, which
 * is the exact bug that made `AI_BUDGET_USD` a per-wake allowance once before.
 *
 * A ledger that cannot be read does **not** block the call. The global cap is
 * still in force underneath, and refusing every teacher because a query failed
 * turns a database blip into a total outage.
 */
export async function assertUserQuotaAvailable(userId: string | null | undefined): Promise<void> {
  const limit = getUserBudgetLimitUsd();
  if (!limit || !userId) return;
  const spent = await readUserPeriodSpendUsd(userId);
  if (spent === null) return;
  if (spent >= limit) throw new AiUserQuotaExceededError(spent, limit);
}

export function assertBudgetAvailable(): void {
  rollPeriodIfNeeded();
  const limit = getBudgetLimitUsd();
  if (spentUsd >= limit) throw new AiBudgetExceededError(spentUsd, limit);
}

/**
 * What a completion was for.
 *
 * The keys are optional, and leaving them out is the right call for any
 * workload that cannot be cached — chat, whose turns never repeat, and the
 * derivative drill generator, whose prompt asks for a *fresh, varied* item and
 * takes no inputs at all. Handing those a key computed from an empty body
 * would give every such row the same hash, and the repeat-rate analysis this
 * table exists for would read that as a 100% hit rate on a workload that can
 * never hit. An empty key is obviously "no key"; a constant one silently reads
 * as "the same request, every time".
 *
 * So: `kind` is always recorded, because cost-by-workload is worth knowing for
 * every call. Keys are recorded only where a cache could actually serve the
 * request.
 */
export type GenerationDetail = {
  kind: string;
  promptVersion: string;
  coarseKey?: string;
  strictKey?: string;
  hasContext?: boolean;
  userId?: string | null;
  cacheStatus?: "hit" | "miss";
};

/**
 * Call once per completion, after a successful response, to add its cost to
 * the running total, and to record the row behind it.
 *
 * `model` is required rather than looked up. Once generation and chat can run
 * different models, pricing a completion by a single global would bill every
 * chat turn at the generation model's rate — and the guard would be wrong in
 * whichever direction the two prices differ.
 */
export function recordUsage(
  usage: { prompt_tokens?: number; completion_tokens?: number } | undefined | null,
  model: string,
  detail?: GenerationDetail,
): void {
  if (!usage) return;
  rollPeriodIfNeeded();
  const { input, output } = getPricing(model);
  const promptTokens = usage.prompt_tokens ?? 0;
  const completionTokens = usage.completion_tokens ?? 0;
  const cost =
    (promptTokens / 1_000_000) * input +
    (completionTokens / 1_000_000) * output;
  spentUsd += cost;
  logger.info(
    { spentUsd: Number(spentUsd.toFixed(4)), limitUsd: getBudgetLimitUsd(), model },
    "ai spend updated",
  );

  if (!detail) return;
  // Deliberately not awaited. The completion is already paid for and the
  // artifact is already in hand; making the teacher wait on a metrics insert,
  // or failing their request when it errors, would trade something that
  // matters for something that does not. recordGeneration never rejects.
  void recordGeneration({
    userId: detail.userId ?? null,
    kind: detail.kind,
    model,
    promptVersion: detail.promptVersion,
    coarseKey: detail.coarseKey ?? "",
    strictKey: detail.strictKey ?? "",
    hasContext: detail.hasContext ?? false,
    cacheStatus: detail.cacheStatus ?? "miss",
    promptTokens,
    completionTokens,
    costUsd: cost,
  });
}

export function getBudgetStatus(): {
  liveMode: boolean;
  generationModel: string;
  chatModel: string;
  spentUsd: number;
  limitUsd: number;
  remainingUsd: number;
  periodStart: string;
  persisted: boolean;
  persistenceFailure: "read" | "insert" | null;
} {
  rollPeriodIfNeeded();
  const limitUsd = getBudgetLimitUsd();
  // Reports both models, not one `model`. The single field was accurate only
  // while the two workloads were guaranteed to share a model; naming them
  // separately is what makes "which model answered that?" checkable here.
  //
  // `persisted` is the field to read first. False means the total covers this
  // process only — the pre-2026-08-22 behaviour, where a restart wiped it —
  // and any spend figure below is a floor, not a total.
  return {
    liveMode: isAiLiveModeOn(),
    generationModel: getGenerationModel(),
    chatModel: getChatModel(),
    spentUsd: Number(spentUsd.toFixed(4)),
    limitUsd,
    remainingUsd: Number(Math.max(0, limitUsd - spentUsd).toFixed(4)),
    periodStart: periodStart.toISOString(),
    persisted: hydrated,
    persistenceFailure: getPersistenceFailure(),
  };
}
