/**
 * Per-format activity blueprints.
 *
 * The Activity generator used to build one template and swap a single noun
 * into it, so all five activity types came back byte-identical apart from the
 * title suffix and the group-size label — «لعبة تعليمية» had no rules, no
 * scoring and no win condition, and an `individual` activity still told the
 * teacher to «قسّم الطلاب حسب فردي» and assign roles inside each group.
 *
 * Each format now has its own steps, materials, tips, differentiation and
 * assessment, built around what the format is actually for:
 *
 * | Format       | Structure it exists to create                              |
 * | ------------ | ---------------------------------------------------------- |
 * | `individual` | silent retrieval → worked example → fading → self-explanation |
 * | `group`      | jigsaw: each member owns a part, plus random accountability |
 * | `discussion` | a contestable claim, think-pair-share, re-vote              |
 * | `hands-on`   | measure/construct a physical artefact, then reconcile it    |
 * | `game`       | explicit rules, rounds, scoring, a win condition            |
 * | `warmup`     | short prior-knowledge retrieval, not a compressed lesson    |
 *
 * `activityBlueprintIds` is the contract `generators.ts` and
 * `activityBlueprints.test.ts` share: every id here must produce a distinct
 * body, which the test asserts field by field.
 */
import type { ActivityStep } from './AIService.ts';
import type { KBLesson } from '../knowledgeBase.ts';
import type { Lang, PracticeWQ } from './mathPractice.ts';

export const ACTIVITY_BLUEPRINT_IDS = [
  'individual', 'group', 'discussion', 'hands-on', 'game', 'warmup',
] as const;

export type ActivityBlueprintId = typeof ACTIVITY_BLUEPRINT_IDS[number];

export interface ActivityBlueprintContext {
  topic: string;
  lang: Lang;
  /** Whether the concrete math bank applies — decides problem vs. concept steps. */
  math: boolean;
  /** Concrete items already drawn for this activity. May be empty (non-math). */
  practice: PracticeWQ[];
  /** The grounded lesson, when the topic resolved to one. */
  kb: KBLesson | null;
  /** Total minutes the steps must sum to exactly. */
  duration: number;
}

export interface ActivityBlueprint {
  /** Title suffix — the part after the topic. */
  titleSuffix: string;
  groupSize: string;
  objective: string;
  materials: string[];
  steps: ActivityStep[];
  teacherTips: string[];
  differentiation: string;
  assessment: string;
}

// ─── Duration helpers ────────────────────────────────────────────────────────

/**
 * Split `total` minutes across `weights`, as whole minutes summing to exactly
 * `total` — or to `weights.length` when `total` is smaller than that, since a
 * step of zero minutes is not a step. Callers report the SUM as the activity's
 * duration rather than what was asked for, so the two can never disagree.
 *
 * The old generator hard-coded 5 / stepDur / stepDur / 5 with
 * `stepDur = max(5, (duration - 10) / 2)`, so a 10-minute warm-up came back
 * claiming 10 minutes while its four steps summed to 20. Anything reading
 * `totalDuration` and anything adding up `durationMin` disagreed.
 */
export function distributeMinutes(total: number, weights: number[]): number[] {
  const n = weights.length;
  if (n === 0) return [];
  const safeTotal = Math.max(n, Math.round(total));
  const sumW = weights.reduce((s, w) => s + w, 0) || n;
  const raw = weights.map(w => (w / sumW) * safeTotal);
  const out = raw.map(v => Math.max(1, Math.floor(v)));
  let drift = safeTotal - out.reduce((s, v) => s + v, 0);
  // Hand the remainder to the steps with the largest fractional part first,
  // and take any overshoot back off the longest steps — never below 1 minute.
  const order = raw
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac)
    .map(x => x.i);
  let cursor = 0;
  while (drift > 0) { out[order[cursor % n]] += 1; drift -= 1; cursor += 1; }
  while (drift < 0) {
    const longest = out.indexOf(Math.max(...out));
    if (out[longest] <= 1) break;
    out[longest] -= 1; drift += 1;
  }
  return out;
}

function steps(
  titlesAndBodies: Array<[string, string]>,
  minutes: number[],
): ActivityStep[] {
  return titlesAndBodies.map(([title, description], i) => ({
    stepNumber: i + 1,
    title,
    description,
    durationMin: minutes[i],
  }));
}

// ─── Content helpers ─────────────────────────────────────────────────────────

/** A concrete item, or a topic-shaped placeholder when the bank has none. */
function item(ctx: ActivityBlueprintContext, i: number): PracticeWQ | null {
  return ctx.practice[i] ?? null;
}

function concepts(ctx: ActivityBlueprintContext, n: number): string[] {
  const list = ctx.lang === 'ar' ? ctx.kb?.keyConceptsAr : ctx.kb?.keyConceptsEn;
  return (list ?? []).slice(0, n);
}

function rules(ctx: ActivityBlueprintContext, n: number): string[] {
  const list = ctx.lang === 'ar' ? ctx.kb?.rulesAr : ctx.kb?.rulesEn;
  return (list ?? []).slice(0, n);
}

/**
 * Numbered sub-tasks for the jigsaw, one per home-group member.
 *
 * Math lessons split by problem, concept lessons by key concept — either way
 * each member has to come back with something the others do not have, which
 * is the whole point of the format.
 */
function jigsawParts(ctx: ActivityBlueprintContext): string[] {
  const ar = ctx.lang === 'ar';
  if (ctx.math && ctx.practice.length >= 2) {
    return ctx.practice.map(p => (ar ? `حلّ: ${p.text}` : `Solve: ${p.text}`));
  }
  const cs = concepts(ctx, 4);
  if (cs.length >= 2) {
    return cs.map(c => (ar ? `اشرح «${c}» بمثال من الكتاب` : `Explain “${c}” with a textbook example`));
  }
  return ar
    ? [
        `عرّف ${ctx.topic} بكلماتك`,
        `أعطِ مثالًا يوضّح ${ctx.topic}`,
        `اذكر خطأً شائعًا في ${ctx.topic}`,
        `اربط ${ctx.topic} بموقف حياتي`,
      ]
    : [
        `Define ${ctx.topic} in your own words`,
        `Give a worked example of ${ctx.topic}`,
        `Name one common error in ${ctx.topic}`,
        `Link ${ctx.topic} to a real situation`,
      ];
}

/**
 * The claim the discussion argues about.
 *
 * Deliberately a *misconception stated as an assertion* — a claim that is
 * partly reasonable is what produces a real split in the room. A true
 * statement gives unanimous agreement and no discussion.
 */
function contestableClaim(ctx: ActivityBlueprintContext): string {
  const ar = ctx.lang === 'ar';
  const first = item(ctx, 0);
  if (ctx.math && first?.options?.length) {
    const wrong = first.options.find(o => o !== first.answer);
    if (wrong) {
      return ar
        ? `«الإجابة الصحيحة عن: ${first.text} هي ${wrong}.» — هل توافق؟`
        : `“The answer to: ${first.text} is ${wrong}.” — Do you agree?`;
    }
  }
  const rule = rules(ctx, 1)[0];
  if (rule) {
    return ar
      ? `«${rule}» — هل تنطبق هذه القاعدة دائمًا، أم لها شروط؟`
      : `“${rule}” — Does this always hold, or does it have conditions?`;
  }
  const concept = concepts(ctx, 1)[0] ?? ctx.topic;
  return ar
    ? `«يمكن تطبيق ${concept} في كل الحالات دون استثناء.» — هل توافق؟`
    : `“${concept} can be applied in every case without exception.” — Do you agree?`;
}

/** What students physically build or measure in the hands-on format. */
function manipulativeTask(ctx: ActivityBlueprintContext): { task: string; check: string } {
  const ar = ctx.lang === 'ar';
  const first = item(ctx, 0);
  if (ctx.math && first) {
    return ar
      ? {
          task: `ارسم الشكل الوارد في المسألة على ورق مقوى بمقياس رسم 1 سم : 1 وحدة، ثم قصّه:\n${first.text}`,
          check: `قِس الناتج على النموذج بالمسطرة/المنقلة، ثم احسبه بالقاعدة. سجّل القيمتين والفرق بينهما (القيمة المحسوبة: ${first.answer}).`,
        }
      : {
          task: `Build the figure from this problem on card stock at 1 cm : 1 unit, then cut it out:\n${first.text}`,
          check: `Measure the result on your model with a ruler/protractor, then compute it with the rule. Record both values and the gap (computed value: ${first.answer}).`,
        };
  }
  const concept = concepts(ctx, 1)[0] ?? ctx.topic;
  return ar
    ? {
        task: `ابنِ نموذجًا ملموسًا يمثّل «${concept}» باستخدام المواد المتاحة (كرات وعيدان، بطاقات، أو رسم مجسّم على ورق مقوى).`,
        check: `اعرض النموذج وفسّر: أي جزء منه يمثّل أي عنصر في «${concept}»؟ وأين يختلف النموذج عن الواقع؟`,
      }
    : {
        task: `Build a physical model of “${concept}” from the available materials (balls and sticks, cards, or a card-stock construction).`,
        check: `Present the model and explain: which part represents which element of “${concept}”, and where does the model differ from reality?`,
      };
}

/** Question deck for the game, with the point value attached to each round. */
function gameQuestions(ctx: ActivityBlueprintContext): string[] {
  const ar = ctx.lang === 'ar';
  if (ctx.math && ctx.practice.length) {
    return ctx.practice.map(p => `${p.text}   ← (${ar ? 'الإجابة' : 'answer'}: ${p.answer})`);
  }
  const cs = concepts(ctx, 3);
  if (cs.length) {
    return cs.map(c => (ar ? `ما المقصود بـ«${c}»؟ وأعطِ مثالًا.` : `What is “${c}”? Give an example.`));
  }
  return ar
    ? [`عرّف ${ctx.topic}`, `أعطِ مثالًا على ${ctx.topic}`, `ما الخطأ الشائع في ${ctx.topic}؟`]
    : [`Define ${ctx.topic}`, `Give an example of ${ctx.topic}`, `What is a common error in ${ctx.topic}?`];
}

/** The prior-knowledge prompt a warm-up retrieves — never today's new content. */
function priorRecallPrompt(ctx: ActivityBlueprintContext): string {
  const ar = ctx.lang === 'ar';
  const prior = (ctx.kb?.objectives ?? []).slice(0, 1)[0];
  if (prior) {
    return ar
      ? `اكتب من ذاكرتك — الدفاتر مغلقة — ما تتذكره عن: ${prior}`
      : `From memory, notebooks closed — write what you recall about: ${prior}`;
  }
  return ar
    ? `اكتب من ذاكرتك — الدفاتر مغلقة — كل ما تتذكره عن ${ctx.topic} من الحصة السابقة (3 نقاط).`
    : `From memory, notebooks closed — write everything you recall about ${ctx.topic} from last lesson (3 points).`;
}

// ─── Blueprints ──────────────────────────────────────────────────────────────

function individualAr(ctx: ActivityBlueprintContext): ActivityBlueprint {
  const [a, b, c] = [item(ctx, 0), item(ctx, 1), item(ctx, 2)];
  const mins = distributeMinutes(ctx.duration, [1.2, 1.8, 3, 1.3]);
  const workedBody = ctx.math && a
    ? `اعرض هذا المثال **محلولًا بالكامل** على السبورة. لا يحلّه الطالب — بل يدرسه:\n${a.text}\nالحل خطوة بخطوة، ثم الناتج: ${a.answer}\nيكتب كل طالب بجانب كل خطوة: «لماذا هذه الخطوة؟» بجملة واحدة.`
    : `اعرض شرحًا نموذجيًا مكتملًا لـ«${concepts(ctx, 1)[0] ?? ctx.topic}» (من الكتاب أو من إعدادك). يدرسه الطالب صامتًا ويضع خطًا تحت الجملة التي يعتبرها مفتاح الفكرة، ثم يكتب سبب اختياره.`;
  const fadingBody = ctx.math && b
    ? `يعمل كل طالب بمفرده وبصمت:\n1) أكمل الحل الناقص: ${b.text} — الخطوة الأولى مكتوبة لك على الورقة، أكمل الباقي.\n2) حلّ كاملًا بلا مساعدة: ${c?.text ?? b.text}\n(للمعلم — الإجابات: ${b.answer}${c ? ` ؛ ${c.answer}` : ''})`
    : `يعمل كل طالب بمفرده وبصمت على ورقة العمل: السؤال الأول نصفه محلول (أكمله)، والثاني من دون أي مساعدة. لا نقاش ولا رفع أيدٍ خلال هذه الفترة.`;
  return {
    titleSuffix: 'عمل فردي',
    groupSize: 'فردي — كل طالب بمفرده',
    objective: ctx.math
      ? `أن يحلّ كل طالب مسائل ${ctx.topic} بمفرده وأن يبرّر خطوة واحدة من حله كتابيًا`
      : `أن يستحضر كل طالب مفاهيم ${ctx.topic} من ذاكرته ويشرحها بكلماته كتابيًا`,
    materials: ['دفتر الطالب', 'ورقة الاسترجاع (فارغة)', 'بطاقة المثال المحلول لكل طالب', 'ورقة عمل فردية متدرجة'],
    steps: steps([
      ['استرجاع صامت', `الدفاتر مغلقة. ${priorRecallPrompt(ctx)}\nلا تصحّح ولا تعلّق الآن — الهدف هو محاولة الاستحضار نفسها، وهي ما يثبّت المعلومة.`],
      ['دراسة مثال محلول', workedBody],
      ['تدرّب بتدرّج', fadingBody],
      ['اشرح لنفسك', `على ظهر الورقة يجيب كل طالب بجملتين: «ما أول خطوة قمت بها ولماذا كانت صحيحة؟» ثم «أين كدت أخطئ؟».\nتُجمع الأوراق — هذه هي بطاقة الخروج.`],
    ], mins),
    teacherTips: [
      'الصمت هنا جزء من النشاط لا خلل فيه: امنع النقاش ورفع الأيدي في خطوتَي 1 و3 حتى ينتهي الوقت.',
      'لا تعطِ الإجابة لطالب متوقف — أعده إلى المثال المحلول في خطوة 2 وأشر إلى الخطوة المقابلة.',
      'تجوّل بورقة فارغة وسجّل أسماء من توقّف وعند أي خطوة؛ هذه قائمة الدعم للحصة القادمة.',
    ],
    differentiation: 'للمتعثرين: امنحهم نسخة يظهر فيها نصف الحل في السؤال الثاني أيضًا (تلاشٍ أبطأ). للمتقدمين: احذف المثال المحلول واطلب منهم بدلًا منه كتابة مثال محلول من عندهم لزميل.',
    assessment: ctx.math
      ? `ورقة الاسترجاع + ورقة التدرّج المصحّحة فرديًا. الإجابات المرجعية: ${ctx.practice.map(p => p.answer).join(' ؛ ') || '—'}. ما يهمّ في بطاقة الخروج هو جودة التبرير لا صحة الناتج وحده.`
      : 'ورقة الاسترجاع (كم نقطة استحضرها الطالب دون الدفتر) + جملتا التبرير في بطاقة الخروج.',
  };
}

function groupAr(ctx: ActivityBlueprintContext): ActivityBlueprint {
  const parts = jigsawParts(ctx);
  const mins = distributeMinutes(ctx.duration, [1, 2.5, 2.5, 1.2]);
  return {
    titleSuffix: 'تعلّم تعاوني (جيقسو)',
    groupSize: 'مجموعات أساسية من 4 طلاب + مجموعات خبراء',
    objective: `أن تنتج كل مجموعة إجابة عن ${ctx.topic} لا تكتمل إلا بمساهمة كل فرد فيها`,
    materials: [
      'أربع بطاقات مهمة مختلفة لكل مجموعة (مرقّمة 1–4)',
      'أوراق مجموعات الخبراء',
      'لوح إجابة واحد لكل مجموعة أساسية',
      'كيس أرقام للمساءلة العشوائية',
    ],
    steps: steps([
      ['توزيع الأدوار والمهام', `قسّم الصف إلى مجموعات أساسية من 4. يأخذ كل فرد رقمًا (1–4) ومعه **مهمة مختلفة عن زملائه**:\n${parts.slice(0, 4).map((p, i) => `${i + 1}. ${p}`).join('\n')}\nأعلن الآن: لوح المجموعة لن يكتمل إن غاب أي جزء.`],
      ['مجموعات الخبراء', 'يترك الطلاب مجموعاتهم الأساسية ويجتمع كل أصحاب الرقم نفسه معًا (كل أصحاب الرقم 1 في مجموعة، وهكذا). يتقنون مهمتهم المشتركة ويتفقون على أفضل طريقة لشرحها — لا على نسخها.'],
      ['العودة والتركيب', 'يعود كل خبير إلى مجموعته الأساسية ويشرح جزءه لزملائه (90 ثانية لكل فرد، بالترتيب). تكتب المجموعة الإجابة الكاملة على اللوح — ولا تُقبل إجابة ينقصها جزء.'],
      ['مساءلة فردية عشوائية', 'اسحب رقمًا من الكيس ثم اسم مجموعة: الطالب صاحب هذا الرقم — وليس مقرّر المجموعة — هو من يعرض إجابة مجموعته كاملة. كرّرها مع 3 مجموعات.'],
    ], mins),
    teacherTips: [
      'المساءلة العشوائية في الخطوة الأخيرة هي ما يجعل الاعتماد المتبادل حقيقيًا؛ إن ألغيتها عاد النشاط طالبًا واحدًا يعمل وثلاثة يشاهدون.',
      'في مرحلة الخبراء تدخّل لتصحيح الفهم فورًا — الخبير الذي يفهم خطأً سينقل الخطأ إلى ثلاثة آخرين.',
      'اضبط مؤقتًا مرئيًا لكل مرحلة؛ أكثر ما يفشل الجيقسو هو تأخّر العودة من مجموعات الخبراء.',
    ],
    differentiation: 'وزّع البطاقات بقصد لا عشوائيًا: البطاقة الأقصر للطالب الذي يحتاج دعمًا (يظل مسؤولًا عن جزء حقيقي)، والبطاقة التي تتطلب ربطًا بين مفهومين للمتقدم. للمجموعات التي تنهي مبكرًا: اطلب منهم صياغة سؤال امتحان واحد يغطي الأجزاء الأربعة معًا.',
    assessment: `تُقيَّم المجموعة بإجابة الفرد الذي سُحب رقمه، لا بأفضل أفرادها. راجع ألواح المجموعات بحثًا عن جزء ناقص أو ضعيف باستمرار — هذا هو الجزء الذي يحتاج إعادة شرح للصف كله.${ctx.math && ctx.practice.length ? ` الإجابات: ${ctx.practice.map(p => p.answer).join(' ؛ ')}` : ''}`,
  };
}

function discussionAr(ctx: ActivityBlueprintContext): ActivityBlueprint {
  const claim = contestableClaim(ctx);
  const mins = distributeMinutes(ctx.duration, [1, 1.2, 3.4, 1.4]);
  return {
    titleSuffix: 'نقاش صفّي',
    groupSize: 'الصف كامل، مع مرحلة ثنائية',
    objective: `أن يبني الطالب موقفًا مبرّرًا من ادعاء حول ${ctx.topic}، وأن يغيّره أو يثبّته بناءً على حجة زميله`,
    materials: [
      'بطاقتان لكل طالب: «أوافق» / «لا أوافق»',
      'الادعاء مكتوبًا على السبورة أو معروضًا',
      'سبورة لتسجيل الحجج (عمودان)',
      'ورقة صغيرة لتدوين التبرير',
    ],
    steps: steps([
      ['اعرض الادعاء وصوّتوا', `اكتب هذا الادعاء على السبورة واتركه ظاهرًا طوال الحصة:\n«${claim}»\nتصويت أول برفع البطاقات — سجّل العدد في زاوية السبورة. لا تعلّق ولا تلمّح إلى الإجابة.`],
      ['فكّر بمفردك', 'دقيقتان صمتًا تامًا. يكتب كل طالب على ورقته: موقفي (أوافق / لا أوافق) + **سبب واحد**. لا يتكلم أحد بعد — من يتكلم مبكرًا يسرق تفكير من حوله.'],
      ['ناقش: ثنائي ثم الصف', `ثنائيات أولًا (دقيقتان): كل طالب يعرض سببه، ثم يعيد صياغة سبب زميله قبل الردّ عليه.\nثم نقاش صفّي تديره بهذه العبارات — لا بالتصحيح:\n• «من يستطيع إعادة صياغة ما قاله زميله بكلماته؟»\n• «ما الدليل الذي يسند رأيك؟»\n• «هل توجد حالة واحدة يفشل فيها هذا الادعاء؟»\n• «من غيّر رأيه؟ ما الذي غيّره؟»\nسجّل الحجج في عمودين على السبورة دون أن تحكم أيها الصحيح.`],
      ['أعيدوا التصويت واحسموا', 'تصويت ثانٍ بالبطاقات. قارنه بالعدد الأول واجعل التحوّل مرئيًا للصف. عندها فقط احسم الادعاء بدقة، مع تسمية الشرط الذي كان مفقودًا فيه.'],
    ], mins),
    teacherTips: [
      'الادعاء مصمَّم ليكون معقولًا وخاطئًا جزئيًا — لو اتفق الصف كله من أول تصويت فقد سقط النشاط؛ عدّل الادعاء ليصبح أكثر إغراءً.',
      'لا تصحّح أثناء الخطوة 3 مهما كان الخطأ واضحًا. تصحيحك المبكر ينهي النقاش فورًا ويعيد الصف إلى انتظار إجابتك.',
      'انتظر 5 ثوانٍ كاملة بعد كل سؤال قبل أن تنادي على أحد؛ هذه الثواني هي ما يُدخل الطلاب الأبطأ إلى النقاش.',
    ],
    differentiation: 'للمتردّدين في الكلام: امنحهم صيغة جاهزة على بطاقة («أوافق لأن…» / «لا أوافق لأن…» / «أتفق مع زميلي لكن…»). للمتقدمين: كلّفهم بالدفاع عن الموقف المعاكس لموقفهم الأول.',
    assessment: 'ليست الإجابة الصحيحة هي المقياس بل جودة التبرير: اجمع أوراق التبرير وصنّفها إلى (سبب مبني على قاعدة / سبب مبني على مثال / سبب بلا سند). وتحوّل الأصوات بين التصويتين مؤشّر مباشر على أثر النقاش.',
  };
}

function handsOnAr(ctx: ActivityBlueprintContext): ActivityBlueprint {
  const { task, check } = manipulativeTask(ctx);
  const mins = distributeMinutes(ctx.duration, [1, 3, 2, 1.2]);
  return {
    titleSuffix: 'نشاط تطبيقي عملي',
    groupSize: 'ثنائيات — يد واحدة تبني ويد تسجّل، ثم يتبادلان',
    objective: `أن ينتج الطالب نموذجًا ملموسًا مرتبطًا بـ${ctx.topic}، وأن يقارن ما قاسه بما تعطيه القاعدة ويفسّر الفرق`,
    materials: [
      'ورق مقوّى ومقص',
      'مسطرة ومنقلة',
      'خيط أو شريط قياس',
      'أقلام تحديد وشريط لاصق',
      'آلة حاسبة',
      'بطاقة تسجيل القياسات لكل ثنائي',
    ],
    steps: steps([
      ['جهّزوا المواد ووزّعوا الدورين', 'كل ثنائي يأخذ عدّة كاملة. حدّدا من يبني أولًا ومن يسجّل — ستتبادلان الدورين في منتصف الخطوة التالية. راجع قواعد السلامة في استخدام المقص.'],
      ['ابنِ / قِس', task],
      ['من القياس إلى القاعدة', `${check}\nاكتبا على بطاقة التسجيل: القيمة المقيسة، القيمة المحسوبة، الفرق بينهما، وسببًا واحدًا محتملًا للفرق (دقة القياس؟ مقياس الرسم؟ التقريب؟).`],
      ['اعرضوا وقارنوا', 'علّق الثنائيات نماذجها على الحائط مع بطاقات التسجيل. جولة سريعة: أي ثنائي حصل على أصغر فرق؟ وماذا فعل مختلفًا؟ اختم بالقاعدة مكتوبة على السبورة إلى جانب أحد النماذج.'],
    ], mins),
    teacherTips: [
      'الفرق بين القياس والحساب ليس خطأ الطالب — إنه محتوى الحصة. اجعل تفسير الفرق هو السؤال، لا إخفاءه.',
      'جهّز عدّتين إضافيتين: قطعة تتمزّق أو قياس يفسد سيوقف ثنائيًا بالكامل عن النشاط.',
      'صوّر ثلاثة نماذج بالهاتف قبل تفكيكها — تصلح كمرجع بصري في حصة المراجعة.',
    ],
    differentiation: 'للمتعثرين: امنحهم شكلًا مطبوعًا جاهزًا للقص بدل الرسم من الصفر، فيبدأ عملهم من القياس مباشرة. للمتقدمين: اطلب نموذجًا ثانيًا بمقياس رسم مختلف والتحقق من أن النسبة بقيت ثابتة.',
    assessment: 'بطاقة التسجيل هي المنتج المقيَّم: دقة القياس، صحة القيمة المحسوبة، ومعقولية تفسير الفرق. النموذج نفسه دليل على المشاركة لا على الفهم — لا تكتفِ به.',
  };
}

function gameAr(ctx: ActivityBlueprintContext): ActivityBlueprint {
  const qs = gameQuestions(ctx);
  const mins = distributeMinutes(ctx.duration, [1, 2.4, 2.6, 1.2]);
  return {
    titleSuffix: 'لعبة تعليمية تنافسية',
    groupSize: 'فرق من 4 طلاب — 5 إلى 7 فرق',
    objective: `أن يستدعي الطالب ${ctx.topic} تحت ضغط الوقت ضمن فريق، وأن يقرّر الفريق مستوى ثقته في إجابته`,
    materials: [
      'لوحة نتائج على السبورة (اسم كل فريق + عمود النقاط)',
      'مؤقت مرئي',
      'لوح صغير وقلم لكل فريق (الإجابة تُرفع، لا تُصرخ)',
      'بطاقات أسئلة الجولتين',
      'بطاقات المخاطرة (1 / 2 / 3 نقاط)',
    ],
    steps: steps([
      ['القواعد وتشكيل الفرق', `اكتب القواعد على السبورة قبل البدء:\n• الإجابة تُكتب على اللوح وتُرفع عند انتهاء المؤقت — الصراخ بالإجابة يُلغي نقطة الفريق.\n• كل أفراد الفريق يوقّعون على اللوح؛ الفريق يجيب، لا فرد فيه.\n• الجولة الأولى: كل سؤال بنقطة واحدة.\n• الجولة الثانية: الفريق يراهن 1 أو 2 أو 3 نقاط **قبل** رؤية السؤال — يربحها إن أصاب ويخسرها إن أخطأ.\n• الفائز: أعلى رصيد بعد الجولة الثانية.\nشكّل الفرق بنفسك لتكون متكافئة.`],
      ['الجولة الأولى — نقطة لكل سؤال', `أسئلة سريعة، 60 ثانية لكل سؤال، ترفع الألواح معًا:\n${qs.map((q, i) => `${i + 1}) ${q}`).join('\n')}\nحدّث لوحة النتائج بعد كل سؤال أمام الجميع — الرصيد الظاهر هو ما يبقي الفرق داخل اللعبة.`],
      ['الجولة الثانية — المخاطرة', 'يرفع كل فريق بطاقة رهانه (1 / 2 / 3) **قبل** أن تعرض السؤال. اعرض سؤالًا أصعب من أسئلة الجولة الأولى، 90 ثانية. الإجابة الصحيحة تضيف قيمة الرهان والخاطئة تطرحها. كرّرها مرتين.'],
      ['الحسم ومراجعة الأخطاء', 'أعلن الرصيد النهائي والفريق الفائز. ثم — وهذه أهم خطوة — ارجع إلى السؤال الذي أخطأت فيه أكثر الفرق، واطلب من فريق أصاب أن يشرح طريقته، ثم أعد طرح سؤال مشابه دون نقاط.'],
    ], mins),
    teacherTips: [
      'الرهان في الجولة الثانية ليس زينة: هو ما يجعل الفريق يقيس ثقته بمعرفته، وهو المعلومة الأهم لك.',
      'أعلن قاعدة «اللوح المرفوع بلا توقيع الجميع لا يُحتسب» من البداية، وإلا تحوّلت اللعبة إلى أسرع فرد في كل فريق.',
      'أوقف اللعب فور بدء الجدل حول النقاط: لوحة نتائج ظاهرة ومحدَّثة بعد كل سؤال تمنع هذا كليًا.',
      'اترك آخر 5 دقائق للمراجعة مهما تأخّر الوقت — بدونها تبقى المتعة وتضيع الفائدة.',
    ],
    differentiation: 'وزّع الفرق بحيث يضم كل فريق مستويات مختلفة. للمتعثرين: امنحهم دور «حارس اللوح» المسؤول عن كتابة الإجابة المتفق عليها بوضوح — دور حقيقي بلا ضغط الاستدعاء. للمتقدمين: اجعلهم «فريق التحكيم» في السؤال الأخير يحكمون على صحة الإجابات ويبرّرون حكمهم.',
    assessment: 'لوحة النتائج نفسها هي التقييم التكويني: السؤال الذي أسقط أكثر الفرق هو الذي يحتاج إعادة شرح، ومقدار الرهان يكشف من يعرف أنه يعرف ومن يخمّن بثقة. صوّر اللوحة قبل مسحها.',
  };
}

function warmupAr(ctx: ActivityBlueprintContext): ActivityBlueprint {
  const first = item(ctx, 0);
  const mins = distributeMinutes(ctx.duration, [2, 2, 1]);
  return {
    titleSuffix: 'تهيئة واسترجاع',
    groupSize: 'فردي ثم الصف كامل',
    objective: `أن يستحضر الطالب ما يلزمه من معرفة سابقة قبل الدخول في ${ctx.topic}`,
    materials: ['ورقة صغيرة لكل طالب', 'السبورة', 'مؤقت'],
    steps: steps([
      ['استرجاع من الذاكرة', `${priorRecallPrompt(ctx)}\nالدفاتر مغلقة تمامًا. المحاولة نفسها هي المقصودة — حتى الاستحضار الناقص يقوّي التثبيت أكثر من إعادة القراءة.`],
      ['تحقّق سريع', first
        ? `سؤال واحد على السبورة، محاولة فردية:\n${first.text}\n(للمعلم — الإجابة: ${first.answer})\nامسح الصف بنظرة: كم طالبًا وصل؟ لا تصحّح فرديًا الآن.`
        : `سؤال واحد على السبورة: «${(ctx.kb?.keyTerms ?? [])[0]?.definitionAr ? `ما المصطلح الذي ينطبق عليه هذا التعريف: ${(ctx.kb!.keyTerms)[0].definitionAr}` : `اذكر مثالًا واحدًا على ${ctx.topic} وسبب اختيارك له`}»\nيكتب الجميع، وامسح الصف بنظرة قبل أن تنتقل.`],
      ['اربط بدرس اليوم', `اكتب على السبورة جملة واحدة تصل ما استرجعه الطلاب بهدف حصة اليوم: «كنّا نعرف … واليوم سنستخدمه لـ ${ctx.topic}». لا تشرح الجديد الآن — هذه تهيئة لا حصة مصغّرة.`],
    ], mins),
    teacherTips: [
      'الدفاتر مغلقة في الخطوة الأولى وإلا تحوّل الاسترجاع إلى نسخ، وأثره التعليمي يسقط بالكامل.',
      'لا تصحّح فرديًا هنا؛ التهيئة تعطيك صورة الصف لا تشخيص كل طالب.',
      'إن لم يستحضر أكثر من نصف الصف الأساسيات، عدّل خطة الحصة الآن لا بعدها.',
    ],
    differentiation: 'للمتعثرين: امنحهم بادئة جملة أو مصطلحًا واحدًا على السبورة كنقطة انطلاق. للمتقدمين: اطلب مثالًا مضادًا بدل الاسترجاع المباشر.',
    assessment: 'نظرة ماسحة على الأوراق: كم طالبًا استحضر الأساس المطلوب؟ الرقم يقرّر إن كنت ستبدأ الدرس الجديد أو تراجع 5 دقائق أولًا.',
  };
}

// ─── English ─────────────────────────────────────────────────────────────────

function individualEn(ctx: ActivityBlueprintContext): ActivityBlueprint {
  const [a, b, c] = [item(ctx, 0), item(ctx, 1), item(ctx, 2)];
  const mins = distributeMinutes(ctx.duration, [1.2, 1.8, 3, 1.3]);
  const workedBody = ctx.math && a
    ? `Put this on the board **fully solved**. Students do not solve it — they study it:\n${a.text}\nStep-by-step working, then the result: ${a.answer}\nEach student writes one sentence beside every step: “why this step?”`
    : `Display a complete model explanation of “${concepts(ctx, 1)[0] ?? ctx.topic}” (from the textbook or your own). Students read it silently, underline the sentence they judge to be the key idea, then write why.`;
  const fadingBody = ctx.math && b
    ? `Everyone works alone, in silence:\n1) Complete the partial solution: ${b.text} — the first step is written for you, finish it.\n2) Solve unaided: ${c?.text ?? b.text}\n(Teacher keys: ${b.answer}${c ? ` ; ${c.answer}` : ''})`
    : 'Everyone works alone and in silence on the worksheet: the first item is half-solved (complete it), the second is unaided. No talking, no hands up during this stretch.';
  return {
    titleSuffix: 'Individual Work',
    groupSize: 'Individual — each student alone',
    objective: ctx.math
      ? `Each student solves ${ctx.topic} problems unaided and justifies one step of their own working in writing`
      : `Each student retrieves ${ctx.topic} from memory and explains it in their own written words`,
    materials: ['Student notebook', 'Blank retrieval slip', 'Worked-example card per student', 'Faded individual worksheet'],
    steps: steps([
      ['Silent retrieval', `Notebooks closed. ${priorRecallPrompt(ctx)}\nDo not mark or comment yet — the attempt itself is the point, and it is what makes the knowledge stick.`],
      ['Study a worked example', workedBody],
      ['Faded practice', fadingBody],
      ['Self-explanation', 'On the back of the sheet, two sentences each: “What was my first step and why was it legal?” then “Where did I nearly go wrong?”\nCollect the sheets — this is the exit ticket.'],
    ], mins),
    teacherTips: [
      'The silence is the activity, not a failure of it: block talking and hands-up in steps 1 and 3 until time is called.',
      'Never hand a stuck student the answer — send them back to the worked example in step 2 and point at the matching step.',
      'Circulate with a blank sheet and note who stalled and at which step; that list is next lesson’s support group.',
    ],
    differentiation: 'Support: give a version where the second item is also half-solved (slower fading). Stretch: remove the worked example and ask them to author one for a classmate instead.',
    assessment: ctx.math
      ? `Retrieval slip plus the individually marked faded worksheet. Keys: ${ctx.practice.map(p => p.answer).join(' ; ') || '—'}. On the exit ticket, judge the quality of the justification, not just a correct result.`
      : 'The retrieval slip (how much was recalled without the notebook) plus the two justification sentences on the exit ticket.',
  };
}

function groupEn(ctx: ActivityBlueprintContext): ActivityBlueprint {
  const parts = jigsawParts(ctx);
  const mins = distributeMinutes(ctx.duration, [1, 2.5, 2.5, 1.2]);
  return {
    titleSuffix: 'Collaborative Jigsaw',
    groupSize: 'Home groups of 4, plus expert groups',
    objective: `Each group produces one ${ctx.topic} answer that cannot be completed without every member’s part`,
    materials: [
      'Four different task cards per group (numbered 1–4)',
      'Expert-group worksheets',
      'One group answer board per home group',
      'Number draw for random accountability',
    ],
    steps: steps([
      ['Assign roles and parts', `Split the class into home groups of 4. Each member takes a number (1–4) and a **different** task from their teammates:\n${parts.slice(0, 4).map((p, i) => `${i + 1}. ${p}`).join('\n')}\nAnnounce now: the group board cannot be completed if any part is missing.`],
      ['Expert groups', 'Students leave their home groups; everyone holding the same number meets together (all 1s in one group, and so on). They master their shared task and agree how best to teach it — not how to copy it.'],
      ['Regroup and assemble', 'Each expert returns to their home group and teaches their part (90 seconds each, in order). The group writes the full answer on its board — an answer missing a part is not accepted.'],
      ['Random individual accountability', 'Draw a number, then name a group: the student holding that number — not the group’s presenter — reports the group’s whole answer. Repeat with three groups.'],
    ], mins),
    teacherTips: [
      'The random call in the last step is what makes the interdependence real; drop it and the activity reverts to one student working while three watch.',
      'Intervene during the expert stage to correct misunderstandings immediately — an expert who learns it wrong teaches it wrong to three others.',
      'Run a visible timer per stage; the usual failure of a jigsaw is experts returning late.',
    ],
    differentiation: 'Hand out the cards deliberately, not at random: the shortest card to a student who needs support (still a real part they own), the card requiring two concepts to be linked to a stronger student. Early finishers: have them write one exam question covering all four parts at once.',
    assessment: `Grade the group on the answer given by the student whose number was drawn, not on its strongest member. Scan the group boards for a part that is consistently missing or weak — that is the part to re-teach to the whole class.${ctx.math && ctx.practice.length ? ` Keys: ${ctx.practice.map(p => p.answer).join(' ; ')}` : ''}`,
  };
}

function discussionEn(ctx: ActivityBlueprintContext): ActivityBlueprint {
  const claim = contestableClaim(ctx);
  const mins = distributeMinutes(ctx.duration, [1, 1.2, 3.4, 1.4]);
  return {
    titleSuffix: 'Class Discussion',
    groupSize: 'Whole class, with a paired stage',
    objective: `Students build a justified position on a claim about ${ctx.topic}, then hold or change it on the strength of a classmate’s argument`,
    materials: [
      'Two cards per student: “Agree” / “Disagree”',
      'The claim written on the board and left up',
      'Board space for two columns of arguments',
      'Slip for writing the justification',
    ],
    steps: steps([
      ['Post the claim and vote', `Write this claim on the board and leave it visible for the whole lesson:\n“${claim}”\nFirst vote by raised cards — record the count in the corner of the board. Do not comment or hint at the answer.`],
      ['Think alone', 'Two minutes of complete silence. Each student writes on their slip: my position (agree / disagree) plus **one reason**. Nobody speaks yet — early talkers steal the thinking of everyone around them.'],
      ['Discuss: pairs, then class', `Pairs first (two minutes): each states their reason, then restates their partner’s reason before responding to it.\nThen whole-class discussion, run with these moves — not with corrections:\n• “Who can put what your classmate just said in their own words?”\n• “What evidence supports that?”\n• “Is there a single case where this claim fails?”\n• “Who changed their mind? What changed it?”\nRecord arguments in two columns without ruling on which is right.`],
      ['Re-vote and settle it', 'Second vote by cards. Compare it with the first count and make the shift visible to the class. Only now settle the claim precisely, naming the condition it was missing.'],
    ], mins),
    teacherTips: [
      'The claim is built to be plausible and partly wrong — if the class agrees unanimously on the first vote the activity has failed; make the claim more tempting.',
      'Do not correct during step 3, however obvious the error. An early correction ends the discussion and puts the class back to waiting for your answer.',
      'Wait a full 5 seconds after each question before calling on anyone; those seconds are what bring slower processors into the discussion.',
    ],
    differentiation: 'For reluctant talkers: hand them sentence stems on a card (“I agree because…” / “I disagree because…” / “I agree with my partner but…”). Stretch: assign them to argue the opposite of their own first position.',
    assessment: 'Correctness is not the measure — the quality of justification is: collect the slips and sort them into (reason grounded in a rule / reason grounded in an example / reason with no support). The swing between the two votes is a direct read on what the discussion did.',
  };
}

function handsOnEn(ctx: ActivityBlueprintContext): ActivityBlueprint {
  const { task, check } = manipulativeTask(ctx);
  const mins = distributeMinutes(ctx.duration, [1, 3, 2, 1.2]);
  return {
    titleSuffix: 'Hands-on Build',
    groupSize: 'Pairs — one builds, one records, then swap',
    objective: `Students produce a physical model tied to ${ctx.topic}, then compare what they measured with what the rule predicts and account for the gap`,
    materials: [
      'Card stock and scissors',
      'Ruler and protractor',
      'String or tape measure',
      'Markers and adhesive tape',
      'Calculator',
      'Measurement record card per pair',
    ],
    steps: steps([
      ['Set up and split the roles', 'Each pair takes a full kit. Decide who builds first and who records — you will swap halfway through the next step. Review scissor safety.'],
      ['Build / measure', task],
      ['From measurement to rule', `${check}\nOn the record card write: measured value, computed value, the gap, and one plausible cause of the gap (measurement precision? scale? rounding?).`],
      ['Display and compare', 'Pairs post their models on the wall with their record cards. Quick tour: which pair got the smallest gap, and what did they do differently? Close with the rule written on the board next to one of the models.'],
    ], mins),
    teacherTips: [
      'The gap between measured and computed is not student error — it is the content of the lesson. Make explaining the gap the question rather than hiding it.',
      'Prepare two spare kits: one torn piece or one spoiled measurement stops a pair completely.',
      'Photograph three models before they are dismantled — they make a useful visual reference in the revision lesson.',
    ],
    differentiation: 'Support: give a pre-printed figure to cut out instead of drawing from scratch, so their work starts at measuring. Stretch: require a second model at a different scale and a check that the ratio held.',
    assessment: 'The record card is the assessed product: measurement accuracy, correctness of the computed value, and plausibility of the explanation for the gap. The model itself evidences participation, not understanding — do not stop there.',
  };
}

function gameEn(ctx: ActivityBlueprintContext): ActivityBlueprint {
  const qs = gameQuestions(ctx);
  const mins = distributeMinutes(ctx.duration, [1, 2.4, 2.6, 1.2]);
  return {
    titleSuffix: 'Competitive Learning Game',
    groupSize: 'Teams of 4 — five to seven teams',
    objective: `Students retrieve ${ctx.topic} under time pressure as a team, and the team decides how confident it is in its own answer`,
    materials: [
      'Scoreboard on the board (team name + points column)',
      'Visible timer',
      'A mini whiteboard and marker per team (answers are raised, not shouted)',
      'Question cards for both rounds',
      'Wager cards (1 / 2 / 3 points)',
    ],
    steps: steps([
      ['Rules and team formation', `Write the rules on the board before starting:\n• Answers are written on the board and raised when the timer ends — shouting an answer costs the team a point.\n• Every team member signs the board; the team answers, not one member.\n• Round 1: one point per question.\n• Round 2: the team wagers 1, 2 or 3 points **before** seeing the question — won if right, lost if wrong.\n• Winner: highest total after round 2.\nForm the teams yourself so they are evenly matched.`],
      ['Round 1 — one point each', `Fast questions, 60 seconds each, boards raised together:\n${qs.map((q, i) => `${i + 1}) ${q}`).join('\n')}\nUpdate the scoreboard after every question in full view — the visible score is what keeps teams in the game.`],
      ['Round 2 — the wager', 'Each team raises its wager card (1 / 2 / 3) **before** you show the question. Show a question harder than round 1, 90 seconds. A correct answer adds the wager; a wrong one subtracts it. Run it twice.'],
      ['Settle and review the misses', 'Announce final scores and the winning team. Then — the most important step — return to the question most teams got wrong, have a team that got it right explain their method, and re-ask a similar question with no points attached.'],
    ], mins),
    teacherTips: [
      'The round-2 wager is not decoration: it forces a team to measure its confidence against its knowledge, and that is the most useful signal you get.',
      'Announce the “a raised board without every signature does not count” rule from the outset, or the game becomes the fastest individual on each team.',
      'Stop play the moment an argument about points starts: a visible scoreboard updated after every question prevents this entirely.',
      'Protect the last 5 minutes for the review however late you are running — without it the fun stays and the learning does not.',
    ],
    differentiation: 'Build mixed-ability teams. Support: give them the “board keeper” role, responsible for writing the agreed answer legibly — a real job without the pressure of recall. Stretch: make them the “adjudication team” on the final question, ruling on whether answers are correct and justifying the ruling.',
    assessment: 'The scoreboard is the formative assessment: the question that took down the most teams is the one to re-teach, and wager size reveals who knows that they know versus who guesses confidently. Photograph the board before wiping it.',
  };
}

function warmupEn(ctx: ActivityBlueprintContext): ActivityBlueprint {
  const first = item(ctx, 0);
  const mins = distributeMinutes(ctx.duration, [2, 2, 1]);
  const term = (ctx.kb?.keyTerms ?? [])[0];
  return {
    titleSuffix: 'Warm-up & Retrieval',
    groupSize: 'Individual, then whole class',
    objective: `Students retrieve the prior knowledge they need before ${ctx.topic} begins`,
    materials: ['A small slip per student', 'The board', 'Timer'],
    steps: steps([
      ['Retrieve from memory', `${priorRecallPrompt(ctx)}\nNotebooks fully closed. The attempt is the point — even partial recall strengthens retention more than re-reading does.`],
      ['Quick check', first
        ? `One question on the board, individual attempt:\n${first.text}\n(Teacher key: ${first.answer})\nScan the room: how many got there? Do not mark individually yet.`
        : `One question on the board: “${term?.definitionEn ? `Which term matches this definition: ${term.definitionEn}` : `Give one example of ${ctx.topic} and say why you chose it`}”\nEveryone writes; scan the room before moving on.`],
      ['Bridge to today', `Write one sentence on the board joining what they retrieved to today’s objective: “We already knew … and today we use it for ${ctx.topic}.” Do not teach the new content here — this is a warm-up, not a miniature lesson.`],
    ], mins),
    teacherTips: [
      'Notebooks closed in step 1, or retrieval becomes copying and its learning effect disappears entirely.',
      'Do not mark individually here; a warm-up gives you the shape of the class, not a diagnosis of each student.',
      'If more than half the class cannot retrieve the basics, adjust the lesson plan now rather than afterwards.',
    ],
    differentiation: 'Support: give a sentence stem or one key term on the board as a starting point. Stretch: ask for a counter-example instead of straight recall.',
    assessment: 'A scan of the slips: how many students retrieved the required basis? That number decides whether you start the new content or spend five minutes reviewing first.',
  };
}

// ─── Registry ────────────────────────────────────────────────────────────────

const BUILDERS: Record<ActivityBlueprintId, Record<Lang, (ctx: ActivityBlueprintContext) => ActivityBlueprint>> = {
  individual: { ar: individualAr, en: individualEn },
  group: { ar: groupAr, en: groupEn },
  discussion: { ar: discussionAr, en: discussionEn },
  'hands-on': { ar: handsOnAr, en: handsOnEn },
  game: { ar: gameAr, en: gameEn },
  warmup: { ar: warmupAr, en: warmupEn },
};

export function isActivityBlueprintId(value: unknown): value is ActivityBlueprintId {
  return typeof value === 'string'
    && (ACTIVITY_BLUEPRINT_IDS as readonly string[]).includes(value);
}

/**
 * Build the blueprint for one activity format.
 *
 * Unknown ids fall back to `group` rather than throwing: with live AI the
 * request can carry a format the picker never offered, and a cooperative
 * activity is a safer default than a crash — the caller still reports the
 * requested type verbatim, so nothing is mislabelled.
 */
export function buildActivityBlueprint(
  id: string,
  ctx: ActivityBlueprintContext,
): ActivityBlueprint {
  const key: ActivityBlueprintId = isActivityBlueprintId(id) ? id : 'group';
  return BUILDERS[key][ctx.lang](ctx);
}
