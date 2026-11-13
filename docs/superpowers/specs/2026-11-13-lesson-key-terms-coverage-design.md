# Science lessons cover every key term of the book — design

2026-11-13. Approach A («the book's terms as a checklist»), approved in chat. This is
sub-project 1 of three that answer a Grade 10 physics teacher's review of the
generated material; the other two (drawn physics figures; explanations for book-figure
slides) get their own specs.

## Why

A physics teacher graded the five tools (lesson plan, worksheet, quiz, slides, class
activity) for every Grade 10 physics lesson. Lesson plans and activities were all
«مناسب بلا أخطاء». Three findings are about **coverage**, not wrong content:

| Lesson | Tool | Finding |
|---|---|---|
| u2_l2 الحركة في بعدين | quiz | «يتجاهل مسائل زمن التحليق والمدى وأقصى ارتفاع» |
| u6_l2 خصائص الحركة الموجية | slides | «العرض ناقص جدًا: الانكسار والتداخل والحيود» (and الاستقطاب); «التركيز على مسائل دوبلر مثل الكتاب» |
| u2_l3 قوانين الحركة لنيوتن | slides | «شريحة 10: صورة Air Track دون ذكر علاقته بالجاذبية» |

The book already names what is missing. Each lesson's vocabulary in
`lib/curriculum/src/data/iqra_curriculum_g10_phys_sem{1,2}.json` (copied from the
lesson opener):

- u2_l2: المقذوفات، أقصى ارتفاع، زمن التحليق، المدى الأفقي، حركة دائرية منتظمة، تسارع مركزي
- u6_l2: انعكاس الموجة، انكسار الموجة، مبدأ تراكب الموجات، تداخل، حيود، استقطاب، تأثير دوبلر

## Where we start (checked 2026-11-13)

- The vocabulary reaches every prompt already, as a «المصطلحات:» list inside
  `additionalContext` (`buildGeneratorContext`, `services/kbContext.ts`). Nothing tells
  the model to *cover* it.
- **Slides.** The explanation section comes from `/generate/lesson-teaching`
  (`lessonTeachingPrompt.ts`), which asks for 3–5 concept slides
  (`TEACHING_CONCEPTS_MIN/MAX`). The app keeps at most 5 (`usableTeaching`,
  `services/lessonSlides.ts`, its own `TEACHING_CONCEPTS_MAX = 5`). Seven phenomena
  cannot fit in five slides of one idea each.
- A concept may carry `photo`, a 2–5 word English search phrase; the app finds a stock
  photo for it (`teachingPhotoTargets`). Nothing asks the slide's words to say what the
  photo shows — the air-track finding.
- **Quiz / worksheet / homework.** `quizPromptAr/En`, `worksheetPromptAr/En`
  (`artifacts/api-server/src/lib/prompts.ts`) say how many questions and of which types.
  Spreading questions over lessons exists only for a wide scope (`coverage.ts`); inside
  one lesson there is no rule, so the model can spend a whole quiz on one idea.
- The API has no knowledge base. The app does: a Grade 10 physics or chemistry KB
  lesson carries `keyTerms: { ar, en }[]` built from the same vocabulary
  (`lib/curriculum/src/catalogs/g10PhysSem1.ts`, `…Sem2.ts`, and the chemistry catalogs).
- Every generator screen reads its request fields off one grounding with
  `groundingRequestFields` (`services/kbContext.ts`), which already carries `lessonId`.

## Design

### 1. The terms travel with the request

- `groundingRequestFields` gains `keyTerms?: string[]`: the grounded lesson's
  `keyTerms`, in the content language (`ar` or `en`), **only when the lesson's own
  `subjectId` is `physics` or `chemistry`**. Any other subject, an ungrounded topic or a
  wide scope sends nothing, so their requests stay byte-for-byte as they are.
  Why only the sciences: an English lesson's vocabulary is a word list, not the ideas the
  lesson teaches, and a maths lesson's terms are names of rules the book already projects.
- The terms come from the grounding already resolved by lesson id, never from
  re-grounding the title (CLAUDE.md, «A lesson title does not identify a lesson»).
- New `artifacts/api-server/src/lib/keyTerms.ts`, modelled on `coverage.ts`:
  `parseKeyTerms(body): string[] | null`. Request-controlled, so bounded: an array of
  1–12 strings, each folded to one line, trimmed, 1–60 characters, duplicates dropped;
  anything else returns `null` and the prompts render nothing. Imports nothing that
  touches the OpenAI client.
- **Cache key.** `generationKey.ts` adds a `keyTermsHash` to the strict key when
  `parseKeyTerms` returns a list (same shape as `coverageHash`). Requests without terms
  hash exactly as today, so **no `PROMPT_VERSION_BY_KIND` bump**: only science lessons
  generate afresh, and the pool for every other subject is untouched.

### 2. What each generator is told

Each clause is rendered only when `parseKeyTerms` returns a list, in both languages,
and printed after the existing rules.

**Slides — `/generate/lesson-teaching`**
- The concept range's upper bound becomes `max(5, min(8, terms.length))`
  (`TEACHING_CONCEPTS_MAX_WITH_TERMS = 8`); the lower bound stays 3. So u6_l2's seven
  terms allow 3–7 slides, a lesson with four terms keeps 3–5, and without terms nothing
  changes.
- Rule: «هذه مصطلحات الدرس كما في الكتاب: … اشرح كل مصطلح منها في شريحة "concepts"
  واحدة على الأقل، ويجوز أن تجمع شريحةٌ مصطلحين متلازمين (مثل التداخل ومبدأ التراكب)
  إذا شرحتهما معًا. لا تُسقط مصطلحًا. حين يكون للمصطلح علاقة رياضية في هذا الدرس فليكن
  مثاله في "points" مسألة قصيرة بأرقام.»
- The worked example and practice stay one each (unchanged), but the rule asks that,
  when the lesson's terms include a calculable quantity, the worked example is about one
  of them. (For u6_l2 that steers it to Doppler, which is what the reviewer asked for;
  it is not forced to Doppler by name.)
- **Photo rule (all lessons, terms or not):** a concept that carries `photo` must have
  one of its `points` say what the photo shows and how it relates to the idea. This is
  the air-track finding. It applies to every subject because a stock photo with no words
  is the same problem anywhere; it changes the lesson-teaching prompt text for every
  lesson, so `PROMPT_VERSION_BY_KIND['lesson-teaching']` **does** move for this one
  rule (consequence below).
- `usableTeaching` (mobile) keeps up to 8 concepts instead of 5. The deck has no other
  concept cap; the plan checks `buildLessonDeck` and the PDF/PPTX exports for a hidden
  one.

**Quiz, worksheet, homework — `/generate/quiz|worksheet|homework`**
- Rule: «مصطلحات الدرس كما في الكتاب: … وزّع الأسئلة عليها بحيث يتناول كل مصطلح سؤالًا
  واحدًا على الأقل ما دام عدد الأسئلة يسمح؛ وإن كانت الأسئلة أقل من المصطلحات فاختر
  مصطلحات متباعدة في القائمة. المصطلح الذي يمثّل كمية تُقاس أو تُحسب (مثل زمن التحليق،
  المدى الأفقي، أقصى ارتفاع) يُسأل عنه بمسألة حسابية بأرقام في سؤال من النوع المسموح
  (اختيار من متعدد أو إجابة قصيرة).»
- The model decides which terms are quantities; nothing hand-labels them.
- The clause sits beside `coverageClauseAr/En` and never with it: a wide scope sends no
  `keyTerms` (section 1), so the two cannot both render.
- Top-ups (`quizTopUpBlock`, `worksheetTopUpBlock`) are unchanged.

**Not changed:** the lesson plan and the class activity (rated fine), evaluations
(their own generator and competency quotas), and the **offline generators**. Shipped
builds run live AI (`EXPO_PUBLIC_DEMO_MODE=false`, `AI_LIVE_MODE=true`). The offline
deck already projects the book's vocabulary, and the offline physics quiz draws from a
bank this change does not touch, so a paper made offline can still miss a term. The PR
says so, because CLAUDE.md warns that output differing by path is a known trap.

### 3. Measuring

- After a generation with terms, the route logs `{ kind, lessonId, terms, missing }`
  («key terms coverage»), where `missing` lists the terms that appear nowhere in the
  reply's text. Matching folds harakat, tatweel, hamza forms and the definite article
  («الـ»), and tests substring. It is a measurement only: nothing is retried, trimmed or
  refused on it.
- If the logs show terms regularly missing, approach C (ask once more for the missing
  terms, like `quizShortfall`) is the follow-up, decided then.

## Consequences

- **Pool cost.** Science requests (physics and chemistry, all grades the KB covers)
  miss the shared pool once per lesson and kind, then fill it again. The lesson-teaching
  version bump makes every lesson's next slides request regenerate once, all subjects,
  because of the photo rule. Both are one generation per lesson per kind, inside
  `AI_BUDGET_USD`.
- **Students.** Approved student explanations are read by lesson and language, not by
  this key, so they keep being served unchanged.
- **«ما الجديد»: none.** This changes the content of existing tools, not what a teacher
  can do; the PR body says so.
- **Revert.** Code and prompt text only, no migration: reverting the commit restores the
  old prompts; pooled artifacts made in between stay valid.

## Testing

- **API (`src/**/__tests__`):**
  - `parseKeyTerms`: accepts a clean list; rejects a non-array, over 12, an empty or
    over-60-character term; folds newlines; drops duplicates.
  - Prompt pins, Arabic and English: the term clause is present with terms and absent
    without, for lesson-teaching, quiz, worksheet and homework; the concept range reads
    3–5 without terms and up to 8 with seven terms; the photo rule is present in both
    languages.
  - `generationKey`: the key changes with the terms and is identical to today's for a
    request without them.
  - The coverage log's matcher tests each term whole: «حيود» is found in «يحدث الحيود
    عند…» (article added) and in «حُيود» (harakat); «انكسار الموجة» is found in «يحدث
    انكسار الموجة عند…», but «الانكسار» alone does not count as «انكسار الموجة».
- **Mobile (`services/__tests__`):** `groundingRequestFields` sends `keyTerms` for a
  physics and a chemistry lesson, in Arabic and English, and nothing for maths, English
  or an ungrounded topic; `usableTeaching` keeps 8 concepts and drops the ninth.
- **Live, before and after** (the session can reach the model API): the u2_l2 quiz
  (10 questions) and the u6_l2 slides' teaching section, Arabic, with the real prompt
  builders. Every question, step and key is read by hand (CLAUDE.md: check each answer
  key yourself), and the before/after is shown to the user: which terms each covers,
  whether the u2_l2 quiz now has time-of-flight, range and maximum-height calculations,
  whether u6_l2 now explains refraction, interference, diffraction and polarisation, and
  whether its worked example is a calculation.
- **Whole suite before the PR:** `pnpm run typecheck`; api-server `pnpm build && pnpm
  test`; mobile `pnpm test`.

## Decisions to confirm when you review

1. Physics and chemistry only (not biology, earth science or maths), because those are
   the lessons whose book vocabulary is a list of ideas. Biology can join once someone
   checks its vocabulary reads the same way.
2. The photo rule applies to every subject and so bumps the lesson-teaching prompt
   version for all lessons.
3. The worked example is steered to a calculable term, not forced to Doppler by name.
4. Coverage is measured, not enforced, in this change.
