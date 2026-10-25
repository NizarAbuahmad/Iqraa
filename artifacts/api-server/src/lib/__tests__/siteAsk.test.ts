/**
 * The decision order of the public bot, with every effect faked.
 *
 * What matters most here is what does NOT happen: once a cap has tripped, the
 * model is never called and no facts are fetched, so a refusal costs nothing.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  answerSiteQuestion,
  buildSiteAskMessages,
  type SiteAskDeps,
  type SiteAskMessage,
} from "../siteAsk.ts";
import { SITE_ASK_REMINDER } from "../siteAskPrompts.ts";

const ask = { message: "هل هو مجاني؟", history: [] as { role: "user" | "assistant"; content: string }[] };

function setup(over: Partial<SiteAskDeps> = {}) {
  const calls = { complete: 0, facts: 0, recorded: 0 };
  const seen: { messages: SiteAskMessage[] | null } = { messages: null };
  const base: SiteAskDeps = {
    curatedAnswer: () => null,
    liveModeOn: () => true,
    budgetAvailable: () => true,
    dailyCapOpen: async () => true,
    loadFacts: async () => {
      calls.facts += 1;
      return { text: "FACT: free in beta", source: "site" };
    },
    complete: async (messages) => {
      calls.complete += 1;
      seen.messages = messages;
      return { content: "  نعم، مجاني في النسخة التجريبية.  ", usage: { prompt_tokens: 120, completion_tokens: 14 } };
    },
    recordUsage: () => {
      calls.recorded += 1;
    },
  };
  return { deps: { ...base, ...over }, calls, seen };
}

describe("answerSiteQuestion", () => {
  it("answers, trims the reply and records the spend", async () => {
    const s = setup();
    const result = await answerSiteQuestion(ask, s.deps);
    assert.deepEqual(result, { answered: true, content: "نعم، مجاني في النسخة التجريبية.", source: "ai" });
    assert.equal(s.calls.complete, 1);
    assert.equal(s.calls.recorded, 1);
    assert.deepEqual(s.seen.messages, buildSiteAskMessages(ask, "FACT: free in beta"));
  });

  it("refuses when live mode is off, without fetching facts or calling the model", async () => {
    const s = setup({ liveModeOn: () => false });
    assert.deepEqual(await answerSiteQuestion(ask, s.deps), { answered: false, reason: "live_mode_off" });
    assert.equal(s.calls.complete, 0);
    assert.equal(s.calls.facts, 0);
  });

  it("refuses when the global budget is spent", async () => {
    const s = setup({ budgetAvailable: () => false });
    assert.deepEqual(await answerSiteQuestion(ask, s.deps), { answered: false, reason: "budget" });
    assert.equal(s.calls.complete, 0);
    assert.equal(s.calls.facts, 0);
  });

  it("refuses when the bot's own daily cap is reached", async () => {
    const s = setup({ dailyCapOpen: async () => false });
    assert.deepEqual(await answerSiteQuestion(ask, s.deps), { answered: false, reason: "daily_cap" });
    assert.equal(s.calls.complete, 0);
    assert.equal(s.calls.facts, 0);
  });

  it("checks the cheap things first: live mode, then the global budget, then the daily cap", async () => {
    const order: string[] = [];
    const s = setup({
      liveModeOn: () => (order.push("live"), true),
      budgetAvailable: () => (order.push("budget"), true),
      dailyCapOpen: async () => (order.push("daily"), false),
    });
    await answerSiteQuestion(ask, s.deps);
    assert.deepEqual(order, ["live", "budget", "daily"]);
  });

  it("answers with a reason, not an exception, when the model fails", async () => {
    const s = setup({
      complete: async () => {
        throw new Error("upstream 500");
      },
    });
    assert.deepEqual(await answerSiteQuestion(ask, s.deps), { answered: false, reason: "error" });
    assert.equal(s.calls.recorded, 0);
  });

  it("treats a blank reply as a non-answer, but still records what it cost", async () => {
    const s = setup({
      complete: async () => ({ content: "   ", usage: { prompt_tokens: 900, completion_tokens: 800 } }),
    });
    assert.deepEqual(await answerSiteQuestion(ask, s.deps), { answered: false, reason: "empty" });
    assert.equal(s.calls.recorded, 1, "a reply that was all hidden reasoning is still billed");
  });

  it("treats a missing reply as a non-answer", async () => {
    const s = setup({ complete: async () => ({ content: null, usage: null }) });
    assert.deepEqual(await answerSiteQuestion(ask, s.deps), { answered: false, reason: "empty" });
  });

  it("never throws: an unexpected failure anywhere becomes reason 'error'", async () => {
    const s = setup({
      loadFacts: async () => {
        throw new Error("boom");
      },
    });
    assert.deepEqual(await answerSiteQuestion(ask, s.deps), { answered: false, reason: "error" });
    const t = setup({
      budgetAvailable: () => {
        throw new Error("not a budget error");
      },
    });
    assert.deepEqual(await answerSiteQuestion(ask, t.deps), { answered: false, reason: "error" });
  });
});

describe("answerSiteQuestion: fixed answers first", () => {
  const hit = { id: "pricing", content: "FIXED ANSWER" };

  it("answers a curated hit with live mode off, the budget spent and the daily cap reached, touching nothing", async () => {
    const n = { live: 0, budget: 0, daily: 0 };
    const s = setup({
      curatedAnswer: () => hit,
      liveModeOn: () => (n.live++, false),
      budgetAvailable: () => (n.budget++, false),
      dailyCapOpen: async () => (n.daily++, false),
    });
    assert.deepEqual(await answerSiteQuestion(ask, s.deps), {
      answered: true,
      content: "FIXED ANSWER",
      source: "curated",
    });
    assert.equal(s.calls.facts, 0);
    assert.equal(s.calls.complete, 0);
    assert.equal(s.calls.recorded, 0);
    assert.deepEqual(n, { live: 0, budget: 0, daily: 0 }, "no gate is even consulted");
  });

  it("hands the matcher the visitor's message exactly, not the history", async () => {
    const seen: string[] = [];
    const s = setup({ curatedAnswer: (m) => (seen.push(m), null) });
    await answerSiteQuestion(
      { message: "وما الصفوف؟", history: [{ role: "user", content: "ما هو إقرأ؟" }] },
      s.deps,
    );
    assert.deepEqual(seen, ["وما الصفوف؟"]);
  });

  it("treats a throwing matcher as a miss: the AI path still answers", async () => {
    const s = setup({
      curatedAnswer: () => {
        throw new Error("matcher bug");
      },
    });
    assert.deepEqual(await answerSiteQuestion(ask, s.deps), {
      answered: true,
      content: "نعم، مجاني في النسخة التجريبية.",
      source: "ai",
    });
    assert.equal(s.calls.complete, 1);
  });

  it("a throwing matcher with the AI blocked is live_mode_off, not error", async () => {
    const s = setup({
      curatedAnswer: () => {
        throw new Error("matcher bug");
      },
      liveModeOn: () => false,
    });
    assert.deepEqual(await answerSiteQuestion(ask, s.deps), { answered: false, reason: "live_mode_off" });
  });

  it("a miss runs the gates in the old order after the matcher", async () => {
    const order: string[] = [];
    const s = setup({
      curatedAnswer: () => (order.push("curated"), null),
      liveModeOn: () => (order.push("live"), true),
      budgetAvailable: () => (order.push("budget"), true),
      dailyCapOpen: async () => (order.push("daily"), false),
    });
    await answerSiteQuestion(ask, s.deps);
    assert.deepEqual(order, ["curated", "live", "budget", "daily"]);
  });
});

describe("buildSiteAskMessages", () => {
  it("sends rules and facts first, then history, then the question, then the reminder", () => {
    const messages = buildSiteAskMessages(
      {
        message: "وما الصفوف؟",
        history: [
          { role: "user", content: "ما هو إقرأ؟" },
          { role: "assistant", content: "مساعد تحضير للمعلمين." },
        ],
      },
      "FACT-MARKER",
    );
    assert.deepEqual(
      messages.map((m) => m.role),
      ["system", "user", "assistant", "user", "system"],
    );
    assert.ok(messages[0]!.content.includes("FACT-MARKER"));
    assert.equal(messages[3]!.content, "وما الصفوف؟");
    assert.equal(messages[4]!.content, SITE_ASK_REMINDER);
  });
});
