import { randomUUID } from "node:crypto";
import { Router, type Response } from "express";
import type { AuthenticatedRequest } from "../middlewares/auth.ts";
import { openai, generateImageBuffer } from "@workspace/integrations-openai-ai-server";
import { isPublicR2Configured, publicUrl, putPublicObject } from "../lib/r2.ts";
import { logger } from "../lib/logger";
import {
  SYSTEM_AR,
  systemPrompt,
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
  MAX_PROMPT_SLIDES,
  MAX_PROMPT_SLIDE_IMAGES,
  promptSlidesPromptAr,
  promptSlidesPromptEn,
} from "../lib/promptSlidesPrompt.ts";

import {
  AiBudgetExceededError,
  AiLiveModeOffError,
  AiUserQuotaExceededError,
  assertBudgetAvailable,
  assertLiveModeEnabled,
  assertUserQuotaAvailable,
  getGenerationModel,
  recordCacheHit,
  recordUsage,
  type GenerationDetail,
} from "../lib/aiBudget.ts";
import { normalizeEscapeCodes } from "../lib/escapeCodes.ts";
import { withGrounding, type Grounding } from "../lib/grounding.ts";
import { PROMPT_VERSION, generationKeys, normalizeText } from "../lib/generationKey.ts";
import {
  noteServed,
  readPool,
  readSeenArtifactIds,
  retireVariant,
  storeVariant,
} from "../lib/artifactCache.ts";
import { decideServe } from "../lib/variantPolicy.ts";
import { SingleFlight } from "../lib/singleFlight.ts";
import {
  OVERLAP_REJECT_ABOVE,
  normalizeAvoidInput,
  overlapRatio,
  signatureLines,
  variationBlock,
} from "../lib/variation.ts";
import { VARIANT_POOL_MAX } from "@workspace/db/schema";
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
 * Collapses concurrent identical misses into one model call.
 *
 * Keyed on `${strictKey}:${variantIndex}` — the artifact being asked for, not
 * the request asking for it. Thirty teachers in one training session hitting
 * the same lesson used to be thirty completions; they are now one, and the
 * other twenty-nine await it. See `singleFlight.ts` for why the unique index
 * on `ai_artifacts` is still needed on top of this.
 */
const inFlight = new SingleFlight<GenerateResult>();

type GenerateArgs = {
  kind: GenerationKind;
  systemPrompt: string;
  userPrompt: string;
  maxCompletionTokens: number;
  /** Post-grounding request body — what the prompt was built from. */
  body: Record<string, unknown>;
  /** Which language the variation directives should be written in. */
  isAr: boolean;
  userId?: string | null;
};

type GenerateResult = {
  content: unknown;
  /**
   * The `ai_artifacts` row this response came from, when there is one.
   *
   * Handed back to the client so a later "regenerate" can say which variant it
   * is replacing without the server having to infer it. That echo is what makes
   * regeneration work when the pool cannot be read at all, and on the very
   * first regeneration of a key — the paths where a server-side serve log has
   * nothing to say yet.
   */
  variantId?: string;
  /**
   * Set only when a cap turned a fresh generation into a pooled repeat.
   *
   * The teacher asked for something new and got something they may well have
   * seen before. Saying so is the whole difference between a graceful
   * degradation and a silent one: without this the screen would present a
   * month-old variant as newly generated, which is the same substitution the
   * provenance badge exists to prevent on the client side.
   */
  servedReason?: "quota" | "budget";
};

type Completion = {
  parsed: unknown;
  usage: { prompt_tokens?: number; completion_tokens?: number } | undefined | null;
};

/**
 * One completion, parsed and shape-checked.
 *
 * Spend is recorded by the caller, not here, because only the caller knows
 * which `ai_artifacts` row a completion ended up as — and that id is what makes
 * the row a serve log rather than just a cost line. The one thing recorded here
 * is a completion that failed the shape check: those tokens are spent too, and
 * a budget guard that forgets the calls that failed is one that can be walked
 * past by failing.
 */
async function completeOnce(args: {
  kind: GenerationKind;
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxCompletionTokens: number;
  detail: Omit<GenerationDetail, "artifactId">;
}): Promise<Completion> {
  const completion = await openai.chat.completions.create({
    model: args.model,
    max_completion_tokens: args.maxCompletionTokens,
    messages: [
      { role: "system", content: args.systemPrompt },
      { role: "user", content: args.userPrompt },
    ],
  });
  try {
    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = extractJSON(raw);
    // Valid JSON is not the same as a usable artifact. Without this the route
    // answered 200 with `{}` and the screen rendered a blank lesson plan. It
    // also guards the pool: an unusable artifact stored here would be served
    // to every teacher who asks for that lesson.
    assertUsableGeneration(args.kind, parsed);
    return { parsed, usage: completion.usage };
  } catch (err) {
    recordUsage(completion.usage, args.model, { ...args.detail, artifactId: null });
    throw err;
  }
}

/**
 * Ask both caps whether a live call is allowed, and hand back the refusal
 * rather than throwing it.
 *
 * Returning the error instead of raising it is what lets the caller choose to
 * serve a pooled repeat instead — a decision that needs to know a cap said no,
 * *and* still hold the original error in case there is nothing to fall back to.
 * Only the two cap errors are caught; anything else (a broken ledger query, say)
 * propagates, because "the guard itself failed" must not read as "the guard
 * said no".
 */
async function refusalFromCaps(
  userId: string | null | undefined,
): Promise<{ reason: "quota" | "budget"; error: Error } | null> {
  try {
    await assertUserQuotaAvailable(userId);
  } catch (err) {
    if (err instanceof AiUserQuotaExceededError) return { reason: "quota", error: err };
    throw err;
  }
  try {
    assertBudgetAvailable();
  } catch (err) {
    if (err instanceof AiBudgetExceededError) return { reason: "budget", error: err };
    throw err;
  }
  return null;
}

/**
 * Shared by every route below: gate on AI_LIVE_MODE, try the shared variant
 * pool, and only then gate on budget and call the model.
 *
 * The order matters. `assertBudgetAvailable()` used to run first; it now runs
 * after the cache lookup, so a spent budget still serves artifacts that cost
 * nothing to serve. `assertLiveModeEnabled()` stays first, deliberately: with
 * live mode off this API is meant to make no claim about AI content at all,
 * and quietly answering from a pool filled on some earlier day would undo the
 * one switch that says whether generation is real (see CLAUDE.md on the
 * provenance badge).
 *
 * On the ceiling: these were 1500–2000, which is tight for a full Arabic
 * lesson plan and outright breaks a reasoning model — reasoning tokens are
 * billed as output and count against the same ceiling, so the model can spend
 * the whole budget thinking and return a truncated object. The failure is
 * silent: `extractJSON` on a truncated response yields a partial object or
 * `{}`, the route answers 200, and the client renders an empty lesson plan.
 * Every caller passes `GENERATION_TOKENS`; the parameter is here so a task
 * that genuinely needs a different ceiling can have one.
 */
async function generateContent(args: GenerateArgs): Promise<GenerateResult> {
  assertLiveModeEnabled();
  const { kind, body, userId } = args;
  const model = getGenerationModel();
  const keys = generationKeys(kind, model, body);
  const regenerate = body.regenerate === true;
  const detail = { kind, promptVersion: PROMPT_VERSION, userId, ...keys };

  // Only a shareable request touches the pool at all. A request carrying the
  // teacher's own pasted material is neither read from nor written to it —
  // serving teacher A's document-derived worksheet to teacher B is a content
  // leak, not a cache hit.
  const [pool, seenIds] = keys.shareable
    ? await Promise.all([
        readPool(keys.strictKey),
        readSeenArtifactIds({ strictKey: keys.strictKey, userId }),
      ])
    : [{ variants: [], nextVariantIndex: 0, readable: false }, new Set<string>()];
  // The client tells us which variant it is holding. Unioned with the serve
  // log rather than replacing it: the log covers a teacher who saw this on
  // another device, the echo covers the case the log cannot know about yet.
  for (const id of clientHeldVariantIds(body)) seenIds.add(id);

  const decision = decideServe({
    variants: pool.variants,
    nextVariantIndex: pool.nextVariantIndex,
    readable: pool.readable,
    seenIds,
    regenerate,
    shareable: keys.shareable,
    poolMax: VARIANT_POOL_MAX,
  });

  if (decision.action === "serve") {
    noteServed(decision.artifact.id);
    // A row per hit, at zero cost. Without it the hit rate is invisible, and
    // so is the fact that this teacher has now seen this variant — which is
    // what stops their next regenerate handing the same paper back.
    recordCacheHit(model, { ...detail, artifactId: decision.artifact.id });
    logger.info(
      { kind, strictKey: keys.strictKey, variantIndex: decision.artifact.variantIndex },
      "generation served from the shared pool",
    );
    return { content: decision.artifact.content, variantId: decision.artifact.id };
  }

  // Both caps, and what to do when one of them says no.
  //
  // Placement is the point. This sits *after* the serve branch above, so a
  // teacher who is out of allowance still gets every pooled artifact, without
  // limit — the caps exist to bound what we pay OpenAI, and serving an artifact
  // another teacher already paid for costs nothing. `assertBudgetAvailable()`
  // was moved here for that reason already (see the note above); the per-user
  // check inherits it by standing on the same line.
  //
  // When a cap does refuse, prefer a repeat over a refusal. Reaching here means
  // the pool had nothing unseen — but "nothing unseen" is not "nothing at all",
  // and handing back a variant this teacher has seen before beats handing back
  // an error. `servedReason` is what keeps that honest; it must reach the
  // screen, or a degraded serve is indistinguishable from a fresh one.
  // No role is threaded here: /generate is teacher-only (requireRole in
  // routes/index.ts), so the teacher allowance is always the right one.
  //
  // This covers every route in this file. /generate/verified-derivative/* lives
  // in verifiedMath.ts and reaches the model through derivativeVerified.ts,
  // which checks the same allowance itself — its handlers now take the request
  // and pass `req.user.id` down, so those completions are both billed to a user
  // and bounded by one.
  const capRefusal = await refusalFromCaps(userId);
  if (capRefusal) {
    const fallback = pool.variants[0];
    if (fallback) {
      noteServed(fallback.id);
      recordCacheHit(model, { ...detail, artifactId: fallback.id });
      logger.info(
        { kind, strictKey: keys.strictKey, reason: capRefusal.reason },
        "cap reached — serving a pooled variant instead of generating",
      );
      return {
        content: fallback.content,
        variantId: fallback.id,
        servedReason: capRefusal.reason,
      };
    }
    // Nothing pooled to fall back to, so the refusal is the honest answer. The
    // original error is rethrown rather than a fresh one: it carries the real
    // spend and limit, and an error reconstructed here would report $0 of $0.
    throw capRefusal.error;
  }

  // What this teacher has already been shown for this key: the pooled variants
  // they were served, plus whatever the screen says it is holding. Only the
  // stems are sent — a whole prior worksheet in the prompt would cost more
  // input than the generation it is varying.
  const avoid = regenerate
    ? dedupe([
        ...pool.variants.filter((v) => seenIds.has(v.id)).flatMap((v) => signatureLines(v.content)),
        ...normalizeAvoidInput(body.avoid),
      ])
    : [];

  const run = async (): Promise<GenerateResult> => {
    const completionArgs = {
      kind,
      model,
      systemPrompt: args.systemPrompt,
      maxCompletionTokens: args.maxCompletionTokens,
      detail,
    };

    let chosen = await completeOnce({
      ...completionArgs,
      userPrompt:
        args.userPrompt
        + variationBlock({ variantIndex: decision.variantIndex, isArabic: args.isAr, avoid }),
    });

    const repeated = overlapRatio(signatureLines(chosen.parsed), avoid);
    if (repeated > OVERLAP_REJECT_ABOVE) {
      // The directive was read as a suggestion. Nothing further down would
      // know: the model returned a well-formed artifact and the route would
      // have answered 200 with the paper the teacher had just rejected.
      // Measuring it is the only thing that makes "regenerated" mean anything
      // — see CLAUDE.md on flags that describe an intention, not a result.
      logger.warn(
        { kind, strictKey: keys.strictKey, repeated: Number(repeated.toFixed(2)) },
        "regeneration repeated most of what the teacher had already seen — retrying once",
      );
      // The rejected attempt was still billed, and it is not the artifact that
      // gets stored, so it is recorded here with no artifact to its name.
      recordUsage(chosen.usage, model, { ...detail, artifactId: null });
      // One retry, not a loop: a second failure means the model has nothing
      // else to say about this lesson, and a third call would spend the
      // teacher's time to prove it. Whatever comes back is what is served.
      chosen = await completeOnce({
        ...completionArgs,
        userPrompt:
          args.userPrompt
          + variationBlock({
            variantIndex: decision.variantIndex,
            isArabic: args.isAr,
            avoid,
            insistent: true,
          }),
      });
    }

    // Stored only once, and only the artifact actually being served. Storing
    // inside the completion helper meant a retry wrote the *rejected* attempt
    // into the pool first and then lost the slot to its own unique index — so
    // every teacher after inherited the repetitive paper and the teacher who
    // paid for the good one got it unstored.
    const artifactId = decision.store ? await storeVariant({
      strictKey: keys.strictKey,
      coarseKey: keys.coarseKey,
      kind,
      model,
      promptVersion: PROMPT_VERSION,
      language: typeof body.language === "string" ? body.language : "arabic",
      lessonRef: lessonRefOf(body),
      variantIndex: decision.variantIndex,
      content: chosen.parsed,
    }) : null;

    recordUsage(chosen.usage, model, { ...detail, artifactId });
    return { content: chosen.parsed, variantId: artifactId ?? undefined };
  };

  return inFlight.run(`${keys.strictKey}:${decision.variantIndex}`, run);
}

/** Variant ids the client says it already holds. Sanitised: this is
 *  request-controlled, and it is only ever compared against ids read out of
 *  the pool, never queried with. */
function clientHeldVariantIds(body: Record<string, unknown>): string[] {
  const raw = body.excludeVariantIds ?? body.variantId;
  const list = Array.isArray(raw) ? raw : [raw];
  return list.filter((v): v is string => typeof v === "string" && v.length > 0 && v.length <= 64);
}

function dedupe(lines: string[]): string[] {
  return [...new Set(lines)];
}

/**
 * Whether this lesson has student-book figures that will actually be printed.
 *
 * The client knows; the server cannot. The crops live in
 * `knowledge-base/<grade>-<subject>/figures/` and are joined to a lesson by
 * `figure-lesson-map.json`, both of which are bundled into the app — the API
 * has no copy of either and no way to resolve one. So the generator screens
 * send the count they already compute for the export appendix, and this reads
 * it.
 *
 * Fail closed on anything unexpected. Missing, zero or non-numeric means "no
 * figures", which selects the stricter prompt — the one that forbids referring
 * to a figure at all. Wrong in the permissive direction would print «انظر
 * الشكل المجاور» on a paper with no figure anywhere on it, which is the exact
 * bug the graph rule was written to stop.
 */
function hasBookFigures(body: Record<string, unknown>): boolean {
  const n = body.bookFigureCount;
  return typeof n === "number" && Number.isFinite(n) && n > 0;
}

/** How the pool is browsed by a human — the lesson this artifact belongs to.
 *  Not part of the key, so an imperfect value costs nothing but readability. */
function lessonRefOf(body: Record<string, unknown>): string {
  const id = typeof body.lessonId === "string" ? body.lessonId.trim() : "";
  if (id) return id;
  return typeof body.topic === "string" ? normalizeText(body.topic).slice(0, 200) : "";
}

/**
 * Hand the citations, and the variant's id, back with the artifact.
 *
 * The page numbers exist so a teacher can hold the generated worksheet against
 * the printed book; stopping them at the prompt would waste the only part of
 * retrieval a human can check. `variantId` is the handle the screen sends back
 * when the teacher presses regenerate, so the server knows which of the pool's
 * variants not to hand them again. `servedReason` says a cap turned this into a
 * pooled repeat. Additive — every existing field is untouched, and an ungrounded
 * generation is returned exactly as it was.
 *
 * Takes the whole `GenerateResult` rather than its fields one at a time: the
 * meta it attaches grows (this is the second field), and a positional parameter
 * per field means every one of the seven routes below has to be edited to pass
 * something it does not otherwise care about.
 */
function withMeta(result: GenerateResult, grounding: Grounding | null): unknown {
  const { content, variantId, servedReason } = result;
  if (typeof content !== "object" || content === null) return content;
  if (!grounding && !variantId && !servedReason) return content;
  return {
    ...content,
    ...(grounding ? { sources: grounding.sources } : {}),
    ...(variantId ? { variantId } : {}),
    ...(servedReason ? { servedReason } : {}),
  };
}

/**
 * AI live-mode-off and cap-exceeded are expected, user-facing states — not
 * server errors.
 *
 * Every one of them carries a `code`, matching evaluations.ts. The API answers
 * in English and the app is Arabic, so the code is the only thing the client can
 * translate from without matching on message text — and these three mean three
 * different things to a teacher ("wait a month", "we're switched off", "try
 * again"), which a single generic failure message flattens into one.
 *
 * Reaching the two cap branches here means the pool had nothing to fall back on
 * — generateContent serves a repeat when it can (see refusalFromCaps). So this
 * really is "there is nothing for you", not merely "you are capped".
 */
function respondAiError(err: unknown, res: Response, label: string): void {
  if (err instanceof AiLiveModeOffError) {
    res.status(503).json({ error: err.message, code: "live_mode_off" });
    return;
  }
  if (err instanceof AiUserQuotaExceededError) {
    res.status(429).json({ error: err.message, code: "user_quota_exceeded" });
    return;
  }
  if (err instanceof AiUserQuotaExceededError) {
    res.status(429).json({ error: err.message, code: "user_quota_exceeded" });
    return;
  }
  if (err instanceof AiBudgetExceededError) {
    res.status(429).json({ error: err.message, code: "budget_exceeded" });
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
    const result = await generateContent({
      kind: "lesson-plan", systemPrompt: systemPrompt(isAr, { hasBookFigures: hasBookFigures(body) }), userPrompt: prompt,
      maxCompletionTokens: GENERATION_TOKENS, body, isAr, userId: req.user?.id,
    });
    res.json(withMeta(result, grounding));
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
    const result = await generateContent({
      kind: "worksheet", systemPrompt: systemPrompt(isAr, { hasBookFigures: hasBookFigures(body) }), userPrompt: prompt,
      maxCompletionTokens: GENERATION_TOKENS, body, isAr, userId: req.user?.id,
    });
    res.json(withMeta(result, grounding));
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
    const result = await generateContent({
      kind: "quiz", systemPrompt: systemPrompt(isAr, { hasBookFigures: hasBookFigures(body) }), userPrompt: prompt,
      maxCompletionTokens: GENERATION_TOKENS, body, isAr, userId: req.user?.id,
    });
    res.json(withMeta(result, grounding));
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
    // `homework: true` rides on the key body as well as the prompt — a homework
    // and a worksheet for one lesson are different artifacts, and the pool must
    // not hand one out for the other.
    const result = await generateContent({
      kind: "homework", systemPrompt: systemPrompt(isAr, { hasBookFigures: hasBookFigures(body) }), userPrompt: prompt,
      maxCompletionTokens: GENERATION_TOKENS, body: { ...body, homework: true }, isAr,
      userId: req.user?.id,
    });
    res.json(withMeta(result, grounding));
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
    const result = await generateContent({
      kind: "activity", systemPrompt: systemPrompt(isAr, { hasBookFigures: hasBookFigures(body) }), userPrompt: prompt,
      maxCompletionTokens: GENERATION_TOKENS, body, isAr, userId: req.user?.id,
    });
    res.json(withMeta(result, grounding));
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
    const result = await generateContent({
      kind: "classroom-activity", systemPrompt: systemPrompt(isAr, { hasBookFigures: hasBookFigures(body) }), userPrompt: prompt,
      maxCompletionTokens: GENERATION_TOKENS, body, isAr, userId: req.user?.id,
    });
    // Applied on the way out, to pooled and freshly generated decks alike —
    // what is stored is the model's own output, so a deck served from the pool
    // has to pass the same two filters the day it is served, not the day it
    // was made.
    //
    // The escape deck's unlock codes are the activity's only mechanic and the
    // app never validates them, so an unreadable or repeated digit ships as-is.
    // A no-op for every other activity type. See lib/escapeCodes.ts.
    const withCodes = normalizeEscapeCodes(result.content, isAr);
    // No live call runs a verifier over its own output, so any "verified"
    // fields a model invented are unearned. See stripUnearnedVerification.
    res.json(
      withMeta({ ...result, content: stripUnearnedVerification(withCodes) }, grounding),
    );
  } catch (err) {
    respondAiError(err, res, "generate classroom-activity");
  }
});


/**
 * Turns `mediaPrompt`s from `/generate/prompt-slides` into real images, and
 * enforces the slide-count and per-deck image caps stated in the prompt (a
 * belt-and-suspenders backstop — the model does not always obey slide-count
 * instructions, and nothing else here would catch it).
 *
 * A slide beyond the image cap, one whose `mediaPrompt` is missing, or one
 * whose image generation fails is downgraded to a plain `'intro'` slide (the
 * type this JSON contract already uses for plain explanatory text — see
 * `classroomPrompts.ts`'s own quick-check intro slide; `ActivitySlide.type`
 * has no separate "content" member, so writing one here would render as
 * nothing in `presentation.tsx`) rather than failing the whole request — the
 * deck is still usable without that one picture. Images go to the public
 * bucket (`putPublicObject`/`publicUrl`), not the signed-URL private one: a
 * deck reopened weeks after generation needs a link that has not expired.
 */
async function finalizePromptSlides(content: unknown): Promise<unknown> {
  if (content === null || typeof content !== "object" || Array.isArray(content)) return content;
  const deck = content as Record<string, unknown>;
  const slides = deck.slides;
  if (!Array.isArray(slides)) return content;

  const truncated = slides.slice(0, MAX_PROMPT_SLIDES);
  const canGenerateImages = isPublicR2Configured();
  let imagesUsed = 0;

  const finished = await Promise.all(truncated.map(async (raw) => {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return raw;
    const slide = raw as Record<string, unknown>;
    if (slide.type !== "media") return slide;

    const { mediaPrompt, ...rest } = slide;
    const trimmedPrompt = typeof mediaPrompt === "string" ? mediaPrompt.trim() : "";
    if (!canGenerateImages || !trimmedPrompt || imagesUsed >= MAX_PROMPT_SLIDE_IMAGES) {
      return { ...rest, type: "intro" };
    }
    imagesUsed += 1;
    try {
      const buffer = await generateImageBuffer(trimmedPrompt);
      const key = `deck-images/${randomUUID()}.png`;
      await putPublicObject(key, buffer, "image/png");
      const url = publicUrl(key);
      if (!url) throw new Error("R2 public base URL not configured");
      return { ...rest, mediaUrl: url, mediaKind: "image" };
    } catch (err) {
      logger.warn({ err }, "prompt-slides image generation failed");
      return { ...rest, type: "intro" };
    }
  }));

  return { ...deck, slides: finished };
}

// ─── Prompt Slides route ───────────────────────────────────────────────────────
// The teacher's own free-text prompt IS the spec — there is no curriculum
// lesson to ground this in, unlike every other route here. The prompt is
// carried as `additionalContext` with `contextSource` forced to `'teacher'`
// *server-side*, ignoring anything the client sent for that field: this is
// what makes `generationKeys()` (lib/generationKey.ts) mark the request
// unshareable so it never touches the `ai_artifacts` pool. Skipping this would
// serve one teacher's prompt — and the deck built from it — verbatim to
// another teacher out of the shared pool. See CLAUDE.md: "A shared artifact
// makes every generator bug everybody's bug" — this route has no business
// being in that pool at all.
generateRouter.post('/generate/prompt-slides', async (req: AuthenticatedRequest, res) => {
  const reqBody = req.body as Record<string, unknown>;
  const isAr = reqBody.language === 'arabic';
  const prompt = typeof reqBody.prompt === 'string' ? reqBody.prompt.trim() : '';
  if (!prompt) {
    res.status(400).json({ error: 'prompt is required' });
    return;
  }
  const body: Record<string, unknown> = {
    ...reqBody,
    additionalContext: prompt,
    contextSource: 'teacher',
  };
  try {
    const userPrompt = (isAr ? promptSlidesPromptAr(body) : promptSlidesPromptEn(body))
      + classroomSetupClause(body, isAr);
    const result = await generateContent({
      kind: "prompt-slides", systemPrompt: systemPrompt(isAr), userPrompt,
      maxCompletionTokens: GENERATION_TOKENS, body, isAr, userId: req.user?.id,
    });
    const finalized = await finalizePromptSlides(result.content);
    res.json(
      withMeta({ ...result, content: stripUnearnedVerification(finalized) }, null),
    );
  } catch (err) {
    respondAiError(err, res, "generate prompt-slides");
  }
});


/**
 * Take a pooled artifact out of circulation.
 *
 * This is the safety valve for sharing. One bad worksheet used to cost one
 * teacher a regeneration; pooled, it reaches every teacher who asks for that
 * lesson until somebody notices. A retired row is never served again and its
 * slot is never reused, so the next request for that key generates into a
 * fresh one.
 *
 * Open to any authenticated teacher, not to admins only. The person holding
 * the bad paper is the person who knows it is bad, and routing that through an
 * operator means it stays in the pool for as long as the round trip takes. The
 * downside is bounded in a way the alternative is not: the worst a wrong call
 * does is spend one generation regenerating something that was fine.
 *
 * Under /generate/* so it inherits the auth guard the classroom-activity route
 * once escaped by being mounted bare — see the note above that route.
 */
generateRouter.post("/generate/variants/:id/retire", async (req: AuthenticatedRequest, res) => {
  // Express types this as `string | string[]`; a repeated :id would otherwise
  // reach a uuid comparison as an array.
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (typeof id !== "string" || !id) {
    res.status(404).json({ error: "No pooled variant to retire." });
    return;
  }
  const retired = await retireVariant(id);
  if (!retired) {
    // 404 for "no such variant" and for "already retired" alike: both mean
    // there is nothing in the pool under that id any more, which is what the
    // caller wanted, and telling the two apart says which ids exist.
    res.status(404).json({ error: "No pooled variant to retire." });
    return;
  }
  logger.warn({ artifactId: id, userId: req.user?.id }, "pooled artifact retired by a teacher");
  res.json({ retired: true });
});

export default generateRouter;
