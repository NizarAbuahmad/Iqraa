/**
 * The admin alerts for a failing AI account and a spend that is running out.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/aiAlerts.test.ts
 */
import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  accountErrorAlert,
  alertAccountError,
  alertBudgetThreshold,
  budgetAlert,
  budgetThresholdsReached,
} from "../aiAlerts.ts";
import { resetAlertGateForTests } from "../adminAlertGate.ts";

function countingStore() {
  const counts = new Map<string, number>();
  return {
    keys: [] as string[],
    async hit(key: string, windowMs: number) {
      this.keys.push(key);
      const n = (counts.get(key) ?? 0) + 1;
      counts.set(key, n);
      return { count: n, resetAt: new Date(Date.now() + windowMs) };
    },
  };
}

describe("budgetThresholdsReached", () => {
  it("is empty under 80%", () => {
    assert.deepEqual(budgetThresholdsReached(1.59, 2), []);
  });
  it("names 80% from exactly 80%", () => {
    assert.deepEqual(budgetThresholdsReached(1.6, 2), [0.8]);
  });
  it("names both once the budget is spent", () => {
    assert.deepEqual(budgetThresholdsReached(2, 2), [0.8, 1]);
    assert.deepEqual(budgetThresholdsReached(2.4, 2), [0.8, 1]);
  });
  it("is empty for a nonsense limit or spend", () => {
    assert.deepEqual(budgetThresholdsReached(5, 0), []);
    assert.deepEqual(budgetThresholdsReached(Number.NaN, 2), []);
  });
});

describe("alert wording", () => {
  it("an account error says which provider, whether it switched, and the status", () => {
    const a = accountErrorAlert({ provider: "Claude", switchedTo: "OpenAI", status: 401 });
    assert.match(a.body, /Claude/);
    assert.match(a.body, /OpenAI/);
    assert.match(a.body, /401/);
    const none = accountErrorAlert({ provider: "OpenAI", switchedTo: null, status: 429 });
    assert.match(none.body, /OpenAI/);
    assert.ok(none.body !== a.body);
  });

  it("carries no key, message or secret-shaped text", () => {
    const a = accountErrorAlert({ provider: "Claude", switchedTo: "OpenAI", status: 401 });
    const text = JSON.stringify(a);
    assert.doesNotMatch(text, /sk-|Bearer|api[_-]?key/i);
  });

  it("the budget alert gives rounded dollars and the percentage", () => {
    const a = budgetAlert({ threshold: 0.8, spentUsd: 1.6123, limitUsd: 2 });
    assert.match(a.body, /80/);
    assert.match(a.body, /1\.61/);
    assert.match(a.body, /2\.00/);
  });

  it("both open the AI costs screen on the admin channel", () => {
    assert.equal(accountErrorAlert({ provider: "Claude", switchedTo: null, status: 401 }).screen, "ai-costs");
    assert.equal(budgetAlert({ threshold: 1, spentUsd: 2, limitUsd: 2 }).screen, "ai-costs");
  });
});

describe("alertAccountError", () => {
  beforeEach(() => resetAlertGateForTests());

  it("sends once per provider per window, however many requests fail", async () => {
    const store = countingStore();
    const sent: string[] = [];
    const notify = async (a: { body: string }) => void sent.push(a.body);
    for (let i = 0; i < 100; i++) {
      await alertAccountError({ provider: "Claude", switchedTo: "OpenAI", status: 401 }, { store, notify });
    }
    assert.equal(sent.length, 1);
    assert.deepEqual(store.keys, ["admin-alert:ai-account:Claude"]);
  });

  it("a different provider failing is its own alert", async () => {
    const store = countingStore();
    const sent: string[] = [];
    const notify = async (a: { body: string }) => void sent.push(a.body);
    await alertAccountError({ provider: "Claude", switchedTo: "OpenAI", status: 401 }, { store, notify });
    await alertAccountError({ provider: "OpenAI", switchedTo: null, status: 402 }, { store, notify });
    assert.equal(sent.length, 2);
  });

  it("never throws when notifying fails", async () => {
    const store = countingStore();
    await assert.doesNotReject(() =>
      alertAccountError(
        { provider: "Claude", switchedTo: null, status: 401 },
        { store, notify: async () => { throw new Error("smtp down"); } },
      ),
    );
  });
});

describe("alertBudgetThreshold", () => {
  beforeEach(() => resetAlertGateForTests());

  it("sends once per threshold per period across instances", async () => {
    const store = countingStore();
    const sent: string[] = [];
    const notify = async (a: { body: string }) => void sent.push(a.body);
    const period = new Date("2026-11-01T00:00:00Z");
    const args = { threshold: 0.8, spentUsd: 1.7, limitUsd: 2, periodStart: period };
    await alertBudgetThreshold(args, { store, notify });
    resetAlertGateForTests(); // a second container
    await alertBudgetThreshold(args, { store, notify });
    assert.equal(sent.length, 1);
    assert.deepEqual(store.keys[0], "admin-alert:ai-budget:0.8:2026-11-01");
  });

  it("the next month is a new alert", async () => {
    const store = countingStore();
    const sent: string[] = [];
    const notify = async (a: { body: string }) => void sent.push(a.body);
    await alertBudgetThreshold({ threshold: 0.8, spentUsd: 1.7, limitUsd: 2, periodStart: new Date("2026-11-01T00:00:00Z") }, { store, notify });
    await alertBudgetThreshold({ threshold: 0.8, spentUsd: 1.7, limitUsd: 2, periodStart: new Date("2026-12-01T00:00:00Z") }, { store, notify });
    assert.equal(sent.length, 2);
  });
});

describe("where the alerts are wired", () => {
  const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

  it("every place that adds to the spend, and the gate in front of a call, checks the thresholds", () => {
    const src = read("../aiBudget.ts");
    assert.equal(src.match(/\bcheckBudgetAlerts\(\);/g)?.length, 3);
    const gate = src.slice(src.indexOf("export function assertBudgetAvailable"));
    assert.ok(gate.indexOf("checkBudgetAlerts()") < gate.indexOf("throw new AiBudgetExceededError"));
  });

  it("the artifact-report route awaits the admin notification through pushWithin", () => {
    const src = read("../../routes/generate.ts");
    const route = src.slice(src.indexOf('"/generate/variants/:id/retire"'));
    assert.match(route, /await pushWithin\("artifact report"/);
    assert.doesNotMatch(route, /notifyAdminsOfArtifactReport\([^)]*\)\.catch/);
  });
});

describe("the alert email", () => {
  it("escapes its text and links the admin screen", async () => {
    const { adminAlertBodyHtml } = await import("../email.ts");
    const html = adminAlertBodyHtml({ body: "<b>x</b>", bodyEn: "a & b", path: "/admin/ai-costs" });
    assert.doesNotMatch(html, /<b>x<\/b>/);
    assert.match(html, /&lt;b&gt;/);
    assert.match(html, /https:\/\/app\.iqrra\.com\/admin\/ai-costs/);
  });
});
