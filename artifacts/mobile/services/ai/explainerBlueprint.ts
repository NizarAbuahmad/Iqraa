/**
 * The offline blueprint for «تبسيط الشرح» — a handout written for the student.
 *
 * Kept out of `generators.ts` for the same reason `activityBlueprints.ts` is:
 * it is pure, it loads under `node --test`, and the format it defines has a
 * twin on the server (`EXPLAINER_RULES_AR`/`_EN` in
 * `artifacts/api-server/src/lib/prompts.ts`). Both must move together, or a
 * teacher gets a different kind of handout depending on whether live
 * generation happened to be on — see CLAUDE.md.
 *
 * The rule this file follows throughout: **never fabricate curriculum**. Every
 * sentence here is either quoted from the lesson (summary, concepts, rules,
 * key terms), drawn from the reviewed concrete bank, or a generic study-skill
 * instruction that names the topic and claims nothing about it. A plausible
 * invented definition is the one failure mode a student cannot detect.
 */
import type {
  Misconception, SelfCheckItem, SimplifiedExplanationOutput,
  SimplifiedKeyWord, WorkedExample,
} from './AIService.ts';
import type { KBLesson } from '../knowledgeBase.ts';
import type { DocumentGrounding } from '../documents/grounding.ts';
import type { Lang, PracticeWQ } from './mathPractice.ts';

/**
 * The shape both paths promise.
 *
 * `simplifiedExplanationPrompts.test.ts` asserts the live prompt states these
 * same numbers, so a change here that is not mirrored there fails the build
 * rather than quietly producing two different formats.
 */
export const EXPLAINER_SHAPE = { minSteps: 3, maxSteps: 5, checks: 3 } as const;

export interface ExplainerContext {
  topic: string;
  lang: Lang;
  /** Whether the concrete math bank applies — decides worked example and checks. */
  math: boolean;
  /** The item the worked example is built from. Null when the bank had none. */
  workedItem: PracticeWQ | null;
  /** A multiple-choice item whose distractors are hand-authored misconceptions. */
  misconceptionItem: PracticeWQ | null;
  /** Items for the self-checks. May be short or empty; padded honestly. */
  practice: PracticeWQ[];
  /** The grounded lesson, when the topic resolved to one. */
  kb: KBLesson | null;
  docs: DocumentGrounding;
}

/** Everything the blueprint decides; the generator adds grade and subject. */
export type ExplainerBody =
  Omit<SimplifiedExplanationOutput, 'grade' | 'subject' | 'sources' | 'variantId'>;

// ── sources of truth, in priority order ────────────────────────────────────

function conceptsOf(ctx: ExplainerContext): string[] {
  if (ctx.docs.present && ctx.docs.concepts.length) return ctx.docs.concepts;
  const kb = ctx.kb;
  if (!kb) return [];
  return (ctx.lang === 'ar' ? kb.keyConceptsAr : kb.keyConceptsEn) ?? [];
}

function rulesOf(ctx: ExplainerContext): string[] {
  const kb = ctx.kb;
  if (!kb) return [];
  return (ctx.lang === 'ar' ? kb.rulesAr : kb.rulesEn) ?? [];
}

function termsOf(ctx: ExplainerContext): SimplifiedKeyWord[] {
  const ar = ctx.lang === 'ar';
  return (ctx.kb?.keyTerms ?? [])
    .map(t => ({
      term: (ar ? t.ar : t.en)?.trim() ?? '',
      meaning: (ar ? t.definitionAr : t.definitionEn)?.trim() ?? '',
    }))
    .filter(t => t.term.length > 0 && t.meaning.length > 0);
}

function bigIdeaOf(ctx: ExplainerContext): string {
  const ar = ctx.lang === 'ar';
  const summary = (
    ctx.docs.summary?.trim()
    || (ar ? ctx.kb?.summaryAr : ctx.kb?.summaryEn)?.trim()
  );
  if (summary) return summary;
  // Nothing grounded this topic. Say what the handout is about without
  // asserting anything about the subject matter.
  return ar
    ? `هذه الورقة تشرح «${ctx.topic}» خطوة بخطوة، بأبسط صياغة ممكنة.`
    : `This sheet explains “${ctx.topic}” step by step, in the plainest wording possible.`;
}

/** Generic study-skill steps: they name the topic and claim nothing about it. */
function genericSteps(ctx: ExplainerContext): string[] {
  const ar = ctx.lang === 'ar';
  return ar
    ? [
        `اقرأ السؤال وحدّد بالضبط ما هو المطلوب في «${ctx.topic}».`,
        'اكتب المعطيات التي بين يديك قبل أن تبدأ الحل.',
        'نفّذ خطوة واحدة في كل مرة، ثم اسأل نفسك: هل النتيجة منطقية؟',
      ]
    : [
        `Read the question and pin down exactly what “${ctx.topic}” is asking for.`,
        'Write down what you are given before you start.',
        'Do one step at a time, then ask yourself: does this result make sense?',
      ];
}

function explanationOf(ctx: ExplainerContext): string[] {
  const ar = ctx.lang === 'ar';
  const out: string[] = [];

  for (const c of conceptsOf(ctx).slice(0, EXPLAINER_SHAPE.maxSteps - 1)) {
    out.push(ar ? `افهم أولاً: ${c}` : `First, understand: ${c}`);
  }
  const rule = rulesOf(ctx)[0];
  if (rule) out.push(ar ? `القاعدة التي تستخدمها: ${rule}` : `The rule you apply: ${rule}`);

  for (const step of genericSteps(ctx)) {
    if (out.length >= EXPLAINER_SHAPE.minSteps) break;
    out.push(step);
  }
  return out.slice(0, EXPLAINER_SHAPE.maxSteps);
}

function workedExampleOf(ctx: ExplainerContext, bigIdea: string): WorkedExample {
  const ar = ctx.lang === 'ar';
  const anchor = rulesOf(ctx)[0] ?? conceptsOf(ctx)[0] ?? ctx.topic;

  // Math: the bank supplies both the problem and the answer. The steps stay
  // method-only — inventing intermediate arithmetic the bank never carried is
  // how a worked example ends up contradicting its own answer.
  if (ctx.math && ctx.workedItem) {
    return {
      text: ctx.workedItem.text,
      steps: ar
        ? [
            'اكتب المعطيات كما وردت في السؤال دون تغيير.',
            `طبّق «${anchor}» خطوة واحدة في كل مرة، واكتب كل خطوة في سطر.`,
            'تحقّق من الناتج بتعويضه في السؤال الأصلي.',
          ]
        : [
            'Write the given values exactly as the question states them.',
            `Apply “${anchor}” one step at a time, each step on its own line.`,
            'Check the result by substituting it back into the original question.',
          ],
      answer: ctx.workedItem.answer,
    };
  }

  // Non-math, grounded: the curriculum's own definition is the answer.
  const term = termsOf(ctx)[0];
  if (term) {
    return {
      text: ar
        ? `ما المقصود بـ«${term.term}» في هذا الدرس؟`
        : `What does “${term.term}” mean in this lesson?`,
      steps: ar
        ? [
            'ارجع إلى موضع المصطلح في الدرس واقرأ الجملة التي حوله.',
            'اربطه بالفكرة المختصرة في أعلى الورقة.',
            'أعد صياغة التعريف بكلماتك أنت، ثم قارنه بالتعريف الأصلي.',
          ]
        : [
            'Find the term in the lesson and read the sentence around it.',
            'Connect it to the one-sentence idea at the top of this sheet.',
            'Restate the definition in your own words, then compare it with the original.',
          ],
      answer: term.meaning,
    };
  }

  // Ungrounded: the only thing we can honestly ask for is the idea itself.
  return {
    text: ar
      ? `اشرح فكرة «${ctx.topic}» بجملة واحدة كما لو كنت تشرحها لزميل.`
      : `Explain the idea of “${ctx.topic}” in one sentence, as if to a classmate.`,
    steps: genericSteps(ctx),
    answer: bigIdea,
  };
}

function misconceptionOf(ctx: ExplainerContext, bigIdea: string): Misconception {
  const ar = ctx.lang === 'ar';

  // The bank's distractors ARE hand-authored misconceptions — they were written
  // as the wrong answer a student actually gives, not as filler.
  const item = ctx.misconceptionItem;
  const wrong = item?.options?.find(o => o !== item.answer);
  if (item && wrong) {
    return {
      claim: ar
        ? `كثيرون يجيبون «${wrong}» عن: ${item.text}`
        : `A lot of students answer “${wrong}” to: ${item.text}`,
      correction: ar
        ? `الإجابة الصحيحة «${item.answer}». أعد الحل خطوة بخطوة وقارن أين اختلفت خطوتك عن الخطوة الصحيحة.`
        : `The correct answer is “${item.answer}”. Redo it step by step and find where your step diverged.`,
    };
  }

  const rule = rulesOf(ctx)[0];
  if (rule) {
    return {
      claim: ar
        ? `«${rule}» تنطبق في كل الحالات دون شروط.`
        : `“${rule}” applies in every case, with no conditions.`,
      correction: ar
        ? 'لها شروط. ارجع إلى شروط تطبيق القاعدة في الدرس وتأكّد منها قبل أن تستخدمها.'
        : 'It has conditions. Check the conditions stated in the lesson before you apply it.',
    };
  }

  return {
    claim: ar
      ? `«${ctx.topic}» مجرّد خطوات تُحفظ، ولا يهم لماذا نفعل كل خطوة.`
      : `“${ctx.topic}” is just steps to memorise; why each step happens does not matter.`,
    correction: ar
      ? `لكل خطوة سبب. ${bigIdea}`
      : `Every step has a reason. ${bigIdea}`,
  };
}

function checksOf(ctx: ExplainerContext): SelfCheckItem[] {
  const ar = ctx.lang === 'ar';
  const out: SelfCheckItem[] = [];

  if (ctx.math) {
    for (const p of ctx.practice.slice(0, EXPLAINER_SHAPE.checks)) {
      out.push({ text: p.text, answer: p.answer, answerSource: 'bank' });
    }
  } else {
    for (const t of termsOf(ctx).slice(0, EXPLAINER_SHAPE.checks)) {
      out.push({
        text: ar ? `عرّف «${t.term}» بجملة واحدة.` : `Define “${t.term}” in one sentence.`,
        answer: t.meaning,
        answerSource: 'curriculum',
      });
    }
  }

  // Pad to a stable count with open questions that carry NO answer. An omitted
  // answer prints no key; a guessed one prints a wrong key under a heading
  // that looks official.
  const open = ar
    ? [
        `اشرح «${ctx.topic}» بجملتين لزميل لم يحضر الحصة.`,
        `اذكر مثالاً واحداً على «${ctx.topic}» من عندك.`,
        `ما الخطأ الذي يجب أن تنتبه له في «${ctx.topic}»؟`,
      ]
    : [
        `Explain “${ctx.topic}” in two sentences to a classmate who missed the lesson.`,
        `Give one example of “${ctx.topic}” of your own.`,
        `What mistake do you need to watch out for in “${ctx.topic}”?`,
      ];
  for (const text of open) {
    if (out.length >= EXPLAINER_SHAPE.checks) break;
    out.push({ text });
  }
  return out;
}

export function buildExplainer(ctx: ExplainerContext): ExplainerBody {
  const ar = ctx.lang === 'ar';
  const bigIdea = bigIdeaOf(ctx);
  const keyWords = termsOf(ctx).slice(0, 3);

  return {
    title: ar ? `تبسيط الشرح – ${ctx.topic}` : `Simplified explanation – ${ctx.topic}`,
    bigIdea,
    explanation: explanationOf(ctx),
    // Omitted, not [], when the lesson prints no terms box — `missingFields`
    // does not require this field, and an empty array would render an empty
    // heading on the handout.
    ...(keyWords.length > 0 ? { keyWords } : {}),
    workedExample: workedExampleOf(ctx, bigIdea),
    misconception: misconceptionOf(ctx, bigIdea),
    checks: checksOf(ctx),
  };
}
