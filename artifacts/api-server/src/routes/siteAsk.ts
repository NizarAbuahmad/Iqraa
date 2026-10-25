import { Router } from "express";
import {
  AiBudgetExceededError,
  assertBudgetAvailable,
  getChatModel,
  getPricing,
  isAiLiveModeOn,
  recordUsage,
} from "../lib/aiBudget.ts";
import { getPersistenceFailure } from "../lib/aiUsageLog.ts";
import { createRateLimiter } from "../lib/rateLimit.ts";
import { answerSiteQuestion, SITE_ASK_MAX_TOKENS, SITE_ASK_TIMEOUT_MS, type SiteAskDeps } from "../lib/siteAsk.ts";
import { parseSiteAsk } from "../lib/siteAskInput.ts";
import {
  createSiteAskSpendGate,
  estimateCostUsd,
  getSiteAskDailyCapUsd,
  readSiteAskSpendLast24hUsd,
  SITE_ASK_KIND,
} from "../lib/siteAskBudget.ts";
import { SITE_ASK_FALLBACK_MESSAGE, SITE_ASK_PROMPT_VERSION } from "../lib/siteAskPrompts.ts";
import { loadSiteFacts } from "../lib/siteFacts.ts";

const siteAskRouter = Router();

/**
 * POST /site/ask — the visitor-facing «اسأل إقرأ» bot on iqrra.com.
 *
 * Mounted at /site/ask in routes/index.ts, never bare: this router is public,
 * and a router mounted without a prefix sees every request.
 *
 * Public with no key — a browser posts here directly and cannot hold a secret —
 * so the limits are the defence, as for /site/ideas (admin.ts): a person asks a
 * handful of questions an hour, and the global ceiling bounds how fast many
 * addresses together can spend. CORS (app.ts) only constrains browsers; curl
 * ignores it, which is why it is not relied on.
 *
 * Every outcome the visitor can cause is a 200. `answered: false` carries a
 * reason (for the logs and tests) and the fixed bilingual message (for the
 * widget), so a cap tripping or the model failing never shows as an error page.
 * The limiter's own 429 and a malformed body's 400 are the only non-200s.
 *
 * It answers about Iqraa only, from the site's own llms.txt (lib/siteFacts.ts).
 * It has its own daily spend ceiling (lib/siteAskBudget.ts). That ceiling
 * bounds what anonymous traffic can add per day; it does not set the bot apart
 * from the teachers' budget: recordUsage still adds each answer to the shared
 * month-to-date total that AI_BUDGET_USD caps, so at the default of $1 a day
 * the bot can use up to about $30 of a month. Size AI_BUDGET_USD with that in
 * mind, or lower SITE_BOT_BUDGET_USD_DAILY. The OpenAI client is imported
 * lazily, inside `complete`, because it throws at module scope without a key.
 */
// The global limit is a spend control and a lever: 100 an hour is roughly what a
// $1/day cap can pay for (about $0.01 an answer), and anyone can use up a global
// ceiling to turn every other visitor away, so it is kept near what the money
// allows, not far above it. The per-IP limit stays 20 an hour.
const siteAskIpLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 20, name: "site-ask-ip" });
const siteAskGlobalLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 100,
  name: "site-ask-all",
  key: () => "all",
});

const spendGate = createSiteAskSpendGate({
  read: () => readSiteAskSpendLast24hUsd(),
  capUsd: () => getSiteAskDailyCapUsd(process.env.SITE_BOT_BUDGET_USD_DAILY),
  // recordUsage's ledger write fails soft; a ledger that cannot be written
  // cannot enforce a cap, so the gate closes while inserts are failing.
  ledgerHealthy: () => getPersistenceFailure() !== "insert",
});

function realDeps(model: string): SiteAskDeps {
  return {
    liveModeOn: isAiLiveModeOn,
    budgetAvailable: () => {
      try {
        assertBudgetAvailable();
        return true;
      } catch (err) {
        if (err instanceof AiBudgetExceededError) return false;
        throw err;
      }
    },
    dailyCapOpen: () => spendGate.isOpen(),
    loadFacts: () => loadSiteFacts(),
    complete: async (messages) => {
      const { openai } = await import("@workspace/integrations-openai-ai-server");
      const completion = await openai.chat.completions.create(
        { model, max_completion_tokens: SITE_ASK_MAX_TOKENS, messages },
        // The client default is 120 s and one retry: far too patient for a
        // visitor watching a typing indicator.
        { timeout: SITE_ASK_TIMEOUT_MS, maxRetries: 0 },
      );
      return { content: completion.choices[0]?.message?.content, usage: completion.usage };
    },
    recordUsage: (usage, durationMs) => {
      recordUsage(usage, model, { kind: SITE_ASK_KIND, promptVersion: SITE_ASK_PROMPT_VERSION, durationMs });
      // The gate's database total is cached for a minute; count this answer now.
      spendGate.add(estimateCostUsd(usage, getPricing(model)));
    },
  };
}

siteAskRouter.post("/", siteAskIpLimiter, siteAskGlobalLimiter, async (req, res) => {
  const parsed = parseSiteAsk(req.body);
  if (!parsed.ok) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  res.setHeader("Cache-Control", "no-store");
  const result = await answerSiteQuestion(parsed.value, realDeps(getChatModel()));
  if (result.answered) {
    res.json({ answered: true, content: result.content });
    return;
  }
  res.json({ answered: false, reason: result.reason, fallback: SITE_ASK_FALLBACK_MESSAGE });
});

export default siteAskRouter;
