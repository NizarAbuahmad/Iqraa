/**
 * Provider evaluation harness — which model is actually best for this product.
 *
 * Runs the SAME shipped prompts (src/lib/prompts.ts) through several providers
 * over the same real curriculum lessons, then scores what can be scored
 * objectively and lays out the rest for blind human rating.
 *
 * Why offline rather than wired into the app: the question is answered once.
 * Building a provider abstraction into the request path first would be weeks
 * of plumbing before learning anything, and would leave three integrations to
 * maintain to settle a decision that only needs settling one time.
 *
 * What it measures
 *   • Math correctness — generated quiz answer keys go through the same
 *     classifier the app uses and then through SymPy. This is the objective
 *     signal, and having a verifier makes it available at all.
 *   • Cost and latency — from each provider's own reported token usage.
 *   • Arabic quality — NOT scored here. Outputs are written under anonymised
 *     ids with the mapping held back in key.json, so the rating can be done
 *     blind. A model that reads better because you knew which one it was is
 *     not evidence.
 *
 * Run:
 *   OPENAI_API_KEY=... ANTHROPIC_API_KEY=... DEEPSEEK_API_KEY=... \
 *     node --experimental-strip-types artifacts/api-server/scripts/provider-eval.ts
 *
 * Any provider whose key is absent is skipped, so this is usable with one key.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import {
  SYSTEM_AR,
  lessonPlanPromptAr,
  quizPromptAr,
  worksheetPromptAr,
} from "../src/lib/prompts.ts";

// ─── The eval set ────────────────────────────────────────────────────────────
// Fixed and checked in on purpose: an eval whose inputs drift cannot be
// compared across runs. Real NCCD Grade 10 lesson titles, spread across the
// families the verifier can and cannot reach.
const LESSONS = [
  { topic: "الاشتقاق", subject: "الرياضيات", grade: "الصف العاشر" },
  { topic: "معادلة الدائرة", subject: "الرياضيات", grade: "الصف العاشر" },
  { topic: "النسب المثلثية", subject: "الرياضيات", grade: "الصف العاشر" },
  { topic: "التفاعلات الكيميائية", subject: "الكيمياء", grade: "الصف العاشر" },
];

/**
 * The ceiling is generous on purpose.
 *
 * These were 2000–2500, which would have quietly rigged the comparison: on a
 * reasoning model, thinking tokens are billed as output and count against the
 * same ceiling, so the model can spend most of the budget reasoning and return
 * a truncated object. That scores as a malformed answer and reads as "this
 * model is bad at Arabic lesson plans" when it was never given room to reply.
 * An eval that penalises a model for the harness's configuration measures the
 * harness.
 */
const TASK_TOKENS = 16000;

/**
 * The fields the app actually reads. `parsed` only asks whether the response
 * was JSON at all — a model can return well-formed JSON with none of these and
 * score as a success, then render as an empty lesson plan. Conformance is the
 * objective half of "is this output usable".
 */
const REQUIRED_FIELDS: Record<string, string[]> = {
  "lesson-plan": [
    "title", "objectives", "materials", "introduction", "mainActivity",
    "guidedPractice", "independentPractice", "closure", "assessment",
    "differentiation", "homework",
  ],
  worksheet: ["title", "instructions", "sections", "answerKey"],
  quiz: ["title", "duration", "totalPoints", "questions"],
};

const TASKS = [
  { id: "lesson-plan", build: lessonPlanPromptAr, maxTokens: TASK_TOKENS },
  { id: "worksheet", build: worksheetPromptAr, maxTokens: TASK_TOKENS },
  { id: "quiz", build: quizPromptAr, maxTokens: TASK_TOKENS },
] as const;

/** Which required fields are missing or empty — [] means fully conformant. */
function missingFields(task: string, parsed: unknown): string[] {
  const required = REQUIRED_FIELDS[task] ?? [];
  if (parsed === null || typeof parsed !== "object") return [...required];
  const obj = parsed as Record<string, unknown>;
  return required.filter((f) => {
    const v = obj[f];
    if (v === undefined || v === null) return true;
    if (typeof v === "string") return v.trim() === "";
    if (Array.isArray(v)) return v.length === 0;
    return false;
  });
}

// ─── Providers ───────────────────────────────────────────────────────────────
// USD per million tokens. `null` means "not priced here" — the run reports
// tokens and leaves cost blank rather than inventing a number.
type Pricing = { input: number; output: number } | null;

type Provider = {
  id: string;
  model: string;
  pricing: Pricing;
  enabled: boolean;
  run: (system: string, user: string, maxTokens: number) => Promise<Completion>;
};

type Completion = { text: string; inputTokens: number; outputTokens: number };

const openaiModel = process.env.OPENAI_EVAL_MODEL || "gpt-4o-mini";
const anthropicModel = process.env.ANTHROPIC_EVAL_MODEL || "claude-opus-5";
const deepseekModel = process.env.DEEPSEEK_EVAL_MODEL || "deepseek-chat";
const effort = process.env.ANTHROPIC_EVAL_EFFORT || "medium";

const OPENAI_PRICING: Record<string, Pricing> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10 },
};
// Standard rates. Claude Sonnet 5 also has a $2/$10 introductory rate through
// 2026-08-31 — deliberately NOT used here: the decision this eval informs
// outlives the promotion, so pricing it at the intro rate would compare a
// temporary number against permanent ones.
const ANTHROPIC_PRICING: Record<string, Pricing> = {
  "claude-opus-5": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

function openaiCompatible(id: string, model: string, apiKey: string, baseURL?: string, pricing: Pricing = null): Provider {
  const client = new OpenAI({ apiKey, ...(baseURL ? { baseURL } : {}) });
  return {
    id, model, pricing, enabled: true,
    async run(system, user, maxTokens) {
      const c = await client.chat.completions.create({
        model,
        max_completion_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      });
      return {
        text: c.choices[0]?.message?.content ?? "",
        inputTokens: c.usage?.prompt_tokens ?? 0,
        outputTokens: c.usage?.completion_tokens ?? 0,
      };
    },
  };
}

function anthropicProvider(apiKey: string): Provider {
  const client = new Anthropic({ apiKey });
  return {
    id: "anthropic",
    model: anthropicModel,
    pricing: ANTHROPIC_PRICING[anthropicModel] ?? null,
    enabled: true,
    async run(system, user, maxTokens) {
      // Adaptive thinking is the recommended default and is left on, so the
      // measured cost is the cost of using this model properly rather than a
      // flattering configuration. Thinking tokens are billed as output and
      // therefore show up in the cost column — that is the honest comparison.
      const msg = await client.messages.create({
        model: anthropicModel,
        max_tokens: maxTokens,
        system,
        thinking: { type: "adaptive" },
        output_config: { effort: effort as "low" | "medium" | "high" },
        messages: [{ role: "user", content: user }],
      });
      const text = msg.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("");
      return {
        text,
        inputTokens: msg.usage.input_tokens,
        outputTokens: msg.usage.output_tokens,
      };
    },
  };
}

function buildProviders(): Provider[] {
  const out: Provider[] = [];
  if (process.env.OPENAI_API_KEY) {
    out.push(openaiCompatible("openai", openaiModel, process.env.OPENAI_API_KEY, undefined,
      OPENAI_PRICING[openaiModel] ?? null));
  }
  if (process.env.ANTHROPIC_API_KEY) out.push(anthropicProvider(process.env.ANTHROPIC_API_KEY));
  if (process.env.DEEPSEEK_API_KEY) {
    // DeepSeek serves an OpenAI-compatible API. Pricing intentionally null —
    // it is not quoted here rather than quoted from memory and be wrong.
    out.push(openaiCompatible("deepseek", deepseekModel, process.env.DEEPSEEK_API_KEY,
      "https://api.deepseek.com", null));
  }
  return out;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
/** Same shape as the route's parser: models wrap JSON in prose or fences. */
function extractJSON(raw: string): unknown {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1]! : raw;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    return null;
  }
}

function costUsd(p: Pricing, inTok: number, outTok: number): number | null {
  if (!p) return null;
  return (inTok * p.input + outTok * p.output) / 1_000_000;
}

type Row = {
  anonId: string;
  provider: string;
  model: string;
  task: string;
  topic: string;
  ms: number;
  inputTokens: number;
  outputTokens: number;
  usd: number | null;
  parsed: boolean;
  /** Required fields absent or empty. [] is a fully usable artifact. */
  missing: string[];
  error?: string;
};

// ─── Run ─────────────────────────────────────────────────────────────────────
const providers = buildProviders();
if (providers.length === 0) {
  console.error(
    "No provider keys found. Set at least one of OPENAI_API_KEY, ANTHROPIC_API_KEY, DEEPSEEK_API_KEY.",
  );
  process.exit(1);
}

const runId = process.env.EVAL_RUN_ID || `run-${Date.now()}`;
const outDir = join("eval-out", runId);
mkdirSync(join(outDir, "raw"), { recursive: true });

console.log(`Providers: ${providers.map((p) => `${p.id}(${p.model})`).join(", ")}`);
console.log(`${LESSONS.length} lessons × ${TASKS.length} tasks × ${providers.length} providers`
  + ` = ${LESSONS.length * TASKS.length * providers.length} generations\n`);

const rows: Row[] = [];
const key: Record<string, Omit<Row, "anonId">> = {};
const mathItems: { anonId: string; text: string; answer: string; options: string[] }[] = [];
let n = 0;

for (const lesson of LESSONS) {
  for (const task of TASKS) {
    const user = task.build({ ...lesson, language: "arabic" });
    for (const provider of providers) {
      // Anonymised so the Arabic can be rated without knowing the author.
      const anonId = `s${String(++n).padStart(3, "0")}`;
      const started = Date.now();
      let row: Row;
      try {
        const c = await provider.run(SYSTEM_AR, user, task.maxTokens);
        const ms = Date.now() - started;
        const parsed = extractJSON(c.text);
        row = {
          anonId, provider: provider.id, model: provider.model, task: task.id,
          topic: lesson.topic, ms, inputTokens: c.inputTokens, outputTokens: c.outputTokens,
          usd: costUsd(provider.pricing, c.inputTokens, c.outputTokens),
          parsed: parsed !== null,
          missing: missingFields(task.id, parsed),
        };
        writeFileSync(join(outDir, "raw", `${anonId}.json`),
          JSON.stringify({ anonId, task: task.id, topic: lesson.topic, output: parsed ?? c.text }, null, 2));

        // Collect quiz questions for symbolic scoring.
        if (task.id === "quiz" && parsed && typeof parsed === "object") {
          const qs = (parsed as { questions?: unknown[] }).questions ?? [];
          for (const q of qs) {
            const qq = q as { text?: string; correctAnswer?: string; options?: string[] };
            if (typeof qq.text === "string" && typeof qq.correctAnswer === "string") {
              mathItems.push({
                anonId, text: qq.text, answer: qq.correctAnswer,
                options: Array.isArray(qq.options) ? qq.options : [],
              });
            }
          }
        }
      } catch (e) {
        row = {
          anonId, provider: provider.id, model: provider.model, task: task.id,
          topic: lesson.topic, ms: Date.now() - started, inputTokens: 0, outputTokens: 0,
          usd: null, parsed: false, missing: REQUIRED_FIELDS[task.id] ?? [],
          error: e instanceof Error ? e.message : String(e),
        };
      }
      rows.push(row);
      const { anonId: _drop, ...rest } = row;
      key[anonId] = rest;
      console.log(`${anonId} ${provider.id.padEnd(10)} ${task.id.padEnd(12)} ${lesson.topic.padEnd(22)}`
        + ` ${String(row.ms).padStart(6)}ms `
        + (row.error
          ? "ERROR: " + row.error.slice(0, 60)
          : !row.parsed
            ? "unparseable"
            : row.missing.length > 0
              ? `missing: ${row.missing.join(", ")}`
              : "ok"));
    }
  }
}

writeFileSync(join(outDir, "key.json"), JSON.stringify(key, null, 2));
writeFileSync(join(outDir, "math-items.json"), JSON.stringify(mathItems, null, 2));

// ─── Summary ─────────────────────────────────────────────────────────────────
const byProvider = new Map<string, Row[]>();
for (const r of rows) byProvider.set(r.provider, [...(byProvider.get(r.provider) ?? []), r]);

const lines: string[] = [];
lines.push(`# Provider evaluation — ${runId}\n`);
lines.push(`${LESSONS.length} lessons × ${TASKS.length} tasks, Arabic, using the shipped prompts.\n`);
// "parsed" and "complete" are different questions, so they get different
// columns: a model can return well-formed JSON that the app renders as an
// empty lesson plan.
lines.push("| provider | model | parsed | complete | median ms | total tokens | est. cost |");
lines.push("|---|---|---|---|---|---|---|");
for (const [id, rs] of byProvider) {
  const ok = rs.filter((r) => r.parsed).length;
  const complete = rs.filter((r) => r.parsed && r.missing.length === 0).length;
  const times = rs.map((r) => r.ms).sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)] ?? 0;
  const tokens = rs.reduce((s, r) => s + r.inputTokens + r.outputTokens, 0);
  const usd = rs.every((r) => r.usd === null)
    ? "—"
    : `$${rs.reduce((s, r) => s + (r.usd ?? 0), 0).toFixed(4)}`;
  lines.push(`| ${id} | ${rs[0]!.model} | ${ok}/${rs.length} | ${complete}/${rs.length} | ${median} | ${tokens} | ${usd} |`);
}
lines.push(`
## Next steps

1. **Symbolic scoring** — \`python3 artifacts/api-server/scripts/score-math.py ${outDir}\`
   runs every generated answer key through SymPy and reports a per-provider
   pass rate. That is the objective half.
2. **Blind Arabic rating** — read \`raw/*.json\` without opening \`key.json\`,
   rank them, and only then un-blind. Ideally have a teacher do this too.

\`ok/total\` counts responses that parsed as JSON at all — a model that writes
beautiful Arabic prose where the app expects JSON scores zero in production,
so this column is a gate, not a nicety.
`);
writeFileSync(join(outDir, "results.md"), lines.join("\n"));

console.log(`\n${lines.slice(2).join("\n")}`);
console.log(`\nWritten to ${outDir}/`);

/**
 * A run where nothing generated is a failed run, and must exit non-zero.
 *
 * The first real run proved the point: all twelve calls came back `429 You
 * exceeded your current quota`, every column read 0, and the job still
 * reported success — because the harness catches each error per row and then
 * exits cleanly. A green tick over a table of zeros is worse than a red one,
 * because the zeros look like a verdict on the model rather than on the
 * account's billing.
 *
 * Only a TOTAL failure fails the run. One provider being down must not throw
 * away the others' results, which cost real money to produce.
 */
const succeeded = rows.filter((r) => !r.error);
if (rows.length > 0 && succeeded.length === 0) {
  const reasons = [...new Set(rows.map((r) => r.error ?? "unknown"))];
  console.error(
    `\nEvery generation failed — nothing was produced.\n`
      + reasons.map((r) => `  • ${r}`).join("\n")
      + `\n\nA 429 quota message means the account has no credit, not that the`
      + ` model is unavailable. A 401 means the key; a 404 means the model id.\n`,
  );
  process.exitCode = 1;
}
