/**
 * The public bot's decision order, with every effect injected.
 *
 * The route gives this real dependencies (OpenAI, the database, the clock);
 * tests give it fakes. Keeping it free of both is what lets the important
 * property be asserted directly: once any cap has tripped, nothing downstream
 * runs — no facts fetch, no model call, no spend.
 *
 * Order is cheapest first: live mode (an env read), the global budget (memory),
 * the bot's own daily cap (a cached database read). Only then facts and the
 * model.
 *
 * Never throws and never returns a made-up answer. Every failure is a reason the
 * route turns into the fixed "write to us" message; a mock that looked like a
 * real answer is exactly what CLAUDE.md warns against.
 *
 * No message text reaches the logger: outcome, facts source and duration only.
 */
import { logger } from "./logger.ts";
import type { SiteAskInput } from "./siteAskInput.ts";
import { buildSiteAskSystemPrompt, SITE_ASK_REMINDER } from "./siteAskPrompts.ts";

/** Hidden reasoning counts against the same ceiling as visible text on the
 *  production chat model (see the note in routes/chat.ts), so this is far above
 *  the three sentences the prompt asks for. */
export const SITE_ASK_MAX_TOKENS = 800;
export const SITE_ASK_TIMEOUT_MS = 20_000;

export type SiteAskReason = "live_mode_off" | "budget" | "daily_cap" | "error" | "empty";
export type SiteAskResult =
  | { answered: true; content: string }
  | { answered: false; reason: SiteAskReason };

export type SiteAskMessage = { role: "system" | "user" | "assistant"; content: string };
export type SiteAskUsage = { prompt_tokens?: number; completion_tokens?: number };

export type SiteAskDeps = {
  liveModeOn(): boolean;
  budgetAvailable(): boolean;
  dailyCapOpen(): Promise<boolean>;
  loadFacts(): Promise<{ text: string; source: string }>;
  complete(
    messages: SiteAskMessage[],
  ): Promise<{ content: string | null | undefined; usage?: SiteAskUsage | null }>;
  recordUsage(usage: SiteAskUsage | null | undefined, durationMs: number): void;
};

export function buildSiteAskMessages(input: SiteAskInput, factsText: string): SiteAskMessage[] {
  return [
    { role: "system", content: buildSiteAskSystemPrompt(factsText) },
    ...input.history,
    { role: "user", content: input.message },
    { role: "system", content: SITE_ASK_REMINDER },
  ];
}

export async function answerSiteQuestion(input: SiteAskInput, deps: SiteAskDeps): Promise<SiteAskResult> {
  const refuse = (reason: SiteAskReason): SiteAskResult => {
    logger.info({ outcome: reason }, "site-ask refused");
    return { answered: false, reason };
  };

  try {
    if (!deps.liveModeOn()) return refuse("live_mode_off");
    if (!deps.budgetAvailable()) return refuse("budget");
    if (!(await deps.dailyCapOpen())) return refuse("daily_cap");

    const facts = await deps.loadFacts();
    const messages = buildSiteAskMessages(input, facts.text);

    const startedAt = Date.now();
    const completion = await deps.complete(messages);
    const durationMs = Date.now() - startedAt;
    // Before the empty check: a reply that was all hidden reasoning is billed.
    deps.recordUsage(completion.usage, durationMs);

    const content = (completion.content ?? "").trim();
    if (!content) return refuse("empty");

    logger.info({ outcome: "answered", factsSource: facts.source, durationMs }, "site-ask answered");
    return { answered: true, content };
  } catch (err) {
    logger.error({ err }, "site-ask failed");
    return { answered: false, reason: "error" };
  }
}
