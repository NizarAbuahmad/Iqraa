/**
 * Admin alerts for the two ways live AI stops working without anyone noticing:
 * a provider that refuses the ACCOUNT (expired key, empty balance — the
 * 2026-11-20 OpenAI credit outage), and a month's spend nearing AI_BUDGET_USD.
 *
 * Until now both only wrote a log line; users got the other provider or sample
 * content and nobody was told.
 *
 * Text is fixed wording plus a provider name, a status code and rounded dollar
 * amounts. It never includes an error message (an SDK's 401 message can quote
 * part of the key), a key, a user or a prompt.
 *
 * No database or aiBudget import at module scope: aiBudget.ts and
 * providerFallback.ts import this, and their tests must stay loadable without
 * DATABASE_URL. The sender (adminNotify.ts) is imported when an alert is due.
 */
import { claimAlert, type ClaimDeps } from "./adminAlertGate.ts";
import { logger } from "./logger.ts";

const HOUR = 60 * 60 * 1000;
/** One account-error alert per provider per 6 hours, across instances. */
export const ACCOUNT_ALERT_WINDOW_MS = 6 * HOUR;
/** A budget threshold alerts once a month; the key carries the month, this only bounds the row. */
const BUDGET_ALERT_WINDOW_MS = 32 * 24 * HOUR;

export type AdminAlert = {
  title: string;
  /** Arabic push body and first paragraph of the email. */
  body: string;
  bodyEn: string;
  subject: string;
  /** `data.screen` of the push; must be in the mobile whitelist (notificationDeepLink.ts). */
  screen: string;
  /** The admin web path the email links to. */
  path: string;
};

export type AlertDeps = ClaimDeps & { notify?: (alert: AdminAlert) => Promise<void> };

export type ProviderName = "Claude" | "OpenAI";

export function accountErrorAlert(input: {
  provider: ProviderName;
  switchedTo: ProviderName | null;
  status: number | undefined;
}): AdminAlert {
  const code = typeof input.status === "number" ? ` (HTTP ${input.status})` : "";
  const bodyAr = input.switchedTo
    ? `رفض مزوّد ${input.provider} حساب الخدمة${code}: المفتاح منتهٍ أو الرصيد فارغ. تُجاب الطلبات الآن عبر ${input.switchedTo}. راجع المفتاح أو الرصيد.`
    : `رفض مزوّد ${input.provider} حساب الخدمة${code}: المفتاح منتهٍ أو الرصيد فارغ، ولا يوجد مزوّد بديل. يرى المستخدمون محتوى تجريبياً أو خطأ. راجع المفتاح أو الرصيد.`;
  const bodyEn = input.switchedTo
    ? `${input.provider} refused the service account${code}: expired key or empty balance. Requests are now answered by ${input.switchedTo}. Check the key or balance.`
    : `${input.provider} refused the service account${code}: expired key or empty balance, and there is no backup provider. Users get sample content or an error. Check the key or balance.`;
  return {
    title: "تنبيه: مشكلة في حساب الذكاء الاصطناعي",
    body: bodyAr,
    bodyEn,
    subject: `تنبيه: حساب ${input.provider} مرفوض / AI provider account problem`,
    screen: "ai-costs",
    path: "/admin/ai-costs",
  };
}

export function budgetAlert(input: { threshold: number; spentUsd: number; limitUsd: number }): AdminAlert {
  const pct = Math.round(input.threshold * 100);
  const spent = input.spentUsd.toFixed(2);
  const limit = input.limitUsd.toFixed(2);
  const spentAll = input.threshold >= 1;
  return {
    title: spentAll ? "تنبيه: نفدت ميزانية الذكاء الاصطناعي" : "تنبيه: ميزانية الذكاء الاصطناعي تقترب من النفاد",
    body: spentAll
      ? `بلغ الإنفاق ${spent}$ من ${limit}$ (${pct}%). توقّف التوليد الحي حتى رفع AI_BUDGET_USD أو بداية الشهر.`
      : `بلغ إنفاق الشهر ${spent}$ من ${limit}$ (${pct}%). يتوقف التوليد الحي عند الحد.`,
    bodyEn: spentAll
      ? `Spend reached $${spent} of $${limit} (${pct}%). Live generation stops until AI_BUDGET_USD is raised or the month rolls over.`
      : `This month's spend reached $${spent} of $${limit} (${pct}%). Live generation stops at the limit.`,
    subject: spentAll
      ? "تنبيه: نفدت ميزانية الذكاء الاصطناعي / AI budget exhausted"
      : `تنبيه: ${pct}% من ميزانية الذكاء الاصطناعي / AI budget at ${pct}%`,
    screen: "ai-costs",
    path: "/admin/ai-costs",
  };
}

/** The alert thresholds, as fractions of AI_BUDGET_USD. */
export const BUDGET_ALERT_THRESHOLDS = [0.8, 1] as const;

/** Which thresholds `spentUsd` has reached. Level-based, so it does not depend on seeing the moment of crossing. */
export function budgetThresholdsReached(spentUsd: number, limitUsd: number): number[] {
  if (!Number.isFinite(spentUsd) || !Number.isFinite(limitUsd) || limitUsd <= 0) return [];
  return BUDGET_ALERT_THRESHOLDS.filter(t => spentUsd >= limitUsd * t);
}

async function defaultNotify(alert: AdminAlert): Promise<void> {
  const { notifyAdminsOfAlert } = await import("./adminNotify.ts");
  await notifyAdminsOfAlert(alert);
}

/** Never rejects: an alert about a failure must not become another one. */
export async function alertAccountError(
  input: { provider: ProviderName; switchedTo: ProviderName | null; status: number | undefined },
  deps: AlertDeps = {},
): Promise<void> {
  try {
    if (!(await claimAlert(`ai-account:${input.provider}`, ACCOUNT_ALERT_WINDOW_MS, deps))) return;
    await (deps.notify ?? defaultNotify)(accountErrorAlert(input));
  } catch (err) {
    logger.error({ err }, "AI account-error alert failed");
  }
}

/** Never rejects. Once per threshold per monthly period, across instances. */
export async function alertBudgetThreshold(
  input: { threshold: number; spentUsd: number; limitUsd: number; periodStart: Date },
  deps: AlertDeps = {},
): Promise<void> {
  try {
    const period = input.periodStart.toISOString().slice(0, 10);
    if (!(await claimAlert(`ai-budget:${input.threshold}:${period}`, BUDGET_ALERT_WINDOW_MS, deps))) return;
    await (deps.notify ?? defaultNotify)(budgetAlert(input));
  } catch (err) {
    logger.error({ err }, "AI budget alert failed");
  }
}
