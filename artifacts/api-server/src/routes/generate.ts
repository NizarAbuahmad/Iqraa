import { Router, type Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth.ts";
import { openai } from "@workspace/integrations-openai-ai-server";
import { logger } from "../lib/logger";
import {
  SYSTEM_AR,
  SYSTEM_EN,
  activityPromptAr,
  activityPromptEn,
  lessonPlanPromptAr,
  lessonPlanPromptEn,
  quizPromptAr,
  quizPromptEn,
  worksheetPromptAr,
  worksheetPromptEn,
} from "../lib/prompts.ts";
import {
  classroomPromptAr,
  classroomPromptEn,
  classroomSetupClause,
  stripUnearnedVerification,
} from "../lib/classroomPrompts.ts";

import {
  AiBudgetExceededError,
  AiLiveModeOffError,
  assertBudgetAvailable,
  assertLiveModeEnabled,
  getGenerationModel,
  recordUsage,
} from "../lib/aiBudget.ts";
import { normalizeEscapeCodes } from "../lib/escapeCodes.ts";
import { withGrounding, type Grounding } from "../lib/grounding.ts";
import { PROMPT_VERSION, generationKeys } from "../lib/generationKey.ts";
import {
  assertUsableGeneration,
  extractJSON,
  UnusableGenerationError,
  type GenerationKind,
} from "../lib/generationShape.ts";

const generateRouter = Router();

/**
 * Output ceiling for a generated artifact.
 *
 * Generous on purpose: the cost of a ceiling that is too high is a few unused
 * tokens; the cost of one that is too low is a truncated artifact that looks
 * like a successful generation. The budget guard, not this number, is what
 * limits spend.
 */
const GENERATION_TOKENS = 8000;

/**
 * Shared by every route below: gate on AI_LIVE_MODE + budget, call the model,
 * parse JSON out.
 *
 * On the ceiling: these were 1500–2000, which is tight for a full Arabic
 * lesson plan and outright breaks a reasoning model — reasoning tokens are
 * billed as output and count against the same ceiling, so the model can spend
 * the whole budget thinking and return a truncated object. The failure is
 * silent: `extractJSON` on a truncated response yields a partial object or
 * `{}`, the route answers 200, and the client renders an empty lesson plan.
 * The ceiling is now set per task below with room for that.
 */
async function generateContent(
  kind: GenerationKind,
  systemPrompt: string,
  userPrompt: string,
  maxCompletionTokens: number,
  body: Record<string, unknown> = {},
  userId?: string | null,
): Promise<unknown> {
  assertLiveModeEnabled();
  assertBudgetAvailable();
  const model = getGenerationModel();
  const completion = await openai.chat.completions.create({
    model,
    max_completion_tokens: maxCompletionTokens,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });
  // The keys are recorded, not consulted — nothing caches yet. They are what
  // lets the repeat rate be measured from history instead of estimated.
  const keys = generationKeys(kind, model, body);
  recordUsage(completion.usage, model, {
    kind,
    promptVersion: PROMPT_VERSION,
    userId,
    ...keys,
  });
  const raw = completion.choices[0]?.message?.content ?? "{}";
  const parsed = extractJSON(raw);
  // Valid JSON is not the same as a usable artifact. Without this the route
  // answered 200 with `{}` and the screen rendered a blank lesson plan.
  assertUsableGeneration(kind, parsed);
  return parsed;
}

/**
 * Hand the citations back with the artifact.
 *
 * The page numbers exist so a teacher can hold the generated worksheet against
 * the printed book; stopping them at the prompt would waste the only part of
 * retrieval a human can check. Additive — every existing field is untouched,
 * and an ungrounded generation is returned exactly as it was.
 */
function withSources(parsed: unknown, grounding: Grounding | null): unknown {
  if (!grounding || typeof parsed !== "object" || parsed === null) return parsed;
  return { ...parsed, sources: grounding.sources };
}

/** AI live-mode-off and budget-exceeded are expected, user-facing states — not server errors. */
function respondAiError(err: unknown, res: Response, label: string): void {
  if (err instanceof AiLiveModeOffError) {
    res.status(503).json({ error: err.message });
    return;
  }
  if (err instanceof AiBudgetExceededError) {
    res.status(429).json({ error: err.message });
    return;
  }
  if (err instanceof UnusableGenerationError) {
    // 502, not 500: the request was fine, the upstream reply was not. Naming
    // the missing fields is the point — a bare "generation failed" is how this
    // stayed invisible for as long as it did.
    logger.error({ kind: err.kind, missing: err.missing }, `${label} returned an unusable shape`);
    res.status(502).json({ error: err.message, missing: err.missing });
    return;
  }
  logger.error({ err }, `${label} error`);
  res.status(500).json({ error: "AI generation failed. Please try again." });
}

// ─── Lesson Plan ─────────────────────────────────────────────────────────────
generateRouter.post("/generate/lesson-plan", async (req: AuthenticatedRequest, res) => {
  try {
    const isAr = req.body.language !== "english";
    const { body, grounding } = withGrounding(req.body, isAr);
    const prompt = isAr ? lessonPlanPromptAr(body) : lessonPlanPromptEn(body);
    const parsed = await generateContent("lesson-plan", isAr ? SYSTEM_AR : SYSTEM_EN, prompt, GENERATION_TOKENS, body, req.user?.id);
    res.json(withSources(parsed, grounding));
  } catch (err) {
    respondAiError(err, res, "generate lesson-plan");
  }
});

// ─── Worksheet ────────────────────────────────────────────────────────────────
generateRouter.post("/generate/worksheet", async (req: AuthenticatedRequest, res) => {
  try {
    const isAr = req.body.language !== "english";
    const { body, grounding } = withGrounding(req.body, isAr);
    const prompt = isAr ? worksheetPromptAr(body) : worksheetPromptEn(body);
    const parsed = await generateContent("worksheet", isAr ? SYSTEM_AR : SYSTEM_EN, prompt, GENERATION_TOKENS, body, req.user?.id);
    res.json(withSources(parsed, grounding));
  } catch (err) {
    respondAiError(err, res, "generate worksheet");
  }
});

// ─── Quiz ─────────────────────────────────────────────────────────────────────
generateRouter.post("/generate/quiz", async (req: AuthenticatedRequest, res) => {
  try {
    const isAr = req.body.language !== "english";
    const { body, grounding } = withGrounding(req.body, isAr);
    const prompt = isAr ? quizPromptAr(body) : quizPromptEn(body);
    const parsed = await generateContent("quiz", isAr ? SYSTEM_AR : SYSTEM_EN, prompt, GENERATION_TOKENS, body, req.user?.id);
    res.json(withSources(parsed, grounding));
  } catch (err) {
    respondAiError(err, res, "generate quiz");
  }
});

// ─── Homework ─────────────────────────────────────────────────────────────────
generateRouter.post("/generate/homework", async (req: AuthenticatedRequest, res) => {
  try {
    const isAr = req.body.language !== "english";
    const { body, grounding } = withGrounding(req.body, isAr);
    const prompt = isAr ? worksheetPromptAr({ ...body, homework: true }) : worksheetPromptEn({ ...body, homework: true });
    const parsed = await generateContent("homework", isAr ? SYSTEM_AR : SYSTEM_EN, prompt, GENERATION_TOKENS, body, req.user?.id);
    res.json(withSources(parsed, grounding));
  } catch (err) {
    respondAiError(err, res, "generate homework");
  }
});

// ─── Activity ─────────────────────────────────────────────────────────────────
generateRouter.post("/generate/activity", async (req: AuthenticatedRequest, res) => {
  try {
    const isAr = req.body.language !== "english";
    const { body, grounding } = withGrounding(req.body, isAr);
    const prompt = isAr ? activityPromptAr(body) : activityPromptEn(body);
    const parsed = await generateContent("activity", isAr ? SYSTEM_AR : SYSTEM_EN, prompt, GENERATION_TOKENS, body, req.user?.id);
    res.json(withSources(parsed, grounding));
  } catch (err) {
    respondAiError(err, res, "generate activity");
  }
});


// ─── Classroom Activity route ─────────────────────────────────────────────────
// Every other route in this file is under /generate/*, which is exactly the
// prefix routes/index.ts scopes authMiddleware to. This one was registered
// bare, at /classroom-activity, so it never went through the guard — an
// unauthenticated, unlimited proxy onto the OpenAI account. Same failure
// shape as the roster/evaluations mount-order incident; see routes/index.ts.
generateRouter.post('/generate/classroom-activity', async (req: AuthenticatedRequest, res) => {
  const isAr = (req.body as Record<string, unknown>).language === 'arabic';
  const { body, grounding } = withGrounding(req.body as Record<string, unknown>, isAr);
  try {
    const prompt = (isAr ? classroomPromptAr(body) : classroomPromptEn(body))
      + classroomSetupClause(body, isAr);
    const data = await generateContent("classroom-activity", isAr ? SYSTEM_AR : SYSTEM_EN, prompt, GENERATION_TOKENS, body, req.user?.id);
    // The escape deck's unlock codes are the activity's only mechanic and the
    // app never validates them, so an unreadable or repeated digit ships as-is.
    // A no-op for every other activity type. See lib/escapeCodes.ts.
    const withCodes = normalizeEscapeCodes(data, isAr);
    // No live call runs a verifier over its own output, so any "verified"
    // fields a model invented are unearned. See stripUnearnedVerification.
    res.json(withSources(stripUnearnedVerification(withCodes), grounding));
  } catch (err) {
    respondAiError(err, res, "generate classroom-activity");
  }
});


export default generateRouter;
