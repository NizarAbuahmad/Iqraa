/**
 * Automated validation of generated exams and slide decks over a fixed golden
 * set of units — no people.
 *
 * Per unit, through the SHIPPED path (same prompts, same parser):
 *  • an exam: `validateGenerated` + `verifyAnswerKeys` + `checkGrounding`
 *  • a deck:  the `/generate/prompt-slides` prompt + `checkDeck`
 *
 * Teaching plans are not here: `autoScheduleEntries` is deterministic, so its
 * sweep over every real class is a plain test
 * (`artifacts/mobile/services/__tests__/planChecks.test.ts`) and runs in CI.
 *
 * Hard failures (exit 1): a question the validator rejects, a key the SymPy
 * verifier contradicts, or a deck `error` (correctIndex out of range, a slide
 * with no teacher block, ...). Those are regressions — rerun on every prompt or
 * model change and compare.
 * Soft signals (printed, exit 0): answers/slides with weak book support, deck
 * warnings, and the share of keys SymPy actually judged. They rank what a
 * person should read; they do not prove anything is wrong.
 *
 * Run (live model, spends tokens — about two calls per unit):
 *   OPENAI_API_KEY=... node --experimental-strip-types  *     artifacts/api-server/scripts/validate-outputs.ts [--units 8] [--out report.json]
 *
 * Only units with extracted book text are used: with no text there is nothing
 * to ground against and the result would say nothing.
 */
import { writeFileSync } from "node:fs";
import OpenAI from "openai";
import { getAllObjectives, getObjectivesForUnit, getUnitById } from "@workspace/curriculum";
import { passagesForUnit, repairExtractionArtifacts } from "@workspace/curriculum/passages";
import { groundingForObjectives } from "../src/lib/grounding.ts";
import { extractJSON } from "../src/lib/generationShape.ts";
import { getGenerationModel, getPromptSlidesModel } from "../src/lib/aiBudget.ts";
import { SYSTEM_AR } from "../src/lib/prompts.ts";
import { promptSlidesPromptAr } from "../src/lib/promptSlidesPrompt.ts";
import { checkDeck } from "../src/lib/deckChecks.ts";
import { relateAnswerKey } from "../src/lib/mathVerifierClient.ts";
import { generateWithModel } from "../src/modules/assessment/llmGenerator.ts";
import { validateGenerated } from "../src/modules/assessment/validator.ts";
import { verifyAnswerKeys } from "../src/modules/assessment/keyVerification.ts";
import { checkGrounding, claimText } from "../src/modules/assessment/groundingCheck.ts";

const arg = (name: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};
const UNIT_CAP = Number(arg("units") ?? 8);
const COUNT = 10;
const TYPES = ["multiple_choice", "true_false", "fill_blank", "short_answer"] as const;

if (!process.env.OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is not set — this script generates live and cannot run without it.");
  process.exit(2);
}
const openai = new OpenAI();

// Sorted, so the golden set is the same units on every run.
const unitIds = [...new Set(getAllObjectives().map(o => o.unitId))]
  .sort()
  .filter(id => passagesForUnit({ unitId: id, limit: 1, quotableOnly: true }).length > 0)
  .slice(0, UNIT_CAP);

let hardFailures = 0;
const report: unknown[] = [];

for (const unitId of unitIds) {
  const objectives = getObjectivesForUnit(unitId);
  const grounding = groundingForObjectives(objectives, true);
  // Wider than the three pages the prompt carried: a correct answer drawn from
  // a neighbouring page is not a hallucination, and this keeps it from reading as one.
  const source = passagesForUnit({ unitId, limit: 12, quotableOnly: true })
    .map(p => repairExtractionArtifacts(p.text))
    .join("\n");

  const gen = await generateWithModel(
    {
      objectives,
      assessmentTypes: [...TYPES],
      count: COUNT,
      difficulty: "standard",
      language: "ar",
      bookExcerpts: grounding?.block,
    },
    async prompt => {
      const model = getGenerationModel();
      const c = await openai.chat.completions.create({
        model,
        max_completion_tokens: 8000,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
      });
      return { parsed: extractJSON(c.choices[0]?.message?.content ?? "{}"), model };
    },
  );

  const valid = validateGenerated(gen.questions, {
    allowedObjectiveIds: objectives.map(o => o.id),
    allowedTypes: [...TYPES],
  });
  const keys = await verifyAnswerKeys(valid.accepted, relateAnswerKey);
  const kept = keys.kept.map(k => k.question);
  const verdicts = checkGrounding(kept, source);
  const weak = verdicts.filter(v => v.status === "weak");

  hardFailures += valid.rejected.length + keys.dropped.length;
  console.log(
    `${unitId}: asked ${COUNT}, got ${gen.questions.length}, rejected ${valid.rejected.length}, `
      + `key-contradicted ${keys.dropped.length}, keys checked ${keys.checked}/${kept.length}, `
      + `weak book support ${weak.length}`,
  );
  for (const v of weak) console.log(`  weak (${v.support!.toFixed(2)}): ${claimText(kept[v.index]!)}`);
  for (const r of valid.rejected) console.log(`  REJECTED #${r.index + 1}: ${r.reason}`);
  for (const d of keys.dropped) console.log(`  KEY WRONG #${d.index + 1}: ${d.reason}`);

  // Deck, same unit, same book text.
  const unitName = getUnitById(unitId)?.nameAr ?? unitId;
  const deckCall = await openai.chat.completions.create({
    model: getPromptSlidesModel(),
    // A full Arabic deck with teacher blocks does not fit 8k once reasoning
    // tokens bill against the same ceiling.
    max_completion_tokens: 16000,
    messages: [
      { role: "system", content: SYSTEM_AR },
      { role: "user", content: promptSlidesPromptAr({ additionalContext: `حصة عن: ${unitName}` }) },
    ],
  });
  let deckIssues: ReturnType<typeof checkDeck>;
  try {
    deckIssues = checkDeck(extractJSON(deckCall.choices[0]?.message?.content ?? "{}"), source);
  } catch {
    deckIssues = [{ severity: "error", code: "unparseable_json" }];
  }
  const deckErrors = deckIssues.filter(i => i.severity === "error");
  hardFailures += deckErrors.length;
  console.log(`  deck: ${deckErrors.length} error(s), ${deckIssues.length - deckErrors.length} warning(s)`);
  for (const i of deckIssues) {
    const where = i.slide ? ` @${i.slide}` : "";
    console.log(`    ${i.severity === "error" ? "DECK ERROR" : "deck warn"} ${i.code}${where}${i.detail ? ` — ${i.detail}` : ""}`);
  }

  report.push({ unitId, model: gen.model, rejected: valid.rejected, dropped: keys.dropped, weak, verdicts, deckIssues });
}

const out = arg("out");
if (out) writeFileSync(out, JSON.stringify(report, null, 2));
console.log(hardFailures === 0 ? "\nNo hard failures." : `\n${hardFailures} hard failure(s).`);
process.exit(hardFailures === 0 ? 0 : 1);
