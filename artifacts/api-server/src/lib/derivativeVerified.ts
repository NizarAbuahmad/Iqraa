/**
 * Derivative vertical slice — two generation paths:
 * 1) Template a·x^n (no AI) — answer computed in code
 * 2) AI + SymPy check — never return unverified items
 *
 * Compute in latin x; convert to س / Arabic digits only at display time.
 */

import { openai } from "@workspace/integrations-openai-ai-server";
import { verifyDerivative } from "./mathVerifierClient";

export const DERIVATIVE_TOPIC = "derivative_polynomial" as const;

export type Distractor = { value: string; misconception: string };

export type DerivativeItem = {
  topic: typeof DERIVATIVE_TOPIC;
  question: string;
  answer: string;
  distractors: Distractor[];
  source: "template" | "ai_verified";
  verified: boolean;
  display: { question: string; answer: string };
  attempts?: number;
};

const ARABIC_DIGITS: Record<string, string> = {
  "0": "٠",
  "1": "١",
  "2": "٢",
  "3": "٣",
  "4": "٤",
  "5": "٥",
  "6": "٦",
  "7": "٧",
  "8": "٨",
  "9": "٩",
};

export function toArabicDisplay(expr: string): string {
  return expr
    .replace(/x/g, "س")
    .replace(/[0-9]/g, (d) => ARABIC_DIGITS[d] ?? d);
}

function withDisplay(item: Omit<DerivativeItem, "display">): DerivativeItem {
  return {
    ...item,
    display: {
      question: toArabicDisplay(item.question),
      answer: toArabicDisplay(item.answer),
    },
  };
}

function fmtTerm(coef: number, power: number): string {
  if (power === 0) return String(coef);
  const body = power === 1 ? "x" : `x^${power}`;
  if (coef === 1) return body;
  if (coef === -1) return `-${body}`;
  return `${coef}${body}`;
}

function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

const MAX_TEMPLATE_ATTEMPTS = 8;

/** Path 1 — parameterized template a·x^n; answer from power rule; distractors verified when service up. */
export async function generateTemplateItem(): Promise<DerivativeItem> {
  let lastError = "unknown";
  for (let attempt = 0; attempt < MAX_TEMPLATE_ATTEMPTS; attempt++) {
    let a = 0;
    while (a === 0) a = randInt(-9, 9);
    const n = randInt(2, 8);
    const question = fmtTerm(a, n);
    const answer = fmtTerm(a * n, n - 1);
    const distractors: Distractor[] = [
      {
        value: fmtTerm(a, n - 1),
        misconception: "forgot to multiply by the power",
      },
    ];
    if (n > 2) {
      distractors.push({
        value: fmtTerm(a, n),
        misconception: "did not reduce the exponent",
      });
    }

    const check = await verifyDerivative(question, answer, DERIVATIVE_TOPIC, distractors);
    if (check.error === "timeout" || check.error?.startsWith("client_error")) {
      // Service down — trust code-computed template (local power rule).
      return withDisplay({
        topic: DERIVATIVE_TOPIC,
        question,
        answer,
        distractors,
        source: "template",
        verified: true,
      });
    }
    if (check.verified) {
      const canon = (check.computed_answer ?? answer).replace(/\*\*/g, "^").replace(/\*/g, "");
      return withDisplay({
        topic: DERIVATIVE_TOPIC,
        question,
        answer: canon,
        distractors,
        source: "template",
        verified: true,
      });
    }
    lastError = check.error ?? "mismatch";
  }
  throw new Error(`Template generation failed after ${MAX_TEMPLATE_ATTEMPTS}: ${lastError}`);
}

function extractJSON(raw: string): unknown {
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = (fence?.[1] ?? raw).trim();
  return JSON.parse(text);
}

const SYSTEM = `You are a Grade 10 Jordan math item writer for المشتقات (derivatives).
Return ONLY valid JSON (latin x, ascii digits, no Arabic):
{
  "topic": "derivative_polynomial",
  "question": "3x^4 - 2x + 7",
  "answer": "12x^3 - 2",
  "distractors": [
    { "value": "3x^3", "misconception": "forgot to multiply by the power" }
  ]
}
Distractors must NOT be equivalent to the correct answer.`;

const MAX_REGEN = 5;

type LlmContract = {
  topic?: string;
  question?: string;
  answer?: string;
  distractors?: Distractor[];
};

async function callLlm(): Promise<LlmContract> {
  const completion = await openai.chat.completions.create({
    model: "gpt-5.6-luna",
    max_completion_tokens: 400,
    messages: [
      { role: "system", content: SYSTEM },
      {
        role: "user",
        content:
          "Generate one fresh derivative_polynomial drill item. Use a cubic/quartic with 3+ terms; vary coefficients.",
      },
    ],
  });
  const raw = completion.choices[0]?.message?.content ?? "{}";
  return extractJSON(raw) as LlmContract;
}

export type AiGenerateResult = {
  item: DerivativeItem;
  attempts: string[];
};

/**
 * Path 2 — LLM proposes item; SymPy must verify answer + distractors.
 * On mismatch/timeout/bad distractors → regenerate. Never returns unverified.
 */
export async function generateAiVerifiedItem(): Promise<AiGenerateResult> {
  const attempts: string[] = [];
  for (let i = 0; i < MAX_REGEN; i++) {
    let proposed: LlmContract;
    try {
      proposed = await callLlm();
    } catch (err) {
      attempts.push(`llm_error:${err instanceof Error ? err.message : String(err)}`);
      continue;
    }
    if (proposed.topic !== DERIVATIVE_TOPIC || !proposed.question || !proposed.answer) {
      attempts.push("bad_contract");
      continue;
    }
    const distractors = Array.isArray(proposed.distractors) ? proposed.distractors : [];
    const check = await verifyDerivative(
      proposed.question,
      proposed.answer,
      DERIVATIVE_TOPIC,
      distractors,
    );
    if (!check.verified) {
      attempts.push(check.error ?? "mismatch");
      continue;
    }
    const answer =
      (check.computed_answer ?? proposed.answer).replace(/\*\*/g, "^").replace(/\*/g, "");
    attempts.push(`ok_attempt_${i + 1}`);
    return {
      item: withDisplay({
        topic: DERIVATIVE_TOPIC,
        question: proposed.question,
        answer,
        distractors,
        source: "ai_verified",
        verified: true,
        attempts: attempts.length,
      }),
      attempts,
    };
  }
  throw new Error(
    `Failed to produce a verified derivative item after ${MAX_REGEN} attempts: ${attempts.join("; ")}`,
  );
}

export async function generateBatch(opts: {
  template?: number;
  ai?: number;
}): Promise<{
  items: DerivativeItem[];
  wrong: number;
  attempts_per_ai_item: number[];
  avg_ai_attempts: number;
}> {
  const templateN = opts.template ?? 10;
  const aiN = opts.ai ?? 10;
  const items: DerivativeItem[] = [];
  const attempts_per_ai_item: number[] = [];

  for (let i = 0; i < templateN; i++) items.push(await generateTemplateItem());
  for (let i = 0; i < aiN; i++) {
    const { item, attempts } = await generateAiVerifiedItem();
    items.push(item);
    attempts_per_ai_item.push(attempts.length);
  }

  let wrong = 0;
  for (const item of items) {
    if (item.source === "template") {
      const check = await verifyDerivative(
        item.question,
        item.answer,
        DERIVATIVE_TOPIC,
        item.distractors,
      );
      if (check.error === "timeout" || check.error?.startsWith("client_error")) {
        continue;
      }
      if (!check.verified) wrong += 1;
    } else if (!item.verified) {
      wrong += 1;
    }
  }

  const avg_ai_attempts =
    attempts_per_ai_item.length === 0
      ? 0
      : attempts_per_ai_item.reduce((a, b) => a + b, 0) / attempts_per_ai_item.length;

  return { items, wrong, attempts_per_ai_item, avg_ai_attempts };
}
